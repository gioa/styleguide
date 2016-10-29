/* eslint react/prefer-es6-class: 0, react/no-is-mounted: 0 */

import $ from 'jquery';
import _ from 'underscore';
import React from 'react';
import ReactDOM from 'react-dom';
import ClassNames from 'classnames';

import WorkspacePermissions from '../acl/WorkspacePermissions';

import { LanguageNames } from '../notebook/LanguageNames';
import NotebookModel from '../notebook/NotebookModel';
import ReactNotebookCommandListView from '../notebook/ReactNotebookCommandListView.jsx';
import NotebookCommandModel from '../notebook/NotebookCommandModel';
import DashboardViewModel from '../notebook/dashboards/DashboardViewModel';
import DashboardPresentView from '../notebook/dashboards/DashboardPresentView.jsx';

import StaticNotebookImportDialog from './StaticNotebookImportDialog.jsx';

import ReactModalUtils from '../ui_building_blocks/dialogs/ReactModalUtils';
import IconsForType from '../ui_building_blocks/icons/IconsForType';
import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

import { ResourceUrls } from '../urls/ResourceUrls';

// tooltip shown if the static notebook was exported from a development shard
const DEV_WARNING = (
  <div>
    This HTML notebook was exported from a development shard and will not render outside
    the development environment.
    <br /><br />
    To share this notebook outside of development, import it into a production shard and export it
    again.
  </div>
);

/**
 * Given the JSON of a NotebookModel and its command collection, render entire the body of a
 * static notebook.
 */
const StaticNotebookView = React.createClass({

  propTypes: {
    // a hash containing the notebook model JSON
    notebookModelObject: React.PropTypes.object.isRequired,
    // an array containing the JSON of the models in the notebook command collection
    notebookModelCommandCollection: React.PropTypes.array.isRequired,
    // whether or not to show the top bar
    showTopBar: React.PropTypes.bool.isRequired,
    // whether or not to show the import button
    showImportButton: React.PropTypes.bool.isRequired,
    // The url where users should go to sign up for Databricks
    signupUrl: React.PropTypes.string.isRequired,
    // if defined, show the dashboard ID
    showDashboardId: React.PropTypes.number,
    // if this is a table of contents notebook, specifies the starting src of the iframe
    tableOfContentsStartPage: React.PropTypes.string,
    // true if the static notebook was produced in a development environment. the topbar will
    // indicate to the viewer that this static notebook should not be distributed outside of the
    // development environment (as the static resources may not be deployed outside of dev)
    isDevelopmentVersion: React.PropTypes.bool,
  },

  getInitialState() {
    return {
      // true iff the content pane is scrolled to near the top
      scrollNearTop: true,
    };
  },

  _scrollHandler() {
    if (this.isMounted()) {
      const contentDiv = ReactDOM.findDOMNode(this.refs.content);
      const scrollTop = $(contentDiv).scrollTop();
      if (scrollTop < 50 && !this.state.scrollNearTop) {
        this.setState({ scrollNearTop: true });
      } else if (scrollTop >= 50 && this.state.scrollNearTop) {
        this.setState({ scrollNearTop: false });
      }
    }
  },

  componentDidMount() {
    // if this is a dashboard presentation view, fade out the topbar on scroll-down
    // since it would otherwise overlap the dashboard content
    if (this._isDashboard()) {
      const contentDiv = ReactDOM.findDOMNode(this.refs.content);
      $(contentDiv).scroll(_.throttle(this._scrollHandler, 100));
    }
  },

  _isDashboard() {
    return !_.isUndefined(this.props.showDashboardId) && this.props.showDashboardId !== null;
  },

  _importDialog() {
    ReactModalUtils.createModal(
      <StaticNotebookImportDialog
        url={window.location.href}
        signupUrl={this.props.signupUrl}
      />
    );
  },

  _renderView(notebookModel) {
    if (this._isDashboard()) {
      return (
        <DashboardPresentView
          ref='dashboardPresentView'
          clusters={window.clusterList}
          notebook={notebookModel}
          dashboardId={this.props.showDashboardId}
          showUpdateBtn={false}
          showInputWidgets={false}
          showExitBtn={false}
        />
      );
    }
    return (
      <ReactNotebookCommandListView
        ref='nbCmdListView'
        notebook={notebookModel}
        onTextSelected={() => {}}
        permissionLevel={WorkspacePermissions.VIEW}
        isStatic
        resultsOnly={false}
        showCommentsPanel={false}
        showLastDivider
        showLoadScreen={false}
        showSubmitHint
      />
    );
  },

  render() {
    const notebookModel = new NotebookModel(this.props.notebookModelObject);
    notebookModel.set({ permissionLevel: WorkspacePermissions.VIEW });
    notebookModel.commandCollection().loaded = true;
    this.props.notebookModelCommandCollection.forEach((json) => {
      let model;
      if (json.type === 'command') {
        model = new NotebookCommandModel(json);
      } else if (json.type === 'dashboardView') {
        model = new DashboardViewModel(json);
      } else {
        return;
      }
      model.set({ parent: notebookModel });
      notebookModel.commandCollection().add(model);
    });

    const title = notebookModel.get('name');
    const lang = LanguageNames[notebookModel.get('language')];
    const isDev = this.props.isDevelopmentVersion;

    const devWarning = isDev ? (
      <span className='tb-title-dev-version'>
        <i className={'fa fa-' + IconsForType.warning} />
      </span>
    ) : null;

    const importButton = this.props.showImportButton ? (
      <div className='tb-import'>
        <a onClick={this._importDialog}
          className='btn btn-default import-button'
          title='Import Notebook'
        >
          <i className={'fa fa-' + IconsForType.import} /> Import Notebook
        </a>
      </div>
    ) : null;

    const topbarClasses = {
      'fade-out': !this.state.scrollNearTop,
      'dashboard-topbar': this._isDashboard(),
    };

    let topbar = this.props.showTopBar ? (
      <div ref='topbar' id='topbar' className={ClassNames(topbarClasses)}>
        <div className='tb-logo'>
          <a href='http://databricks.com' target='_blank' title='Databricks'>
            <img src={ResourceUrls.getResourceUrl('img/databricks_logoTM_rgb_TM.svg')}
              alt='databricks-logo'
            />
          </a>
        </div>
        <div className='tb-title-wrapper tb-title-wrapper-central'>
          {this._isDashboard() ? null :
            <span>
              <span ref='tbTitle' className='tb-title'>{title}</span>
              <span className='tb-title-lang'>{lang ? ('(' + lang + ')') : ''}</span>
            </span>}
          {devWarning}
        </div>
        {importButton}
      </div>
    ) : null;

    if (topbar && isDev) {
      topbar = (
      <Tooltip text={DEV_WARNING}>
        {topbar}
      </Tooltip>
      );
    }

    // Renders the embedded right pane for Table of Contents notebooks.
    let frame = null;
    if (this.props.tableOfContentsStartPage) {
      frame =
      (<iframe
        id='tableOfContentsRightPane'
        name='rightpane'
        src={this.props.tableOfContentsStartPage + '?hideTopBar=1'}
      ></iframe>);
    }

    const overallViewClasses = {
      'hide-top-bar': !this.props.showTopBar,
      'dashboard-present-view': this._isDashboard(),
    };

    return (
      <div id='static-notebook'
        className={this.props.tableOfContentsStartPage ? 'isTableOfContents' : null}
      >
        <div id='tooltip' className='hidden'>
          <p><span id='value'></span></p>
        </div>
        {topbar}
        <div id='overallView' className={ClassNames(overallViewClasses)}>
          <div id='content' ref='content'>
            <div className='overallContainer'>
              {this._renderView(notebookModel)}
            </div>
          </div>
          {frame}
        </div>
      </div>
    );
  },
});

module.exports = StaticNotebookView;
