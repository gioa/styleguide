/* eslint react/prefer-es6-class: 0, react/no-is-mounted: 0, max-lines: 0, func-names: 0 */

import _ from 'underscore';
import React from 'react';

import { AclUtils } from '../acl/AclUtils.jsx';
import { PermissionEditView } from '../acl/PermissionEditView.jsx';
import WorkspacePermissions from '../acl/WorkspacePermissions';

import { ClusterDropdownItem } from '../notebook/ClusterDropdownItem.jsx';
import ClusterList from '../clusters/ClusterList';
import { ClusterUtil } from '../clusters/Common.jsx';

import NavFunc from '../filetree/NavFunc.jsx';

import KeyboardShortcutsView from '../notebook/KeyboardShortcutsView.jsx';
import NotebookConstants from '../notebook/NotebookConstants';
import NotebookModel from '../notebook/NotebookModel';
import NotebookUtilities from '../notebook/NotebookUtilities';
import { triggerPublishNotebookWorkflow, triggerHubPublishWorkflow }
  from '../notebook/PublishNotebookView.jsx';
import { RestartClusterDropdownLink } from '../notebook/RestartClusterDropdownLink.jsx';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';
import ReactDialogBox from '../ui_building_blocks/dialogs/ReactDialogBox.jsx';
import { ContextBarLink } from './ContextBarLink.jsx';

import ReactModalUtils from '../ui_building_blocks/dialogs/ReactModalUtils';
import DropdownMenuView from '../ui_building_blocks/dropdowns/DropdownMenuView.jsx';
import IconsForType from '../ui_building_blocks/icons/IconsForType';
import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

import { BrowserUtils } from '../user_platform/BrowserUtils';

const ContextBarView = React.createClass({

  propTypes: {
    clusters: React.PropTypes.instanceOf(ClusterList).isRequired,
    model: React.PropTypes.instanceOf(NotebookModel).isRequired,
    isExampleNotebook: React.PropTypes.bool,
    displayMode: React.PropTypes.string,
    changeDisplayCallback: React.PropTypes.func,
    showLoadScreenCallback: React.PropTypes.func,
    hideLoadScreenCallback: React.PropTypes.func,
    toggleCommentsPanel: React.PropTypes.func,
    showCommentsPanel: React.PropTypes.bool,
    toggleHistory: React.PropTypes.func,
    showHistory: React.PropTypes.bool,
    toggleSchedule: React.PropTypes.func,
    showSchedule: React.PropTypes.bool,
    currentDashboardId: React.PropTypes.oneOfType([
      React.PropTypes.string,
      React.PropTypes.number,
    ]),
    permissionLevel: React.PropTypes.string,
  },

  getDefaultProps() {
    const noOp = function() {};
    return {
      isExampleNotebook: false,
      displayMode: 'notebook',
      changeDisplayCallback: noOp,
      showLoadScreenCallback: noOp,
      hideLoadScreenCallback: noOp,
      toggleCommentsPanel: noOp,
      showCommentsPanel: false,
      toggleHistory: noOp,
      showHistory: false,
      toggleSchedule: noOp,
      showSchedule: false,
      permissionLevel: WorkspacePermissions.MANAGE,
    };
  },

  _forceUpdate() {
    if (this.isMounted()) {
      this.forceUpdate();
    }
  },

  componentDidMount() {
    if (AclUtils.clusterAclsEnabled()) {
      AclUtils.fetchAndSetPermissions(
        this.props.clusters.attachableOrInProgressClusters(), WorkspacePermissions.CLUSTER_TYPE);
    }
  },

  tags(additionalTags) {
    let tags = this.props.model.tags(); // notebook tags
    tags.source = 'ContextBarView';
    tags = _.defaults(tags, additionalTags);
    return BrowserUtils.getMeasurementTags(tags);
  },

  attachToCluster(cluster) {
    const clusterId = cluster.get('clusterId');
    const clusterName = cluster.get('clusterName');
    const curTags = this.tags({
      'clusterId': clusterId,
      'clusterName': clusterName,
      'actionSelected': 'attachNotebook',
    });
    window.recordEvent('notebookActionsClicked', curTags);
    NotebookUtilities.attachToCluster(this.props.model, cluster);
  },

  // Get the cluster links for the DropdownMenu
  getClusters() {
    return _.map(this.props.clusters.attachableOrInProgressClusters(), (cluster) => {
      let clickHandler;

      if (cluster.isAttachable()) {
        clickHandler = () => this.attachToCluster(cluster);
      } else {
        clickHandler = () => {
          if (window.settings.allowRunOnPendingClusters) {
            this.attachToCluster(cluster);
          } else {
            DeprecatedDialogBox.confirm({
              message: name + ' is not ready yet. Do you want to attach this notebook to ' +
                name + ' when it is ready?',
              confirm: () => this.attachToCluster(cluster),
            });
          }
        };
      }
      return <ClusterDropdownItem
        cluster={cluster}
        clickHandler={clickHandler}
        tagsFunction={self.tags}
      />;
    });
  },

  getReattachClusterDropdownItems() {
    const self = this;

    return _.map(this.props.clusters.attachableOrInProgressClusters(), function(cluster) {
      const name = cluster.get('clusterName');
      const clusterId = cluster.get('clusterId');
      const clusterName = cluster.get('clusterName');
      const curTags = self.tags({
        'clusterId': clusterId,
        'clusterName': clusterName,
        'actionSelected': 'detachAndAttach',
      });
      let clickHandler;

      if (cluster.isAttachable()) {
        clickHandler = function() {
          self.props.model.detachAndAttach(clusterId);
          window.recordEvent('notebookActionsClicked', curTags);
        };
      } else {
        clickHandler = function() {
          if (window.settings.allowRunOnPendingClusters) {
            self.props.model.detachAndAttach(clusterId);
          } else {
            ReactDialogBox.confirm({
              message: name + ' is not ready yet. Do you want to attach this notebook to ' +
                name + ' when it is ready?',
              confirm() {
                self.props.model.detachAndAttach(clusterId);
                window.recordEvent('notebookActionsClicked', curTags);
              },
            });
          }
        };
      }

      return <ClusterDropdownItem
        cluster={cluster}
        clickHandler={clickHandler}
        tagsFunction={self.tags}
      />;
    });
  },

  handleShortcutsClick() {
    // open or close the dropdown
    this.refs.shortcutView.toggleState();
    // record click
    window.recordEvent('shortcutsViewed', {
      clickOrigin: 'contextBarShortcutsIcon',
    });
  },

  getShortcutsIcon() {
    return (
      <div id={"shortcut-wrapper"}>
        <a className={"shortcut-menu-icon"} onClick={this.handleShortcutsClick} >
          <i className={"fa fa-keyboard-o"}></i>
        </a>
      </div>
    );
  },

  getHistoryLink() {
    if (window.settings.enableNotebookHistoryUI) {
      return (<ContextBarLink
        text='Revision history'
        onClick={this.props.toggleHistory}
        iconType='history'
        id={this.props.showHistory ? 'hide-history' : 'show-history'}
        inset={this.props.showHistory}
      />);
    }
    return null;
  },

  /**
   * Render the schedule link only if the window.settings.enableNotebookRefresh feature flip is
   * true.
   *
   * @return {React|null} React element iff window.settings.enableNotebookRefresh is true.
   */
  getScheduleLink() {
    if (window.settings.enableNotebookRefresh) {
      return (<ContextBarLink
        text='Schedule'
        onClick={this.props.toggleSchedule}
        iconType='jobs'
        id={this.props.showSchedule ? 'hide-schedule' : 'show-schedule'}
        disabled={false}
        inset={this.props.showSchedule}
      />);
    }
    return null;
  },

  getCommentsLink() {
    if (window.settings.enableReactNotebookComments) {
      return (<ContextBarLink
        text='Comments'
        onClick={this.props.toggleCommentsPanel}
        iconType='comments'
        id={this.props.showCommentsPanel ? 'hide-comments' : 'show-comments'}
        inset={this.props.showCommentsPanel}
      />);
    }
    return null;
  },

  openPublishNotebookDialog() {
    window.recordEvent('notebookActionsClicked', this.tags({
      actionSelected: 'openPublishNotebook',
    }));
    triggerPublishNotebookWorkflow(this.getNodeId(), this.isDashboard());
  },

  openHubPublish() {
    triggerHubPublishWorkflow(
      this.getNodeId(),
      this.isDashboard(),
      this.props.model.get('name')
    );
  },

  togglePublishMenu() {
    this.setState({ publishMenuVisible: !this.state.publishMenuVisible });
  },

  getPublishNotebookLink() {
    /* Only allow private-link publishing */
    if (!window.settings.enablePublishHub) {
      const description =
        'This notebook will be published publicly and anyone with the link can view it';
      return (<ContextBarLink
        text='Publish'
        onClick={this.openPublishNotebookDialog}
        iconType='publish'
        id='publish-notebook'
        disabled={this.props.showHistory}
        tooltip={description}
      />);
    }

    /* Allow both private-link and Hub publishing */
    const actionElements = () => [
      <a id='action' onClick={this.openPublishNotebookDialog}>Private link</a>,
      <a id='action' onClick={this.openHubPublish}>NotebookHub</a>,
    ];

    const publishDropdownMenu = (<DropdownMenuView
      outsideClickHandler={this.togglePublishMenu}
      ignoreClickClasses={['actions-dropdown']}
      getItems={actionElements}
      classes={['actions-dropdown-contents']}
    />);

    return (
      <div className={'dropdown actions-dropdown'}>
        <ContextBarLink
          text='Publish'
          caret
          onClick={this.togglePublishMenu}
          iconType='publish'
          id='publish-dropdown-link'
          disabled={this.props.showHistory}
        />
        {this.state.publishMenuVisible ? publishDropdownMenu : null}
    </div>
    );
  },

  getPermissionLink() {
    const permissionLevel = this.props.model.getPermissionLevel();
    let tooltipText;
    const permissionsText = 'Permissions';
    if (window.settings.enableWorkspaceAclsConfig) {
      // if workspace ACLs are turned on, the tooltip should show the description of the user's
      // permissions
      tooltipText = WorkspacePermissions.permissionToDescription(permissionLevel, 'shell', 'You');
      const canManage = this.props.model.canManage();
      return (
        <ContextBarLink
          classes={['permissions']}
          text={canManage ? permissionsText : permissionLevel}
          onClick={canManage ? this.openEditPermissionDialog : null}
          iconType={canManage ? 'lock' : 'share'}
          id='share'
          disabled={this.props.showHistory}
          tooltip={tooltipText + (canManage ? ' Click to change permissions.' : '')}
        />);
    }
    // if workspace ACLs are not turned on but are enabled, the tooltip should tell the
    // user to contact an admin to enable ACLs. Otherwise, the customer is in starter tier
    // (workspace ACLs are not enabled) and we suggest for them to upgrade.
    tooltipText = window.settings.enableWorkspaceAcls ?
      'Contact your admin to enable Workspace Access Control in the admin console.'
      : Tooltip.getUpgradeElement('Workspace Access Control', false);
    return (
      <ContextBarLink
        classes={['permissions']}
        text={permissionsText}
        onClick={null}
        iconType='lock'
        id='share'
        disabled={true}
        tooltip={tooltipText}
      />);
  },


  openEditPermissionDialog() {
    window.recordEvent('notebookActionsClicked', this.tags({
      actionSelected: 'openPermissions',
    }));

    const model = this.props.model;
    model.fetchWorkspaceAcl(function() {
      const view = <PermissionEditView workspaceAcl={model.get('workspaceAcl')} />;
      ReactModalUtils.createModal(view);
    });
  },

  _runAll() {
    // TODO(Chaoyu): remove the duplicated runall metric in NotebookModel
    window.recordEvent('notebookActionsClicked', this.tags({
      actionSelected: 'runAll',
    }));

    this.props.model.runAll();
  },

  _cancelRunAll() {
    // TODO(Chaoyu): remove the duplicated cancelRunAll metric in NotebookModel
    window.recordEvent('notebookActionsClicked', this.tags({
      actionSelected: 'cancelRunAll',
    }));

    this.props.model.cancelRunAll();
  },

  clearResults(e) {
    if (e && e.getModifierState && e.getModifierState('Shift')) {
      this.clearResultsWithoutConfirmation();
    } else {
      this.clearResultsWithConfirmation();
    }
  },

  clearResultsWithoutConfirmation() {
    window.recordEvent('notebookActionsClicked', this.tags({
      actionSelected: 'clearResults',
    }));

    this.props.model.clearResults();
  },

  clearResultsWithConfirmation() {
    const msg = (
      <div>
        <p>Are you sure you want to clear all notebook results?</p>
        <p className='hint-msg'>
          Tip: bypass this dialog by holding the 'Shift' key when clicking on the button.
        </p>
      </div>
    );

    ReactDialogBox.confirm({
      message: msg,
      confirmButton: 'Confirm',
      confirm: this.clearResultsWithoutConfirmation,
    });
  },

  // Returns the appropriate RunAll link depending on the state of execution
  // Returns a "Run All" link if the notebook is current not executing but is attached
  // Returns null if the notebook is not attached.
  // Otherwise it returns a stop execution link
  // If canRun is false, the link will be grayed out and unclickable
  getRunAllLink() {
    const notebook = this.props.model;
    const canRun = WorkspacePermissions.canRun(this.props.permissionLevel);
    const shouldDisableLink = this.props.showHistory || !canRun;

    if (NotebookUtilities.isRunningAll(notebook)) {
      return (<ContextBarLink
        text='Stop Execution'
        onClick={this._cancelRunAll}
        id='stopExecution'
        ref='stopExecutionLink'
        disabled={shouldDisableLink}
        iconType='stopRunAll'
      />);
    }
    return (<ContextBarLink
      text='Run All'
      onClick={this._runAll}
      disabled={shouldDisableLink}
      iconType='runAll'
    />);
  },

  getClearMenu() {
    // only show clear results if user has RUN permission
    if (!WorkspacePermissions.canRun(this.props.permissionLevel)) {
      return null;
    }

    // only show clear results in notebook/resultsOnly view
    if (this.props.displayMode !== 'notebook' && this.props.displayMode !== 'resultsOnly') {
      return null;
    }

    const clearMenu = (<DropdownMenuView
      heading={null}
      outsideClickHandler={this.toggleClearMenu}
      ignoreClickClasses={['clear-dropdown']}
      getItems={this.getClearDropdownItems}
      classes={[]}
    />);

    if (window.settings.enableClearStateFeature) {
      return (
        <div className={"dropdown clear-dropdown"}>
          <ContextBarLink
            text='Clear'
            onClick={this.toggleClearMenu}
            iconType='clearResults'
            caret
            id='clear-results-link'
          />
          {this.state.clearMenuVisible ? clearMenu : null}
        </div>
      );
    }
    const notebook = this.props.model;
    return (<ContextBarLink
      text='Clear Results'
      onClick={this.clearResults}
      disabled={this.props.showHistory || notebook.isRunning()}
      iconType='clearResults'
    />);
  },


  restartCluster() {
    const self = this;
    const clusterName = this.props.model.get('clusterName');
    const clusterId = this.props.model.get('clusterId');

    DeprecatedDialogBox.confirm({
      message: (<div>Are you sure you want to restart <b>{clusterName}</b>?
		This action will affect all users of the cluster.</div>),
      confirm() {
        const clusterModel = self.props.clusters.findWhere({ clusterId: clusterId });
        // check for cluster model since there can be a race condition in cluster polling
        if (clusterModel) {
          clusterModel.restart();
        }
      },
    });
  },

  detachWithoutConfirm() {
    this.props.model.detach();
  },

  detachWithConfirm() {
    const notebook = this.props.model;
    const msg = (<div>Are you sure you want to detach <b>{notebook.get('name')}</b>?
              This will clear all computed variable values from this notebook.</div>);

    DeprecatedDialogBox.confirm({
      message: msg,
      confirmButton: 'Confirm',
      confirm: this.detachWithoutConfirm,
    });
  },

  clearStateWithoutConfirm(runAfter, clearAfter) {
    const clusterId = this.props.model.get('clusterId');
    const clusterName = this.props.model.get('clusterName');
    this.props.model.detachAndAttach(clusterId);

    const curTags = this.tags();
    curTags.clusterId = clusterId;
    curTags.clusterName = clusterName;
    curTags.actionSelected = 'clearState';

    if (runAfter) {
      curTags.isRunAll = true;
      curTags.actionSelected = 'clearStateAndRunAll';
      this.props.model.runAll();
    }

    if (clearAfter) {
      curTags.actionSelected = 'clearStateAndResults';
      this.props.model.clearResults();
    }
    window.recordEvent('notebookActionsClicked', curTags);
  },

  clearStateWithConfirm(runAfter) {
    const msg = (<div>Are you sure you want to clear the notebook state? This will clear all
              computed variable values from this notebook.</div>);

    ReactDialogBox.confirm({
      message: msg,
      confirmButton: 'Confirm',
      confirm: this.clearStateWithoutConfirm.bind(this, runAfter, false),
    });
  },

  clearStateAndResultsWithConfirm() {
    const msg = (<div>Are you sure you want to clear the notebook state and all results ?
              This will clear all computed variable values from this notebook.</div>);

    ReactDialogBox.confirm({
      message: msg,
      confirmButton: 'Confirm',
      confirm: this.clearStateWithoutConfirm.bind(this, false, true),
    });
  },

  // Link and dropdown menu to show if the target cluster is not yet runnable (e.g., restarting)
  getPendingDropDown(targetClusterModel) {
    const clusterName = targetClusterModel.get('clusterName');
    const detachLink =
      (<a data-name={"Context Bar Detach"} onClick={this.detachWithoutConfirm}>
        Detach
      </a>);

    return this.makeAttachDetachDropDown(
      targetClusterModel.shortDisplayState() + ': ' + clusterName,
      targetClusterModel.displayState(),
      function() { return [detachLink]; },
      true /* inProgress */
      );
  },

  getCreateClusterLink() {
    if (window.settings.enableRestrictedClusterCreation) {
      return '#create/cluster';
    }
    return '#setting/clusters';
  },

  // Link and dropdown menu to show if the notebook is currently detached
  getDetachedDropDown() {
    const clusterCount = this.props.clusters.attachableOrInProgressClusters().length;
    const heading = clusterCount > 0 ? 'Attach to:' : 'No clusters available';
    const createClusterLink = this.getCreateClusterLink();
    const getItems = clusterCount > 0 ? this.getClusters : function() {
      return [<a data-name='Create a Cluster' href={createClusterLink}>Create a Cluster</a>];
    };
    return this.makeAttachDetachDropDown('Detached', heading, getItems, false);
  },

  // Link and dropdown menu to show if the notebook is attached to a cluster
  getAttachDropDown() {
    const clusterModel = this.props.clusters.findWhere({
      clusterId: this.props.model.get('clusterId'),
    });
    const clusterName = this.props.model.get('clusterName');
    const detachLink =
      (<a data-name={"Context Bar Detach"} onClick={this.detachWithConfirm}>
        Detach
      </a>);

    const reAttachLink = (
      <a onClick={this.clearStateWithConfirm.bind(this, false)}>
        Re-Attach
      </a>);

    const reAttachMenu = (
      <li className='dropdown-submenu'>
        <a id='reattach-dropdown-menu'>Detach & Attach to</a>
        <ul className='dropdown-menu attach-dropdown'>
          {_.map(this.getReattachClusterDropdownItems(), (cl) => <li>{cl}</li>)}
        </ul>
      </li>
    );
    // check for model === null due to race condition on cluster polling
    const restartLink = clusterModel && clusterModel.isRestartable() ? (
      <RestartClusterDropdownLink
        clusterModel={clusterModel}
        restartClusterFunc={this.restartCluster}
      />) : null;
    const sparkUiLink = clusterModel ? this._getSparkUILink(clusterModel) : null;
    const driverLogsLink = (clusterModel && window.settings.enableDriverLogsUI) ?
      this._getDriverLogsLink(clusterModel) : null;
    const clusterReady = this.props.model.get('clusterReady');
    const clusterState = clusterReady ? 'Attached: ' : 'Pending: ';
    const headingText = this._getAttachDropdownHeadingText(clusterModel, clusterState, clusterName,
      clusterReady);

    return this.makeAttachDetachDropDown(
      clusterState + clusterName,
      this._getAttachDropdownHeading(clusterModel, headingText),
      function() {
        if (window.settings.enableDetachAndAttachSubMenu) {
          return [detachLink, restartLink, sparkUiLink, driverLogsLink, reAttachLink, reAttachMenu];
        }
        return [detachLink, restartLink, sparkUiLink, driverLogsLink];
      },
      !clusterReady /* inProgress */
      );
  },

  _getAttachDropdownHeadingText(clusterModel, clusterState, clusterName, clusterReady) {
    let headingText = clusterModel ? clusterModel.displayState() : clusterState + clusterName;

    // Only report size if cluster is ready.
    if (clusterModel && clusterReady) {
      headingText += ' ' + clusterModel.sizeAndSparkVersion();
    }

    return headingText;
  },

  _getClusterHref(clusterModel) {
    if (clusterModel && clusterModel.get('clusterId')) {
      return ClusterUtil.getDetailsLinks(clusterModel.get('clusterId')).notebooks;
    }
    return '';
  },

  _getAttachDropdownHeading(clusterModel, headingText) {
    return (
      <div>
        <span className='attach-dropdown-heading-text'>
          {headingText}
        </span>
        <a
          href={this._getClusterHref(clusterModel)}
          target='_blank'
          rel='noopener noreferrer'
          title='Open cluster'
          className='cluster-nav-link attach-dropdown-heading'
        >
          <i className={'fa fa-fw fa-' + IconsForType.navigate} />
        </a>
      </div>
    );
  },

  lacksClusterAttachPermissions(clusterModel) {
    return AclUtils.clusterAclsEnabled() && !clusterModel.canAttach();
  },

  _getSparkUILink(clusterModel) {
    const noPermissions = this.lacksClusterAttachPermissions(clusterModel);
    let link = (
      <a
        data-name='View Spark UI'
        href={clusterModel.driverUrl()}
        target='_blank'
        rel='noopener noreferrer'
        disabled={noPermissions}
      >
        View Spark UI
      </a>
    );
    if (noPermissions) {
      link = this._getNoPermissionsWrappedElem(link);
    }
    return link;
  },

  _getDriverLogsLink(clusterModel) {
    const noPermissions = this.lacksClusterAttachPermissions(clusterModel);
    let link = (
      <a data-name='View Driver Logs'
        href={'#setting/sparkui/' + clusterModel.get('clusterId') + '/driver-logs'}
        target='_blank'
        rel='noopener noreferrer'
        disabled={noPermissions}
      >
        View Driver Logs
      </a>
    );
    if (noPermissions) {
      link = this._getNoPermissionsWrappedElem(link);
    }
    return link;
  },

  _getNoPermissionsWrappedElem(elem) {
    const tooltipText = WorkspacePermissions.NO_VIEW_PERMISSIONS_WARNING;
    return <Tooltip text={tooltipText} attachToBody>{elem}</Tooltip>;
  },

  showRunCommandHighlight(status) {
    if (status === NotebookConstants.state.NO_CLUSTER_ATTACHED) {
      const targetCluster = this.props.clusters.findWhere({
        clusterId: this.props.model.get('targetClusterId'),
      });

      if (targetCluster && targetCluster.isInProgress()) {
        this.showAttachDetachHighlight({
          tooltip: targetCluster.get('clusterName') + ' is not yet ready to run commands. ' +
            'Please wait or attach to another cluster.',
          classes: ['error'],
        });
      } else {
        this.showAttachDetachHighlight({
          tooltip: 'Please attach this notebook to a cluster to run commands.',
          classes: ['error'],
        });
      }
    } else if (status === NotebookConstants.state.ALREADY_RUNNING) {
      this.showStopExecutionHighlight({
        tooltip: "Can't run command during Run All, Please stop current execution first.",
        classes: ['error'],
        autoHide: true,
      });
    } else if (status === NotebookConstants.state.SELECTED_COMMAND_RUNNING) {
      DeprecatedDialogBox.alert('Command is running, Please wait or cancel current execution.');
    }
  },

  showAttachDetachHighlight(options) {
    if (this.isMounted()) {
      this.refs.attachDetachLink.highlight(options);
    }
  },

  showStopExecutionHighlight(options) {
    this.refs.stopExecutionLink.highlight(options);
  },

  makeAttachDetachDropDown(linkText, heading, getItems, inProgress) {
    const hasAttachPermission = WorkspacePermissions.canRun(this.props.permissionLevel);

    const dropdownMenu = (<DropdownMenuView
      heading = {heading}
      outsideClickHandler = { this.toggleMenu }
      ignoreClickClasses={['attach-detach-dropdown']}
      getItems = {getItems}
      classes={['attach-detach-menu', 'skip-heading-hover']}
    />);
    const icon = inProgress ? 'inProgress' : 'cluster';
    const handler = hasAttachPermission ? this.toggleMenu : null;
    let classes = 'dropdown attach-detach-dropdown';
    if (this.props.showHistory) {
      classes += ' history-panel-on';
    }

    return (
      <div className={classes}>
        <ContextBarLink
          text={linkText}
          onClick={handler}
          iconType={icon}
          caret={hasAttachPermission}
          id='attach-detach-link'
          ref='attachDetachLink'
          disabled={this.props.showHistory || !hasAttachPermission}
        />
        {this.state.menuVisible ? dropdownMenu : null}
      </div>
    );
  },

  getAttachDetachDropDown() {
    const isAttached = this.props.model.get('clusterId') !== '';
    const targetCluster = this.props.model.get('targetClusterId');
    const targetClusterModel = this.props.clusters.findWhere({ clusterId: targetCluster });

    if (isAttached) {
      return this.getAttachDropDown();
    } else if (targetClusterModel && !targetClusterModel.isTerminated()) {
      // cluster we were attached to is restarting or reconfiguring
      return this.getPendingDropDown(targetClusterModel);
    }
    return this.getDetachedDropDown();
  },

  getDashboardViews(dashboards, activeView) {
    const activeIndicator = (<i className={'fa fa-' + IconsForType.active}></i>);
    const baseDashboardRoute = '#notebook/' + this.props.model.id + '/dashboard/';
    return _.map(dashboards, function(dashboard) {
      const isActiveView = activeView === dashboard.id;

      const tags = this.tags({
        dashboardId: dashboard.id,
        eventType: 'open',
      });

      return (
          <a data-name={'switch-view-dashboard-' + dashboard.id}
            onClick={function() { window.recordEvent('dashboard', tags); }}
            href={baseDashboardRoute + dashboard.id}
            className={isActiveView ? 'active' : ''}
          >
            {isActiveView ? activeIndicator : null}
            {dashboard.get('title')}
          </a>
      );
    }, this);
  },

  createDashboard() {
    const props = this.props;
    props.showLoadScreenCallback();

    const tags = this.tags({
      eventType: 'create',
    });

    window.recordEvent('dashboard', tags);

    this.props.model.createNewDashboardView(function(resultObject) {
      const route = 'notebook/' + props.model.get('id') + '/dashboard/' + resultObject.dashboardId;
      window.router.navigate(route, { trigger: true });
    });
  },

  getClearDropdownItems() {
    const isAttached = this.props.model.get('clusterId') !== '';
    const canRun = WorkspacePermissions.canRun(this.props.permissionLevel);
    const notebook = this.props.model;
    const showReset = !this.props.showHistory && canRun && isAttached;

    const clearResultsElement = (
      <a data-name={'clear-results'}
        onClick={this.clearResults}
        className={(!this.props.showHistory && !notebook.isRunning()) ? 'active' : 'disabled'}
      >Clear Results</a>);

    const clearStateElement = (
      <a data-name={'clear-state'}
        onClick={this.clearStateWithConfirm.bind(this, false)}
        className={(showReset ? 'active' : 'disabled')}
      >Clear State</a>);

    const clearStateAndResultsElement = (
      <a data-name={'clear-state-and-results'}
        onClick={this.clearStateAndResultsWithConfirm}
        className={(showReset ? 'active' : 'disabled')}
      >Clear State & Results</a>);

    const clearStateAndRunElement = (
      <a data-name={'clear-state-and-run'}
        onClick={this.clearStateWithConfirm.bind(this, true)}
        className={(showReset ? 'active' : 'disabled')}
      >Clear State & Run All</a>);

    return [
      clearResultsElement,
      clearStateElement,
      clearStateAndResultsElement,
      clearStateAndRunElement];
  },

  getViewDropdownItems() {
    const activeView = this.props.displayMode;
    const enableNewDashboardViews = window.settings.enableNewDashboardViews;

    const isNotebookActiveView = activeView === 'notebook';
    const notebookElement = (
      <a data-name={"switch-view-notebook"}
        onClick={function() { window.recordEvent('clickShowAllButton'); }}
        href={'#notebook/' + this.props.model.get('id')}
        className={isNotebookActiveView ? 'active' : ''}
      >
        {isNotebookActiveView ? (<i className={'fa fa-' + IconsForType.active}></i>) : null}
        Code
      </a>
    );
    const isResultsOnlyActiveView = activeView === 'resultsOnly';
    const resultsOnlyElement = (
      <a data-name={"switch-view-resultsOnly"}
        onClick={function() { window.recordEvent('clickResultsOnlyButton'); }}
        href={'#notebook/' + this.props.model.get('id') + '/resultsOnly'}
        className={isResultsOnlyActiveView ? 'active' : ''}
      >
        {isResultsOnlyActiveView ? (<i className={'fa fa-' + IconsForType.active}></i>) : null}
        Results Only
      </a>
    );

    let result = [notebookElement, resultsOnlyElement];

    // when new dashboard view is disabled, only show notebook and results only view
    if (!enableNewDashboardViews) {
      return result;
    }

    result.push(<p role='separator' className='divider dashboard-views'></p>);

    const dashboards = this.props.model.getDashboardViewModels();
    if (dashboards.length) {
      result.push(<span className='heading dashboard-views'>Dashboards:</span>);
      const dashboardElements = this.getDashboardViews(dashboards, this.props.currentDashboardId);
      result = result.concat(dashboardElements);
    }

    const hasEditPerm = WorkspacePermissions.canEdit(this.props.permissionLevel);

    if (hasEditPerm) {
      if (dashboards.length) {
        result.push((<p role='separator' className='divider'></p>));
      }

      const createDashboardLink = (
        <a data-name={"create-dashboard"} onClick={this.createDashboard}>
          <i className={'fa fa-' + IconsForType.create}></i>
          New Dashboard
        </a>
      );
      result.push(createDashboardLink);
    }

    return result;
  },

  getCurrentDisplayModeTitle() {
    const loadingMessage = 'Loading...';
    if (this.props.displayMode === 'dashboardView') {
      const props = this.props;
      const dashboards = props.model.getDashboardViewModels();
      // The first time the model is loaded (like on page navigation) the dashboard view models
      // may not have been loaded. If so, skip loading.
      if (dashboards.length === 0) {
        return loadingMessage;
      }

      const model = _.find(dashboards, function(someModel) {
        return someModel.get('id') === props.currentDashboardId;
      });
      if (!model) {
        return loadingMessage;
      }

      return 'View: ' + model.get('title');
    } if (this.props.displayMode === 'resultsOnly') {
      return 'View: Results Only';
    }
    return 'View: Code';
  },

  getViewSelector() {
    const viewMenu = (<DropdownMenuView
      heading={null}
      outsideClickHandler={this.toggleViewMenu}
      ignoreClickClasses={['view-dropdown']}
      getItems={this.getViewDropdownItems}
      classes={[]}
    />);

    return (
      <div className={"dropdown view-dropdown"}>
        <ContextBarLink
          text={this.getCurrentDisplayModeTitle()}
          onClick={this.toggleViewMenu}
          iconType='view'
          caret
          id='view-mode-link'
        />
        {this.state.viewMenuVisible ? viewMenu : null}
      </div>
    );
  },

  toggleViewMenu() {
    this.setState({ viewMenuVisible: !this.state.viewMenuVisible });
  },

  toggleClearMenu() {
    this.setState({ clearMenuVisible: !this.state.clearMenuVisible });
  },

  getFileDropdown() {
    const self = this;
    const cloneLink = <a id='clone-action' onClick={this.cloneNotebook}>Clone</a>;
    const renameLink = <a id='rename-action' onClick={this.renameNotebook}>Rename</a>;
    const moveLink = <a id='move-action' onClick={this.moveNotebook}>Move</a>;
    const deleteLink = <a id='delete-action' onClick={this.deleteNotebook}>Delete</a>;
    const exportDropdownLink = this.getExportDropdownLink();
    const publishLink = this.getPublishFileDropdownLink();
    const isLocked = this.props.isExampleNotebook;

    const actionElements = function() {
      const canManage = WorkspacePermissions.canManage(self.props.permissionLevel);
      if (!isLocked && canManage) {
        if (window.settings.enablePublishNotebooks) {
          return [cloneLink, renameLink, moveLink, deleteLink, exportDropdownLink, publishLink];
        }
        return [cloneLink, renameLink, moveLink, deleteLink, exportDropdownLink];
      }
      return [cloneLink, exportDropdownLink];
    };

    const fileDropdownMenu = (<DropdownMenuView
      heading={null}
      outsideClickHandler={this.toggleActionsMenu}
      ignoreClickClasses={['actions-dropdown']}
      getItems={actionElements}
      classes={['actions-dropdown-contents']}
    />);

    let classes = 'dropdown actions-dropdown';
    if (this.props.showHistory) { classes += ' history-panel-on'; }

    return (
      <div className={classes}>
        <ContextBarLink
          text='File'
          onClick={this.toggleActionsMenu}
          caret
          id='actions-dropdown-link'
          disabled={this.props.showHistory}
          iconType='shell'
        />
        {this.state.fileMenuVisible ? fileDropdownMenu : null}
      </div>
    );
  },

  toggleActionsMenu() {
    this.setState({ fileMenuVisible: !this.state.fileMenuVisible });
  },

  getInitialState() {
    return {
      menuVisible: false,
      displayMenuVisible: false,
      fileMenuVisible: false,
      viewMenuVisible: false,
      publishMenuVisible: false,
    };
  },

  toggleMenu() {
    this.setState({ menuVisible: !this.state.menuVisible });
  },

  toggleDisplayMenu() {
    this.setState({ displayMenuVisible: !this.state.displayMenuVisible });
  },

  cloneNotebook() {
    window.recordEvent('notebookActionsClicked', {
      actionSelected: 'cloneNotebook',
    });

    NavFunc.cloneNode(
      this.props.model.id,
      this.props.showLoadScreenCallback,
      function(newId) {
        window.location = '#notebook/' + newId;
      },
      this.props.hideLoadScreenCallback);
  },

  renameNotebook() {
    window.recordEvent('notebookActionsClicked', {
      actionSelected: 'renameNotebook',
    });

    NavFunc.renameNode(this.props.model.id, this.props.model);
  },

  deleteNotebook() {
    window.recordEvent('notebookActionsClicked', {
      actionSelected: 'deleteNotebook',
    });

    NavFunc.deleteNode(this.props.model.id, this.props.model, null);
  },

  moveNotebook() {
    window.recordEvent('notebookActionsClicked', {
      actionSelected: 'moveNotebook',
    });

    const srcNode = this.props.model;
    const controls = [
      {
        controlType: 'filetreePath',
        pathlabel: 'Moving to folder: ',
      },
      {
        controlType: 'filetree',
        id: 'picker',
        nodeType: 'folder',
        hideExamples: true,
      },
    ];

    const dialog = DeprecatedDialogBox.custom({
      title: "Moving '" + srcNode.get('name') + "'",
      confirmButton: '  Select',
      class: 'move-file-dialog',
      controls: controls,
      confirm(dialogElem) {
        const destNode = dialogElem.find('#picker')[0].fileTree.selectedFolder().node;

        // Show ACL permission change dialog for individual items if ACLs are on
        const moveNode = NavFunc.moveNodes.bind(this, [srcNode], destNode, null);
        if (window.settings.enableWorkspaceAclsConfig) {
          NavFunc.checkAndPreviewPermission(srcNode, destNode.id, moveNode);
        } else {
          moveNode();
        }
      },
    });

    const parentId = this.props.model.attributes.parentId;
    const parentTreeNode = window.fileBrowserView.getModel(parentId);
    const parentTreeModel = window.fileBrowserView.toTreeNode(parentTreeNode);
    dialog.find('#picker')[0].fileTree.openToNode(parentTreeModel);
  },

  getPublishFileDropdownLink() {
    if (!window.settings.enablePublishHub) {
      return <a id='publish-action' onClick={this.openPublishNotebookDialog}>Publish</a>;
    }

    return (
      <li className='dropdown-submenu'>
        <a id='publish-dropdown-link'>Publish</a>
        <ul className='dropdown-menu publish-dropdown'>
          <li><a onClick={this.openPublishNotebookDialog}>Private link</a></li>
          <li><a onClick={this.openHubPublish}>NotebookHub</a></li>
        </ul>
      </li>
    );
  },

  getExportDropdownLink() {
    const exportIPythonLink = (
      <li><a id='export-ipython-action' onClick={this.exportIPython}>IPython Notebook</a></li>
    );

    return (
      <li className='dropdown-submenu'>
        <a id='export-dropdown-link'>Export</a>
        <ul className='dropdown-menu export-dropdown'>
          <li><a id='export-item-action' onClick={this.exportItem}>DBC Archive</a></li>
          <li><a id='export-source-action' onClick={this.exportSource}>Source File</a></li>
          {this.props.model.get('language') === 'python' ? exportIPythonLink : null}
          {this.getExportHTMLLink()}
        </ul>
      </li>
    );
  },

  exportItem() {
    window.recordEvent('notebookActionsClicked', {
      actionSelected: 'exportNotebookDBCArchive',
    });

    NavFunc.exportItem(this.props.model.id);
  },

  exportSource() {
    window.recordEvent('notebookActionsClicked', {
      actionSelected: 'exportNotebookSourceFile',
    });

    NavFunc.exportSource(this.props.model.id);
  },

  exportIPython() {
    window.recordEvent('notebookActionsClicked', {
      actionSelected: 'exportNotebookIPythonNotebook',
    });

    NavFunc.exportIPython(this.props.model.id);
  },

  getExportHTMLLink() {
    if (window.settings.enableStaticNotebooks || window.testMode) {
      const exportHTML = () => {
        window.recordEvent('notebookActionsClicked', {
          actionSelected: 'exportNotebookHTML',
        });
        NavFunc.exportHTML(this.getNodeId());
      };
      return (<li><a id='export-html-action' onClick={exportHTML}>HTML</a></li>);
    }
    return null;
  },

  getModeSpecificElements() {
    const hasEditPerm = WorkspacePermissions.canEdit(this.props.permissionLevel);

    if (this.props.displayMode === 'notebook') {
      return (
        <div className='context-bar-right-links'>
          {this.getShortcutsIcon()}
          {window.settings.enablePublishNotebooks ? this.getPublishNotebookLink() : null}
          {window.settings.enableElasticSparkUI ? this.getScheduleLink() : null}
          {this.getCommentsLink()}
          {hasEditPerm ? this.getHistoryLink() : null}
        </div>);
    }

    if (this.props.displayMode === 'resultsOnly') {
      return (
        <div className='context-bar-right-links'>
          {this.getScheduleLink()}
          {hasEditPerm ? this.getHistoryLink() : null}
        </div>);
    }

    if (this.props.displayMode === 'dashboardView') {
      return (
        <div className='context-bar-right-links'>
          {this.getScheduleLink()}
        </div>);
    }

    return null;
  },

  isDashboard() {
    return this.props.displayMode === 'dashboardView';
  },

  getNodeId() {
    return this.isDashboard() ? this.props.currentDashboardId : this.props.model.id;
  },

  render() {
    if (this.props.isExampleNotebook) {
      return (
        <div id='context-bar'>
        {this.getFileDropdown()}
        <ContextBarLink text='Example Notebook' onClick={null} />
        </div>
      );
    }

    return (
      <div className='new-notebook context-bar' id='context-bar'>
        {this.getAttachDetachDropDown()}
        {this.getFileDropdown()}
        {this.getViewSelector()}
        {this.getPermissionLink()}
        {this.getRunAllLink()}
        {this.getClearMenu()}
        {this.getModeSpecificElements()}
        <KeyboardShortcutsView ref={"shortcutView"} style={{ right: 10 }} />
      </div>
    );
  },
});

module.exports = ContextBarView;
