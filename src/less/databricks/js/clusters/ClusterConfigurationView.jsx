/* eslint react/prefer-es6-class: 0, complexity: 0, consistent-return: 0 */

import $ from 'jquery';
import _ from 'underscore';
import React from 'react';

import { AclUtils } from '../acl/AclUtils.jsx';
import { PermissionEditBody } from '../acl/PermissionEditView.jsx';

import { ClusterConfigure } from './ReactClusterListView.jsx';
import ReactSparkConfElement from './ReactSparkConfElement.jsx';
import {
  ClusterUtil,
  AZTooltip,
  TypeTooltip,
  CustomSpotPriceTooltip,
  InstanceStats,
  DBUTooltip,
  Label,
  SshExampleTooltip,
  SshInstructions,
} from '../clusters/Common.jsx';
import { InstanceProfileField } from '../clusters/InstanceProfileElements.jsx';
import { EBSVolumeUtils } from '../clusters/EBSVolumeUtils.jsx';
import Cluster from '../clusters/Cluster';
import { ClusterWorkersInput } from './ClusterWorkersInput.jsx';
import { AwsTagList } from '../clusters/aws_tags/AwsTagList.jsx';
import { AwsTagListViewConstants } from '../clusters/aws_tags/AwsTagListViewConstants';

import { Tabs, Panel } from '../ui_building_blocks/TabsView.jsx';
import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

import { IamRolesUtils } from '../user_menu/iam_roles/IamRolesUtils.jsx';

const SPARK_CONF = 'sparkConf';

const doubleDownIcon = <i className='fa fa-angle-double-down' />;
const doubleUpIcon = <i className='fa fa-angle-double-up' />;

const ClusterConfigurationView = React.createClass({
  propTypes: {
    cluster: React.PropTypes.instanceOf(Cluster).isRequired,
    changesMade: React.PropTypes.func.isRequired,
    enableAutoScale: React.PropTypes.bool.isRequired,
    workersConfigurable: React.PropTypes.bool,
    workspaceAcl: React.PropTypes.object,
    permissionsConfigurable: React.PropTypes.bool,
    restrictedClusterCreation: React.PropTypes.bool,
    nodeMemory: React.PropTypes.number,
    nodeCores: React.PropTypes.number,
    nodeTypes: React.PropTypes.array,
    nodeType: React.PropTypes.object,
    driverNodeType: React.PropTypes.object,
    driverMemory: React.PropTypes.number,
    driverCores: React.PropTypes.number,
    onChange: React.PropTypes.func,
  },

  getDefaultProps() {
    return {
      workersConfigurable: true,
      permissionsConfigurable: true,
    };
  },

  getInitialState() {
    const cluster = this.props.cluster;
    const isAutoscaling = cluster.get('isAutoscaling');
    const showAutoScaleWarning = isAutoscaling &&
      ClusterUtil.isSparkVersionBadForAutoscaling(cluster.get('sparkVersion'));
    const numberOfWorkers = this.getDefaultNumWorkers(cluster) + cluster.numSpotWorkers();

    return {
      showAdvancedSettings: true,
      showAutoScaleWarning: showAutoScaleWarning,
      workersValid: true,
      sparkConfHasChanged: false,
      numberOfWorkersHasChanged: false,
      workspaceAclsHasChanged: false,
      activeTab: 'aws',
      showAutoScaleInputs: isAutoscaling,
      numberOfWorkers: isAutoscaling ? null : numberOfWorkers,
      minWorkers: isAutoscaling ? cluster.get('minWorkers') : null,
      maxWorkers: isAutoscaling ? cluster.get('maxWorkers') : null,
    };
  },

  toggleAutoscalingWarning(isAutoscalingEnabled) {
    this.setState({
      showAutoScaleWarning: isAutoscalingEnabled &&
        ClusterUtil.isSparkVersionBadForAutoscaling(this.props.cluster.get('sparkVersion')),
    });
  },

  componentDidUpdate() {
    const workspaceAcl = this.props.workspaceAcl;
    if (workspaceAcl) {
      workspaceAcl.on('change', this.aclsHasChanged.bind(this, workspaceAcl), this);
    }
  },

  componentWillUnmount() {
    this.props.changesMade({}, false);
    this.cancelChangesHandler(this.props.cluster);
    if (this.props.workspaceAcl) {
      this.props.workspaceAcl.off(null, null, this);
    }
  },

  collapseHandler(e) {
    e.preventDefault();
    window.recordEvent('clusterDetailsAdvancedSettingsExpanded', {
      'clusterDetailsAdvancedSettingsExpandState': !this.state.showAdvancedSettings,
    });
    this.setState({ showAdvancedSettings: !this.state.showAdvancedSettings });
  },

  hasChanged() {
    return this.state.sparkConfHasChanged || this.state.numberOfWorkersHasChanged ||
           this.state.workspaceAclsHasChanged;
  },

  cancelChangesHandler(cluster) {
    if (cluster) {
      let numberOfWorkers;
      if (cluster.isHybrid()) {
        numberOfWorkers = cluster.numSpotWorkers();
      } else {
        numberOfWorkers = cluster.get('numWorkers');
      }
      this.setState({
        numberOfWorkers: numberOfWorkers,
        numberOfWorkersHasChanged: false,
        workersValid: true,
        sparkConfHasChanged: false,
        workspaceAclsHasChanged: false,
      });
      $('#number-workers').removeClass('invalid-form');
      if ($('#cluster-conf-form')[0]) {
        $('#cluster-conf-form')[0].reset();
      }
      // Commented out while spark conf is readonly
      // if (this.refs[SPARK_CONF]) {
      //   this.refs[SPARK_CONF].setState({feedback: ""});
      // }
      if (this.props.workspaceAcl) {
        this.props.workspaceAcl.resetAllChanges();
      }
    }
    this.refs.clusterWorkersInput.resetState();
  },

  aclsHasChanged(workspaceAcl) {
    this.setState({
      workspaceAclsHasChanged: workspaceAcl.hasChanges(),
    }, () => {
      this.props.changesMade({}, this.hasChanged(), this.cancelChangesHandler,
        this.state.workersValid);
    });
  },

  /**
   * Helper functions for parsing state returned from ClusterWorkersInput when then instance type
   * is Spot.
   *
   * @param  {Cluster} cluster The cluster being configured
   * @param  {object} state   The state object returned by the ClusterWorkersInput.onChange callback
   * @return {object}
   * Output will be the state values for the worker composition. For example,
   * - If Autoscaling:
   *  {
   *    minWorkers:
   *    maxWorkers:
   *  }
   * - If non-autoscaling:
   *  {
   *    numberOfWorkers:
   *  }
   */
  getChangesForSpot(state) {
    const autoScalingEnabled = state.showAutoScaleInputs;
    if (autoScalingEnabled) {
      return {
        minWorkers: state.spotWorkers,
        maxWorkers: state.autoScaleMaxSpotWorkers,
      };
    }
    return {
      numberOfWorkers: state.spotWorkers,
    };
  },

  /**
   * Helper functions for parsing state returned from ClusterWorkersInput when then instance type
   * is OnDemand.
   *
   * @param  {Cluster} cluster The cluster being configured
   * @param  {object} state   The state object returned by the ClusterWorkersInput.onChange callback
   * @return {object}
   * Output will be the state values for the worker composition. For example,
   * - If Autoscaling:
   *  {
   *    minWorkers:
   *    maxWorkers:
   *  }
   * - If non-autoscaling:
   *  {
   *    numberOfWorkers:
   *  }
   */
  getChangesForOnDemand(state) {
    const autoScalingEnabled = state.showAutoScaleInputs;
    if (autoScalingEnabled) {
      return {
        minWorkers: state.workers,
        maxWorkers: state.autoScaleMaxWorkers,
      };
    }
    return {
      numberOfWorkers: state.workers,
    };
  },

  /**
   * Helper functions for parsing state returned from ClusterWorkersInput when then instance type
   * is Hybrid.
   *
   * @param  {Cluster} cluster The cluster being configured
   * @param  {object} state   The state object returned by the ClusterWorkersInput.onChange callback
   * @return {object}
   * Output will be the state values for the worker composition. For example,
   * - If Autoscaling:
   *  {
   *    minWorkers:
   *    maxWorkers:
   *  }
   * - If non-autoscaling:
   *  {
   *    numberOfWorkers:
   *  }
   */
  getChangesForHybrid(state) {
    const autoScalingEnabled = state.showAutoScaleInputs;
    if (autoScalingEnabled) {
      return {
        minWorkers: state.mixedAutoScaleMinWorkers,
        maxWorkers: state.autoScaleMaxWorkers,
      };
    }
    // For Hybrid clusters, the resizing specifies the total number of workers, spot and on-demand
    // together. Even though the on-demand workers cannot be reconfigured.
    return {
      numberOfWorkers: state.workers + state.spotWorkers,
    };
  },

  /**
   * Get a change object for the cluster.
   *
   * @param  {Cluster} cluster The cluster being changed
   * @param  {object} state   The state object returned by the ClusterWorkersInput.onChange callback
   * @return {object} The change object. If the changes are for autoscaling, numberOfWorkers will
   * be set to undefined. If non-autoscaling, minWorkers and maxWorkers will be set to undefined.
   */
  getChangesForCluster(cluster, state) {
    let changes;
    if (cluster.isSpotOnly()) {
      changes = this.getChangesForSpot(state);
    } else if (cluster.isOnDemandOnly()) {
      changes = this.getChangesForOnDemand(state);
    } else {
      changes = this.getChangesForHybrid(state);
    }

    // We want to make sure we clear out any previously changed values.
    const defaults = {
      minWorkers: null,
      maxWorkers: null,
      numberOfWorkers: null,
    };
    return _.extend(defaults, changes);
  },

  didClusterConfigurationChange(cluster, changes, autoScalingEnabled) {
    if (autoScalingEnabled !== cluster.get('isAutoscaling')) {
      // Auto-scaling has been changed, so must update.
      return true;
    }

    if (autoScalingEnabled) {
      if (cluster.get('minWorkers') !== changes.minWorkers ||
          cluster.get('maxWorkers') !== changes.maxWorkers) {
        return true;
      }
    } else if (cluster.get('numWorkers') !== changes.numberOfWorkers) {
      return true;
    }

    return false;
  },

  onInstanceChange(cluster, state) {
    const workerChanges = this.getChangesForCluster(cluster, state);
    const autoScalingEnabled = state.showAutoScaleInputs;
    const didConfigurationChange =
      this.didClusterConfigurationChange(cluster, workerChanges, autoScalingEnabled);

    this.setState(workerChanges);
    this.setState({
      numberOfWorkersHasChanged: didConfigurationChange,
    }, () => {
      this.props.changesMade(workerChanges, this.hasChanged(), this.cancelChangesHandler,
        this.state.workersValid);
    });
  },

  updateSparkConf(cluster, conf) {
    const oldSparkConf = cluster.get('sparkConf');

    this.setState({
      sparkConfHasChanged: !_.isEqual(oldSparkConf, conf),
    }, () => {
      this.setState({ sparkConf: conf });
      this.props.changesMade({
        sparkConf: conf,
      }, this.hasChanged(), this.cancelChangesHandler, this.state.workersValid);
    });
  },

  setAdvancedSettingsTab(activeTab) {
    this.setState({ activeTab: activeTab });
  },

  metricFunction(tabClicked) {
    window.recordEvent('clusterDetailsAdvancedSettingsTabClicked', {
      'clusterDetailsAdvancedSettingsTab': tabClicked,
    });
  },

  _renderCustomSpotPrice() {
    // feature flag
    if (!window.settings.enableCustomSpotPricing) { return null; }

    // don't show for community edition or on-demand clusters
    if (this.props.restrictedClusterCreation || this.props.cluster.isOnDemandOnly()) {
      return null;
    }

    const min = window.settings && window.settings.minSpotBidPricePercent;
    const max = window.settings && window.settings.maxSpotBidPricePercent;

    return (
      <div className='custom-spot-price section-padded'>
        <div>
          <Label>Spot Bid Price</Label>{' '}
          <CustomSpotPriceTooltip min={min} max={max} />
        </div>
        <div className='spot-price'>
          {this.props.cluster.get('spotBidPricePercent')}&#37; of on-demand instance price
        </div>
      </div>
    );
  },

  shouldRenderSshTab() {
    return window.settings.enableSshKeyUI && !this.props.restrictedClusterCreation;
  },

  shouldRenderTagsTab() {
    return window.settings.enableClusterTagsUI && !this.props.restrictedClusterCreation;
  },

  _renderSshTab(metricFunc) {
    const port = window.settings.sshContainerForwardedPort;
    const driverHostname = this.props.cluster.get('driverDisplayableAddress');
    return (
      <Panel key='driverIp' title='SSH' name='driverIp' onClick={metricFunc}>
        <div className='tab-info-section-wrapper'>
          <div className='tab-info-section section-padded'>
            <Label>Driver Hostname</Label>
            <div>{driverHostname}</div>
          </div>
          <div className='tab-info-section section-padded'>
            <Label>Port</Label>
            <div>{port}</div>
          </div>
          <div className='tab-info-section section-padded'>
            <Label>Example</Label>{' '}
            <SshExampleTooltip customPosition={{ contentLeft: '0px' }} />
            <div className='ex-command'>
              {`ssh ubuntu@${driverHostname} -p ${port} -i <private_key_file_path>`}
            </div>
          </div>
          <SshInstructions />
        </div>
      </Panel>
    );
  },

  _renderJdbcOdbcTab(metricFunc) {
    if (!window.settings.showSqlEndpoints) {
      return this._getDisabledJdbcOdbcPanel(
        Tooltip.getGenericUpgradeElement('To enable JDBC/ODBC endpoints'));
    }
    const sparkVersion = this.props.cluster.get('sparkVersion');
    if (sparkVersion.match('^(1\\.3|1\\.4|1\\.5|1\\.6)')) {
      return this._getDisabledJdbcOdbcPanel(
        'JDBC/ODBC endpoints are only supported in Spark 2.0 and above.');
    }
    return ClusterUtil.renderJdbcTab(this.props.cluster, metricFunc);
  },

  _getEBSTypeLabel(type) {
    if (type === EBSVolumeUtils.GENERAL_PURPOSE) {
      return EBSVolumeUtils.GENERAL_PURPOSE_LABEL;
    } else if (type === EBSVolumeUtils.THROUGHPUT_OPTIMIZED) {
      return EBSVolumeUtils.THROUGHPUT_OPTIMIZED_LABEL;
    }
  },

  _shouldRenderEBSVolumeFields() {
    const cluster = this.props.cluster;
    const hasConfigured = cluster.get('ebsVolumeType') && cluster.get('ebsVolumeSize') &&
      cluster.get('ebsVolumeCount');
    return window.settings.enableEBSVolumesUI && !this.props.restrictedClusterCreation &&
      hasConfigured;
  },

  _renderEBSVolumeFields() {
    const maxCount = window.settings.maxEbsVolumesPerInstance;
    const ebsInfo = EBSVolumeUtils.getEBSSummary(this.props.cluster.get('ebsVolumeCount'),
      this.props.cluster.get('ebsVolumeSize'));

    return (
      <div className='storage-parent-wrapper section-padded ebs-cluster-details'>
        <div className='label-select-group configure type-group'>
          <div>
            <Label>{EBSVolumeUtils.TYPE_LABEL}</Label>{' '}
            <EBSVolumeUtils.EBSVolumeTypeTooltip />
          </div>
          <div className='ebs-type-details'>
            {this._getEBSTypeLabel(this.props.cluster.get('ebsVolumeType'))}
          </div>
        </div>
        <div className='label-select-group configure count-group'>
          <div>
            <Label>{EBSVolumeUtils.COUNT_LABEL}</Label>{' '}
            <EBSVolumeUtils.EBSVolumeCountTooltip maxCount={maxCount} />
          </div>
          <div className='padded-info'>
            {this.props.cluster.get('ebsVolumeCount')}
          </div>
        </div>
        <div className='label-select-group configure size-group'>
          <div>
            <Label>{EBSVolumeUtils.SIZE_LABEL}</Label>{' '}
            <EBSVolumeUtils.EBSVolumeSizeTooltip
              GPMin={EBSVolumeUtils.getGeneralPurposeMin()}
              GPMax={EBSVolumeUtils.getGeneralPurposeMax()}
              TOMin={EBSVolumeUtils.getThroughputOptimizedMin()}
              TOMax={EBSVolumeUtils.getThroughputOptimizedMax()}
            />
          </div>
          <div className='padded-info'>
            {this.props.cluster.get('ebsVolumeSize')}
          </div>
        </div>
        <span className='ebs-info'>{ebsInfo}</span>
      </div>
    );
  },

  _shouldRenderInstanceProfiles() {
    return window.settings.enableInstanceProfilesUI && !this.props.restrictedClusterCreation;
  },

  _getInstanceProfileArnValue() {
    const arnString = this.props.cluster.get('instanceProfileArn');
    return IamRolesUtils.parseIamRoleName(arnString) || 'None';
  },

  _renderInstanceProfiles() {
    return <InstanceProfileField readOnly value={this._getInstanceProfileArnValue()} />;
  },

  /** @return {Boolean} whether selected node types support aws tags */
  _doNodeTypesSupportTags() {
    return _.filter([this.props.nodeType, this.props.driverNodeType], (nodeType) =>
      nodeType.support_cluster_tags
    ).length === 2;
  },

  renderAWSTagsTab() {
    const tagsMetricFunc = this.metricFunction.bind(this, 'Tags');
    const shouldDisable = !this._doNodeTypesSupportTags();
    return (
      <Panel
        title='Tags'
        name='tags'
        onClick={shouldDisable ? null : tagsMetricFunc}
        disabled={shouldDisable}
        tooltipText={AwsTagListViewConstants.DISABLED_TOOLTIP_TEXT}
      >
        <AwsTagList
          customTags={this.props.cluster.get('customTags')}
          defaultTags={this.props.cluster.get('defaultTags')}
        />
      </Panel>
    );
  },

  renderAdvancedSettings(cluster) {
    let permissionsPanel;
    let sparkConfString;
    let activeTab = this.state.activeTab;

    if (!this.state.showAdvancedSettings) {
      return <div className='advanced-settings-content'></div>;
    }

    if (!this.props.permissionsConfigurable) {
      permissionsPanel = <Panel name='permissions' title='Permissions' disabled />;
    } else if (AclUtils.clusterAclsEnabled()) {
      // (PROD-10981) do not render unless workspaceAcl object has been fetched. Since it is
      // fetched async by ClusterDetailsView and passed as prop to ClusterConfigurationView,
      // it will trigger re-render when successfully fetched.
      if (!this.props.workspaceAcl) {
        // TODO(PROD-10987) Perhaps show spinner or other UI indication that it is loading
        permissionsPanel = null;
      } else if (cluster.canManage()) {
        const permMetricFunc = this.metricFunction.bind(this, 'Permissions');
        permissionsPanel = (
          <Panel name='permissions' title='Permissions' onClick={permMetricFunc}>
            <div className='workspace-acl' id='cluster-details-acls'>
              <PermissionEditBody workspaceAcl={this.props.workspaceAcl} />
            </div>
          </Panel>
        );
      } else {
        permissionsPanel = this._getDisabledPermsPanel(ClusterConfigure.noPermissionsForActionText);
      }
    } else {
      const tooltipText = AclUtils.clusterAclsAvailable() ? ClusterConfigure.enableAclsTooltipText
        : Tooltip.getGenericUpgradeElement('To enable cluster access control');
      permissionsPanel = this._getDisabledPermsPanel(tooltipText);
    }

    if (this.state.sparkConf) {
      sparkConfString = ReactSparkConfElement.makeSparkConfString(this.state.sparkConf);
    } else {
      sparkConfString = ReactSparkConfElement.makeSparkConfString(cluster.get('sparkConf'));
    }

    if (activeTab === 'permissions' &&
        !(AclUtils.clusterAclsFeatureFlag() && this.props.permissionsConfigurable)) {
      activeTab = 'aws';
    }

    const awsMetricFunc = this.metricFunction.bind(this, 'AWS');
    const sparkMetricFunc = this.metricFunction.bind(this, 'Spark');
    const sshMetricFunc = this.metricFunction.bind(this, 'SSH');
    const jdbcOdbcMetricFunc = this.metricFunction.bind(this, 'JDBC/ODBC');
    return (
      <div className='advanced-settings-content'>
        <Tabs activeTab={activeTab} onTabClick={this.setAdvancedSettingsTab}>
          <Panel title='AWS' name='aws' onClick={awsMetricFunc}>
            <div className='az-selection section-padded'>
              <div>
                <Label>Availability Zone</Label>{' '}
                <AZTooltip customPosition={{ contentLeft: '18', arrowLeft: '96px' }} />
              </div>
              {cluster.get('zoneId')}
            </div>
            <div className='nodetype-selection section-padded'>
              <div>
                <Label>Worker Node Type</Label>{' '}
                <TypeTooltip />
              </div>
              {this.props.nodeType.description}
              <span className='cluster-create-label reg-font-label node-type-stats'>
                {this.props.nodeType.instance_type_id}:{' '}
                <InstanceStats
                  memory={this.props.nodeMemory}
                  cores={this.props.nodeCores}
                  dbus={ClusterUtil.getDBU(this.props.nodeType, 1)}
                />{' '}
                <DBUTooltip />
              </span>
            </div>
            <div className='driver-nodetype-selection section-padded'>
              <div>
                <Label>Driver Node Type</Label>{' '}
                <TypeTooltip />
              </div>
              {this.props.driverNodeType.description}
              <span className='cluster-create-label reg-font-label node-type-stats'>
                {this.props.driverNodeType.instance_type_id}:{' '}
                <InstanceStats
                  memory={this.props.driverMemory}
                  cores={this.props.driverCores}
                  dbus={ClusterUtil.getDBU(this.props.driverNodeType, 1)}
                />{' '}
                <DBUTooltip />
              </span>
            </div>
            {this._renderCustomSpotPrice()}
            {this._shouldRenderEBSVolumeFields() ? this._renderEBSVolumeFields() : null}
            {this._shouldRenderInstanceProfiles() ? this._renderInstanceProfiles() : null}
          </Panel>
          <Panel title='Spark' name='spark' onClick={sparkMetricFunc} >
            <div className='spark-config section-padded'>
              <Label>Spark Config</Label>
              {/* sparkConf readonly since we don't have a way to reconfigure conf
              <ReactSparkConfElement
                ref={SPARK_CONF}
                defaultSparkConfBlob=
                {this.state.sparkConf ?
                  ReactSparkConfElement.makeSparkConfString(this.state.sparkConf) :
                  ReactSparkConfElement.makeSparkConfString(cluster.get("sparkConf"))}
                onChange={this.updateSparkConf.bind(this, cluster)}
                readOnly={true} />*/}
              <div className='spark-config-settings' ref={SPARK_CONF}>
                {sparkConfString || 'No Spark configuration set'}
              </div>
            </div>
          </Panel>
          {this.shouldRenderTagsTab() ? this.renderAWSTagsTab() : null}
          {this.shouldRenderSshTab() ? this._renderSshTab(sshMetricFunc) : null}
          {window.settings.showSqlProxyUI ? this._renderJdbcOdbcTab(jdbcOdbcMetricFunc) : null}
          {AclUtils.clusterAclsFeatureFlag() ? permissionsPanel :
            <Panel title='' name='' disabled />}
        </Tabs>
      </div>
    );
  },

  _getDisabledPermsPanel(tooltipText) {
    return (
      <Panel title='Permissions' name='permissions' disabled
        tooltipText={tooltipText}
      />);
  },

  _getDisabledJdbcOdbcPanel(tooltipText) {
    return <Panel title='JDBC/ODBC'name='jdbcOdbc' disabled tooltipText={tooltipText}/>;
  },

  getDefaultNumWorkers(cluster) {
    if (cluster.get('isAutoscaling')) {
      if (cluster.isHybrid()) {
        cluster.get('firstOnDemand');
      } else {
        cluster.get('minWorkers');
      }
    }

    return cluster.numOnDemandWorkers();
  },

  renderNewClusterWorkersInput(cluster) {
    let workerType;
    if (cluster.isHybrid()) {
      workerType = ClusterWorkersInput.INSTANCE_MIXED;
    } else if (cluster.isSpotOnly()) {
      workerType = ClusterWorkersInput.INSTANCE_SPOT;
    } else if (cluster.isOnDemandOnly()) {
      workerType = ClusterWorkersInput.INSTANCE_ONDEMAND;
    }

    const defaultSpotWorkers =
      cluster.get('isAutoscaling') ? cluster.get('minWorkers') : cluster.numSpotWorkers();
    const defaultNumWorkers = this.getDefaultNumWorkers(cluster);

    return (
      <ClusterWorkersInput
        ref={"clusterWorkersInput"}
        disabled={!this.props.workersConfigurable}
        showAutoScaleCheckbox={this.props.enableAutoScale || cluster.get('isAutoscaling')}
        enableAutoScale={this.props.enableAutoScale}
        showAutoScaleWarning={this.state.showAutoScaleWarning}
        toggleAutoScale={this.toggleAutoscalingWarning}
        restrictedClusterCreation={this.props.restrictedClusterCreation}
        fixedInstanceType
        fixedFallbackToOnDemand
        fixedOnDemand
        defaultClusterType={workerType}
        defaultNumWorkers={defaultNumWorkers}
        defaultSpotWorkers={defaultSpotWorkers}
        defaultEnableAutoScale={cluster.get('isAutoscaling')}
        defaultMinAutoScaleWorkers={cluster.get('minWorkers')}
        defaultMaxAutoScaleWorkers={cluster.get('maxWorkers')}
        defaultFallbackToOnDemand={cluster.get('fallbackToOnDemand')}
        nodeType={this.props.nodeType}
        driverNodeType={this.props.driverNodeType}
        toggleClusterCreateButton={this._onWorkersInputValidation}
        onChange={this.onClusterConfigurationChange}
      />
    );
  },

  _onWorkersInputValidation(isValid) {
    this.setState({ workersValid: isValid });
  },

  onClusterConfigurationChange(attrObj) {
    this.onInstanceChange(this.props.cluster, attrObj);

    this.setState(attrObj);
    const copy = Object.assign({}, this.state, attrObj);

    if (this.props.onChange) {
      this.props.onChange(copy);
    }
  },

  render() {
    const cluster = this.props.cluster;

    if (!cluster) {
      return <div className='row-fluid'></div>;
    }

    const advancedIcon = this.state.showAdvancedSettings ? doubleUpIcon : doubleDownIcon;
    const advancedAction = this.state.showAdvancedSettings ? 'Hide' : 'Show';

    return (
      <div className='row-fluid'>
        <form id='cluster-conf-form' className='cluster-configuration'>
          <div className='spark-version section-padded'>
            <div>
              <Label>Apache Spark Version</Label>
            </div>
            {cluster.sparkVersion()}
          </div>
          {this.renderNewClusterWorkersInput(cluster)}
          <div className='advanced-settings-label'>
            <a className='collapsible' onClick={this.collapseHandler}>
              {advancedIcon} {advancedAction} advanced settings
            </a>
          </div>
          {this.renderAdvancedSettings(cluster)}
        </form>
      </div>
    );
  },
});

module.exports = ClusterConfigurationView;
