/* eslint react/prefer-es6-class: 0, consistent-return: 0 */

import React from 'react';
import ClassNames from 'classnames';

import ClusterList from '../../clusters/ClusterList';

import ContextBarView from '../../notebook/ContextBarView.jsx';
import DashboardLayoutView from '../../notebook/dashboards/DashboardLayoutView.jsx';
import DashboardSideMenuView from '../../notebook/dashboards/DashboardSideMenuView.jsx';
import DashboardViewMixin from '../../notebook/dashboards/DashboardViewMixin.jsx';
import { FetchErrorPanel } from '../../notebook/FetchErrorPanel.jsx';
import NotebookConstants from '../../notebook/NotebookConstants';
import NotebookModel from '../../notebook/NotebookModel';
import { ScheduleSideMenuView } from '../../notebook/ScheduleSideMenuView.jsx';

import DbGuideLinks from '../../urls/DbGuideLinks';
import { ResourceUrls } from '../../urls/ResourceUrls';

/**
 * DashboardEditView is the main UI for editing a dashboard view. Similar to a notebook view, it
 * provides a context bar, from which user can switch between notebook view and different
 * dashboard views.
 *
 * It renders two components for editing a dashboard view: DashboardLayoutView and
 * DashboardSideMenuView.
 */
const DashboardEditView = React.createClass({

  propTypes: {
    clusters: React.PropTypes.instanceOf(ClusterList).isRequired,
    notebook: React.PropTypes.instanceOf(NotebookModel).isRequired,
    dashboardId: React.PropTypes.string.isRequired,
  },

  mixins: [DashboardViewMixin],


  getInitialState() {
    return {
      visibleSideMenu: '',
    };
  },

  populateDashboard() {
    if (this.state.dashboard) {
      // show load spinner
      this.setContentLoading(true);

      this.state.dashboard.populateElements(function hideLoadSpinner() {
        this.setContentLoading(false);
      }.bind(this));
    }
  },

  showRunCommandError(errors) {
    // @NOTE(jengler) 2015-11-18: The notebook will return a list of all errors, however, we will
    // only show one. Other than not have a UX design for how to display multiple errors, there is
    // no reason for this.
    const firstError = errors.errorType[0];
    this.refs.contextBar.showRunCommandHighlight(firstError);
  },

  onNotebookMessage(message) {
    if (message.type === NotebookConstants.message.RUN_ERROR) {
      this.showRunCommandError(message.data);
    }
  },

  _getEmptyHint(notebook, dashboard) {
    const url = encodeURI(DbGuideLinks.VISUALIZATIONS_URL);
    if (dashboard.isEmpty() && notebook.plottableCommandNUIDs().length > 0) {
      return (
        <div className='empty-dashboard-hint'>
          {"Dashboard is currently empty. You can "}
          <a onClick={this.populateDashboard}>Import All Graphs</a>
          {" from notebook, or import individual command from "}
          <a href={'#notebook/' + notebook.id}> Notebook view</a>.
        </div>
      );
    } else if (notebook.plottableCommandNUIDs().length === 0) {
      // hint if there are no notebook commands to display
      return (
        <div className='empty-dashboard-hint'>
          {"Dashboard is currently empty. You can start by "}
          <a href={url} target={"_blank"}>creating some data visualizations</a>{" in your "}
          <a href={'#notebook/' + notebook.id} target={"_blank"}>notebook.</a>
        </div>
      );
    }
  },

  /**
   * Toggle the currently visible sidemenu
   * @param  {string} sideMenu The sidemenu being toggled
   * @return {none}
   */
  toggleSideMenu(sideMenu) {
    if (this.state.visibleSideMenu === sideMenu) {
      this.setState({ visibleSideMenu: '' });
    } else {
      this.setState({ visibleSideMenu: sideMenu });
    }
  },

  /**
   * Remove all elements from the dashboard view. Callback triggered from side menu view.
   */
  removeAllElements() {
    if (this.refs.layoutView) {
      this.refs.layoutView.removeAllElementsAtOnce();
    }
  },

  /**
   * Render the sidemenu specified by visibleSideMenu with the provided permissions.
   *
   * @param  {string} visibleSideMenu The sidemenu to render
   * @param  {WorkspacePermission} permissionLevel The WorkspacePermission object
   * @return {ReactElement} The rendered react side menu
   */
  renderSideMenu(visibleSideMenu, permissionLevel) {
    switch (visibleSideMenu) {
      case 'schedule':
        return (
          <ScheduleSideMenuView
            ref='scheduleSideMenu'
            notebook={this.props.notebook}
            metricName='dashboard'
            jobSubView={`dashboard/${this.state.dashboard.get('nuid')}`}
          />
        );
      default:
        return (
          <DashboardSideMenuView
            ref={"sideMenu"}
            dashboard={this.state.dashboard}
            permissionLevel={permissionLevel}
            removeAllElements={this.removeAllElements}
          />
        );
    }
  },

  render() {
    const notebook = this.props.notebook;
    const dashboard = this.state.dashboard;

    if (notebook.notebookFetchError()) {
      // show an error view if the initial notebook fetch fails (e.g., due to access denied)
      return <FetchErrorPanel error={notebook.notebookFetchError()} />;
    }

    const permissionLevel = this.getPermissionLevel();
    const dashboardReady = this.dashboardModelReady();

    let content;
    if (dashboardReady) {
      const wrapperStyles = {
        width: dashboard.getDashboardWidth() + 'px',
      };
      const contentClasses = {
        'dashboard-edit-view': true,
        'dashboard-loading': this.state.showSpinner,
      };

      content = (
        <div id='content' className={ClassNames(contentClasses)}>
          <img className='load-spinner' src='../img/spinner.svg' />
          { this.renderSideMenu(this.state.visibleSideMenu, permissionLevel) }
          <div
            className='dashboard-view-wrapper'
            style={wrapperStyles}
          >
            {this._getEmptyHint(notebook, dashboard)}
            <div className='dashboard-layout-view-wrapper'>
              <DashboardLayoutView
                ref={"layoutView"}
                permissionLevel={permissionLevel}
                setContentLoading={this.setContentLoading}
                dashboard={this.state.dashboard}
              />
            </div>
          </div>
        </div>);
    } else {
      content = (
        <div id='content' className='dashboard-loading'>
          <img className='load-spinner' src={ResourceUrls.getResourceUrl('img/spinner.svg')} />
        </div>);
    }

    const toggleScheduleSideMenu = () => { this.toggleSideMenu('schedule'); };
    return (
      <div>
        <ContextBarView
          ref='contextBar'
          model={notebook}
          clusters={this.props.clusters}
          currentDashboardId={this.props.dashboardId}
          isExampleNotebook={notebook.get('isExample')}
          displayMode={"dashboardView"}
          permissionLevel={permissionLevel}
          toggleSchedule={toggleScheduleSideMenu}
          showSchedule={this.state.visibleSideMenu === 'schedule'}
        />
        {content}
      </div>);
  },
});

module.exports = DashboardEditView;
