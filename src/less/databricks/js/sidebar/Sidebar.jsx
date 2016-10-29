/* eslint react/prefer-es6-class: 0, react/no-is-mounted: 0, consistent-return: 0 */

import _ from 'underscore';
import d3 from 'd3';
import React from 'react';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';
import ClassNames from 'classnames';

import ReactRouter from '../controllers/ReactRouter.jsx';

import CollectionDeltaReceiver from '../delta_receiver/CollectionDeltaReceiver';

import TreeNodeCollection from '../filebrowser/TreeNodeCollection';

import NavFunc from '../filetree/NavFunc.jsx';
import { RoutingConstants } from '../filetree/RoutingConstants';
import WorkspaceConstants from '../filetree/WorkspaceConstants';

import SidebarTablePanel from '../sidebar/SidebarTablePanel.jsx';
import SidebarRecentPanel from '../sidebar/SidebarRecentPanel.jsx';

import IconsForType from '../ui_building_blocks/icons/IconsForType';

import { ResourceUrls } from '../urls/ResourceUrls';

// Sidebar width should be in sync with @sidebarwidth in variable.less
const SIDEBAR_WIDTH = 75;
const PANEL_WIDTH = 196;

function SlidingPanels(props) {
  if (props.enableCssTransitions) {
    return (
      <ReactCSSTransitionGroup
        transitionName='sidebar-panel'
        transitionAppear
        transitionAppearTimeout={250}
        transitionEnterTimeout={250}
        transitionLeaveTimeout={250}
      >{props.children}</ReactCSSTransitionGroup>
    );
  }
  return (<div>{props.children}</div>);
}

SlidingPanels.propTypes = {
  children: React.PropTypes.node,
  enableCssTransitions: React.PropTypes.bool,
};

function SidebarSpacer() {
  return <div className='sidebar-spacer'></div>;
}

function SidebarElement({
  label,
  icontype,
  onClick,
  selected,
  dataName,
  href,
  target,
}) {
  const iconClass = 'fa fa-fw fa-' + IconsForType[icontype] || icontype;
  const elementClass = {
    'sidebar-element': true,
    'selected': selected,
  };
  let iconElem = <i className={iconClass} />;

  if (icontype === 'databricks') {
    const color = selected ? 'Orange' : 'Gray';
    const src = ResourceUrls.getResourceUrl('img/Databricks_Logo_Side_Nav_' + color + '.svg');
    iconElem = <img src={src} alt='databricks-logo' />;
  }

  return (
    <li>
      <a href={href}
        className={ClassNames(elementClass)}
        onClick={onClick}
        data-name={dataName}
        target={target}
      >
        <div className='sidebar-element-icon'>
          <div className='sidebar-element-icon-inner'>{iconElem}</div>
        </div>
        <div><span>{label}</span></div>
      </a>
    </li>
  );
}

SidebarElement.propTypes = {
  label: React.PropTypes.string.isRequired,
  icontype: React.PropTypes.string.isRequired,
  onClick: React.PropTypes.func.isRequired,
  selected: React.PropTypes.bool.isRequired,
  dataName: React.PropTypes.string,
  href: React.PropTypes.string,
  target: React.PropTypes.string,
};

// Keeping the negative numbers for nostalgia
const WORKSPACE_ID = 'Workspace';
const TABLES_ID = 'Tables';
const CLUSTERS_ID = 'Clusters';
const HOMEPAGE_ID = 'HomePage';
const JOBS_ID = 'Jobs';
const APPLICATIONS_ID = 'Applications';
const HOMEDIR_ID = 'HomeFolder';
const RECENT_ID = 'Recent';
const SEARCH_ID = 'Search';

const Sidebar = React.createClass({
  propTypes: {
    router: React.PropTypes.object.isRequired,
    // Note: React does not play nicely with mutable objects as props. We need to be very careful to
    // update when we change this.
    fileBrowser: React.PropTypes.object.isRequired,
    fileTree: React.PropTypes.object.isRequired,
    treeCollection: React.PropTypes.instanceOf(TreeNodeCollection).isRequired,
    tables: React.PropTypes.instanceOf(CollectionDeltaReceiver).isRequired,
    enableThirdPartyApplicationsUI: React.PropTypes.bool,
    enableElasticSparkUI: React.PropTypes.bool,
    recentViewRoutes: React.PropTypes.array,
    enableCssTransitions: React.PropTypes.bool,
    reactRouter: React.PropTypes.instanceOf(ReactRouter).isRequired,
  },

  getDefaultProps() {
    return {
      enableThirdPartyApplicationsUI: false,
      enableElasticSparkUI: true,
      enableCssTransitions: true,
    };
  },

  hide() {
    this.setState({ hidden: true });
  },

  show() {
    this.setState({ hidden: false });
  },

  isHidden() {
    return this.state.hidden;
  },

  getInitialState() {
    return {
      hidden: false,
      openPanel: null,
      recentPinned: false,
    };
  },

  componentDidMount() {
    this.props.router.on('route', this.onRoute, this);
    this.props.reactRouter.on('route', this.onRoute, this);

    this.throttledUpdate = _.throttle(() => {
      this.forceUpdateRecents();
    }, 250);

    this.props.treeCollection.on('reset add remove change', this.throttledUpdate, this);
  },

  componentWillUnmount() {
    this.props.treeCollection.off(null, null, this);
    this.props.router.off(null, null, this);
    this.props.reactRouter.off(null, null, this);
  },

  componentDidUpdate() {
    // We perform transitions after the component updates so that the state is set correctly. This
    // is important for ensureStateInSyncWith{FileBrowser,SearchPanel}, because we need the new
    // state when we toggle the file browser.
    this.handleTransitions(this.state.openPanel);
  },

  forceUpdateRecents() {
    if (this.isMounted() && this.state.openPanel === RECENT_ID) {
      this.forceUpdate();
    }
  },

  forceUpdateTables() {
    if (this.isMounted() && this.state.openPanel === TABLES_ID) {
      this.forceUpdate();
    }
  },

  isFileBrowserPinned() {
    return this.isFileBrowserPanel(this.state.openPanel) && this.props.fileTree.isPinned();
  },

  isRecentPinned() {
    return (this.state.openPanel === RECENT_ID) && this.state.recentPinned;
  },

  toggleRecentPinned() {
    this.setState({ 'recentPinned': !this.state.recentPinned });
  },

  /**
   * Should the sidebar panel be closed when the page is routed to a new path.
   * This is true for all routes except:
   * 1. If it is a navigation that result in the sidebar being open. Example, folder navigation
   *    opens the sidebar to the specified folder, so we don't want to immediately close it again.
   * 2. The sidebar is pinned(either filetree is pinned or recent panel is pinned)
   * 3. The current panel is the search bar. Search bar currently handles when it should be closed.
   *
   * @param  {string} route The top-level route we are routing to.
   * @return {bool}         True, if the panel should be closed when routing to this route.
   */
  shouldClosePanelOnRoute(route) {
    if (route === 'folder') {
      return false;
    }

    if (this.isFileBrowserPinned() || this.isRecentPinned()) {
      return false;
    }

    if (this.state.openPanel === SEARCH_ID) {
      return false;
    }

    return true;
  },

  onRoute(route) {
    if (this.shouldClosePanelOnRoute(route)) {
      this.closePanels();
    }
    this.forceUpdate();
  },

  openPanel(panel) {
    this.setState({ openPanel: panel });
  },

  closePanels() {
    this.openPanel(null);
  },

  pushContent() {
    d3.selectAll(WorkspaceConstants.RIGHT_PANE_SELECTOR).transition().style(
      'left', SIDEBAR_WIDTH + PANEL_WIDTH + 'px');
  },

  unpushContent() {
    d3.selectAll(WorkspaceConstants.RIGHT_PANE_SELECTOR).transition().style(
      'left', SIDEBAR_WIDTH + 'px');
  },

  openFileBrowserToHome() {
    const folder = this.props.fileBrowser.getModel(NavFunc.getDefaultFolderId());
    const targetFileTreeNode = this.props.fileBrowser.toTreeNode(folder);
    this.props.fileTree.openToNode(targetFileTreeNode);
  },

  isFileBrowserPanel(panel) {
    return panel === WORKSPACE_ID || panel === HOMEDIR_ID;
  },

  // handleTransitions is responsible for transitioning the side panels in and out. This includes
  // interacting with the non-react fileBrowser.
  handleTransitions(openPanel) {
    // Transitioning the content is idempotent, so as long as we only perform it once in this
    // function, we don't need to worry about the previous state.

    if (!openPanel) {
      // If there are no open panels, the content should not be pushed.
      this.unpushContent();
    } else if (openPanel === TABLES_ID || openPanel === RECENT_ID) {
      // We manually push the content for non-fileBrowser panels.
      this.pushContent();
    }

    // Handle file browser transitions.
    if (this.isFileBrowserPanel(openPanel)) {
      // Showing the file browser closes the search panel as well.
      this.props.fileBrowser.toggleFileBrowser(true, true, false, true, true);

      if (openPanel === HOMEDIR_ID) {
        this.openFileBrowserToHome();
      }
    } else if (openPanel === SEARCH_ID) {
      this.props.fileBrowser.toggleSearchPanel(true, true, true);
    } else {
      // We do not allow the fileBrowser to move content when hiding, as we have already
      // transitioned to the correct level.
      this.props.fileBrowser.toggleFileBrowser(false, false, false, false, true);
      // Hiding the file browser does not close the search panel.
      this.props.fileBrowser.toggleSearchPanel(false, false, true);
    }
  },

  // The sidebar assumes that only it will open or close the fileBrowser. There is currently legacy
  // code that still opens and closes the fileBrowser manually. The following functions are called
  // by the fileBrowser on toggle in order to ensure the sidebar stays in sync with the fileBrowser,
  // even if the transitions were triggered elsewhere.

  ensureStateInSyncWithFileBrowser(fileBrowserOpen) {
    const isFileBrowserPanel = this.isFileBrowserPanel(this.state.openPanel);
    if (fileBrowserOpen && !isFileBrowserPanel) {
      this.openPanel(WORKSPACE_ID);
    } else if (!fileBrowserOpen && isFileBrowserPanel) {
      this.openPanel(null);
    }
  },

  ensureStateInSyncWithSearchPanel(searchPanelOpen) {
    const isSearchPanel = this.state.openPanel === SEARCH_ID;
    if (searchPanelOpen && !isSearchPanel) {
      this.openPanel(SEARCH_ID);
    } else if (!searchPanelOpen && isSearchPanel) {
      this.openPanel(null);
    }
  },

  openWorkspace(id) {
    this.props.fileBrowser.openToNodeId(id);
    this.openPanel(WORKSPACE_ID);
  },

  onClickNavigate(routeId) {
    window.recordEvent('clickSidebarButton', {
      parentMenuName: routeId,
    });

    this.openPanel(routeId);
  },

  getSelectedItem() {
    // If we have a panel open, that is always the selected item.
    if (this.state.openPanel) {
      return this.state.openPanel;
    }

    if (this.props.router.isWorkspaceRoute()) {
      return WORKSPACE_ID;
    } else if (this.props.router.isTableRoute()) {
      return TABLES_ID;
    } else if (this.props.router.isClusterRoute()) {
      return CLUSTERS_ID;
    } else if (this.props.router.isJobsRoute()) {
      return JOBS_ID;
    } else if (this.props.router.isApplicationsRoute()) {
      return APPLICATIONS_ID;
    } else if (this.props.router.isHomeRoute()) {
      return HOMEPAGE_ID;
    }
    return null;
  },

  /**
   * Returns id of the currently active notebook, or undefined if current view is not a notebook.
   */
  getCurrentNotebookId() {
    return window.activeView && window.activeView.props && window.activeView.props.notebook &&
      window.activeView.props.notebook.id;
  },

  /**
   * Returns id of the currently active table, or undefined if current view is not a table.
   */
  getCurrentTableId() {
    return window.activeView && window.activeView.props && window.activeView.props.tableName;
  },

  /**
   * Returns object with the type and id of the currently active view if view is table or notebook.
   * If currently active view is not a table or notebook, returns undefined.
   */
  getCurrentView() {
    const notebookId = this.getCurrentNotebookId();
    const tableName = this.getCurrentTableId();
    if (notebookId) {
      return {
        type: RoutingConstants.NODE_TYPE,
        id: notebookId,
      };
    } else if (tableName) {
      return {
        type: RoutingConstants.TABLE_TYPE,
        id: tableName,
      };
    }
  },

  render() {
    const selected = this.getSelectedItem();
    const makeOnClick = (routeId) => {
      if (this.state.openPanel === routeId) {
        return this.closePanels;
      }
      return this.onClickNavigate.bind(null, routeId);
    };

    const closePanel = this.onClickNavigate.bind(null, null);

    return (
      <div className={'sidebar-outer' + (this.state.hidden ? ' hidden' : '')}>
        <div className='sidebar-main' data-panel='Workspace'>
          <ul className='sidebar-ul'>
            <SidebarElement
              label={"databricks"}
              dataName={"Databricks"}
              icontype={"databricks"}
              href={"#"}
              onClick={closePanel}
              selected={selected === HOMEPAGE_ID}
            />
            <SidebarSpacer />
            <SidebarElement
              label={"Home"}
              dataName={"Home"}
              icontype={"home"}
              onClick={makeOnClick(HOMEDIR_ID)}
              selected={selected === HOMEDIR_ID}
            />
            <SidebarElement
              label={"Workspace"}
              dataName={"Workspace"}
              icontype={"workspace"}
              onClick={makeOnClick(WORKSPACE_ID)}
              selected={selected === WORKSPACE_ID}
            />
            <SidebarElement
              label={"Recent"}
              dataName={"Recent"}
              icontype={"recent"}
              onClick={makeOnClick(RECENT_ID)}
              selected={selected === RECENT_ID}
            />
            <SidebarSpacer />
            <SidebarElement
              label={"Tables"}
              dataName={"Tables"}
              icontype={"table"}
              onClick={makeOnClick(TABLES_ID)}
              selected={selected === TABLES_ID}
            />
            <SidebarElement
              label={"Clusters"}
              dataName={"Clusters"}
              icontype={"cluster"}
              href={"#setting/clusters"}
              onClick={closePanel}
              selected={selected === CLUSTERS_ID}
            />
            <SidebarElement
              label={"Jobs"}
              dataName={"Jobs"}
              icontype={"jobs"}
              href={"#joblist"}
              onClick={closePanel}
              selected={selected === JOBS_ID}
            />
            {this.props.enableThirdPartyApplicationsUI ?
              <SidebarElement
                label={"Apps"}
                dataName={"Applications"}
                icontype={"apps"}
                href={"#setting/applications"}
                onClick={closePanel}
                selected={selected === APPLICATIONS_ID}
              /> : null}
            {window.settings.showNotebookhubSidebarButton ?
              <SidebarElement
                label={"Hub"}
                dataName={"Hub"}
                icontype={"apps"}
                onClick={closePanel}
                href={window.settings.notebookHubUrl}
                selected={false}
                target={"_blank"}
              /> : null}
            <SidebarElement
              label={"Search"}
              dataName={"Search"}
              icontype={"search"}
              onClick={makeOnClick(SEARCH_ID)}
              selected={selected === SEARCH_ID}
            />
          </ul>
        </div>
        <SlidingPanels enableCssTransitions={this.props.enableCssTransitions}>
          {this.state.openPanel === TABLES_ID ?
            <SidebarTablePanel
              key='tables'
              tables={this.props.tables}
            /> : null}
          {this.state.openPanel === RECENT_ID ?
            <SidebarRecentPanel
              currentView={this.getCurrentView()}
              key='recents'
              pinned={this.state.recentPinned}
              toggleRecentPinned={this.toggleRecentPinned}
              fbView={this.props.fileBrowser}
              recentRoutes={window.router.recentViewRoutes} // directly access recent routes
            /> : null}
        </SlidingPanels>
      </div>
    );
  },
});

module.exports = Sidebar;
