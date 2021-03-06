import * as React from 'react';
import * as _ from 'lodash-es';
import * as semver from 'semver';
import { Popover } from '@patternfly/react-core';
import { QuestionCircleIcon } from '@patternfly/react-icons';

import { K8sResourceKind, K8sResourceKindReference } from '../module/k8s';
import { ColHead, DetailsPage, List, ListHeader, ListPage } from './factory';
import { CopyToClipboard, ExternalLink, Kebab, SectionHeading, LabelList, navFactory, ResourceKebab, ResourceLink, ResourceSummary, history, Timestamp } from './utils';
import { fromNow } from './utils/datetime';

const ImageStreamsReference: K8sResourceKindReference = 'ImageStream';
const ImageStreamTagsReference: K8sResourceKindReference = 'ImageStreamTag';

const getImageStreamTagName = (imageStreamName: string, tag: string): string => `${imageStreamName}:${tag}`;

export const getAnnotationTags = (specTag: any) => _.get(specTag, 'annotations.tags', '').split(/\s*,\s*/);

const isBuilderTag = (specTag: any) => {
  // A spec tag has annotations tags, which is a comma-delimited string (e.g., 'builder,httpd').
  const annotationTags = getAnnotationTags(specTag);
  return _.includes(annotationTags, 'builder') && !_.includes(annotationTags, 'hidden');
};

const getStatusTags = (imageStream: K8sResourceKind): any => {
  const statusTags = _.get(imageStream, 'status.tags');
  return _.keyBy(statusTags, 'tag');
};

export const getBuilderTags = (imageStream: K8sResourceKind): any[] => {
  const statusTags = getStatusTags(imageStream);
  return _.filter(imageStream.spec.tags, tag => isBuilderTag(tag) && statusTags[tag.name]);
};

// Sort tags in reverse order by semver, falling back to a string comparison if not a valid version.
export const getBuilderTagsSortedByVersion = (imageStream: K8sResourceKind): any[] => {
  return getBuilderTags(imageStream).sort(({name: a}, {name: b}) => {
    const v1 = semver.coerce(a);
    const v2 = semver.coerce(b);
    if (!v1 && !v2) {
      return a.localeCompare(b);
    }
    if (!v1) {
      return 1;
    }
    if (!v2) {
      return -1;
    }
    return semver.rcompare(v1, v2);
  });
};

export const getMostRecentBuilderTag = (imageStream: K8sResourceKind) => {
  const tags = getBuilderTagsSortedByVersion(imageStream);
  return _.head(tags);
};

// An image stream is a builder image if
// - It has a spec tag annotated with `builder` and not `hidden`
// - It has a corresponding status tag
export const isBuilder = (imageStream: K8sResourceKind) => !_.isEmpty(getBuilderTags(imageStream));

const createApplication = (kindObj, imageStream) => {
  if (!isBuilder(imageStream)) {
    return null;
  }

  const { name, namespace } = imageStream.metadata;
  return {
    btnClass: 'btn-primary',
    callback: () => {
      history.push(`/catalog/source-to-image?imagestream=${name}&imagestream-ns=${namespace}`);
    },
    label: 'Create Application',
  };
};

const actionButtons = [
  createApplication,
];

const { common } = Kebab.factory;
const menuActions = [...common];

const ImageStreamTagsRow: React.SFC<ImageStreamTagsRowProps> = ({imageStream, specTag, statusTag}) => {
  const latest = _.get(statusTag, ['items', 0]);
  const from = _.get(specTag, 'from');
  const referencesTag = _.get(specTag, 'from.kind') === 'ImageStreamTag';
  const image = _.get(latest, 'image');
  const created = _.get(latest, 'created');
  return <div className="row">
    <div className="col-md-2 col-sm-4 col-xs-4 co-break-word">
      <ResourceLink kind={ImageStreamTagsReference} name={getImageStreamTagName(imageStream.metadata.name, statusTag.tag)} namespace={imageStream.metadata.namespace} title={statusTag.tag} />
    </div>
    <span className="col-md-3 col-sm-4 col-xs-8 co-break-all">
      {from && referencesTag && <ResourceLink kind={ImageStreamTagsReference} name={getImageStreamTagName(imageStream.metadata.name, from.name)} namespace={imageStream.metadata.namespace} title={from.name} />}
      {from && !referencesTag && <React.Fragment>{from.name}</React.Fragment>}
      {!from && <span className="text-muted">pushed image</span>}
    </span>
    <span className="col-md-4 col-sm-4 hidden-xs co-break-all">
      {image && <React.Fragment>{image}</React.Fragment>}
      {!image && '-'}
    </span>
    <div className="col-md-3 hidden-sm hidden-xs">
      {created && <Timestamp timestamp={created} />}
      {!created && '-'}
    </div>
  </div>;
};

export const ExampleDockerCommandPopover: React.FC<ImageStreamManipulationHelpProps> = ({imageStream, tag}) => {
  const publicImageRepository = _.get(imageStream, 'status.publicDockerImageRepository');
  if (!publicImageRepository) {
    return null;
  }
  const loginCommand = 'oc registry login';
  const pushCommand = `docker push ${publicImageRepository}:${tag || '<tag>'}`;
  const pullCommand = `docker pull ${publicImageRepository}:${tag || '<tag>'}`;

  return <Popover
    headerContent={<React.Fragment>Image registry commands</React.Fragment>}
    className="co-example-docker-command__popover"
    bodyContent={
      <div>
        <p>Create a new Image Stream Tag by pushing an image to this Image Stream with the desired tag.</p>
        <br />
        <p>Authenticate to the internal registry</p>
        <CopyToClipboard value={loginCommand} />
        <br />
        <p>Push an image to this Image Stream</p>
        <CopyToClipboard value={pushCommand} />
        <br />
        <p>Pull an image from this Image Stream</p>
        <CopyToClipboard value={pullCommand} />
        <br />
        <p>Red Hat Enterprise Linux users may use the equivalent <strong>podman</strong> commands. <ExternalLink href="https://podman.io/" text="Learn more." /></p>
      </div>
    }>
    <button className="btn btn-link btn-link--no-btn-default-values hidden-sm hidden-xs" type="button"><QuestionCircleIcon /> Do you need to work with this Image Stream outside of the web console?</button>
  </Popover>;
};

export const ImageStreamsDetails: React.SFC<ImageStreamsDetailsProps> = ({obj: imageStream}) => {
  const imageRepository = _.get(imageStream, 'status.dockerImageRepository');
  const publicImageRepository = _.get(imageStream, 'status.publicDockerImageRepository');
  const imageCount = _.get(imageStream, 'status.tags.length');
  const specTagByName = _.keyBy(imageStream.spec.tags, 'name');

  return <div>
    <div className="co-m-pane__body">
      <SectionHeading text="Image Stream Overview" />
      <ResourceSummary resource={imageStream}>
        {imageRepository && <dt>Image Repository</dt>}
        {imageRepository && <dd>{imageRepository}</dd>}
        {publicImageRepository && <dt>Public Image Repository</dt>}
        {publicImageRepository && <dd>{publicImageRepository}</dd>}
        <dt>Image Count</dt>
        <dd>{imageCount ? imageCount : 0}</dd>
      </ResourceSummary>
      <ExampleDockerCommandPopover imageStream={imageStream} />
    </div>
    <div className="co-m-pane__body">
      <SectionHeading text="Tags" />
      {_.isEmpty(imageStream.status.tags)
        ? <span className="text-muted">No tags</span>
        : <div className="row">
          <div className="co-m-table-grid co-m-table-grid--bordered">
            <div className="row co-m-table-grid__head">
              <div className="col-md-2 col-sm-4 col-xs-4">Name</div>
              <div className="col-md-3 col-sm-4 col-xs-8">From</div>
              <div className="col-md-4 col-sm-4 hidden-xs">Identifier</div>
              <div className="col-md-3 hidden-sm hidden-xs">Last Updated</div>
            </div>
            <div className="co-m-table-grid__body">
              {_.map(imageStream.status.tags, (statusTag) =>
                <ImageStreamTagsRow
                  key={statusTag.tag}
                  imageStream={imageStream}
                  specTag={specTagByName[statusTag.tag]}
                  statusTag={statusTag} />)}
            </div>
          </div>
        </div>}
    </div>
  </div>;
};

const pages = [navFactory.details(ImageStreamsDetails), navFactory.editYaml()];
export const ImageStreamsDetailsPage: React.SFC<ImageStreamsDetailsPageProps> = props =>
  <DetailsPage
    {...props}
    kind={ImageStreamsReference}
    buttonActions={actionButtons}
    menuActions={menuActions}
    pages={pages} />;
ImageStreamsDetailsPage.displayName = 'ImageStreamsDetailsPage';

const ImageStreamsHeader = props => <ListHeader>
  <ColHead {...props} className="col-sm-3 col-xs-6" sortField="metadata.name">Name</ColHead>
  <ColHead {...props} className="col-sm-3 col-xs-6" sortField="metadata.namespace">Namespace</ColHead>
  <ColHead {...props} className="col-sm-3 hidden-xs" sortField="metadata.labels">Labels</ColHead>
  <ColHead {...props} className="col-sm-3 hidden-xs" sortField="metadata.creationTimestamp">Created</ColHead>
</ListHeader>;

const ImageStreamsRow: React.SFC<ImageStreamsRowProps> = ({obj}) => <div className="row co-resource-list__item">
  <div className="col-sm-3 col-xs-6">
    <ResourceLink kind={ImageStreamsReference} name={obj.metadata.name} namespace={obj.metadata.namespace} title={obj.metadata.name} />
  </div>
  <div className="col-sm-3 col-xs-6 co-break-word">
    <ResourceLink kind="Namespace" name={obj.metadata.namespace} />
  </div>
  <div className="col-sm-3 hidden-xs">
    <LabelList kind={ImageStreamsReference} labels={obj.metadata.labels} />
  </div>
  <div className="col-sm-3 hidden-xs">
    { fromNow(obj.metadata.creationTimestamp) }
  </div>
  <div className="dropdown-kebab-pf">
    <ResourceKebab actions={menuActions} kind={ImageStreamsReference} resource={obj} />
  </div>
</div>;

export const ImageStreamsList: React.SFC = props => <List {...props} Header={ImageStreamsHeader} Row={ImageStreamsRow} />;
ImageStreamsList.displayName = 'ImageStreamsList';

export const buildPhase = build => build.status.phase;

export const ImageStreamsPage: React.SFC<ImageStreamsPageProps> = props =>
  <ListPage
    {...props}
    title="Image Streams"
    kind={ImageStreamsReference}
    ListComponent={ImageStreamsList}
    canCreate={true}
  />;
ImageStreamsPage.displayName = 'ImageStreamsListPage';

type ImageStreamTagsRowProps = {
  imageStream: K8sResourceKind;
  specTag: any;
  statusTag: any;
};

export type ImageStreamManipulationHelpProps = {
  imageStream: K8sResourceKind;
  tag?: string
};

export type ImageStreamsRowProps = {
  obj: K8sResourceKind;
};

export type ImageStreamsDetailsProps = {
  obj: K8sResourceKind;
};

export type ImageStreamsPageProps = {
  filterLabel: string;
};

export type ImageStreamsDetailsPageProps = {
  match: any;
};
