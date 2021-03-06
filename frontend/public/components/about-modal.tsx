import * as React from 'react';
import * as _ from 'lodash-es';
import { AboutModal as PfAboutModal, TextContent, TextList, TextListItem } from '@patternfly/react-core';

import { FLAGS } from '../const';
import { connectToFlags } from '../reducers/features';
import { getBrandingDetails } from './masthead';
import { Firehose } from './utils';
import { ClusterVersionModel } from '../models';
import { ClusterVersionKind, referenceForModel, UpdateHistory } from '../module/k8s';
import { k8sVersion } from '../module/status';

const AboutModalItems: React.FC<AboutModalItemsProps> = ({cv}) => {
  const [kubernetesVersion, setKubernetesVersion] = React.useState('');
  React.useEffect(() => {
    k8sVersion()
      .then(({gitVersion}) => setKubernetesVersion(gitVersion))
      .catch(() => setKubernetesVersion('unknown'));
  }, []);
  const clusterID: string = _.get(cv, 'data.spec.clusterID');
  const channel: string = _.get(cv, 'data.spec.channel');
  const lastUpdate: UpdateHistory = _.get(cv, 'data.status.history[0]');
  return (
    <TextContent>
      <TextList component="dl">
        {lastUpdate && (
          <React.Fragment>
            <TextListItem component="dt">OpenShift Version</TextListItem>
            <TextListItem component="dd">{lastUpdate.state === 'Partial' ? `Updating to ${lastUpdate.version}` : lastUpdate.version}</TextListItem>
          </React.Fragment>
        )}
        <TextListItem component="dt">Kubernetes Version</TextListItem>
        <TextListItem component="dd">{kubernetesVersion}</TextListItem>
        {channel && (
          <React.Fragment>
            <TextListItem component="dt">Channel</TextListItem>
            <TextListItem component="dd">{channel}</TextListItem>
          </React.Fragment>
        )}
        {clusterID && (
          <React.Fragment>
            <TextListItem component="dt">Cluster ID</TextListItem>
            <TextListItem component="dd">{clusterID}</TextListItem>
          </React.Fragment>
        )}
      </TextList>
    </TextContent>
  );
};
AboutModalItems.displayName = 'AboutModalItems';

const AboutModal_: React.FC<AboutModalProps> = (props) => {
  const { isOpen, closeAboutModal, flags } = props;
  const details = getBrandingDetails();
  const customBranding = window.SERVER_FLAGS.customLogoURL || window.SERVER_FLAGS.customProductName;
  const resources = flags[FLAGS.CLUSTER_VERSION]
    ? [{ kind: referenceForModel(ClusterVersionModel), name: 'version', isList: false, prop: 'cv' }]
    : [];
  return (
    <PfAboutModal
      isOpen={isOpen}
      onClose={closeAboutModal}
      productName=""
      brandImageSrc={details.logoImg}
      brandImageAlt={details.productName}
    >
      {!customBranding && <p>OpenShift is Red Hat&apos;s container application platform that allows developers to quickly develop, host,
        and scale applications in a cloud environment.</p>}
      <br />
      <Firehose resources={resources}>
        <AboutModalItems {...props as any} />
      </Firehose>
    </PfAboutModal>
  );
};
export const AboutModal = connectToFlags(FLAGS.CLUSTER_VERSION)(AboutModal_);
AboutModal.displayName = 'AboutModal';

type AboutModalItemsProps = {
  cv?: {
    data?: ClusterVersionKind;
  };
};

type AboutModalProps = {
  isOpen: boolean;
  closeAboutModal: () => void;
  flags: {[key: string]: boolean};
};
