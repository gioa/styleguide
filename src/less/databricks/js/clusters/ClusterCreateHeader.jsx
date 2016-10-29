import React from 'react';

import { ClusterUtil, SubmitButton, CancelButton } from '../clusters/Common.jsx';
import { CreateSummary } from '../clusters/CreateSummary.jsx';

const submitEnabled = 'ClusterCreateHeader.submitEnabled';
const submitDisabledWithTooltip = 'ClusterCreateHeader.submitDisabledWithTooltip';

/**
 * The submit button is enabled if submitState == submitEnabled. However, there are two
 * disabled states, one with no tooltip when the configuration is invalid (e.g. empty name),
 * and one with a tooltip if the current user is a dev-tier user who cannot make any more
 * clusters.
 */
export function ClusterSubmitButton(props) {
  const submitButton = (<SubmitButton
    disabled={props.submitState !== submitEnabled}
    text={props.submitText}
    onClick={props.onSubmit}
  />);
  if (props.submitState === submitDisabledWithTooltip) {
    return ClusterUtil.generateClusterLimitTooltip(submitButton);
  }
  return submitButton;
}

export function ClusterCreateHeader(props) {
  const nodeType = ClusterUtil.getNodeType(props.nodeTypeId, props.nodeTypes);
  // props.driverNodeTypeId will not exist before either node type or driver node type is
  // explicitly set. Before that, they are the same
  const driverNodeType =
    ClusterUtil.getNodeType(props.driverNodeTypeId || props.nodeTypeId, props.nodeTypes);
  const numWorkers = props.numWorkers;
  const maxWorkers = props.maxWorkers;

  return (
    <div className='create-cluster-title'>
      <div className='create-title'>
        <h2 className='create-title-text'>{props.headerText}</h2>
        <CancelButton onClick={props.onCancel} />
        <ClusterSubmitButton {...props} />
      </div>
      {props.showCreateSummary ? (
         <CreateSummary
           workers={numWorkers}
           workerDBU={ClusterUtil.getDBU(nodeType, numWorkers)}
           maxDBU={ClusterUtil.getDBU(nodeType, maxWorkers)}
           driverDBU={ClusterUtil.getDBU(driverNodeType, 1)}
           maxWorkers={maxWorkers}
           memoryGb={ClusterUtil.workersToMemoryGB(numWorkers, nodeType, true)}
           maxMemoryGb={ClusterUtil.workersToMemoryGB(maxWorkers, nodeType, true)}
           cores={ClusterUtil.workersToCores(numWorkers, nodeType)}
           maxCores={ClusterUtil.workersToCores(maxWorkers, nodeType)}
           driver={1}
           driverMemoryGb={ClusterUtil.workersToMemoryGB(1, driverNodeType, true)}
           driverCores={ClusterUtil.workersToCores(1, driverNodeType)}
         />) : null}
    </div>
  );
}

ClusterCreateHeader.submitEnabled = submitEnabled;
ClusterCreateHeader.submitDisabled = 'ClusterCreateHeader.submitDisabled';
ClusterCreateHeader.submitDisabledWithTooltip = submitDisabledWithTooltip;

ClusterCreateHeader.propTypes = {
  maxWorkers: React.PropTypes.number,
  numWorkers: React.PropTypes.number.isRequired,
  nodeTypeId: React.PropTypes.string.isRequired,
  driverNodeTypeId: React.PropTypes.string.isRequired,
  nodeTypes: React.PropTypes.array.isRequired,
  headerText: React.PropTypes.string.isRequired,
  onCancel: React.PropTypes.func.isRequired,
  onSubmit: React.PropTypes.func.isRequired,
  submitText: React.PropTypes.string,
  submitState: React.PropTypes.string,
  showCreateSummary: React.PropTypes.bool,
};

ClusterCreateHeader.defaultProps = {
  maxWorkers: 0,
  showCreateSummary: true,
  submitText: 'Create Cluster',
  submitState: ClusterCreateHeader.submitEnabled,
};
