/* eslint react/prefer-es6-class: 0, react/no-is-mounted: 0, func-names: 0 */

import _ from 'underscore';
import React from 'react';

import { AclUtils } from '../acl/AclUtils.jsx';
import WorkspacePermissions from '../acl/WorkspacePermissions';

import Cluster from '../clusters/Cluster';
import { ClusterCreateHeader } from '../clusters/ClusterCreateHeader.jsx';
import { ClusterUtil } from '../clusters/Common.jsx';
import { ClusterWorkersInput } from '../clusters/ClusterWorkersInput.jsx';
import { ClusterCreateView } from '../clusters/ClusterCreateView.jsx';
import { SparkVersionUtils } from '../clusters/SparkVersionUtils';

import { Select } from '../forms/ReactFormElements.jsx';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';
import ReactModal from '../ui_building_blocks/dialogs/ReactModal.jsx';
import ReactModalUtils from '../ui_building_blocks/dialogs/ReactModalUtils';
import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

require('../../lib/bootstrap');

const CLUSTER_TYPE = 'clusterType';
const EXISTING_CLUSTER_SELECTOR = 'existingCluster';
const NEW_CLUSTER = 'new';
const EXISTING_CLUSTER = 'existing';

// This is the fake cluster id used for the null row in the cluster selector,
// which can be the initial (default) value and is rendered with the text "-".
const INVALID_CLUSTER_ID_STUB = 'no_appropriate_cluster';

export const ReactClusterBody = React.createClass({

  /**
   * basicInfo: basic info from the model
   * clusters: List of attachable clusters.
   * confirmOnEnter: Function to confirm on ENTER.
   * enableVersionUI: Whether or not to show the <select> for choosing a Spark version.
   * enableCustomVersionUI: Whether or not to show the <input> for setting a custom Spark version
   *   for development.
   * initialClusterType: which cluster dropdown (new/existing) to show initially
   * setCreateSummary: callback that gets prop values for the ClusterCreateHeader.
   * setParentWorkersValid: Send the valid state of workers back to the Dialog.
   * setParentClusterType: Send the cluster type back to the Dialog.
   * showExistingClusterDropdown: whether to allow user to choose existing cluster (based on ACLs)
   * toggleClusterCreateButton: Enables/disables the cluster create button depending on
   *  worker validation (only for new hybrid cluster UI)
   * zoneInfo: the availability zone info list
   */
  propTypes: {
    basicInfo: React.PropTypes.object.isRequired,
    clusters: React.PropTypes.array.isRequired,
    confirmOnEnter: React.PropTypes.func.isRequired,
    enableVersionUI: React.PropTypes.bool.isRequired,
    enableCustomVersionUI: React.PropTypes.bool.isRequired,
    initialClusterType: React.PropTypes.string.isRequired,
    restrictedClusterCreation: React.PropTypes.bool,
    setCreateSummary: React.PropTypes.func,
    setParentWorkersValid: React.PropTypes.func.isRequired,
    setParentClusterType: React.PropTypes.func.isRequired,
    showExistingClusterDropdown: React.PropTypes.bool,
    toggleClusterCreateButton: React.PropTypes.func,
    zoneInfos: React.PropTypes.array.isRequired,
  },

  getInitialState() {
    const initialCluster = this._getDefaultClusterId();
    return {
      clusterType: this.props.initialClusterType,
      cluster: initialCluster,
      initialCluster: initialCluster,
      hasCreateClusterPerms: true,
      showSpinner: false,
    };
  },

  componentDidMount() {
    if (AclUtils.clusterAclsEnabled()) {
      this.fetchClusterCreatePermissions();
    }
  },

  fetchClusterCreatePermissions() {
    Cluster.ROOT.fetchPermissionLevel(() => {
      this.setState({ hasCreateClusterPerms: Cluster.ROOT.canCreateClusters() });
    });
  },

  getDefaultProps() {
    return {
      showExistingClusterDropdown: true,
    };
  },

  setClusterTypeState() {
    const value = this.refs[CLUSTER_TYPE].value();
    this.setState({ clusterType: value });
    this.props.setParentClusterType(value);
  },

  _toggleClusterCreateButton() {
    const selectedCluster = this.getChosenExistingCluster();
    this.setState({ cluster: selectedCluster });
    const isValid = selectedCluster !== this.state.initialCluster &&
      selectedCluster !== INVALID_CLUSTER_ID_STUB;
    this.props.toggleClusterCreateButton(isValid);
  },

  _clusterSelector() {
    if (this.props.clusters.length === 0) {
      return (
        <div className='cluster-selector'>
          <Select
            ref={EXISTING_CLUSTER_SELECTOR}
            selectID={EXISTING_CLUSTER_SELECTOR}
            selectClassName='control-field cluster-dialog-element'
            options={[{ label: 'No existing clusters.', disabled: true }]}
          />
        </div>
      );
    }
    const defaultClusterId = this._getDefaultClusterId();
    const options = this._getOptionsList(defaultClusterId);

    // Turn off the confirm button initially if the default option is the null row
    // because the toggle function only gets called on change
    if (this.state.cluster === this.state.initialCluster &&
        this.state.cluster === INVALID_CLUSTER_ID_STUB) {
      this.props.toggleClusterCreateButton(false);
    }

    return (
      <div className='cluster-selector'>
        <Select
          ref={EXISTING_CLUSTER_SELECTOR}
          selectID={EXISTING_CLUSTER_SELECTOR}
          selectClassName='control-field cluster-dialog-element'
          options={options}
          onChange={this._toggleClusterCreateButton}
          confirm={this.props.confirmOnEnter}
          defaultValue={defaultClusterId}
        />
      </div>
    );
  },

  /**
   * @param {string} defaultClusterId: if this is the no-cluster fake id, add a null
   *   row to the selector.
   */
  _getOptionsList(defaultClusterId) {
    const options = [];
    if (defaultClusterId === INVALID_CLUSTER_ID_STUB) {
      options.push({
        label: '-',
        value: INVALID_CLUSTER_ID_STUB,
        disabled: false,
      });
    }
    this.props.clusters.forEach(function(c) {
      options.push({
        label: c.shortDescription(),
        value: c.get('clusterId'),
        disabled: AclUtils.clusterAclsEnabled() ? !c.canAttach() : false,
      });
    });
    return options;
  },

  /**
   * Returns the clusterId of the cluster currently set on the job. If whatever is set is
   * not currently the id of a running cluster, or if the user doesn't have attach permissions
     for the cluster with that id, return that no cluster was found (i.e. show a null row in
   * the Select).
   * @return {string} a cluster id if a valid one exists, otherwise the const for a null row
   */
  _getDefaultClusterId() {
    let defaultId = INVALID_CLUSTER_ID_STUB;
    if (this.props.basicInfo.resources.clusterId) {
      // Set the default cluster selector value to the previously set cluster on this job
      defaultId = this.props.basicInfo.resources.clusterId;
      if (AclUtils.clusterAclsEnabled()) {
        // If ACLs enabled, make sure user can still attach to previously set cluster. If they
        // can't, show a null row (-) in the cluster selector.
        const prevCluster = this._getPreviouslySetCluster();
        const canAttach = prevCluster && prevCluster.canAttach();
        if (!canAttach) {
          defaultId = INVALID_CLUSTER_ID_STUB;
        }
      }
    }
    if (!this.props.clusters.some((cluster) => cluster.get('clusterId') === defaultId)) {
      defaultId = INVALID_CLUSTER_ID_STUB;
    }
    return defaultId;
  },

  /**
   * Returns the cluster currently set on the job, or undefined if none exists or there are
   * no clusters.
   */
  _getPreviouslySetCluster() {
    return _.find(
      this.props.clusters,
      (cluster) => cluster.get('clusterId') === this.props.basicInfo.resources.clusterId
    );
  },

  isClusterType(type) {
    return this.refs[CLUSTER_TYPE].value() === type;
  },

  getChosenExistingCluster() {
    return this.refs[EXISTING_CLUSTER_SELECTOR].value();
  },

  collectClusterCreateParams() {
    const configureParams = this.jobCreateClusterView.collect();

    configureParams.clusterId = null;
    configureParams.jobId = this.props.basicInfo.jobId;
    configureParams.newClusterNumWorkers = configureParams.numWorkers;
    configureParams.nodeType = configureParams.nodeTypeId;
    configureParams.runOnNewCluster = true;
    configureParams.useSpot = configureParams.useSpotInstance;
    delete configureParams.useSpotInstance;
    delete configureParams.clusterName;
    delete configureParams.numWorkers;
    delete configureParams.nodeTypeId;

    return configureParams;
  },

  startSpinner() {
    this.setState({ showSpinner: true });
  },

  stopSpinner() {
    this.setState({ showSpinner: false });
  },

  createClusterForJob() {
    this.startSpinner();
    const success = function() {
      this.stopSpinner();
      ReactModalUtils.destroyModal();
    }.bind(this);
    const fail = function(model, response, options) {
      this.stopSpinner();
      DeprecatedDialogBox.alert('Could not create cluster for job: ' + options);
    }.bind(this);

    ClusterUtil.createClusterForJob(this.collectClusterCreateParams(), success, fail);
  },

  _chooseDialogBody() {
    if (this.state.clusterType === EXISTING_CLUSTER) {
      return this._renderExistingClusterDialogBody();
    }
    return (<div className='create-cluster'>{this._renderClusterCreateView()}</div>);
  },

  _renderExistingClusterDialogBody() {
    const divProps = {
      className: 'multi-input-row select-cluster-field',
      'data-row-for': CLUSTER_TYPE,
    };
    return (
      <div {...divProps}>
        <div>
          <label className='unclickable cluster-dialog-label'>Select Cluster</label>
          {this._clusterSelector()}
        </div>
        <div className='dialog-tip'>
          <p>
            Please note that when running jobs on an existing cluster, you may need to manually
            restart the cluster if it stops responding. We suggest running jobs on new clusters
            for greater reliability.
          </p>
          <p>
            {ClusterUtil.reuseExistingInstancesTip()}
          </p>
        </div>
      </div>
    );
  },

  _getClusterInstanceType(resources) {
    if (!resources.useSpot) {
      return ClusterWorkersInput.INSTANCE_ONDEMAND;
    } else if (resources.firstOnDemand > 0) {
      return ClusterWorkersInput.INSTANCE_MIXED;
    }
    return ClusterWorkersInput.INSTANCE_SPOT;
  },

  _jobCreateClusterViewRef(ref) {
    this.jobCreateClusterView = ref;
  },

  _shouldRenderTags() {
    return window.settings.enableClusterTagsUI && window.settings.enableClusterTagsUIForJobs &&
      !this.props.restrictedClusterCreation;
  },

  _shouldRenderSsh() {
    return window.settings.enableSshKeyUI && window.settings.enableSshKeyUIInJobs &&
      !this.props.restrictedClusterCreation;
  },

  _shouldShowEBSVolumes() {
    return window.settings.enableEBSVolumesUI && !this.props.restrictedClusterCreation &&
      window.settings.enableEBSVolumesUIForJobs;
  },

  _shouldShowInstanceProfiles() {
    return window.settings.enableInstanceProfilesUI && !this.props.restrictedClusterCreation &&
      window.settings.enableInstanceProfilesUIInJobs;
  },

  _getDefaultEBSVolumeType(resources) {
    // there is no default nonetype for ebs volume type in the backend, so it will always
    // be set as something regardless of whether the user previously configured it. Therefore
    // we check count & size to determine whether it has been set by user.
    return resources.ebsVolumeSize && resources.ebsVolumeCount ? resources.ebsVolumeType : null;
  },

  _renderClusterCreateView() {
    // we must access cluster attributes via the basicInfo.resources attr on the job
    const resources = this.props.basicInfo.resources;
    const configureDefaults = {
      firstOnDemand: resources.firstOnDemand,
      defaultSparkVersionKey: resources.sparkVersion,
      instanceType: this._getClusterInstanceType(resources),
      spotBidPricePercent: resources.spotBidPricePercent,
      minWorkers: resources.minWorkers,
      maxWorkers: resources.maxWorkers,
      ebsVolumeType: this._getDefaultEBSVolumeType(resources),
      ebsVolumeCount: resources.ebsVolumeCount ? resources.ebsVolumeCount : null,
      ebsVolumeSize: resources.ebsVolumeSize ? resources.ebsVolumeSize : null,
      instanceProfileArn: resources.instanceProfileArn,
      useSpotForWorkers: resources.useSpot,
      customTags: resources.customTags,
    };
    const defaultNodeTypeId = resources.nodeTypeId ? resources.nodeTypeId.id
      : window.settings.nodeInfo.default_node_type_id;
    const defaultDriverTypeId = resources.driverNodeTypeId ? resources.driverNodeTypeId.id
      : window.settings.nodeInfo.default_node_type_id;

    const shouldShowAutoScaling = window.settings.enableClusterAutoScaling &&
      window.settings.enableClusterAutoScalingForJobs;

    return (
      <ClusterCreateView
        ref={this._jobCreateClusterViewRef}
        configureDefaults={configureDefaults}
        clusters={window.clusterList}
        defaultCoresPerContainer={window.settings.defaultCoresPerContainer}
        defaultNumWorkers={resources.newClusterNumWorkers}
        defaultNodeType={defaultNodeTypeId}
        defaultDriverNodeTypeId={defaultDriverTypeId}
        defaultSparkVersion={window.settings.defaultSparkVersion}
        defaultZoneId={resources.zoneId ? resources.zoneId : window.settings.defaultZoneId}
        enableClusterName={false}
        // This determines if autoscaling checkbox is shown at all
        showAutoScaleCheckbox={shouldShowAutoScaling || false}
        // This determines if autoscaling is enabled for the current tier.
        enableAutoScale={window.settings.enableClusterAutoScaling}
        enableHybridClusterType={window.settings.enableHybridClusterType}
        enableCustomSparkVersions={window.prefs.get('enableCustomSparkVersions')}
        enableSparkVersionsUI={window.settings.enableSparkVersionsUI}
        fallbackToOndemand={resources.fallbackToOndemand}
        hideMissingSparkPackageWarning={window.settings.hideMissingSparkPackageWarning}
        nodeTypes={window.settings.nodeInfo.node_types}
        onChange={this.props.setCreateSummary}
        restrictedClusterCreation={this.props.restrictedClusterCreation}
        showHiddenSparkVersions={window.settings.showHiddenSparkVersions}
        sparkConf={resources.sparkConf}
        sparkVersions={window.settings.sparkVersions}
        toggleClusterCreateButton={this.props.toggleClusterCreateButton}
        zoneInfos={this.props.zoneInfos}
        renderSsh={this._shouldRenderSsh()}
        renderTags={this._shouldRenderTags()}
        showEBSVolumes={this._shouldShowEBSVolumes()}
        showInstanceProfiles={this._shouldShowInstanceProfiles()}
      />
    );
  },

  focus() {
    // Select workers by default, unless we're in restricted cluster creation
    // where it can't be changed.
    if (this.refs.form && !this.props.restrictedClusterCreation) {
      this.refs.form.refs.workerInput.focus();
    }
  },

  getAclsWarning() {
    return (
      <span className='no-create-perms-tooltip'>
        <Tooltip ref='clusterCreateWarning' text={WorkspacePermissions.JOB_CREATE_CLUSTER_WARNING}
          customPosition={{ 'contentLeft': '0' }}
        >
          <i className='fa fa-exclamation-circle state-message-icon' />
        </Tooltip>
      </span>);
  },

  render() {
    let defaultValue = this.props.basicInfo.resources.runOnNewCluster ?
                       NEW_CLUSTER : EXISTING_CLUSTER;
    let options = [
      {
        label: 'New Cluster',
        value: NEW_CLUSTER,
      },
      {
        label: 'Existing Cluster',
        value: EXISTING_CLUSTER,
      },
    ];
    // To run JAR Jobs on existing clusters, user must use the new way of creating JARs,
    // i.e. runAsNotebook is true. If users use the legacy way where they include
    // "new SparkContext ()" then they cannot select "Existing Cluster" in the pull down menu.
    const jobActions = this.props.basicInfo.jobActions[0];
    if (jobActions && !jobActions.notebookPath) {
      if (!jobActions.runAsNotebook) {
        options = [{
          label: 'New Cluster',
          value: NEW_CLUSTER,
        }];
      }
    }

    if (!this.props.showExistingClusterDropdown) {
      options = [{
        label: 'New Cluster',
        value: NEW_CLUSTER,
      }];
      defaultValue = NEW_CLUSTER;
    }

    const props = { className: 'multi-input-row', 'data-row-for': CLUSTER_TYPE };
    const spinner = <img className='load-spinner' src='../img/spinner.svg' />;

    return (
      <div>
        {this.state.showSpinner ? spinner : null}
        <div {...props}>
          <div className='cluster-type-select-wrapper'>
            <label className='unclickable cluster-dialog-label cluster-create-label'>
              Cluster Type
              {!this.state.hasCreateClusterPerms ? this.getAclsWarning() : null}
            </label>
            <div className='cluster-type-select'>
              <Select
                ref={CLUSTER_TYPE}
                selectID={CLUSTER_TYPE}
                selectClassName='control-field cluster-dialog-element'
                defaultValue={defaultValue}
                onChange={this.setClusterTypeState}
                confirm={this.props.confirmOnEnter}
                options={options}
              />
            </div>
          </div>
        </div>
        {this._chooseDialogBody()}
      </div>
    );
  },
});

export const ReactJobClusterDialog = React.createClass({
  propTypes: {
    basicInfo: React.PropTypes.object.isRequired,
    clusters: React.PropTypes.array.isRequired,
    setNewCluster: React.PropTypes.func.isRequired,
    setExistingCluster: React.PropTypes.func.isRequired,
    enableVersionUI: React.PropTypes.bool.isRequired,
    enableCustomVersionUI: React.PropTypes.bool.isRequired,
    zoneInfos: React.PropTypes.array.isRequired,
    restrictedClusterCreation: React.PropTypes.bool,
  },

  getInitialState() {
    const resources = this.props.basicInfo.resources;
    const nodeTypeId = resources.nodeTypeId ? resources.nodeTypeId.id
      : window.settings.nodeInfo.default_node_type_id;
    const driverNodeTypeId = resources.driverNodeTypeId ? resources.driverNodeTypeId.id
      : window.settings.nodeInfo.default_node_type_id;
    const numWorkers = resources.newClusterNumWorkers + resources.minWorkers;
    const autoScaleMaxWorkers = resources.maxWorkers;

    return {
      clusterType: this._getInitialClusterType(),
      cluster: this.props.clusters.length > 0 ? this.props.clusters[0].get('clusterId') : '',
      // used in the hybrid cluster dialog to show summary #s of the cluster to be created
      numWorkers: numWorkers,
      autoScaleMaxWorkers: autoScaleMaxWorkers,
      workers: 8,
      nodeTypeId: nodeTypeId,
      driverNodeTypeId: driverNodeTypeId,
      version: this.props.basicInfo.resources.sparkVersion,
      useSpot: true,
      fallBack: true,
      // Note: only used in the new hybrid cluster UI
      clusterCreateBtnDisabled: true,
      workersValid: true,
    };
  },

  _getInitialClusterType() {
    // if cluster ACLs are enabled but the user has lost attach permissions on all clusters,
    // including the one the job is currenty using, only allow them to select a new cluster
    if (!this._shouldShowExistingClusterDropdown()) {
      return NEW_CLUSTER;
    }
    return this.props.basicInfo.resources.runOnNewCluster ? NEW_CLUSTER : EXISTING_CLUSTER;
  },

  _shouldShowExistingClusterDropdown() {
    if (!AclUtils.clusterAclsEnabled()) { return true; }
    const attachCluster = _.find(this.props.clusters, (cluster) => cluster.canAttach());
    return !!attachCluster;
  },

  confirmOnEnter(e) {
    const existingClusterConfirmDisabled = this.props.clusters.length === 0;
    const newClusterConfirmDisabled = !this.state.workersValid;
    const confirmDisabled = this.refs.body.state[CLUSTER_TYPE] === EXISTING_CLUSTER ?
      existingClusterConfirmDisabled : newClusterConfirmDisabled;

    if (e.which === 13 && !confirmDisabled) {
      this.confirm(e);
      ReactModalUtils.destroyModal();
    }
  },

  _userChoseExistingCluster() {
    return this.refs.body.isClusterType(EXISTING_CLUSTER);
  },

  _setExistingCluster(e, onSuccessCallback) {
    this.props.setExistingCluster(
      e, this.refs.body.getChosenExistingCluster(), onSuccessCallback);
  },

  confirm(e) {
    if (this._userChoseExistingCluster()) {
      this._setExistingCluster(e, null);
    } else {
      SparkVersionUtils.setDefaultSparkVersion(this.refs.body.refs.form.state.version);
      const advancedSettings = this.refs.body.refs.form.refs.advancedSettings;
      const zoneId = advancedSettings && advancedSettings.getZoneId();
      const sparkConf = (advancedSettings && advancedSettings.getSparkConf()) || {};
      this.props.setNewCluster(
        this.refs.body.refs.form.state.version,
        this.refs.body.refs.form.refs.workerInput.value(),
        this.refs.body.refs.form.refs.clusterUseSpot.checked(),
        this.refs.body.refs.form.refs.clusterFallBack.checked(),
        zoneId,
        sparkConf
      );
    }
  },

  setWorkersValidState(isValid) {
    this.setState({
      workersValid: isValid,
      clusterCreateBtnDisabled: false,
    });
  },

  _setClusterTypeState(clusterType) {
    this.setState({
      clusterType: clusterType,
      clusterCreateBtnDisabled: false,
    });
  },

  componentDidMount() {
    this.refs.body.focus();
  },

  /**
   * Used when the new hybrid cluster UI is enabled
   */
  _confirmConfigureCluster(e) {
    const onSuccess = ReactModalUtils.destroyModal;
    if (this._userChoseExistingCluster()) {
      this._setExistingCluster(e, onSuccess);
    } else {
      this.refs.body.createClusterForJob();
    }
  },

  _toggleClusterCreateButton(isValid) {
    if (this.isMounted() && isValid === this.state.clusterCreateBtnDisabled) {
      this.setState({ clusterCreateBtnDisabled: !isValid });
    }
  },

  _getSubmitButtonState() {
    if (this.state.clusterCreateBtnDisabled || !this.state.workersValid) {
      return ClusterCreateHeader.submitDisabled;
    }
    return ClusterCreateHeader.submitEnabled;
  },

  _getHeader() {
    return (
      <ClusterCreateHeader
        headerText='Configure Cluster'
        onSubmit={this._confirmConfigureCluster}
        onCancel={ReactModalUtils.destroyModal}
        showCreateSummary={this.state.clusterType === NEW_CLUSTER}
        submitText='Confirm'
        submitState={this._getSubmitButtonState()}
        numWorkers={this.state.numWorkers}
        maxWorkers={this.state.autoScaleMaxWorkers}
        nodeTypeId={this.state.nodeTypeId}
        driverNodeTypeId={this.state.driverNodeTypeId}
        nodeTypes={window.settings.nodeInfo.node_types}
      />
    );
  },

  _setCreateSummary(attrObj) {
    let workers = attrObj.workers + attrObj.spotWorkers;
    let autoScaleMaxWorkers = 0;

    // if auto scaling, set the max workers and (for hybrid clusters) min workers
    // (workers/spotWorkers are used for mins in autoscaled on demand & spot clusters)
    if (attrObj.showAutoScaleInputs) {
      autoScaleMaxWorkers = attrObj.autoScaleMaxWorkers + attrObj.autoScaleMaxSpotWorkers;
      if (attrObj.mixedAutoScaleMinWorkers) {
        workers = attrObj.mixedAutoScaleMinWorkers;
      }
    }

    this.setState({
      numWorkers: workers,
      autoScaleMaxWorkers: autoScaleMaxWorkers,
      nodeTypeId: attrObj.nodeTypeId,
      driverNodeTypeId: attrObj.driverNodeTypeId,
    });
  },

  render() {
    const body = (<ReactClusterBody
      ref='body'
      basicInfo={this.props.basicInfo}
      clusters={this.props.clusters}
      confirmOnEnter={this.confirmOnEnter}
      enableVersionUI={this.props.enableVersionUI}
      enableCustomVersionUI={this.props.enableCustomVersionUI}
      initialClusterType={this.state.clusterType}
      showExistingClusterDropdown={this._shouldShowExistingClusterDropdown()}
      setCreateSummary={this._setCreateSummary}
      setParentWorkersValid={this.setWorkersValidState}
      setParentClusterType={this._setClusterTypeState}
      toggleClusterCreateButton={this._toggleClusterCreateButton}
      zoneInfos={this.props.zoneInfos}
      restrictedClusterCreation={this.props.restrictedClusterCreation}
    />);

    // the extra enable-hybrid-clusters class controls styles in the new modal
    const modalName = 'job-cluster-dialog enable-hybrid-clusters';

    return (
      <ReactModal
        classes={"dialog-set-cluster"}
        modalName={modalName}
        header={this._getHeader()}
        body={body}
        footer={null}
      />
    );
  },
});
