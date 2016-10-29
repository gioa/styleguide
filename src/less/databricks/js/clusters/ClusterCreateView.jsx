/* eslint complexity: 0, consistent-return: 0 */

import _ from 'underscore';
import React from 'react';

import { AdvancedSettings } from '../clusters/AdvancedSettings.jsx';
import ClusterList from '../clusters/ClusterList';
import { ClusterNameInput } from '../clusters/ClusterNameInput.jsx';
import { ClusterWorkersInput } from '../clusters/ClusterWorkersInput.jsx';
import { ClusterUtil, isGpuNodeType, isGpuSparkVersion } from '../clusters/Common.jsx';
import { default as Cluster } from '../clusters/Cluster';
import { CustomSparkVersionInput } from '../clusters/CustomSparkVersionInput.jsx';
import { SparkVersionInput } from '../clusters/SparkVersionInput.jsx';
import { SparkVersionUtils } from '../clusters/SparkVersionUtils';

export class ClusterCreateView extends React.Component {

  constructor(props) {
    super(props);

    this._onNameValidation = this._onNameValidation.bind(this);
    this.onClusterTypeChange = this.onClusterTypeChange.bind(this);
    this._onWorkersInputValidation = this._onWorkersInputValidation.bind(this);
    this.onAdvancedChange = this.onAdvancedChange.bind(this);

    const defaultState = this.getDefaultState(this.props);
    this.state = defaultState;

    // @TODO(jengler) 2016-07-11: This is bad and needs to go. Store it in the state.
    this.current = {
      sparkVersion: defaultState.sparkVersion,
      zoneId: this.props.defaultZoneId,
      sparkConf: this.props.sparkConf,
      sshKey: this.props.sshKey,
    };
  }

  isClusterAutoScaling(props) {
    return props.configureDefaults.maxWorkers > 0;
  }

  /**
   * Convert the jobs configurations to a cluster so we can re-use the cluster Model's code:
   *
   * @param  {object} props The props used to invoke this instance
   * @return {Cluster}      The Cluster instance for the current props.
   */
  convertJobsPropsToClusterModel(props) {
    const defaults = props.configureDefaults;
    // Spot is by default true (unless this is a preconfigured job cluster with spot = false).
    const useSpotForWorkers =
      defaults.useSpotForWorkers === undefined || defaults.useSpotForWorkers;
    const clusterFields = {
      numWorkers: props.defaultNumWorkers,
      useSpotInstance: useSpotForWorkers,
      spotBidPricePercent: defaults.spotBidPricePercent,
      firstOnDemand: defaults.firstOnDemand,
      minWorkers: defaults.minWorkers,
      maxWorkers: defaults.maxWorkers,
      isAutoscaling: this.isClusterAutoScaling(props),
    };
    return new Cluster(clusterFields);
  }

  getDefaultInstanceType(props) {
    if (props.configureDefaults.instanceType) {
      return props.configureDefaults.instanceType;
    } else if (props.enableHybridClusterType) {
      return ClusterWorkersInput.INSTANCE_MIXED;
    }
    return ClusterWorkersInput.INSTANCE_SPOT;
  }

  getDefaultNumWorkers(cluster) {
    if (cluster.get('isAutoscaling')) {
      if (cluster.isHybrid()) {
        cluster.get('firstOnDemand');
      } else {
        cluster.get('minWorkers');
      }
    }

    return cluster.numOnDemandWorkers();
  }

  getDefaultState(props) {
    const cluster = this.convertJobsPropsToClusterModel(props);
    const instanceType = this.getDefaultInstanceType(props);

    const defaultSpotWorkers =
      cluster.get('isAutoscaling') ? cluster.get('minWorkers') : cluster.numSpotWorkers();
    const defaultNumWorkers = this.getDefaultNumWorkers(cluster);

    const defaultSparkVersion = props.configureDefaults.defaultSparkVersionKey ||
      SparkVersionUtils.getDefaultSparkVersion();
    const showAutoScaleWarning = cluster.get('isAutoscaling') &&
      ClusterUtil.isSparkVersionBadForAutoscaling(defaultSparkVersion);

    return {
      showAutoScaleInputs: cluster.get('isAutoscaling'),
      nodeTypeId: props.defaultNodeType,
      driverNodeTypeId: props.defaultDriverNodeTypeId,
      workers: defaultNumWorkers,
      spotWorkers: defaultSpotWorkers,
      showAutoScaleWarning: showAutoScaleWarning,
      sparkVersion: defaultSparkVersion,
      minWorkers: cluster.get('minWorkers'),
      maxWorkers: cluster.get('maxWorkers'),
      // If name is enabled, it is empty and so invalid by default
      nameValid: !props.enableClusterName,
      sparkVersions: props.sparkVersions,
      workersValid: true,
      // If set to true, the user has selected a driver image that only works with GPUs.
      // This indicates that only GPU instance types will be accepted in the UI.
      gpuWorkloadIsSelected: isGpuSparkVersion(defaultSparkVersion),
      instanceType: instanceType,
      ebsVolumeType: props.configureDefaults.ebsVolumeType,
      ebsVolumeSize: props.configureDefaults.ebsVolumeSize,
      ebsVolumeCount: props.configureDefaults.ebsVolumeCount,
      instanceProfileArn: props.configureDefaults.instanceProfileArn,
      customTags: props.configureDefaults.customTags,
    };
  }

  getNodeType(nodeTypeId) {
    // nodeTypeId may be undefined if it is not explicitly set yet (specifically for driver)
    // This guard prevents a JS exception
    return ClusterUtil.getNodeType(nodeTypeId || this.props.defaultNodeType, this.props.nodeTypes);
  }

  getAutoScaleMin() {
    if (!this.clusterType) {
      // we are opening a previously configured cluster, use configureDefaults
      return this.props.configureDefaults.minWorkers;
    }
    if (this.state.instanceType === ClusterWorkersInput.INSTANCE_ONDEMAND) {
      return this.state.workers;
    } else if (this.state.instanceType === ClusterWorkersInput.INSTANCE_MIXED) {
      return this.clusterType.state.mixedAutoScaleMinWorkers;
    } else if (this.state.instanceType === ClusterWorkersInput.INSTANCE_SPOT) {
      return this.state.spotWorkers;
    }
  }

  getAutoScaleMax() {
    if (!this.clusterType) {
      // we are opening a previously configured cluster, use configureDefaults
      return this.props.configureDefaults.maxWorkers;
    }
    if (this.state.instanceType === ClusterWorkersInput.INSTANCE_ONDEMAND ||
      this.state.instanceType === ClusterWorkersInput.INSTANCE_MIXED) {
      return this.clusterType.state.autoScaleMaxWorkers;
    } else if (this.state.instanceType === ClusterWorkersInput.INSTANCE_SPOT) {
      return this.clusterType.state.autoScaleMaxSpotWorkers;
    }
  }

  collect() {
    const sparkV = this.current.sparkVersion;
    const customV = this.current.customVersion;

    let useSpot = false;
    let firstOnDemand = 0;

    if (this.state.instanceType === ClusterWorkersInput.INSTANCE_ONDEMAND) {
      useSpot = false;
      firstOnDemand = 0;
    } else if (this.state.instanceType === ClusterWorkersInput.INSTANCE_MIXED) {
      useSpot = true;
      // When a mixed cluster is chosen, we add one to put the driver on demand
      firstOnDemand = this.state.workers + 1;
    } else if (this.state.instanceType === ClusterWorkersInput.INSTANCE_SPOT) {
      useSpot = true;
      firstOnDemand = 0;
    }

    const nodeTypeId = this.state.nodeTypeId ? this.state.nodeTypeId : this.props.defaultNodeType;
    const driverNodeTypeId =
        this.state.driverNodeTypeId ? this.state.driverNodeTypeId : this.props.defaultNodeType;
    const zoneId = this.current.zoneId ? this.current.zoneId : this.props.defaultZoneId;

    const createParams = {
      numWorkers: this.state.workers + this.state.spotWorkers,
      useSpotInstance: useSpot,
      sparkVersion: customV || sparkV,
      sparkConf: this.current.sparkConf,
      sshPublicKeys: this.current.sshKey,
      fallbackToOndemand: this.clusterType.getFallbackToOndemand(),
      firstOnDemand: firstOnDemand,
    };

    if (this.state.ebsVolumeType) {
      createParams.ebsVolumeType = this.state.ebsVolumeType;
      createParams.ebsVolumeCount = this.state.ebsVolumeCount;
      createParams.ebsVolumeSize = this.state.ebsVolumeSize;
    }

    if (this.state.instanceProfileArn) {
      createParams.instanceProfileArn = this.state.instanceProfileArn;
    }

    if (this.state.customTags && this._shouldSubmitAWSTags(nodeTypeId, driverNodeTypeId)) {
      createParams.customTags = this.state.customTags;
    }

    if (useSpot && !this.props.restrictedClusterCreation &&
      window.settings.enableCustomSpotPricing) {
      createParams.spotBidPricePercent = this.advanced.state.spotBidPrice;
    }

    // Omit missing information if it hasn't been loaded yet.
    if (typeof nodeTypeId !== 'undefined' && nodeTypeId !== '') {
      _.extend(createParams, { nodeTypeId: nodeTypeId });
    }

    if (typeof driverNodeTypeId !== 'undefined' && driverNodeTypeId !== '') {
      _.extend(createParams, { driverNodeTypeId: driverNodeTypeId });
    }

    if (typeof zoneId !== 'undefined' && nodeTypeId !== '') {
      _.extend(createParams, { zoneId: zoneId });
    }

    // only submit either numWorkers (regular) OR minWorkers and maxWorkers (autoscaled)
    if (this.state.showAutoScaleInputs) {
      delete createParams.numWorkers;
      createParams.minWorkers = this.getAutoScaleMin();
      createParams.maxWorkers = this.getAutoScaleMax();
    }

    if (this.props.enableClusterName) {
      createParams.clusterName = this.clusterName.get();
    }

    return createParams;
  }

  _shouldSubmitAWSTags(nodeTypeId, driverNodeTypeId) {
    return this.advanced.doNodeTypesSupportTags(
      [nodeTypeId, driverNodeTypeId],
      this.props.nodeTypes
    );
  }

  onAdvancedChange(attrObj) {
    _.extend(this.current, {
      zoneId: attrObj.zoneId,
      sparkConf: attrObj.sparkConf,
      sshKey: attrObj.sshKey,
      spotBidPricePercent: attrObj.spotBidPricePercent,
      ebsVolumeType: attrObj.ebsVolumeType,
      ebsVolumeCount: attrObj.ebsVolumeCount,
      ebsVolumeSize: attrObj.ebsVolumeSize,
      nodeTypeId: attrObj.nodeTypeId,
      driverNodeTypeId: attrObj.driverNodeTypeId,
      instanceProfileArn: attrObj.instanceProfileArn,
      customTags: attrObj.customTags,
    });

    const newState = this.setStateAndDispatchChange(attrObj);
    const validState = this._isValidState(newState);
    this._onToggleClusterCreateButton(validState);
  }

  onClusterTypeChange(attrObj) {
    const newState = this.setStateAndDispatchChange(attrObj);
    const validState = this._isValidState(newState);
    this._onToggleClusterCreateButton(validState);
  }

  onAttrChange(name, value) {
    const attrObj = {};
    attrObj[name] = value;
    _.extend(this.current, attrObj);

    const newState = this.setStateAndDispatchChange(attrObj);
    const validState = this._isValidState(newState);
    this._onToggleClusterCreateButton(validState);
  }

 /**
   * The changes to perform on the state for a given spark version.
   *
   * Invariants assumed to hold: props.defaultNodeTypeId is not a GPU type.
   *
   * Stateless.
   *
   * @return {object}
   */
  _getSparkVersionStateChanges(sparkVersion) {
    const gpuWorkloadIsSelected = isGpuSparkVersion(sparkVersion);
    const attrObj = {
      sparkVersion: sparkVersion,
      gpuWorkloadIsSelected: gpuWorkloadIsSelected,
    };

    const nodeTypeChanges = this._getNodeTypeStateChangesForSparkVersion(gpuWorkloadIsSelected);
    // Disregard all changes if some invariants are not respected.
    if (nodeTypeChanges === null) {
      return {};
    }
    _.extend(attrObj, nodeTypeChanges);
    return attrObj;
  }

  /**
   * The changes to the node types (if any) to take into account the hardware requirements
   * of the Spark version.
   *
   * @param {bool} gpuWorkloadIsSelected true if the user has selected a GPU worload
   * @return {object} a set of new attributes to the state, or null if the input is invalid.
   */
  _getNodeTypeStateChangesForSparkVersion(gpuWorkloadIsSelected) {
    // All the node types compatible with GPU-enabled spark versions.
    const gpuNodeTypes = this.props.nodeTypes.filter(isGpuNodeType);
    // If a GPU type has been selected, set the nodeTypes to something GPU-like.
    // Otherwise, make sure a GPU node is *not* selected.

    // It may the case that we do not even have gpu nodes available on this shard.
    // The configuration sent to the frontend is expected to offer some GPU node types if a
    // dedicated GPU image is presented in the frontend. In any case, the manager will reject
    // invalid combinations.
    if (gpuWorkloadIsSelected && gpuNodeTypes.length === 0) {
      console.warn('A GPU workload has been selected, but no node supports this workload');
      // The changes are not taken into account.
      return null;
    }
    const attrObj = {};
    const currentNodeIsGpu = isGpuNodeType(this.getNodeType(this.state.nodeTypeId));
    const currentDriverNodeIsGpu = isGpuNodeType(this.getNodeType(this.state.driverNodeTypeId));

    if (gpuWorkloadIsSelected) {
      // Same node for both driver and worker.
      const defaultNodeTypeId = gpuNodeTypes[0].node_type_id;
      if (!currentNodeIsGpu) {
        attrObj.nodeTypeId = defaultNodeTypeId;
      }
      if (!currentDriverNodeIsGpu) {
        attrObj.driverNodeTypeId = defaultNodeTypeId;
      }
      return attrObj;
    }

    // This is the regular workload with only CPUs.
    const defaultNodeTypeId = this.props.defaultNodeType;
    // A default driver node type may not be defined, reuse the default node type.
    const defaultDriverNodeTypeId = this.props.defaultDriverNodeTypeId || defaultNodeTypeId;
    if (currentNodeIsGpu) {
      attrObj.nodeTypeId = defaultNodeTypeId;
    }
    if (currentDriverNodeIsGpu) {
      attrObj.driverNodeTypeId = defaultDriverNodeTypeId;
    }
    return attrObj;
  }

  _onSparkVersionChange(sparkVersion) {
    // Copied from onAttrChange because 4 state items are changed at once.
    const attrObj = this._getSparkVersionStateChanges(sparkVersion);
    if (!attrObj) {
      return;
    }

    _.extend(this.current, attrObj);
    const newState = this.setStateAndDispatchChange(attrObj);
    const validState = this._isValidState(newState);
    this._onToggleClusterCreateButton(validState);
  }
  toggleAutoscalingWarning(stateObj) {
    // (PROD-11520) show warning if spark version is below 1.6.2 and autoscaling is checked
    this.setState({
      showAutoScaleWarning: stateObj.showAutoScaleInputs &&
        ClusterUtil.isSparkVersionBadForAutoscaling(stateObj.sparkVersion),
    });
  }

  // Resolves a spark version key (e.g. "1.2") to a sparkVersion struct, or null.
  getSparkVersion() {
    const defaultKey = this.props.configureDefaults.defaultSparkVersionKey;
    const defaultSparkKey = defaultKey || SparkVersionUtils.getDefaultSparkVersion();
    const found = _.find(this.state.sparkVersions, function matchDefaultSparkKey(version) {
      if (version.key === defaultSparkKey) {
        return version;
      }
    });
    if (found) {
      return found;
    }
    return this.props.defaultSparkVersion;
  }

  _isValidState(state) {
    return state.workersValid && state.nameValid;
  }

  /**
   * @NOTE(jengler) 2016-07-14: I don't know why onChange and onValidation are separate for the
   * sub-components. Seems like on change should just pass an attribute saying if it is valid?
   * For now, keeping them separate.
   *
   * @param {object} changes [description]
   */
  setStateAndDispatchChange(changes) {
    this.setState(changes);
    const newState = Object.assign({}, this.state, changes);
    if (this.props.onChange) {
      this.props.onChange(newState);
    }
    this.toggleAutoscalingWarning(newState);
    return newState;
  }

  /**
   * @NOTE(jengler) 2016-07-14: I don't know why onChange and onValidation are separate for the
   * sub-components. Seems like on change should just pass an attribute saying if it is valid?
   * For now, keeping them separate.
   *
   * @param {object} validationChanges [description]
   */
  setStateAndDispatchValidation(validationChanges) {
    this.setState(validationChanges);
    const validState = this._isValidState(Object.assign({}, this.state, validationChanges));
    this._onToggleClusterCreateButton(validState);
  }

  _onNameValidation(isValid) {
    this.setStateAndDispatchValidation({ nameValid: isValid });
  }

  _onWorkersInputValidation(isValid) {
    this.setStateAndDispatchValidation({ workersValid: isValid });
  }

  _onToggleClusterCreateButton(isValid) {
    if (this.props.toggleClusterCreateButton) {
      this.props.toggleClusterCreateButton(isValid);
    }
  }

  componentDidMount() {
    if (this.clusterName) {
      this.clusterName.focus();
    }
    if (window.settings.dynamicSparkVersions) {
      ClusterUtil.updateSparkVersions(window.settings, (latestVersions) => {
        this.setState({ sparkVersions: latestVersions });
      });
    }
  }

  _getDefaultSpotBid() {
    if (this.props.configureDefaults && this.props.configureDefaults.spotBidPricePercent) {
      return this.props.configureDefaults.spotBidPricePercent;
    }
    // 100 is fail-safe; should match CommonConf
    return (window.settings && window.settings.defaultSpotBidPricePercent) || 100;
  }

  render() {
    const state = this.state;
    const clusterNameRef = (ref) => this.clusterName = ref;
    const onNameChange = this.onAttrChange.bind(this, 'name');
    const sparkVersionRef = (ref) => this.sparkVersion = ref;
    const onSparkVersionChange = this._onSparkVersionChange.bind(this);
    const customVersionRef = (ref) => this.customVersion = ref;
    const onCustomVersionChange = this.onAttrChange.bind(this, 'customVersion');
    const clusterTypeRef = (ref) => this.clusterType = ref;
    const advancedRef = (ref) => this.advanced = ref;
    const hideSpotBidPrice = state.instanceType === ClusterWorkersInput.INSTANCE_ONDEMAND ||
      this.props.restrictedClusterCreation;

    return (
        <div>
          <div>
            {this.props.enableClusterName ?
              <ClusterNameInput
                ref={clusterNameRef}
                clusters={this.props.clusters}
                onChange={onNameChange}
                onNameValidation={this._onNameValidation}
              /> : <div />}
            {this.props.enableSparkVersionsUI ?
              <SparkVersionInput
                ref={sparkVersionRef}
                onChange={onSparkVersionChange}
                defaultSparkVersion={this.getSparkVersion()}
                gpuWorkloadIsSelected={state.gpuWorkloadIsSelected}
                sparkVersions={state.sparkVersions}
                showHiddenSparkVersions={this.props.showHiddenSparkVersions}
                hideMissingSparkPackageWarning={this.props.hideMissingSparkPackageWarning}
              /> : <div />}
            {this.props.enableCustomSparkVersions ?
              <CustomSparkVersionInput
                ref={customVersionRef}
                defaultVersionKey={this.props.customVersion}
                onChange={onCustomVersionChange}
              /> : <div />}
            {this.props.enableInstanceType ?
              <ClusterWorkersInput
                ref={clusterTypeRef}
                showAutoScaleCheckbox={this.props.showAutoScaleCheckbox}
                enableAutoScale={this.props.enableAutoScale}
                enableHybridClusterType={this.props.enableHybridClusterType}
                restrictedClusterCreation={this.props.restrictedClusterCreation}
                defaultClusterType={state.instanceType}
                defaultNumWorkers={state.workers}
                defaultSpotWorkers={state.spotWorkers}
                defaultEnableAutoScale={this.isClusterAutoScaling(this.props)}
                defaultMinAutoScaleWorkers={state.minWorkers}
                defaultMaxAutoScaleWorkers={state.maxWorkers}
                defaultFallbackToOnDemand={this.props.fallbackToOndemand}
                nodeType={this.getNodeType(state.nodeTypeId)}
                driverNodeType={this.getNodeType(state.driverNodeTypeId)}
                toggleClusterCreateButton={this._onWorkersInputValidation}
                onChange={this.onClusterTypeChange}
                showAutoScaleWarning={state.showAutoScaleWarning}
              /> : <div />}
          </div>
          <div>
            <AdvancedSettings {...this.props}
              ref={advancedRef}
              onChange={this.onAdvancedChange}
              enableAZ={this.props.enableAZ}
              enableNodeType={this.props.enableNodeType}
              defaultZoneId={this.props.defaultZoneId}
              // Override the default choices with the current state, because the default choices
              // may be invalide for GPU configurations.
              defaultNodeType={state.nodeTypeId}
              defaultDriverNodeTypeId={state.driverNodeTypeId}
              defaultSparkConf={this.props.sparkConf}
              defaultSshKey={this.props.sshKey}
              renderSsh={this.props.renderSsh}
              renderTags={this.props.renderTags}
              zoneInfos={this.props.zoneInfos}
              nodeTypes={this.props.nodeTypes}
              hideSpotBidPrice={hideSpotBidPrice}
              defaultSpotBid={this._getDefaultSpotBid()}
              restrictedClusterCreation={this.props.restrictedClusterCreation}
              ebsVolumeType={state.ebsVolumeType}
              ebsVolumeCount={state.ebsVolumeCount}
              ebsVolumeSize={state.ebsVolumeSize}
              numWorkers={state.showAutoScaleInputs ? null : state.workers + state.spotWorkers}
              minWorkers={state.showAutoScaleInputs ? this.getAutoScaleMin() : null}
              maxWorkers={state.showAutoScaleInputs ? this.getAutoScaleMax() : null}
              showEBSVolumes={this.props.showEBSVolumes}
              gpuWorkloadIsSelected={state.gpuWorkloadIsSelected}
              showInstanceProfiles={this.props.showInstanceProfiles}
              instanceProfileArn={state.instanceProfileArn}
              customTags={state.customTags}
            />
          </div>
        </div>);
  }
}

ClusterCreateView.propTypes = {
  clusters: React.PropTypes.instanceOf(ClusterList).isRequired,
  // used when configuring a cluster for a job to show current properties on the model
  configureDefaults: React.PropTypes.object,
  customVersion: React.PropTypes.object,
  defaultCoresPerContainer: React.PropTypes.number,
  defaultNumWorkers: React.PropTypes.number,
  defaultNodeType: React.PropTypes.string,
  defaultDriverNodeTypeId: React.PropTypes.string,
  defaultSparkVersion: React.PropTypes.object.isRequired,
  defaultZoneId: React.PropTypes.string,
  // tier-based; controls whether the auto scale checkbox is greyed out & disabled
  enableAutoScale: React.PropTypes.bool,
  // controls whether the auto scale checkbox appears at all
  showAutoScaleCheckbox: React.PropTypes.bool,
  enableAZ: React.PropTypes.bool,
  enableClusterName: React.PropTypes.bool,
  enableCustomSparkVersions: React.PropTypes.bool,
  enableHybridClusterType: React.PropTypes.bool,
  enableInstanceType: React.PropTypes.bool,
  enableNodeType: React.PropTypes.bool,
  enableSparkVersionsUI: React.PropTypes.bool,
  fallbackToOndemand: React.PropTypes.bool,
  hideMissingSparkPackageWarning: React.PropTypes.bool,
  nodeTypes: React.PropTypes.array.isRequired,
  restrictedClusterCreation: React.PropTypes.bool,
  // Note: right now this callback is not executed for every input change, only
  // in onClusterTypeChange, and onAdvancedChange
  onChange: React.PropTypes.func,
  showHiddenSparkVersions: React.PropTypes.bool,
  sparkConf: React.PropTypes.object,
  sshKey: React.PropTypes.array,
  sparkVersions: React.PropTypes.array,
  // disables/enables the create button in the header depending on worker validation
  toggleClusterCreateButton: React.PropTypes.func,
  zoneInfos: React.PropTypes.array.isRequired,
  renderSsh: React.PropTypes.bool,
  renderTags: React.PropTypes.bool,
  showEBSVolumes: React.PropTypes.bool,
  showInstanceProfiles: React.PropTypes.bool,
};

ClusterCreateView.defaultProps = {
  configureDefaults: {},
  enableAutoScale: true,
  enableAZ: true,
  enableClusterName: true,
  enableSparkVersionsUI: true,
  enableInstanceType: true,
  enableCustomSparkVersions: false,
  enableHybridClusterType: true,
  enableNodeType: true,
  nodeType: 'memory-optimized',
  restrictedClusterCreation: false,
  showAutoScaleCheckbox: false,
  sparkConf: {},
  sshKey: [],
};
