/* eslint react/prefer-es6-class: 0 */

import React from 'react';
import ClassNames from 'classnames';

import ClusterList from '../../clusters/ClusterList';
import { SubmitButton } from '../../clusters/Common.jsx';

import NotebookModel from '../../notebook/NotebookModel';
import DashboardLayoutView from '../../notebook/dashboards/DashboardLayoutView.jsx';
import DashboardViewMixin from '../../notebook/dashboards/DashboardViewMixin.jsx';
import { FetchErrorPanel } from '../../notebook/FetchErrorPanel.jsx';
import NotebookUtilities from '../../notebook/NotebookUtilities';

import { ResourceUrls } from '../../urls/ResourceUrls';

/**
 * DashboardPresentView is the UI component for viewing a dashboard
 */
const DashboardPresentView = React.createClass({

  propTypes: {
    clusters: React.PropTypes.instanceOf(ClusterList),
    notebook: React.PropTypes.instanceOf(NotebookModel).isRequired,
    dashboardId: React.PropTypes.number.isRequired,
    exitRoute: React.PropTypes.string,
    showExitBtn: React.PropTypes.bool,
    showUpdateBtn: React.PropTypes.bool,
    showInputWidgets: React.PropTypes.bool,
  },

  getDefaultProps() {
    return {
      showExitBtn: true,
      showUpdateBtn: true,
      showInputWidgets: true,
    };
  },

  mixins: [DashboardViewMixin],

  getInitialState() {
    return {
      isCancelling: false,
    };
  },

  _tags() {
    const tags = this.state.dashboard.tags();
    tags.source = 'DashboardPresentView';
    return tags;
  },

  onUpdate() {
    this.setState({ isCancelling: false });
    this.props.notebook.runAll();
    const tags = this._tags();
    tags.eventType = 'runAll';
    window.recordEvent('dashboard', tags);
  },

  onCancel() {
    this.setState({ isCancelling: true });
    this.props.notebook.cancelRunAll();
    const tags = this._tags();
    tags.eventType = 'cancelRunAll';
    window.recordEvent('dashboard', tags);
  },

  renderUpdateButton() {
    if (!this.props.showUpdateBtn || NotebookUtilities.isRunningAll(this.props.notebook)) {
      return null;
    }

    return (
      <span className='refresh-btn'>
        <SubmitButton text='Update' onClick={this.onUpdate} />
      </span>
    );
  },

  renderCancelUpdateButton() {
    if (!this.props.showUpdateBtn || !NotebookUtilities.isRunningAll(this.props.notebook)) {
      return null;
    }

    const buttonContent = (
      <span>
        <img className='update-btn-spinner' title='Dashboard is updating..'
          src={ResourceUrls.getResourceUrl('img/spinner.svg')}
        />
      {this.state.isCancelling ? 'Cancelling' : 'Cancel'}
      </span>
    );

    return (
      <span className='cancel-refresh-btn'>
        <SubmitButton
          text={buttonContent}
          onClick={this.onCancel}
          disabled={this.state.isCancelling}
        />
      </span>
    );
  },

  render() {
    const notebook = this.props.notebook;
    const dashboard = this.state.dashboard;

    if (notebook.notebookFetchError()) {
      // show an error view if the initial notebook fetch fails (e.g., due to access denied)
      return <FetchErrorPanel error={notebook.notebookFetchError()} />;
    }

    const permissionLevel = this.getPermissionLevel();

    if (!this.dashboardModelReady()) {
      return (<div className='dashboard-present-content dashboard-loading'>
        <img className='load-spinner' src={ResourceUrls.getResourceUrl('img/spinner.svg')} />
      </div>);
    }

    const exitRoute = this.props.exitRoute ? this.props.exitRoute :
      dashboard.getDashboardViewRoute();
    const wrapperClasses = {
      'dashboard-present-view-wrapper': true,
      'dashboard-loading': this.state.showSpinner,
    };
    const wrapperStyles = {
      width: dashboard.getDashboardWidth() + 'px',
    };
    const emptyHint = dashboard.isEmpty() ? (
      <div className='empty-dashboard-hint'>
        {"Dashboard is currently empty. "}
        <a href={dashboard.getDashboardViewRoute()}>Back to edit view.</a>
      </div>) : null;
    const exitBtn = this.props.showExitBtn ? (
      <div className='exit-present-btn'>
        <a href={exitRoute}>Exit</a>
      </div>) : null;
    const title = dashboard.get('title');
    const titleDiv = <div ref='dashboardTitle' className='dashboard-title'>{title}</div>;

    return (
      <div className=''>
        <div
          className={ClassNames(wrapperClasses)}
          style={wrapperStyles}
        >
          {exitBtn}
          {this.renderUpdateButton()}
          {this.renderCancelUpdateButton()}
          {emptyHint}
          {title && title !== 'Untitled' ? titleDiv : null}
          <DashboardLayoutView
            ref={"layoutView"}
            static
            permissionLevel={permissionLevel}
            setContentLoading={this.setContentLoading}
            showInputWidgets={this.props.showInputWidgets}
            dashboard={this.state.dashboard}
          />
        </div>
      </div>);
  },
});

module.exports = DashboardPresentView;
