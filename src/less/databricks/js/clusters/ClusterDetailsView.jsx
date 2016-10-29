/* eslint react/prefer-es6-class: 0, complexity: 0, react/no-is-mounted: 0, consistent-return: 0,
func-names: 0 */

import $ from 'jquery';
import React from 'react';
import ReactDOM from 'react-dom';

import { AclUtils } from '../acl/AclUtils.jsx';
import WorkspacePermissions from '../acl/WorkspacePermissions';

import ClusterConfigurationView from '../clusters/ClusterConfigurationView.jsx';
import { ClusterDetailsLibrariesList } from '../clusters/ClusterDetailsLibrariesList.jsx';
import { ClusterDetailsNotebooksList } from '../clusters/ClusterDetailsNotebooksList.jsx';
import ClusterList from '../clusters/ClusterList';
import { ClusterUtil } from '../clusters/Common.jsx';
import DriverLogsView from '../clusters/DriverLogsViewReact.jsx';

import NavFunc from '../filetree/NavFunc.jsx';

import SparkUI from '../spark_ui/ReactSparkUIView.jsx';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';
import DropdownMenu from '../ui_building_blocks/dropdowns/DropdownMenuView.jsx';
import { Tabs, Panel } from '../ui_building_blocks/TabsView.jsx';

import { BrowserUtils } from '../user_platform/BrowserUtils';

const checkIcon = <i className='fa fa-check'></i>;
const caretDownIcon = <i className='fa fa-caret-down'></i>;
const CONFIGURATION_VIEW = 'configurationView';
const viewName = 'ClusterDetailsView';

const ClusterDetailsView = React.createClass({
  propTypes: {
    clusterId: React.PropTypes.string.isRequired,
    clusters: React.PropTypes.instanceOf(ClusterList).isRequired,
    restrictedClusterCreation: React.PropTypes.bool,
    enableAutoScale: React.PropTypes.bool.isRequired,
    nodeTypes: React.PropTypes.array,
    currentWorkerNode: React.PropTypes.string,
    activeTab: React.PropTypes.string,
    windowHash: React.PropTypes.string,
    isElasticSparkCluster: React.PropTypes.bool,
  },

  getInitialState() {
    return {
      dropdownMenuVisible: false,
      currentWorkerNode: 'master',
      currentWorkerNodeTitle: 'Spark Cluster UI - Master',
      currentWorkerUrl: null,
      showConfirmButton: false,
      changesValid: true,
    };
  },

  onClustersLoaded() {
    const cluster = this.maybeGetCluster();
    if (cluster) {
      cluster.on('change', this.forceUpdate.bind(this, null), this);
      if (AclUtils.clusterAclsEnabled()) {
        this.fetchClusterPermissions(cluster);
      }
    }
    // TODO(PROD-12526) redirect to cluster list page and show message if cluster doesn't exist
  },

  // @NOTE(lauren): if window.clusterList is not loaded, this will return undefined
  maybeGetCluster() {
    return this.props.clusters.findWhere({ clusterId: this.props.clusterId });
  },

  _setState(newState) {
    if (this.isMounted()) {
      this.setState(newState);
    }
  },

  fetchClusterPermissions(cluster) {
    // the permissions tab depends on having the workspaceAcl object fetched on the cluster,
    // so always call fetchPermissions (rather than first checking if permissions have been fetched
    // via cluster.permissionsHaveBeenFetched())
    cluster.fetchPermissions();
  },

  componentDidMount() {
    // this.props.clusters (= window.clusterList) may initially be empty (e.g. on page refresh)
    this.props.clusters.fetchAndUpdateXHR.done(this.onClustersLoaded);
    // sets the clusterId so that it is included in "Send Feedback" emails to support
    BrowserUtils.setGlobalMeasurementTags({ clusterId: this.props.clusterId });
  },

  componentWillReceiveProps(nextProps) {
    const [currentWorkerNode, currentWorkerNodeTitle, currentWorkerUrl] =
      this.determineWorkerNode(nextProps);

    this._setState({
      currentWorkerNode: currentWorkerNode,
      currentWorkerNodeTitle: currentWorkerNodeTitle,
      currentWorkerUrl: currentWorkerUrl,
    });
  },

  componentWillUnmount() {
    if (this.permissionsFetch) { this.permissionsFetch.abort(); }
    const cluster = this.maybeGetCluster();
    if (cluster) {
      cluster.off(null, null, this);
    }
    if ($('#topbar .tb-title')[0]) {
      ReactDOM.unmountComponentAtNode($('#topbar .tb-title')[0]);
    }
    BrowserUtils.setGlobalMeasurementTags({});
  },

  renderDriverLogs(cluster) {
    return (
      <DriverLogsView
        clusterId={this.props.clusterId}
        shouldFetchLogs={AclUtils.clusterAclsEnabled() ? cluster.canAttach() : true}
      />
    );
  },

  configurationChangesMade(changesObject, hasChanged, cancelChangesHandler, valid) {
    if (!this.state.cancelChangesHandler) {
      this._setState({
        cancelChangesHandler: cancelChangesHandler,
      });
    }

    this._setState({
      showConfirmButton: hasChanged,
      changesValid: valid,
    });
    this._setState(changesObject);
  },

  /**
   * @NOTE(jengler): The confirm function assumes that this.state.numberOfWorkers is not set at the
   * same time as this.state.minWorkers/maxWorkers.
   *
   * @param  {[type]} cluster [description]
   * @return {[type]}         [description]
   */
  confirmChanges(cluster) {
    const configurationView = this.refs[CONFIGURATION_VIEW];
    let numberOfWorkersPromise;
    let workspaceAclsPromise;
    let dialogMessage;
    if (configurationView.state.numberOfWorkersHasChanged) {
      dialogMessage = `Are you sure you want to resize cluster ${cluster.get('clusterName')}?`;
    } else {
      dialogMessage = 'You are changing who has access to this cluster. Are you sure you want ' +
        `to reconfigure ${cluster.get('clusterName')}?`;
    }

    return DeprecatedDialogBox.confirm({
      message: dialogMessage,
      confirm: () => {
        if (configurationView.state.numberOfWorkersHasChanged) {
          const configureParams = {
            clusterId: cluster.get('clusterId'),
          };
          /**
           * @NOTE(jengler): The backend assumes that if workers is specified,
           * it is a non-autoscaling cluster.
           * (i.e., never pass the workers param if the cluster is autoscaling)
           */
          if (this.state.minWorkers || this.state.maxWorkers) {
            configureParams.minWorkers = this.state.minWorkers;
            configureParams.maxWorkers = this.state.maxWorkers;
          } else {
            configureParams.workers = this.state.numberOfWorkers;
          }
          const success = () => {
            console.log(
              `Successfully resized cluster ${cluster.get('clusterId')}:
                workers: ${configureParams.workers}
                minWorkers: ${configureParams.minWorkers}
                maxWorkers: ${configureParams.maxWorkers}
            `);
          };

          window.recordEvent('clusterReconfigured', {
            'clusterReconfigureOrigin': viewName,
            'clusterReconfigureNumberBefore': cluster.get('isAutoscaling') ?
                cluster.numSpotWorkers() : cluster.get('numWorkers'),
            'clusterReconfigureNumberAfter': this.state.numberOfWorkers,
          });

          console.log(
            `Updating cluster ${cluster.get('clusterId')}:
              workers: ${configureParams.workers}
              minWorkers: ${configureParams.minWorkers}
              maxWorkers: ${configureParams.maxWorkers}
          `);
          numberOfWorkersPromise = ClusterUtil.configureCluster(configureParams, success);
        }

        if (configurationView.state.workspaceAclsHasChanged) {
          const workspaceAcl = cluster.get('workspaceAcl');
          window.recordEvent('aclChange', { 'aclChangeOrigin': viewName });
          const commitChanges = function() {
            workspaceAclsPromise = workspaceAcl.commit({
              sync: true,
              success: () => {
                console.log('Successfully configured the permissions for cluster ' +
                  cluster.get('clusterId'));
              },
            });
          };

          if (workspaceAcl.hasRemovedManagePermission()) {
            DeprecatedDialogBox.confirm({
              messageHTML: '<p>You are removing your <b>' + WorkspacePermissions.MANAGE + '</b> ' +
                "permission on this item and you won't be able to view or change permissions on" +
                'this item any more. Are you sure you want to continue?</p>',
              confirmButton: 'Yes, Remove my manage permission',
              cancelButton: 'No, Cancel',
              confirm: commitChanges,
            });
          } else {
            commitChanges();
          }
        }

        $.when(numberOfWorkersPromise, workspaceAclsPromise)
          .done(function() {
            this._setState({ showConfirmButton: false });
            if (this.isMounted()) {
              configurationView.setState({
                numberOfWorkersHasChanged: false,
                workspaceAclsHasChanged: false,
              });
            }
          }.bind(this))
          .fail((err) => { console.error(err); });
      },
    });
  },

  cancelChanges(cluster) {
    this._setState({
      showConfirmButton: false,
    });
    this.state.cancelChangesHandler(cluster);
  },

  determineWorkerNode(props) {
    const cluster = props.clusters.findWhere({ clusterId: props.clusterId });
    const numWorkers = cluster.get('numWorkers');
    const masterUrl = cluster.masterUrl().split('/').slice(1).join('/')
      + NavFunc.sessionParams(name.indexOf('?') >= 0);
    const workerUrls = cluster.workerUrls();
    workerUrls.forEach(function(url, i) {
      workerUrls[i] = url.split('/').slice(1).join('/')
        + NavFunc.sessionParams(name.indexOf('?') >= 0);
    });
    let currentWorkerNode = this.state.currentWorkerNode;
    let currentWorkerNodeTitle = this.state.currentWorkerNodeTitle;
    let currentWorkerUrl = this.state.currentWorkerUrl;
    const propsWorkerNode = props.currentWorkerNode || this.props.currentWorkerNode;

    // if you are going to Spark Cluster UI or the state is not yet set
    if (this.props.activeTab === 'sparkclusterui' || !currentWorkerUrl) {
      // no prop worker node, just assign based on current state
      if (propsWorkerNode === null || propsWorkerNode === undefined) {
        if (currentWorkerNode === 'master') {
          currentWorkerUrl = masterUrl;
        } else {
          currentWorkerUrl = workerUrls[currentWorkerNode];
        }
      } else if (isNaN(propsWorkerNode) || propsWorkerNode < 0 || propsWorkerNode >= numWorkers) {
        // prop worker node is bad input
        currentWorkerNode = 'master';
        currentWorkerNodeTitle = 'Spark Cluster UI - Master';
        currentWorkerUrl = masterUrl;
      } else {
        // prop worker node is bad input
        currentWorkerNode = propsWorkerNode;
        currentWorkerNodeTitle = 'Spark Cluster UI - Worker ' + currentWorkerNode;
        currentWorkerUrl = workerUrls[currentWorkerNode];
      }
    }

    return [currentWorkerNode, currentWorkerNodeTitle, currentWorkerUrl];
  },

  restartCluster(cluster) {
    DeprecatedDialogBox.confirm({
      message: ('Are you sure you want to restart ' + cluster.get('clusterName') + '?'),
      confirm() {
        window.recordEvent('clusterRestarted', { 'clusterRestartOrigin': viewName });
        cluster.restart();
      },
    });
  },

  terminateCluster(cluster) {
    DeprecatedDialogBox.confirm({
      messageHTML: (
        'Are you sure you want to terminate the <strong>' + cluster.get('clusterName') +
        '</strong> cluster?<br/>' +
        '<div class="dialog-tip">' +
        ClusterUtil.reuseExistingInstancesTip() +
        '</div>'
      ),
      confirm: () => {
        window.recordEvent('clusterTerminated', { 'clusterTerminateOrigin': viewName });
        console.log('Removing cluster ID: ' + this.props.clusterId);
        cluster.set('state', 'Terminating');
        cluster.save({ remove: true }, { patch: true });
        if (this.props.activeTab === 'notebooks' || this.props.activeTab === 'libraries' ||
            this.props.activeTab === 'sparkclusterui') {
          window.router.navigate(this.props.windowHash.split('/').slice(0, -1).join('/') +
            '/configuration', { trigger: true });
        }
      },
    });
  },

  toggleMenu() {
    this._setState({
      dropdownMenuVisible: !this.state.dropdownMenuVisible,
    });
  },

  changeWorkerMenu(workerIndex, url) {
    this._setState({
      currentWorkerNode: workerIndex,
      currentWorkerNodeTitle: workerIndex === 'master' ? 'Spark Cluster UI - Master' :
        'Spark Cluster UI - Worker ' + workerIndex,
      currentWorkerUrl: workerIndex === 'master' ? url : url[workerIndex],
    });
  },

  getWorkers(cluster, masterUrl, workerUrls) {
    const boundMasterUrl = this.changeWorkerMenu.bind(this, 'master', masterUrl);
    const listOfWorkers = [(
      <a className={this.state.currentWorkerNode === 'master' ? 'selected' : null}
        id={"spark-worker-master"}
        onClick={boundMasterUrl}
      >
        {this.state.currentWorkerNode === 'master' ? checkIcon : null}
        Spark Cluster UI - Master
      </a>
    )];
    let i;

    for (i = 0; i < cluster.get('numWorkers'); i++) {
      const boundWorkerUrls = this.changeWorkerMenu.bind(this, i, workerUrls);

      listOfWorkers.push(
        <a className={this.state.currentWorkerNode === i ? 'selected' : null}
          id={'spark-worker-' + i}
          onClick={boundWorkerUrls}
        >
          {this.state.currentWorkerNode === i ? checkIcon : null}
          Spark Cluster UI - Worker {i}
        </a>
      );
    }

    return listOfWorkers;
  },

  isWorkersConfigurable(cluster) {
    if (cluster) {
      const canManage = this._canManageCluster(cluster);
      const clusterState = cluster.get('state');
      const configurable = cluster.isConfigurable();
      const restarting = (
        clusterState === 'Restarting' ||
        clusterState === 'Resizing' ||
        clusterState === 'Reconfiguring'
      );
      const inactive = (
        clusterState === 'Terminating' ||
        clusterState === 'TerminateWhenReady' ||
        clusterState === 'Terminated'
      );
      let isElasticSparkCluster = this.props.isElasticSparkCluster;
      if (isElasticSparkCluster === null || isElasticSparkCluster === undefined) {
        isElasticSparkCluster = cluster.isElasticSparkCluster();
      }

      return !restarting && !inactive && !isElasticSparkCluster && canManage && configurable;
    }
  },

  metricFunction(tabVisited) {
    window.recordEvent('clusterDetailsVisited', {
      'clusterDetailsTabVisited': tabVisited,
      'clusterDetailsTabVisitedOrigin': viewName });
  },

  _canRestartCluster(cluster) {
    return AclUtils.clusterAclsEnabled() ? cluster.canRestart() : true;
  },

  _canManageCluster(cluster) {
    return AclUtils.clusterAclsEnabled() ? cluster.canManage() : true;
  },

  _canAttachToCluster(cluster) {
    return AclUtils.clusterAclsEnabled() ? cluster.canAttach() : true;
  },

  _shouldDisableSparkUIAndDriverLogs(cluster) {
    return !cluster || !this._canAttachToCluster(cluster);
  },

  _shouldDisableSparkClusterUI(inactive, cluster) {
    return inactive || this._shouldDisableSparkUIAndDriverLogs(cluster);
  },

  renderHeader(cluster) {
    if (!cluster) { return; }

    const canRestart = this._canRestartCluster(cluster);
    const clusterName = cluster.get('clusterName');
    const restarting = (cluster.get('state') === 'Restarting');
    const terminating = (cluster.get('state') === 'Terminating') ||
                      (cluster.get('state') === 'TerminateWhenReady');
    // Clusters terminated due to error have state 'Error', so we should use
    // the isTerminated function on the cluster model rather than checking
    // for equality of the state with 'Terminated'.
    const terminated = cluster.isTerminated();
    const inactive = terminating || terminated;
    let isElasticSparkCluster = this.props.isElasticSparkCluster;
    if (isElasticSparkCluster === null || isElasticSparkCluster === undefined) {
      isElasticSparkCluster = cluster.isElasticSparkCluster();
    }

    const elasticSparkClusterName = (<a href={cluster.elasticSparkRunUrl()}>{clusterName}
      <i id='go-to-job' className='fa fa-external-link'></i></a>);
    const confirmClusterChanges = this.confirmChanges.bind(this, cluster);
    const confirmBtn = (
      <button id='confirm-button' className='btn btn-primary'
        disabled={!this.state.changesValid}
        onClick={this.state.changesValid ? confirmClusterChanges : null}
      >Confirm</button>);
    const cancelClusterChanges = this.cancelChanges.bind(this, cluster);
    const cancelBtn = (
      <button className='btn btn-default btn-cancel'
        onClick={cancelClusterChanges}
      >Cancel</button>);
    const restartThisCluster = this.restartCluster.bind(this, cluster);
    const restartBtn = (
      <button className='btn btn-default' disabled={restarting || !canRestart}
        onClick={restarting || !canRestart ? null : restartThisCluster}
      >
        <i id='restart-cluster' className={'fa fa-refresh fa-button-icon' +
        (restarting ? ' fa-spin' : '')}> </i>
        Restart
      </button>);
    const terminateThisCluster = this.terminateCluster.bind(this, cluster);
    const terminateBtn = (
      <button className='btn btn-default' disabled={restarting || !this._canManageCluster(cluster)}
        onClick={restarting || !canRestart ? null : terminateThisCluster}
      >
        <i id='terminate-cluster'
          className={'fa fa-button-icon' + (terminating ? ' fa-spinner fa-spin' : ' fa-close')}>
        </i>
        Terminate
      </button>);

    return (
      <h2>
        {isElasticSparkCluster ? elasticSparkClusterName : clusterName}
        <span id='cluster-options'>
          {inactive ? null : '|'}
          {this.state.showConfirmButton ? confirmBtn : null}
          {this.state.showConfirmButton ? cancelBtn : null}
          {inactive || isElasticSparkCluster ? null : restartBtn }
          {inactive ? null : terminateBtn }
        </span>
      </h2>
    );
  },

  _getClusterPermissionsWarning(cluster, aclsEnabled) {
    return cluster && aclsEnabled && !cluster.canAttach() &&
      WorkspacePermissions.NO_VIEW_PERMISSIONS_WARNING;
  },

  render() {
    const cluster = this.maybeGetCluster();
    let sparkVersion;
    let activeTab;
    let clusterConfigurationView = null;
    let currentWorkerNodeTitle = '';
    let currentWorkerUrl;
    let sparkClusterUiTitle = '';
    let dropdownMenu;
    let inactive;
    let isElasticSparkCluster;
    let libraryLength;
    let nodeType;
    let driverNodeType;
    let notebookLength;
    let sparkUiUrl;
    let windowHash;
    let workspaceAcl;

    if (cluster) {
      notebookLength = cluster.get('notebooks').length;
      libraryLength = cluster.get('libraries').length;
      sparkUiUrl = cluster.driverUrl().split('/').slice(1).join('/') +
          NavFunc.sessionParams(name.indexOf('?') >= 0);
      const masterUrl = cluster.masterUrl().split('/').slice(1).join('/') +
          NavFunc.sessionParams(name.indexOf('?') >= 0);
      const workerUrls = cluster.workerUrls();
      const numWorkers = cluster.get('numWorkers');
      const terminating = (cluster.get('state') === 'Terminating') ||
                        (cluster.get('state') === 'TerminateWhenReady');
      const terminated = (cluster.get('state') === 'Terminated');
      inactive = terminating || terminated;
      isElasticSparkCluster = this.props.isElasticSparkCluster;
      if (isElasticSparkCluster === null || isElasticSparkCluster === undefined) {
        isElasticSparkCluster = cluster.isElasticSparkCluster();
      }
      activeTab = this.props.activeTab;
      windowHash = this.props.windowHash;
      nodeType = ClusterUtil.getNodeType(cluster.get('nodeTypeId').id, this.props.nodeTypes);
      driverNodeType =
          ClusterUtil.getNodeType(cluster.get('driverNodeTypeId').id, this.props.nodeTypes);
      workspaceAcl = cluster.get('workspaceAcl');

      workerUrls.forEach(function(url, i) {
        workerUrls[i] = url.split('/').slice(1).join('/') +
          NavFunc.sessionParams(name.indexOf('?') >= 0);
      });
      windowHash = windowHash.slice(0,
          windowHash.indexOf(this.props.clusterId) + this.props.clusterId.length);

      if (inactive) {
        if (activeTab === 'notebooks' || activeTab === 'libraries' ||
            activeTab === 'sparkclusterui') {
          activeTab = 'configuration';
        }
      } else if (isElasticSparkCluster) {
        if (activeTab === 'notebooks' || activeTab === 'libraries') {
          activeTab = 'configuration';
        }
      }

      [, currentWorkerNodeTitle, currentWorkerUrl] =
        this.determineWorkerNode(this.props);

      sparkVersion = cluster.get('sparkVersion');

      const boundGetWorkers = this.getWorkers.bind(this, cluster, masterUrl, workerUrls);
      dropdownMenu = (
        <DropdownMenu
          classes={['spark-workers-dropdown']}
          outsideClickHandler={this.toggleMenu}
          getItems={boundGetWorkers}
        />);

      clusterConfigurationView = (
        <ClusterConfigurationView
          ref={CONFIGURATION_VIEW}
          workersConfigurable={this.isWorkersConfigurable(cluster)}
          enableAutoScale={this.props.enableAutoScale}
          permissionsConfigurable={!inactive}
          restrictedClusterCreation={this.props.restrictedClusterCreation}
          workspaceAcl={workspaceAcl}
          cluster={cluster}
          changesMade={this.configurationChangesMade}
          nodeTypes={this.props.nodeTypes}
          nodeType={nodeType}
          nodeMemory={ClusterUtil.workersToMemoryGB(1, nodeType, true)}
          nodeCores={ClusterUtil.workersToCores(1, nodeType, true)}
          driverNodeType={driverNodeType}
          driverMemory={ClusterUtil.workersToMemoryGB(1, driverNodeType, true)}
          driverCores={ClusterUtil.workersToCores(1, driverNodeType, true)}
        />);

      if (numWorkers) {
        const btn = (
          <button disabled={inactive} className='btn btn-link'
            id='spark-workers-button' onClick={this.toggleMenu} key='btn'
          >{caretDownIcon}</button>);
        sparkClusterUiTitle = [currentWorkerNodeTitle, btn];
      } else {
        sparkClusterUiTitle = currentWorkerNodeTitle;
      }
    }

    const aclsEnabled = AclUtils.clusterAclsEnabled();
    const configMetricFunc = this.metricFunction.bind(this, 'Configuration');
    const notebookMetricFunc = this.metricFunction.bind(this, 'Notebooks');
    const libraryMetricFunc = this.metricFunction.bind(this, 'Libraries');
    const sparkUiMetricFunc = this.metricFunction.bind(this, 'Spark UI');
    const driverLogsMetricFunc = this.metricFunction.bind(this, 'Driver Logs');
    const sparkClusterUiMetricFunc = this.metricFunction.bind(this, 'Spark Cluster UI');
    const clusterPermissionsWarning = this._getClusterPermissionsWarning(cluster, aclsEnabled);

    return (
      <div id='cluster-details'>
        {this.renderHeader(cluster)}
        <Tabs activeTab={activeTab}>
          <Panel title='Configuration'
            key='configuration'
            name='configuration'
            href={windowHash + '/configuration'}
            onClick={configMetricFunc}
          >
            {clusterConfigurationView}
          </Panel>
          <Panel disabled={inactive || isElasticSparkCluster}
            key='notebooks'
            title={'Notebooks (' + notebookLength + ')'}
            name='notebooks' href={windowHash + '/notebooks'}
            onClick={notebookMetricFunc}
          >
            {cluster ? <ClusterDetailsNotebooksList cluster={cluster} /> : null}
          </Panel>
          <Panel disabled={inactive || isElasticSparkCluster}
            key='libraries'
            title={'Libraries (' + libraryLength + ')'}
            name='libraries' href={windowHash + '/libraries'}
            onClick={libraryMetricFunc}
          >
            {cluster ? <ClusterDetailsLibrariesList cluster={cluster} /> : null}
          </Panel>
          <Panel title='Spark UI'
            disabled={this._shouldDisableSparkUIAndDriverLogs(cluster)}
            tooltipText={clusterPermissionsWarning}
            key='spark-ui'
            name='sparkui'
            href={windowHash + '/sparkUi'}
            onClick={sparkUiMetricFunc}
          >
            <div id='spark-ui-context' className='hidden'>
              <span id='spark-ui-hostname' className='context-bar-item'></span>
              {/* PROD-12432: Space before Spark Version improves Chrome highlighting behavior. */}
              <span className='context-bar-item'>{' Spark Version:' + sparkVersion}</span>
            </div>
            <div className='row-fluid sparkui-wrapper'>
              <SparkUI sparkUiUrl={sparkUiUrl} />
            </div>
          </Panel>
          <Panel title='Driver Logs'
            disabled={this._shouldDisableSparkUIAndDriverLogs(cluster)}
            tooltipText={clusterPermissionsWarning}
            key='driver-logs'
            name='driverlogs'
            href={windowHash + '/driverLogs'}
            onClick={driverLogsMetricFunc}
          >
            {cluster ? this.renderDriverLogs(cluster) : null}
          </Panel>
          <Panel title={sparkClusterUiTitle}
            disabled={this._shouldDisableSparkClusterUI(inactive, cluster)}
            tooltipText={clusterPermissionsWarning}
            key='spark-cluster-ui'
            name='sparkclusterui'
            href={windowHash + '/sparkClusterUi'}
            onClick={sparkClusterUiMetricFunc}
          >
            {this.state.dropdownMenuVisible ? dropdownMenu : null}
            <div id='spark-ui-context' className='hidden'>
              <span id='spark-ui-hostname' className='context-bar-item'></span>
              {/* PROD-12432: Space before Spark Version improves Chrome highlighting behavior. */}
              <span className='context-bar-item'>{' Spark Version:' + sparkVersion}</span>
            </div>
            <div className='row-fluid sparkui-wrapper'>
              <SparkUI sparkUiUrl={currentWorkerUrl} />
            </div>
          </Panel>
        </Tabs>
      </div>
    );
  },
});

module.exports = ClusterDetailsView;
