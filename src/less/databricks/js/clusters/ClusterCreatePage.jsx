import React from 'react';

import { ClusterCreateHeader } from '../clusters/ClusterCreateHeader.jsx';
import { ClusterCreateView } from '../clusters/ClusterCreateView.jsx';
import ClusterList from '../clusters/ClusterList';
import { ClusterUtil } from '../clusters/Common.jsx';
import { SparkVersionUtils } from '../clusters/SparkVersionUtils';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';

/**
 * Wrapper class that renders the ClusterCreateView and ClusterCreateHeader
 * on the cluster creation page, and handles the processing and submission of
 * cluster creation parameters.
 */

export class ClusterCreatePage extends React.Component {
  constructor(props) {
    super(props);

    this.onClickSubmit = this.onClickSubmit.bind(this);
    this.setCreateSummary = this.setCreateSummary.bind(this);
    this.toggleClusterCreateButton = this.toggleClusterCreateButton.bind(this);

    this.state = {
      numWorkers: this.props.defaultNumWorkers,
      autoScaleMaxWorkers: 0,
      nodeTypeId: this.props.defaultNodeTypeId,
      driverNodeTypeId: this.props.defaultNodeTypeId,
      submitDisabled: true,
    };
  }

  componentDidMount() {
    // Maybe update the submit button state if the number of clusters changes.
    this.props.clusters.on('reset change add remove', this._forceUpdate, this);
  }

  _forceUpdate() {
    this.forceUpdate();
  }

  componentWillUnmount() {
    this.props.clusters.off(null, null, this);
  }

  setCreateSummary(attrObj) {
    let workers = attrObj.workers + attrObj.spotWorkers;
    let autoScaleMaxWorkers = 0;

    // if auto scaling, set the max workers and (for hybrid clusters) min workers
    // (workers/spotWorkers are used for mins in autoscaled on demand & spot clusters)
    if (attrObj.showAutoScaleInputs) {
      autoScaleMaxWorkers = attrObj.autoScaleMaxWorkers + attrObj.autoScaleMaxSpotWorkers;
      if (attrObj.mixedAutoScaleMinWorkers || attrObj.mixedAutoScaleMinWorkers === 0) {
        workers = attrObj.mixedAutoScaleMinWorkers;
      }
    }

    this.setState({
      numWorkers: workers,
      autoScaleMaxWorkers: autoScaleMaxWorkers,
      nodeTypeId: attrObj.nodeTypeId,
      driverNodeTypeId: attrObj.driverNodeTypeId,
    });
  }

  getSubmitButtonState() {
    if (ClusterUtil.exceedsClusterLimit(this.props.clusters.activeClusters().length)) {
      return ClusterCreateHeader.submitDisabledWithTooltip;
    } else if (this.state.submitDisabled) {
      return ClusterCreateHeader.submitDisabled;
    }
    return ClusterCreateHeader.submitEnabled;
  }

  startSpinner() {

  }

  stopSpinner() {

  }

  onClickSubmit() {
    this.startSpinner();
    this.createCluster(this.refs.clusterCreateView.collect());
    this.props.onSubmitNavigationCallback();
  }

  onCreateClusterSuccess() {
    this.stopSpinner();
  }

  onCreateClusterFail(createParams, xhr, textStatus, errorThrown) {
    this.stopSpinner();
    let alertMsg = 'Could not create a cluster';
    if (createParams && createParams.clusterName) {
      alertMsg = alertMsg + ' named ' + createParams.clusterName;
    }
    let extraMsg = '';
    if (xhr && xhr.status && String(xhr.status) === '503') {
      extraMsg = '.  The cluster manager is temporarily unreachable. You may not be able to ' +
        'create or inspect clusters at this time. Please try again later.';
    }
    DeprecatedDialogBox.alert(alertMsg + ': ' + errorThrown + extraMsg);
  }

  /**
   * Turn the cluster create button on/off.
   * @param  {Boolean} isValid Is the current input valid,
   *                           meaning the submit should not be disabled.
   * @return {None}
   */
  toggleClusterCreateButton(isValid) {
    this.setState({ submitDisabled: !isValid });
  }

  createCluster(createParams) {
    SparkVersionUtils.setDefaultSparkVersion(createParams.sparkVersion);
    ClusterUtil.createCluster(createParams, this.onCreateClusterSuccess.bind(this),
      this.onCreateClusterFail.bind(this, createParams));
  }

  _shouldShowEBSVolumes() {
    return window.settings.enableEBSVolumesUI && !this.props.restrictedClusterCreation;
  }

  _shouldShowInstanceProfiles() {
    return window.settings.enableInstanceProfilesUI && !this.props.restrictedClusterCreation;
  }

  render() {
    return (
      <div className='create-cluster'>
        <ClusterCreateHeader
          headerText='New Cluster'
          onSubmit={this.onClickSubmit}
          onCancel={() => window.history.back()}
          numWorkers={this.state.numWorkers}
          maxWorkers={this.state.autoScaleMaxWorkers}
          nodeTypeId={this.state.nodeTypeId}
          driverNodeTypeId={this.state.driverNodeTypeId}
          nodeTypes={this.props.nodeTypes}
          submitState={this.getSubmitButtonState()}
        />
        <hr />
        <ClusterCreateView
          ref='clusterCreateView'
          clusters={this.props.clusters}
          defaultCoresPerContainer={this.props.defaultCoresPerContainer}
          defaultNumWorkers={this.props.defaultNumWorkers}
          defaultNodeType={this.props.defaultNodeTypeId}
          defaultSparkVersion={this.props.defaultSparkVersion}
          defaultZoneId={this.props.defaultZoneId}
          showAutoScaleCheckbox
          enableAutoScale={this.props.enableAutoScale}
          enableCustomSparkVersions={this.props.enableCustomSparkVersions}
          enableHybridClusterType={this.props.enableHybridClusterType}
          enableSparkVersionsUI={this.props.enableSparkVersionsUI}
          hideMissingSparkPackageWarning={this.props.hideMissingSparkPackageWarning}
          nodeTypes={this.props.nodeTypes}
          onChange={this.setCreateSummary}
          restrictedClusterCreation={this.props.restrictedClusterCreation}
          toggleClusterCreateButton={this.toggleClusterCreateButton}
          showHiddenSparkVersions={this.props.showHiddenSparkVersions}
          sparkVersions={this.props.sparkVersions}
          zoneInfos={this.props.zoneInfos}
          renderSsh={this.props.renderSsh}
          renderTags={this.props.renderTags}
          showEBSVolumes={this._shouldShowEBSVolumes()}
          showInstanceProfiles={this._shouldShowInstanceProfiles()}
        />
      </div>
    );
  }
}

ClusterCreatePage.propTypes = {
  clusters: React.PropTypes.instanceOf(ClusterList).isRequired,
  defaultCoresPerContainer: React.PropTypes.number,
  defaultNodeTypeId: React.PropTypes.string,
  defaultNumWorkers: React.PropTypes.number,
  defaultSparkVersion: React.PropTypes.object.isRequired,
  defaultZoneId: React.PropTypes.string,
  // tier-based; controls whether the auto scale checkbox is greyed out & disabled
  enableAutoScale: React.PropTypes.bool,
  enableCustomSparkVersions: React.PropTypes.bool,
  enableHybridClusterType: React.PropTypes.bool,
  enableSparkVersionsUI: React.PropTypes.bool,
  hideMissingSparkPackageWarning: React.PropTypes.bool,
  nodeTypes: React.PropTypes.array,
  onSubmitNavigationCallback: React.PropTypes.func,
  restrictedClusterCreation: React.PropTypes.bool,
  showHiddenSparkVersions: React.PropTypes.bool,
  sparkVersions: React.PropTypes.array,
  zoneInfos: React.PropTypes.array.isRequired,
  renderSsh: React.PropTypes.bool,
  renderTags: React.PropTypes.bool,
};

ClusterCreatePage.defaultProps = {
  enableAutoScale: true,
  defaultNodeTypeId: 'memory-optimized',
  defaultNumWorkers: 8,
  onSubmitNavigationCallback: () => window.history.back(),
};
