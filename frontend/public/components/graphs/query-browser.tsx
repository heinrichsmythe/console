import * as React from 'react';
import * as _ from 'lodash-es';
import { Chart, ChartArea, ChartAxis, ChartGroup, ChartTheme } from '@patternfly/react-charts';

// This is not yet available as part of PatternFly
import { VictorySelectionContainer } from 'victory-selection-container';

import { Dropdown, humanizeNumber, LoadingInline, useRefWidth } from '../utils';
import { formatPrometheusDuration, parsePrometheusDuration, twentyFourHourTime } from '../utils/datetime';
import { PrometheusEndpoint } from './helpers';
import { usePrometheusPoll } from './prometheus-poll-hook';
import { PrometheusGraph } from './prometheus-graph';
import { areaTheme } from './themes';

const spans = ['5m', '15m', '30m', '1h', '2h', '6h', '12h', '1d', '2d', '1w', '2w'];
const dropdownItems = _.zipObject(spans, spans);

const theme = Object.assign({}, ChartTheme.light.multi, areaTheme, {
  independentAxis: {
    style: {
      grid: {stroke: '#ededed'},
    },
  },
});

const SpanControls = ({defaultSpanText, onChange, span}) => {
  const [isValid, setIsValid] = React.useState(true);
  const [text, setText] = React.useState(formatPrometheusDuration(span));

  React.useEffect(() => {
    setText(formatPrometheusDuration(span));
  }, [span]);

  const setSpan = newText => {
    const newSpan = parsePrometheusDuration(newText);
    const newIsValid = (newSpan > 0);
    setIsValid(newIsValid);
    setText(newText);
    if (newIsValid && newSpan !== span) {
      onChange(newSpan);
    }
  };

  return <React.Fragment>
    <div className={isValid ? '' : 'has-error'}>
      <input
        className="form-control query-browser__span-text"
        onChange={e => setSpan(e.target.value)}
        type="text"
        value={text}
      />
    </div>
    <Dropdown
      buttonClassName="btn-default form-control query-browser__span-dropdown"
      items={dropdownItems}
      menuClassName="dropdown-menu-right query-browser__span-dropdown-menu"
      onChange={setSpan}
      noSelection={true}
    />
    <button
      className="btn btn-default query-browser__span-reset"
      onClick={() => setSpan(defaultSpanText)}
      type="button"
    >Reset Zoom</button>
  </React.Fragment>;
};

const Graph: React.FC<GraphProps> = ({colors, domain, data, onZoom, query}) => {
  const [containerRef, width] = useRefWidth();

  return <PrometheusGraph linkToPrometheusUI={false} query={query}>
    <div ref={containerRef} style={{width: '100%'}}>
      <Chart
        containerComponent={<VictorySelectionContainer onSelection={(points, range) => onZoom(range)} />}
        domain={domain}
        domainPadding={{y: 20}}
        height={200}
        width={width}
        theme={theme}
        scale={{x: 'time', y: 'linear'}}
      >
        <ChartAxis tickCount={5} tickFormat={twentyFourHourTime} />
        <ChartAxis dependentAxis tickCount={5} tickFormat={humanizeNumber} />
        <ChartGroup colorScale={colors}>
          {_.map(data, ({values}, i) => <ChartArea key={i} data={values} />)}
        </ChartGroup>
      </Chart>
    </div>
  </PrometheusGraph>;
};

export const QueryBrowser: React.FC<QueryBrowserProps> = ({colors, GraphLink, metric, onDataUpdate, query, samples, timeout, timespan}) => {
  // For the default time span, use the first of the suggested span options that is at least as long as timespan
  const defaultSpanText = spans.find(s => parsePrometheusDuration(s) >= timespan);

  const [domain, setDomain] = React.useState();
  const [graphData, setGraphData] = React.useState();
  const [span, setSpan] = React.useState(parsePrometheusDuration(defaultSpanText));
  const [updating, setUpdating] = React.useState(true);

  const endTime = _.get(domain, 'x[1]');

  const [data, error] = usePrometheusPoll({
    // If an end time was set, stop polling since we are no longer displaying the latest data. Otherwise use a polling
    // interval relative to the graph's timespan, but not less than 5s.
    delay: endTime ? null : Math.max(span / 120, 5000),
    endTime,
    endpoint: PrometheusEndpoint.QUERY_RANGE,
    samples,
    query,
    timeout,
    timespan: span,
  });

  React.useEffect(() => {
    const result = _.get(data, 'data.result');
    if (!_.isEmpty(result)) {
      // Work out which labels have different values for different metrics
      const allLabels = _.map(result, 'metric');
      const allLabelKeys = _.uniq(_.flatMap(allLabels, _.keys));
      const differingLabelKeys = _.filter(allLabelKeys, k => _.uniqBy(allLabels, k).length > 1);

      const newGraphData = [];
      _.each(result, d => {
        const labels = _.omit(d.metric, '__name__');

        // If metric prop is specified, ignore all other metrics
        if (metric && _.some(labels, (v, k) => _.get(metric, k) !== v)) {
          return;
        }

        // Just show labels that differ between metrics to keep the name shorter
        const name = _.map(_.pick(labels, differingLabelKeys), (v, k) => `${k}="${v}"`).join(',');

        const values = _.map(d.values, v => ({
          x: new Date(v[0] * 1000),
          y: parseFloat(v[1]),
        }));

        // The data may have missing values, so we fill those gaps with nulls so that the graph correctly shows the
        // missing values as gaps in the line
        const start = Number(_.get(values, '[0].x'));
        const end = Number(_.get(_.last(values), 'x'));
        const step = span / samples;
        _.range(start, end, step).map((t, i) => {
          const x = new Date(t);
          if (_.get(values, [i, 'x']) > x) {
            values.splice(i, 0, {x, y: null});
          }
        });

        newGraphData.push({name, values});
      });

      setGraphData(newGraphData);

      if (onDataUpdate) {
        onDataUpdate(result);
      }
    }
    setUpdating(false);

    // Only trigger when data is updated
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const onSpanChange = newSpan => {
    setDomain(undefined);
    setSpan(newSpan);
    setUpdating(true);
  };

  const onZoom = ({x, y}) => {
    setDomain({x, y});
    setSpan(x[1] - x[0]);
    setUpdating(true);
  };

  const graphDomain = domain || {x: [Date.now() - span, Date.now()], y: undefined};

  return <div className="query-browser__wrapper">
    <div className="query-browser__header">
      <SpanControls defaultSpanText={defaultSpanText} onChange={onSpanChange} span={span} />
      <div className="query-browser__loading">
        {updating && <LoadingInline />}
      </div>
      <div className="query-browser__external-link">
        {GraphLink}
      </div>
    </div>
    {error && <div className="alert alert-danger query-browser__error">
      <span className="pficon pficon-error-circle-o" aria-hidden="true"></span>{_.get(error, 'json.error', error.message)}
    </div>}
    <Graph colors={colors} data={graphData} domain={graphDomain} onZoom={onZoom} query={query} />
  </div>;
};

type Domain = {
  x: [number, number];
  y: [number, number];
};

type GraphDataPoint = {
  name?: string;
  x: Date;
  y: number;
};

type GraphDataMetric = {
  metric: {[key: string]: string}[];
  values: GraphDataPoint[];
};

type GraphProps = {
  colors: string[];
  data: {
    name: string;
    values: GraphDataPoint[];
  }[];
  domain: Domain;
  onZoom: (range: Domain) => void;
  query: string;
};

type QueryBrowserProps = {
  colors: string[];
  GraphLink: React.ComponentType<any>;
  metric: string;
  onDataUpdate: (data: GraphDataMetric) => void;
  query: string;
  samples?: number;
  timeout?: number;
  timespan: number;
};
