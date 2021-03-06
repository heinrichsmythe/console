import * as React from 'react';
import * as _ from 'lodash-es';

import { connectToFlags } from '../reducers/features';
import { Conditions } from './conditions';
import { FLAGS } from '../const';
import { ColHead, DetailsPage, List, ListHeader, ListPage } from './factory';
import { Kebab, navFactory, ResourceKebab, SectionHeading, ResourceLink, ResourceSummary, Selector, StatusIconAndText } from './utils';
import { ResourceEventStream } from './events';

const pvcPhase = pvc => pvc.status.phase;

const { common, ExpandPVC } = Kebab.factory;
const menuActions = [ExpandPVC, ...common];

const PVCStatus = ({pvc}) => {
  const phase = pvcPhase(pvc);
  return <StatusIconAndText status={phase} />;
};

const Header = props => <ListHeader>
  <ColHead {...props} className="col-lg-2 col-md-2 col-sm-4 col-xs-6" sortField="metadata.name">Name</ColHead>
  <ColHead {...props} className="col-lg-2 col-md-2 col-sm-4 col-xs-6" sortField="metadata.namespace">Namespace</ColHead>
  <ColHead {...props} className="col-lg-2 col-md-2 col-sm-4 hidden-xs" sortField="status.phase">Status</ColHead>
  <ColHead {...props} className="col-lg-3 col-md-3 hidden-sm hidden-xs" sortField="spec.volumeName">Persistent Volume</ColHead>
  <ColHead {...props} className="col-lg-3 col-md-3 hidden-sm hidden-xs" sortField="spec.resources.requests.storage">Requested</ColHead>
</ListHeader>;

const kind = 'PersistentVolumeClaim';
const Row = ({obj}) => <div className="row co-resource-list__item">
  <div className="col-lg-2 col-md-2 col-sm-4 col-xs-6">
    <ResourceLink kind={kind} name={obj.metadata.name} namespace={obj.metadata.namespace} title={obj.metadata.name} />
  </div>
  <div className="col-lg-2 col-md-2 col-sm-4 col-xs-6 co-break-word">
    <ResourceLink kind="Namespace" name={obj.metadata.namespace} title={obj.metadata.namespace} />
  </div>
  <div className="col-lg-2 col-md-2 col-sm-4 hidden-xs">
    <PVCStatus pvc={obj} />
  </div>
  <div className="col-lg-3 col-md-3 hidden-sm hidden-xs">
    { _.get(obj, 'spec.volumeName') ?
      <ResourceLink kind="PersistentVolume" name={obj.spec.volumeName} title={obj.spec.volumeName} />:
      <div className="text-muted">No Persistent Volume</div>
    }
  </div>
  <div className="col-lg-3 col-md-3 hidden-sm hidden-xs">
    {_.get(obj, 'spec.resources.requests.storage', '-')}
  </div>
  <div className="dropdown-kebab-pf">
    <ResourceKebab actions={menuActions} kind={kind} resource={obj} />
  </div>
</div>;

const Details_ = ({flags, obj: pvc}) => {
  const canListPV = flags[FLAGS.CAN_LIST_PV];
  const labelSelector = _.get(pvc, 'spec.selector');
  const storageClassName = _.get(pvc, 'spec.storageClassName');
  const volumeName = _.get(pvc, 'spec.volumeName');
  const requestedStorage = _.get(pvc, 'spec.resources.requests.storage');
  const storage = _.get(pvc, 'status.capacity.storage');
  const accessModes = _.get(pvc, 'status.accessModes');
  const conditions = _.get(pvc, 'status.conditions');
  return <React.Fragment>
    <div className="co-m-pane__body">
      <SectionHeading text="PersistentVolumeClaim Overview" />
      <div className="row">
        <div className="col-sm-6">
          <ResourceSummary resource={pvc}>
            <dt>Label Selector</dt>
            <dd><Selector selector={labelSelector} kind="PersistentVolume" /></dd>
          </ResourceSummary>
        </div>
        <div className="col-sm-6">
          <dl>
            <dt>Status</dt>
            <dd><PVCStatus pvc={pvc} /></dd>
            <dt>Storage Class</dt>
            <dd>
              {storageClassName ? <ResourceLink kind="StorageClass" name={storageClassName} /> : '-'}
            </dd>
            {volumeName && canListPV && <React.Fragment>
              <dt>Persistent Volume</dt>
              <dd><ResourceLink kind="PersistentVolume" name={volumeName} /></dd>
            </React.Fragment>}
            <dt>Requested</dt>
            <dd>{requestedStorage || '-'}</dd>
            {storage && <React.Fragment><dt>Size</dt><dd>{storage}</dd></React.Fragment>}
            {!_.isEmpty(accessModes) && <React.Fragment><dt>Access Modes</dt><dd>{accessModes.join(', ')}</dd></React.Fragment>}
          </dl>
        </div>
      </div>
    </div>
    <div className="co-m-pane__body">
      <SectionHeading text="Conditions" />
      <Conditions conditions={conditions} />
    </div>
  </React.Fragment>;
};

const Details = connectToFlags(FLAGS.CAN_LIST_PV)(Details_);

const allPhases = [ 'Pending', 'Bound', 'Lost' ];
const filters = [{
  type: 'pod-status',
  selected: allPhases,
  reducer: pvcPhase,
  items: _.map(allPhases, phase => ({
    id: phase,
    title: phase,
  })),
}];


export const PersistentVolumeClaimsList = props => <List {...props} Header={Header} Row={Row} />;
export const PersistentVolumeClaimsPage = props => {
  const createProps = {
    to: `/k8s/ns/${props.namespace || 'default'}/persistentvolumeclaims/~new/form`,
  };
  return <ListPage {...props} ListComponent={PersistentVolumeClaimsList} kind={kind} canCreate={true} rowFilters={filters} createProps={createProps} />;
};
export const PersistentVolumeClaimsDetailsPage = props => <DetailsPage
  {...props}
  menuActions={menuActions}
  pages={[navFactory.details(Details), navFactory.editYaml(), navFactory.events(ResourceEventStream)]}
/>;
