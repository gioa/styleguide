/* eslint react/prefer-es6-class: 0, complexity: 0, react/no-is-mounted: 0, consistent-return: 0,
max-lines: 0 */

/**
 * Do not use this as an example for tables; it needs to be refactored to use
 * ReactTable's Table and Column. For now, see ClusterDetailsLibrariesList and
 * ClusterDetailsLibrariesListView.
 */

import _ from 'underscore';
import React from 'react';
import ClassNames from 'classnames';

import { AclUtils } from '../acl/AclUtils.jsx';
import { PermissionEditView } from '../acl/PermissionEditView.jsx';
import WorkspacePermissions from '../acl/WorkspacePermissions';

import Cluster from '../clusters/Cluster';
import ClusterList from '../clusters/ClusterList';
import { ClusterUtil } from '../clusters/Common.jsx';
import { SparkInfoCell } from '../clusters/SparkInfoCell.jsx';

import NavFunc from '../filetree/NavFunc.jsx';

import Presence from '../presence/Presence';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';
import ReactModalUtils from '../ui_building_blocks/dialogs/ReactModalUtils';
import DropdownMenu from '../ui_building_blocks/dropdowns/DropdownMenuView.jsx';
import IconsForType from '../ui_building_blocks/icons/IconsForType';
import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

const viewName = 'ReactClusterListView';

function compareClusters(x, y) {
  function basicCompare(a, b) {
    if (a === b) {
      return 0;
    }
    return a > b ? 1 : -1;
  }

  // States are equal, tie-break by creator.
  const xCreator = x.isElasticSparkCluster() ? 1 : 0;
  const yCreator = y.isElasticSparkCluster() ? 1 : 0;
  if (xCreator !== yCreator) {
    return basicCompare(xCreator, yCreator);
  }

  // Fall back to name to ensure stable ordering.
  return basicCompare(x.get('clusterName').toLowerCase(), y.get('clusterName').toLowerCase());
}

const MakeDashboardLink = React.createClass({

  propTypes: {
    defaultCluster: React.PropTypes.bool.isRequired,
    isElasticSparkCluster: React.PropTypes.bool.isRequired,
    model: React.PropTypes.instanceOf(Cluster).isRequired,
  },

  onMakeDefault() {
    const self = this;
    const clusterName = this.props.model.get('clusterName');

    DeprecatedDialogBox.confirm({
      message: ('Are you sure you want to make ' + clusterName + ' the default cluster?'),
      confirm() {
        window.recordEvent('clusterMadeDefault');
        Presence.pushHistory('Made ' + clusterName + ' the default cluster');
        self.props.model.save({ defaultCluster: true }, { patch: true });
        self.render();
      },
    });
  },

  render() {
    const useString = 'used for table management operations (importing data and listing tables)';
    const attachHelp = 'If selected, this cluster will be ' + useString;
    const attachedHelp = 'This cluster is ' + useString;
    const attached = (
      <Tooltip text={attachedHelp}>
        <div>Default</div>
      </Tooltip>
    );
    const makeDashboard = (
      <Tooltip text={attachHelp}>
        <div>
          <a onClick={this.onMakeDefault}
            className='make-default pointer'
          >Make Default</a>
        </div>
      </Tooltip>
    );

    if (this.props.defaultCluster) {
      return attached;
    } else if (this.props.isElasticSparkCluster) {
      return null;
    }
    return makeDashboard;
  },
});

/**
 * Wrapper for showing the Node list in the "Nodes" column.
 */
const NodeList = React.createClass({

  propTypes: {
    clusterName: React.PropTypes.string.isRequired,
    clusterId: React.PropTypes.string.isRequired,
    masterUrl: React.PropTypes.string.isRequired,
    workerUrls: React.PropTypes.array.isRequired,
    terminalUrl: React.PropTypes.string.isRequired,
    totalSpotInstances: React.PropTypes.number.isRequired,
    totalOnDemandInstances: React.PropTypes.number.isRequired,
  },

  getInitialState() {
    return { showNodes: false };
  },

  onClickNodes() {
    window.recordEvent('clusterListNodeExpanded', {
      'clusterListNodeExpandState': !this.state.showNodes,
    });
    this.setState({ showNodes: !this.state.showNodes });
  },

  metricFunction(metric, tags) {
    window.recordEvent(metric, tags);
  },

  /**
   * Render the dropdown arrow to the left of the headers.

   * @param  {Object} style Additional styles to top-level tag for the dropdown menu.
   * @return {HTMLElement} The JSX element.
   */
  renderToggleArrow(style) {
    const iconClass = ClassNames({
      'node-arrow': true,
      'fa fa-caret-right fa-fw': !this.state.showNodes,
      'fa fa-caret-down fa-fw': this.state.showNodes,
    });

    return (
      <a className='with-icon fa-fw spark-toggle' style={style}>
        <i className={iconClass} />
      </a>
    );
  },

  /**
   * Render the header that shows the number of on-demand nodes.
   *
   * @param  {number} numOnDemand Number of on-demand nodes.
   * @return {HTMLElement} The JSX element.
   */
  renderOnDemandHeader(numOnDemand) {
    return (
      <div>
        {this.renderToggleArrow()}
        <span data-ondemand-nodes-length={numOnDemand}>
          {numOnDemand} On-demand
        </span>
      </div>
    );
  },

  /**
   * Render the header that shows the number of spot nodes. If there are also on-demand nodes,
   * the dropdown arrow for the spot nodes will be hidden.
   *
   * @param  {number} numSpot Number of spot nodes.
   * @param  {number} numOnDemand Number of on-demand nodes.
   * @return {HTMLElement} The JSX element.
   */
  renderSpotHeader(numSpot, numOnDemand) {
    // If there are no on demand nodes, then we want to show the spot node toggle icon.
    // We purposefully hide the second drop down arrow when there are onDemand nodes as current
    // design only calls for for one. Using a duplicate dom component to ensure alignment stays
    // consistent, even with styling changes.
    const spotNodeStyle = {
      visibility: numOnDemand > 0 ? 'hidden' : '',
    };

    return (
      <div>
        {this.renderToggleArrow(spotNodeStyle)}
        <span data-spot-nodes-length={numSpot}>
          {numSpot} Spot
        </span>
      </div>
    );
  },

  /**
   * Render the array of node links.
   *
   * @return {HTMLElement[]} An array of rendered JSX elements.
   */
  renderNodeArray() {
    const nodes = [];
    const masterMetricFunc = this.metricFunction.bind(
      this,
      'clusterDetailsVisited',
      {
        'clusterDetailsTabVisited': 'Spark Cluster UI',
        'clusterDetailsTabVisitedOrigin': viewName,
      }
    );
    const masterLink = this.props.terminalUrl ?
      <a href={this.props.terminalUrl + '/master'}>Terminal</a> : null;
    nodes.push(
      <li key={this.props.clusterId + '-master'} className='driver'>
        <a
          href={this.props.masterUrl}
          onClick={masterMetricFunc}
        >
          Master
        </a> {masterLink}
      </li>
    );
    for (let idx = 0; idx < this.props.workerUrls.length; idx++) {
      const workerUrl = this.props.workerUrls[idx];
      const workerMetricFunc = this.metricFunction.bind(
        this,
        'clusterDetailsVisited',
        {
          'clusterDetailsTabVisited': 'Spark Cluster UI',
          'clusterDetailsTabVisitedOrigin': viewName,
        }
      );
      const workerLink = this.props.terminalUrl ?
        <a href={this.props.terminalUrl + '/worker' + idx}>Terminal</a> : null;
      nodes.push(
        <li key={workerUrl} className='worker'>
          <a
            href={workerUrl}
            onClick={workerMetricFunc}
          >
            Worker {idx}
          </a> {workerLink}
        </li>
      );
    }

    return nodes;
  },

  render() {
    const totalInstances = this.props.totalSpotInstances - this.props.totalOnDemandInstances;

    return (
      <div data-node-info={this.props.clusterName} data-node-count={totalInstances}>
        <div>
          <div onClick={this.onClickNodes} className='node-container pointer'>
            {
              this.props.totalOnDemandInstances > 0 ?
                this.renderOnDemandHeader(this.props.totalOnDemandInstances) :
                null
            }
            {
              this.props.totalSpotInstances > 0 ?
                this.renderSpotHeader(
                  this.props.totalSpotInstances,
                  this.props.totalOnDemandInstances) :
                null
            }
          </div>
          <ul className='node-list'>
            {this.state.showNodes ? this.renderNodeArray() : null}
          </ul>
        </div>
      </div>
    );
  },
});

const Libraries = React.createClass({
  propTypes: {
    clusterId: React.PropTypes.string.isRequired,
    libraries: React.PropTypes.array.isRequired,
    // Exact type is LibraryShortStatus
  },

  libOverallStatus() {
    const numLibs = this.props.libraries.length;
    if (numLibs === 1) {
      return '1 library';
    }
    if (numLibs === 0) {
      return '--';
    }
    return numLibs.toString() + ' libraries';
  },

  metricFunction(metric, tags) {
    window.recordEvent(metric, tags);
  },

  render() {
    const libMetricFunc = this.metricFunction.bind(
      this,
      'clusterDetailsVisited',
      {
        'clusterDetailsTabVisited': 'Libraries',
        'clusterDetailsTabVisitedOrigin': viewName,
      }
    );
    return (
      <div>
        <a href={ClusterUtil.getDetailsLinks(this.props.clusterId).libraries}
          data-libraries-length={this.props.libraries.length}
          onClick={libMetricFunc}
        >
          { this.libOverallStatus() }
        </a>
      </div>
    );
  },
});

const Notebooks = React.createClass({

  propTypes: {
    clusterId: React.PropTypes.string.isRequired,
    notebooks: React.PropTypes.array.isRequired,
  },

  nbOverallStatus() {
    const numLibs = this.props.notebooks.length;
    if (numLibs === 1) {
      return '1 notebook';
    }
    if (numLibs === 0) {
      return '--';
    }
    return numLibs.toString() + ' notebooks';
  },

  metricFunction(metric, tags) {
    window.recordEvent(metric, tags);
  },

  render() {
    const notebookMetricFunc = this.metricFunction.bind(
      this,
      'clusterDetailsVisited',
      {
        'clusterDetailsTabVisited': 'Notebooks',
        'clusterDetailsTabVisitedOrigin': viewName,
      }
    );
    return (
      <div>
        <a href={ClusterUtil.getDetailsLinks(this.props.clusterId).notebooks}
          data-notebooks-length={this.props.notebooks.length}
          onClick={notebookMetricFunc}
        >
          { this.nbOverallStatus() }
        </a>
      </div>
    );
  },
});

const ClusterConfigure = React.createClass({

  propTypes: {
    model: React.PropTypes.instanceOf(Cluster).isRequired,
    clusters: React.PropTypes.instanceOf(ClusterList).isRequired,
    userCanManage: React.PropTypes.bool,
    userCanAttach: React.PropTypes.bool,
    userCanRestart: React.PropTypes.bool,
  },

  getInitialState() {
    return {
      dropdownMenuVisible: false,
    };
  },

  configureCluster() {
    const clusterId = this.props.model.get('clusterId');
    window.recordEvent('clusterDetailsVisited', {
      'clusterDetailsTabVisited': 'Configuration',
      'clusterDetailsTabVisitedOrigin': viewName,
    });
    window.location.hash = ClusterUtil.getDetailsLinks(clusterId).configuration;
  },

  restartCluster() {
    const restartId = this.props.model.get('clusterId');
    const clusterName = this.props.model.get('clusterName');

    const self = this;
    DeprecatedDialogBox.confirm({
      message: ('Are you sure you want to restart ' + clusterName + '?'),
      confirm() {
        const cluster = self.props.clusters.findWhere({ clusterId: restartId });
        if (cluster) {
          window.recordEvent('clusterRestarted', { 'clusterRestartOrigin': viewName });
          cluster.restart();
        }
      },
    });
  },

  maybeGetDialogTip() {
    // TODO(mgyucht): This check should really be if the current cluster is free (but on
    // dev-tier all clusters are free for now, so this works, and once a user upgrades, they
    // won't be making free clusters anymore).
    if (!window.settings.enableRestrictedClusterCreation) {
      return (<div className='dialog-tip'>
          {ClusterUtil.reuseExistingInstancesTip()}
        </div>);
    }
    return null;
  },

  terminateCluster() {
    const remClusterId = this.props.model.get('clusterId');
    const clusterName = this.props.model.get('clusterName');
    const self = this;
    const confirmationText =
      (<div>
        Are you sure you want to terminate the <strong>{clusterName}</strong> cluster?
        <br />
        {this.maybeGetDialogTip()}
      </div>);
    DeprecatedDialogBox.confirm({
      title: 'Terminate Cluster',
      message: confirmationText,
      confirm() {
        ClusterUtil.deleteCluster(self.props.clusters, remClusterId);
      },
    });
  },

  openEditPermissionDialog() {
    const cluster = this.props.model;
    cluster.fetchWorkspaceAcl(() => {
      const view = <PermissionEditView workspaceAcl={cluster.get('workspaceAcl')} />;
      ReactModalUtils.createModal(view);
    });
  },

  toggleDropdownMenu() {
    window.recordEvent('clusterListDropdownOpened', {
      'clusterListDropdownOpenState': !this.state.dropdownMenuVisible,
    });
    this.setState({
      dropdownMenuVisible: !this.state.dropdownMenuVisible,
    });
  },

  getPermissionsTooltipLink(userCanManage, link) {
    let tooltipText;
    if (!AclUtils.clusterAclsAvailable()) {
      // user is not in a tier that supports ACLs, show an upgrade message
      tooltipText = Tooltip.getGenericUpgradeElement('To enable cluster access control');
    } else if (AclUtils.couldEnableClusterAcls()) {
      // user is in correct tier, cluster acls are disabled
      tooltipText = ClusterConfigure.enableAclsTooltipText;
    } else if (AclUtils.clusterAclsEnabled() && !userCanManage) {
      // user is in correct tier, cluster acls are enabled, user does not have manage permissions
      tooltipText = ClusterConfigure.noPermissionsForActionText;
    } else {
      // This case shouldn't happen, because if ACLs are not enabled we do not even show a link,
      // and if the userCanManage, then we just show the link without the tooltip. Despite that,
      // leave a harmless tooltip text if somehow this case does get hit.
      tooltipText = ClusterConfigure.enableAclsTooltipText;
    }
    return this.getTooltip(tooltipText, link,
      { arrowLeft: '87px', contentLeft: '-74px', width: '180px' });
  },

  getEditPermissionsLink() {
    // feature flag check, do not show anything if disabled.
    if (!AclUtils.clusterAclsFeatureFlag()) {
      return;
    }

    // check that user has permission
    // the customer has enabled ACLs
    const userCanManage = this.props.userCanManage && AclUtils.clusterAclsEnabled();
    const link = (
      <a onClick={userCanManage ? this.openEditPermissionDialog : null}
        disabled={!userCanManage}
        className='permissions-button with-icon pointer'
        data-cluster-permissions={this.props.model.get('clusterName')}
      >
        <i className={'fa fa-fw fa-' + IconsForType.lock} />Permissions
      </a>
    );

    return userCanManage ? link : this.getPermissionsTooltipLink(userCanManage, link);
  },

  getTooltip(text, link, customPosition) {
    return <Tooltip text={text} customPosition={customPosition}>{link}</Tooltip>;
  },

  shouldEnableLink(permission) {
    if (!AclUtils.clusterAclsEnabled()) {
      return true;
    }
    return !!this.props[permission];
  },

  getConfigureLink() {
    const enable = this.shouldEnableLink('userCanManage');
    const link = (
      <a onClick={this.configureCluster}
        disabled={!enable}
        className='configure-button with-icon pointer'
        data-configure-cluster={this.props.model.get('clusterName')}
      >
        <i className={'fa fa-fw fa-' + IconsForType.setting}></i>Configure
      </a>
    );

    return enable ? link :
      this.getTooltip(ClusterConfigure.noPermissionsForActionText, link,
        { arrowLeft: '87px', contentLeft: '-74px', contentTop: '23px', width: '180px' });
  },

  getDropdownLink() {
    const dropdownButton =
      (<a onClick={this.toggleDropdownMenu}
        className='dropdown-button with-icon pointer action-button'
        data-cluster-actions={this.props.model.get('clusterName')}
      >
        <i className='fa fa-fw fa-chevron-down'></i>
      </a>);

    const tooltipText = 'More actions';
    const customPosition = { arrowLeft: '68px', contentLeft: '0px', width: '96px' };

    return this.getTooltip(tooltipText, dropdownButton, customPosition);
  },

  getTerminateLink(isEnabled, tooltipText) {
    const terminateButton =
      (<a onClick={isEnabled ? this.terminateCluster : null}
        disabled={!isEnabled}
        className='remove-button with-icon pointer action-button'
        data-remove-cluster={this.props.model.get('clusterName')}
      >
        <i className='fa fa-fw fa-times' />
      </a>);

    let text = tooltipText;
    let customPosition;
    if (isEnabled) {
      text = 'Terminate';
      customPosition = { arrowLeft: '38px', contentLeft: '-24px' };
    } else {
      customPosition = { arrowLeft: '108px', contentLeft: '-94px', width: '191px' };
    }

    return this.getTooltip(text, terminateButton, customPosition);
  },

  getRestartLink(isEnabled, tooltipText) {
    const restartButton =
      (<a onClick={isEnabled ? this.restartCluster : null}
        disabled={!isEnabled}
        className='restart-button with-icon pointer action-button'
        data-restart-cluster={this.props.model.get('clusterName')}
      >
        <i className={'fa fa-fw fa-' + IconsForType.refresh}></i>
      </a>);

    let text = tooltipText;
    let customPosition;
    if (isEnabled) {
      text = 'Restart';
      customPosition = { arrowLeft: '32px', contentLeft: '9px' };
    } else {
      customPosition = { arrowLeft: '136px', contentLeft: '-95px', width: '191px' };
    }

    return this.getTooltip(text, restartButton, customPosition);
  },

  getMoreActions() {
    const actions = [];
    if (this.props.model.isConfigurable()) {
      actions.push(this.getConfigureLink());
    }
    if (AclUtils.clusterAclsFeatureFlag() && this.props.model.canManagePermissions()) {
      actions.push(this.getEditPermissionsLink());
    }
    return actions;
  },

  render() {
    const dropdownMenu =
      (<DropdownMenu
        classes={['configure-dropdown']}
        outsideClickHandler={this.toggleDropdownMenu}
        getItems={this.getMoreActions}
      />);

    let terminateTooltip;
    const isTerminable = this.shouldEnableLink('userCanManage') &&
      this.props.model.canTerminate();
    if (!isTerminable) {
      if (!this.shouldEnableLink('userCanManage')) {
        terminateTooltip = ClusterConfigure.noPermissionsForActionText;
      } else {
        terminateTooltip = 'This cluster is not terminable.';
      }
    }

    let restartTooltip;
    const isRestartable = this.shouldEnableLink('userCanRestart') &&
      this.props.model.isRestartable();
    if (!isRestartable) {
      if (!this.shouldEnableLink('userCanRestart')) {
        restartTooltip = ClusterConfigure.noPermissionsForActionText;
      } else {
        restartTooltip = 'This cluster is not restartable.';
      }
    }

    const permissionsEnabled =
      AclUtils.clusterAclsFeatureFlag() && this.props.model.canManagePermissions();

    return (
      <div className='cluster-configure'>
        {this.getTerminateLink(isTerminable, terminateTooltip)}
        {this.getRestartLink(isRestartable, restartTooltip)}
        {(this.props.model.isConfigurable() || permissionsEnabled) ? this.getDropdownLink() : null}
        {this.state.dropdownMenuVisible ? dropdownMenu : null}
      </div>
    );
  },
});

ClusterConfigure.noPermissionsForActionText =
    'You do not have permissions for this action; contact your administrator.';
ClusterConfigure.enableAclsTooltipText =
    "Admin users can enable cluster-level ACLs in your Admin Console, under 'Access Control.'";

const ClusterState = React.createClass({
  propTypes: {
    state: React.PropTypes.string.isRequired,
    displayState: React.PropTypes.string.isRequired,
    stateMessage: React.PropTypes.string.isRequired,
    isDriverHealthy: React.PropTypes.bool.isRequired,
  },

  stateMessageIcon() {
    if (_.isEmpty(this.props.stateMessage)) {
      return null;
    }
    return (<i className='fa fa-exclamation-circle state-message-icon' />);
  },

  render() {
    return (
      <Tooltip ref='stateTooltip' text={this.props.stateMessage}>
        <div className='state-info'>
          <span>
            {this.props.displayState}
            {this.stateMessageIcon()}
          </span>
        </div>
      </Tooltip>);
  },
});

const ClusterRow = React.createClass({
  propTypes: {
    model: React.PropTypes.instanceOf(Cluster).isRequired,
    nodeTypes: React.PropTypes.array.isRequired,
    clusters: React.PropTypes.instanceOf(ClusterList).isRequired,
  },

  /**
   * Determines if we should show info inside the "Spark" column. This is links to the Spark UI and
   * driver logs.
   *
   * @param {string} state The state of the cluster.
   * @param  {bool} state Is the Spark History server enabled. Affects
   *   Terminated clusters.
   *
   * @return {bool} True if the the SparkDriver info should be displayed.
   */
  shouldShowSparkDriverInfo(state, sparkHistoryServerEnabled) {
    return state === 'Running' || state === 'Reconfiguring' ||
      (state === 'Terminated' && sparkHistoryServerEnabled);
  },

  /**
   * Should we show the list of nodes for the cluster. The cluster only has nodes available if it is
   * currently running or in the process of being reconfigured.
   *
   * @return {bool} Should the node list be shown
   */
  shouldShowNodeList(state) {
    return state === 'Running' || state === 'Reconfiguring';
  },

  getStateIcon(state) {
    if (AclUtils.clusterAclsEnabled() && state !== 'Terminated') {
      // While ACLs are being fetched, show an invisible icon, to avoid flashing different icons.
      // Need to return something with width, so whole table doesn't jump sideways on rerender.
      if (!this.props.model.permissionsHaveBeenFetched()) {
        return <i className='fa fa-circle status-icon icon-invisible' />;
      }
      if (!this.props.model.canAttach()) {
        return <i className={`fa fa-${IconsForType.ban} status-icon icon-disabled`} />;
      }
    }

    if (state === 'Running') {
      return <i className='fa fa-circle status-icon icon-green' />;
    } else if (state === 'Pending' || state === 'Restarting' || state === 'Reconfiguring') {
      return <i className='fa fa-spinner fa-spin status-icon icon-green' />;
    } else if (state === 'Terminating' || state === 'TerminateWhenReady') {
      return <i className='fa fa-spinner fa-spin status-icon icon-red' />;
    } else if (state === 'Terminated' || state === 'Error') {
      return <i className='fa fa-circle status-icon icon-gray' />;
    }
  },

  getSparkVersion(key) {
    if (!key) {
      return 'Unspecified spark version';
    }
    const sparkVersion = _.where(window.settings.sparkVersions, { key: key })[0];
    if (sparkVersion) {
      return <span>{sparkVersion.displayName}</span>;
    }
    return (
        <span>
          Spark Custom
          <Tooltip text={key}><i className='fa fa-question-circle' /></Tooltip>
        </span>
    );
  },

  goToClusterDetailsPage(clusterId, state, e) {
    // We want to avoid going to the cluster details page if these tags are the target of the click
    // For example, if I click on the restart button, I don't want the page to redirect
    const tagsToAvoid = ['A', 'I', 'BUTTON'];
    const pendingState = 'Pending';

    if (!tagsToAvoid.includes(e.target.tagName) &&
        !tagsToAvoid.includes(e.target.parentNode.tagName) &&
	state !== pendingState) {
      window.recordEvent('clusterDetailsVisited', {
        'clusterDetailsTabVisited': 'Configuration',
        'clusterDetailsTabVisitedOrigin': viewName,
      });
      window.location.hash = ClusterUtil.getDetailsLinks(clusterId).configuration;
    }
  },

  getStateTooltipText(state, stateMessage) {
    if (AclUtils.clusterAclsEnabled() && !this.props.model.canAttach() && state !== 'Terminated') {
      return 'You do not have attach permissions on this cluster; contact your administrator.';
    }
    return stateMessage ? <span><b>{state}</b>: {stateMessage}</span> : state;
  },

  render() {
    const cluster = this.props.model;
    const sparkVersion = this.getSparkVersion(cluster.get('sparkVersion'));
    const clusterId = cluster.get('clusterId');
    const clusterName = cluster.get('clusterName');
    const state = cluster.get('state');
    const nodeTypeId = cluster.get('nodeTypeId').id;
    const driverNodeTypeId = cluster.get('driverNodeTypeId').id;
    const displayState = cluster.displayState();
    const memInt = cluster.displayMemoryGB();
    const memory = memInt > 0 ? memInt.toString() + ' GB' : '';

    const classes = ClassNames({
      'cluster-row': true,
      'cluster-pending': state === 'Pending',
      'cluster-terminating': state === 'Terminating' || state === 'TerminateWhenReady',
      'cluster-running': state === 'Running',
      'cluster-restarting': state === 'Restarting',
      'cluster-reconfiguring': state === 'Reconfiguring',
      'cluster-terminated': state === 'Terminated',
      'cluster-error': state === 'Error',
      'cluster-unhealthy': !cluster.isDriverHealthy(),
    });

    const stateIcon = this.getStateIcon(state);

    const nodeType = ClusterUtil.getNodeType(nodeTypeId, this.props.nodeTypes);
    const driverNodeType = ClusterUtil.getNodeType(driverNodeTypeId, this.props.nodeTypes);
    let clusterTypeDescription = (
      <div>
        <div>Driver: {driverNodeType.description},</div>
        <div>Workers: {nodeType.description},</div>
      </div>
    );
    if (nodeTypeId === driverNodeTypeId) {
      clusterTypeDescription = <div>{nodeType.description},</div>;
    }

    const clusterNameLink = cluster.isElasticSparkCluster() ?
      (<a href={cluster.elasticSparkRunUrl()}>{clusterName}</a>) : clusterName;
    const terminalUrl = (window.settings.enableTerminal || window.prefs.get('enableTerminal'))
      && (state === 'Running' || state === 'Reconfiguring') ? cluster.terminalUrl() : null;

    const sparkClusterUiUrl = ClusterUtil.getDetailsLinks(clusterId).sparkclusterui;
    const driverUrl = ClusterUtil.getDetailsLinks(clusterId).sparkui;
    const driverLogsUrl = ClusterUtil.getDetailsLinks(clusterId).driverlogs;
    const oldDriverUrl = cluster.driverUrl();

    let nodeList = null;
    const numWorkers = cluster.get('numWorkers');
    const workerUrls = [];
    for (let i = 0; i < numWorkers; i++) {
      workerUrls.push(sparkClusterUiUrl + '/' + i);
    }
    if (this.shouldShowNodeList(state)) {
      // +1 for the driver (since numWorkers is just the number of workers)
      let totalSpotInstances = cluster.get('numActiveSpotExecutors');
      let totalOnDemandInstances = cluster.get('numWorkers') - totalSpotInstances;

      // Add the driver in to the calculation. This must be done after we have calculated
      // totalOnDemandInstances to not incorrectly subtract the driver when it is on spot.
      if (cluster.get('isDriverOnSpot')) {
        totalSpotInstances += 1;
      } else {
        totalOnDemandInstances += 1;
      }

      nodeList = (
        <NodeList
          clusterName={clusterName}
          clusterId={clusterId}
          masterUrl={sparkClusterUiUrl + '/master'}
          workerUrls={workerUrls}
          terminalUrl={terminalUrl}
          totalOnDemandInstances={totalOnDemandInstances}
          totalSpotInstances={totalSpotInstances}
        />
      );
    }

    let sparkDriver = null;
    if (this.shouldShowSparkDriverInfo(state, window.settings.sparkHistoryServerEnabled)) {
      sparkDriver = (
        <SparkInfoCell
          clusterName={clusterName}
          driverUrl={driverUrl}
          oldDriverUrl={oldDriverUrl}
          enableDriverLogsUI={window.settings.enableDriverLogsUI}
          driverLogsUrl={driverLogsUrl}
          terminalUrl={terminalUrl}
          viewName={viewName}
          userCanAttach={AclUtils.clusterAclsEnabled() ? this.props.model.canAttach() : true}
        />
      );
    }

    const clusterTerminated = state === 'Terminated' || state === 'Error';
    const clusterTerminating = state === 'Terminating';

    const libraries = !clusterTerminated ? (
      <Libraries
        clusterId={clusterId}
        libraries={cluster.get('libraries')}
      />) : null;

    const notebookLinks = !clusterTerminated ? (
      <Notebooks
        clusterId={clusterId}
        notebooks={cluster.get('notebooks')}
      />) : null;

    const makeDashboardLink = (!clusterTerminated && !clusterTerminating) ? (
      <MakeDashboardLink
        model={cluster}
        isElasticSparkCluster={cluster.isElasticSparkCluster()}
        defaultCluster={cluster.get('defaultCluster')}
      />) : null;

    const clusterConfigure = !clusterTerminated ? (
      <ClusterConfigure
        userCanManage={this.props.model.canManage()}
        userCanAttach={this.props.model.canAttach()}
        userCanRestart={this.props.model.canRestart()}
        ref='clusterConfigure'
        model={cluster}
        clusters={this.props.clusters}
      />) : null;

    // PROD-4691: Show a warning if the cluster is too small to run Spark commands
    let stateMessage = '';
    if (cluster.get('stateMessage')) {
      stateMessage = cluster.get('stateMessage');
    } else if (state === 'Running' && cluster.workerUrls().length === 0 &&
        !window.settings.enableMiniClusters) {
      stateMessage = 'Warning: a cluster needs at least 1 worker to run Spark commands or ' +
        'import tables.';
    }

    const sparkVersionColumn = <span data-spark-version={clusterName}>{sparkVersion}</span>;
    const boundGoToClusterDetails = this.goToClusterDetailsPage.bind(this, clusterId, state);

    return (
      <tr className={classes} onClick={boundGoToClusterDetails}>
        <td className='cluster-state-icon-cell'
          data-cluster-name={clusterName}
          data-cluster-state={state}
        >
          <Tooltip
            text={this.getStateTooltipText(state, stateMessage)}
            customPosition={{ contentLeft: '-1px', contentTop: '21px', arrowLeft: '11px' }}
          >
            {stateIcon}
          </Tooltip>
        </td>
        <td className='cluster-name-cell'
          data-cluster-name={clusterName}
          data-cluster-state={state}
        >
            {clusterNameLink}
        </td>
        <td className='cluster-memory-cell'
          data-cluster-memory={clusterName}
        >
          {memory}
        </td>
        <td className='cluster-type-cell'>
          {cluster.get('isAutoscaling') ? 'Autoscaling (beta), ' : null}
          {clusterTypeDescription}
          {sparkVersionColumn}
        </td>
        <td className='cluster-state-cell'>
          <ClusterState
            ref='clusterState'
            state={state}
            displayState={displayState}
            isDriverHealthy={cluster.isDriverHealthy()}
            stateMessage={stateMessage}
          />
        </td>
        <td className='cluster-nodes-cell'>{nodeList}</td>
        <td className='cluster-spark-cell'>{sparkDriver}</td>
        <td className='cluster-libraries-cell'>{libraries}</td>
        <td className='cluster-notebooks-cell'>{notebookLinks}</td>
        <td className='cluster-dashboard-cell'>{makeDashboardLink}</td>
        <td className='cluster-configure-cell'>{clusterConfigure}</td>
      </tr>
    );
  },
});

const ReactClusterListView = React.createClass({

  propTypes: {
    clusters: React.PropTypes.instanceOf(ClusterList).isRequired,
    nodeTypes: React.PropTypes.array.isRequired,
  },

  getInitialState() {
    return {
      // only used if clusterAcls are enabled
      userCanCreate: true,
    };
  },

  componentWillMount() {
    if (AclUtils.clusterAclsEnabled()) {
      Cluster.ROOT.fetchPermissions(() => {
        if (this.isMounted()) {
          this.setState({ userCanCreate: Cluster.ROOT.canCreateClusters() });
        }
      });
    }
  },

  componentDidMount() {
    const throttledForceUpdate = _.throttle(() => {
      if (this.isMounted()) {
        this.forceUpdate();
      }
    }, 1000);
    this.props.clusters.on('add change remove reset', throttledForceUpdate, this);
    this.props.clusters.on('add reset', this._resetPermissions, this);
    this._resetPermissions();
  },

  _resetPermissions() {
    const bulkFetchUnderway = this.bulkPermissionsFetch &&
      this.bulkPermissionsFetch.state() === 'pending';
    if (AclUtils.clusterAclsEnabled() && !bulkFetchUnderway) {
      const models = this.props.clusters.models;
      if (models.length === 0) { return; }
      const type = WorkspacePermissions.CLUSTER_TYPE;
      this.bulkPermissionsFetch = AclUtils.fetchAndSetPermissions(models, type);
    }
  },

  componentWillUnmount() {
    this.props.clusters.off(null, null, this);
    if (this.bulkPermissionsFetch) {
      this.bulkPermissionsFetch.abort();
      this.bulkPermissionsFetch = null;
    }
  },

  addCluster() {
    NavFunc.addCluster();
  },

  _getAddClusterLink() {
    const getLink = function getLink(disable) {
      return (
        <h5>
          <a onClick={this.addCluster}
            className='btn btn-primary add-button cluster-add-button'
            id='cluster-add-button'
            disabled={disable}
          >
            <i className='fa fa-plus' /> Create Cluster
          </a>
        </h5>
      );
    }.bind(this);

    // feature flag, tier flag, and ACLs-enabled checks
    if (!AclUtils.clusterAclsEnabled()) {
      return getLink(false);
    }

    // disable link and show tooltip if user lacks permission to create clusters
    const userCanCreate = this.state.userCanCreate;
    if (!userCanCreate) {
      const tooltipText = 'You do not have permission to create clusters. ' +
        'Please contact your administrator.';
      return <Tooltip text={tooltipText}>{getLink(true)}</Tooltip>;
    }

    return getLink(false);
  },

  renderTable(tableRows, tableClass) {
    /**
     * Do not use this as an example for tables; it needs to be refactored to use
     * ReactTable's Table and Column. For now, see ClusterDetailsLibrariesList and
     * ClusterDetailsLibrariesListView.
     */
    return (
        <table className={'table table-bordered-outer ' + tableClass}>
          <thead>
          <tr>
            <th className='empty-header'></th>
            <th className='span2 name-header'>Name</th>
            <th className='span2'>Memory</th>
            <th className='span2'>Type</th>
            <th className='span2'>State</th>
            <th className='span3'>Nodes</th>
            <th className='span3'>Spark</th>
            <th className='span2'>Libraries</th>
            <th className='span2'>Notebooks</th>
            <th className='span3'>Default Cluster</th>
            <th className='span2'>Actions</th>
          </tr>
          </thead>
          <tbody id='clusters-table'>
          {tableRows}
          </tbody>
        </table>);
  },

  prepareClusterRows(rowList, clusters) {
    clusters.sort(compareClusters);
    clusters.forEach((elem) => {
      const row =
      (<ClusterRow
        ref='clusterRow'
        key={elem.get('clusterId')}
        clusters={this.props.clusters}
        nodeTypes={this.props.nodeTypes}
        model={elem}
      />);
      rowList.push(row);
    });
  },

  getClustersForActiveList(clusterList) {
    return clusterList.activeClusters().concat(clusterList.terminatingClusters());
  },

  render() {
    /**
     * Do not use this as an example for tables; it needs to be refactored to use
     * ReactTable's Table and Column. For now, see ClusterDetailsLibrariesList and
     * ClusterDetailsLibrariesListView.
     */
    const activeRows = [];
    const terminatedRows = [];
    const clustersForActiveList = this.getClustersForActiveList(this.props.clusters);
    const terminatedClusters = this.props.clusters.terminatedClusters();

    this.prepareClusterRows(activeRows, clustersForActiveList);
    this.prepareClusterRows(terminatedRows, terminatedClusters);

    return (
      <div id='clusters-content'>
        <div className='cluster-header'>
          <h3>Active Clusters</h3>
          <span className='cluster-header-separator'></span>
          {this._getAddClusterLink(activeRows.length)}
        </div>
        { this.renderTable(activeRows, 'table-clusters-active') }
        <h3>Terminated Clusters</h3>
        { this.renderTable(terminatedRows, 'table-clusters-terminated')}
      </div>
    );
  },

});

module.exports.ReactClusterListView = ReactClusterListView;
module.exports.ClusterConfigure = ClusterConfigure;
module.exports.ClusterRow = ClusterRow;
