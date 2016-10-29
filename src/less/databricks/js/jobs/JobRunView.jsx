/* eslint react/prefer-es6-class: 0, react/no-is-mounted: 0, consistent-return: 0, func-names: 0 */

import $ from 'jquery';
import _ from 'lodash';
import React from 'react';

import { AclUtils } from '../acl/AclUtils.jsx';
import WorkspacePermissions from '../acl/WorkspacePermissions';

import NavFunc from '../filetree/NavFunc.jsx';

import ElasticUtil from '../jobs/ElasticUtil';
import FullElasticRunStatus from '../jobs/FullElasticRunStatus';
import { JobActionElement } from '../jobs/JobActionElement.jsx';
import ReactNotebookCommandListeningListView from
  '../jobs/ReactNotebookCommandListeningListView.jsx';

import DashboardPresentView from '../notebook/dashboards/DashboardPresentView.jsx';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';
import IconsForType from '../ui_building_blocks/icons/IconsForType';
import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

import { BrowserUtils } from '../user_platform/BrowserUtils';
import { DateTimeFormats } from '../user_platform/DateTimeFormats';

const JobRunView = React.createClass({
  propTypes: {
    model: React.PropTypes.instanceOf(FullElasticRunStatus).isRequired,
    hideHeader: React.PropTypes.bool,
    displayMode: React.PropTypes.string,
    dashboardNUID: React.PropTypes.string,
    viewBaseUrl: React.PropTypes.string,
    children: React.PropTypes.node,
  },

  getDefaultProps() {
    return {
      hideHeader: false,
      displayMode: 'notebook',
      dashboardNUID: null,
    };
  },

  getInitialState() {
    return {
      notebook: null,
      clusterAclsFetched: false,
      userCanAttachToCluster: true,
    };
  },

  markPageAsBeta: false,
  refetchTimeout: null,
  forceRefetch: false,  // Set to force the poll loop to do a one-time refetch of model data.

  // sets the clusterId so that it is included in "Send Feedback" emails to support
  _setGlobalMeasurementTags() {
    if (this.getClusterId()) {
      BrowserUtils.setGlobalMeasurementTags({ clusterId: this.getClusterId() });
    } else {
      BrowserUtils.setGlobalMeasurementTags({});
    }
  },

  componentWillMount() {
    this.setupTitle();
    this.addRefetchTimeout();
    this.props.model.on('change', _.bind(function() {
      if (this.isMounted()) {
        this.forceUpdate();
      } else {
        console.debug('Run view unmounted, ignoring model update.');
      }
    }, this));
    this.setNotebookModel();
  },

  componentDidMount() {
    if (AclUtils.clusterAclsEnabled()) {
      this.fetchClusterAcls();
    }
    this._setGlobalMeasurementTags();
  },

  getClusterId() {
    return this.props.model.get('runInfo').clusterId;
  },

  fetchClusterAcls() {
    this.clusterAclFetch = AclUtils.fetchPermissions(
      [this.getClusterId()],
      WorkspacePermissions.CLUSTER_TYPE,
      this.onClusterAclFetchSuccess
    );
  },

  onClusterAclFetchSuccess(permissionsMap) {
    this.setState({
      clusterAclsFetched: true,
      userCanAttachToCluster: AclUtils.canAttach(permissionsMap, this.getClusterId()),
    });
  },

  setNotebookModel(props) {
    const model = props ? props.model : this.props.model;
    const ids = model.get('renderedNotebookIds');
    if (ids && ids.length > 0) {
      const id = parseInt(ids[0], 10);
      const notebook = window.treeCollection.getNotebookModel(id);
      const setNotebook = function(newNotebook) {
        if (!newNotebook || (this.state.notebook && newNotebook.id === this.state.notebook.id)) {
          return;
        }
        this.setState({ notebook: newNotebook });
        // when commandCollection fetched, re-render to show dashboard view options in view menu
        newNotebook.commandCollection().once('add reset', function() {
          if (this.isMounted()) { this.forceUpdate(); }
        }, this);
      }.bind(this);

      if (notebook) {
        setNotebook(notebook);
      } else {
        window.conn.prefetchNode(id, function() {
          const notebookFromId = window.treeCollection.getNotebookModel(id);
          setNotebook(notebookFromId);
        });
      }
    }
  },

  componentWillUpdate(nextProps) {
    this.setupTitle();
    this.setNotebookModel(nextProps);
  },

  componentDidUpdate() {
    this._setGlobalMeasurementTags();
  },

  componentWillUnmount() {
    this.props.model.off(null, null, this);
    if (this.refetchTimeout) {
      window.clearTimeout(this.refetchTimeout);
      this.refetchTimeout = null;
    }
    if (this.clusterAclFetch) {
      this.clusterAclFetch.abort();
      this.clusterAclFetch = null;
    }
    BrowserUtils.setGlobalMeasurementTags({});
  },

  getJobRunTitle() {
    const model = this.props.model;
    const idInJob = model.get('runInfo').idInJob || '?';
    const jobName = model.get('jobInfo').jobName || '?';
    return 'Run ' + idInJob + ' of ' + jobName;
  },

  setupTitle() {
    const title = this.getJobRunTitle();
    // update title on top bar
    const titleDiv = $('#topbar .tb-title');
    titleDiv.text(title);
    titleDiv.attr({ 'data-name': title });
    // update web page title
    BrowserUtils.setDocumentTitle(title);
  },

  render() {
    if (this.props.model.get('runInfo').status === '') {
      return <div id='content' />;
    }
    return (
      <div id='content'>
        {this.props.children}
        {this.renderHeader()}
        <div className='job-run-output'>{this.renderOutput()}</div>
      </div>);
  },

  getViewBaseUrl() {
    if (this.props.viewBaseUrl) {
      return this.props.viewBaseUrl;
    }
    const model = this.props.model;
    const jobId = model.get('jobId');
    const runId = model.get('runId');
    return 'job/' + jobId + '/run/' + runId;
  },

  getDashboardOptions() {
    const notebook = this.state.notebook;
    if (!notebook) {
      return null;
    }

    return _.map(notebook.getDashboardViewModels(), function(dashboard) {
      const nuid = dashboard.get('nuid');
      if (nuid) {
        return (<option value={nuid} key={nuid} ref={nuid}>
          Dashboard: {dashboard.get('title')}
        </option>);
      }
    });
  },

  onViewChange(event) {
    const value = event.target.value;
    let url = this.getViewBaseUrl() + '/';
    if (value === 'notebook' || value === 'resultsOnly') {
      url += value;
    } else {
      url += 'dashboard/' + value;
    }

    window.router.navigate(url, { trigger: true });
  },

  getViewMenu() {
    const model = this.props.model;
    const actionResults = model.get('actionResults');
    if (actionResults.length === 0 || actionResults.length > 1) {
      return null;
    }

    const resultClass = actionResults[0] && actionResults[0]['@class'];
    if (!resultClass || resultClass.indexOf('Notebook') === -1) {
      return null;
    }

    let selected = this.props.displayMode;
    if (this.props.displayMode === 'dashboard') {
      selected = this.props.dashboardNUID;
    }

    return (
      <div className='job-run-view-menu'>
        <label>View:</label>
        <select value={selected} onChange={this.onViewChange}>
          <option value='notebook'>Code</option>
          <option value='resultsOnly'>Results Only</option>
          {this.getDashboardOptions()}
        </select>
      </div>);
  },

  _exportHtml() {
    window.recordEvent('jobRunResultActionTaken', {
      actionTaken: 'exportJobRunResultHTML',
    });
    let nodeId;
    if (this.props.displayMode === 'dashboard') {
      const models = this.state.notebook.getDashboardViewModels();
      const dashboard = _.find(models, (d) => d.get('nuid') === this.props.dashboardNUID);
      if (dashboard) {
        nodeId = dashboard.id;
      }
    } else {
      nodeId = this.state.notebook.id;
    }
    NavFunc.exportHTML(nodeId);
  },

  getExportHtmlBtn() {
    // check this.state.notebook so that we do not show the button for jar job run pages,
    // and because when first visiting the page, the temp notebook may not exist yet
    if (window.settings.enableStaticNotebooks && this.state.notebook) {
      return (
        <button className='btn btn-default export-html-action' onClick={this._exportHtml}>
          <i className={`fa fa-${IconsForType.download}`} /> Export to HTML
        </button>
      );
    }
    return null;
  },

  getLibrary(lib) {
    if (lib.type === 'jar') {
      return <li>{lib.uri} (JAR)</li>;
    } else if (lib.type === 'egg') {
      return <li>{lib.uri} (Egg)</li>;
    } else if (lib.type === 'pypi') {
      return <li>{lib.packageName} (PyPi)</li>;
    } else if (lib.type === 'maven') {
      return <li>{lib.coordinate} (Maven)</li>;
    }
    return null;
  },

  _lacksPermissionOnSparkUIAndDriverLogs() {
    return AclUtils.clusterAclsEnabled() && !this.state.userCanAttachToCluster;
  },

  _areSparkUIAndDriverLogsReady() {
    // avoid having the links flash as enabled then disabled
    return AclUtils.clusterAclsEnabled() ? this.state.clusterAclsFetched : true;
  },

  _getSparkUILink(sparkUIURL, noPermissions) {
    return (
      <a className='spark-ui-link' href={sparkUIURL} disabled={noPermissions} ref='sparkUI'>
        View Spark UI
      </a>
    );
  },

  _getDriverLogsLink(clusterId, noPermissions) {
    const href = '#setting/sparkui/' + clusterId + '/driver-logs';
    return (
      <a className='driver-logs-link' href={href} disabled={noPermissions}>
        Logs
      </a>
    );
  },

  _getNoPermissionsWrappedElem(elem) {
    const tooltipText = WorkspacePermissions.NO_VIEW_PERMISSIONS_WARNING;
    return <Tooltip text={tooltipText}>{elem}</Tooltip>;
  },

  // If the job is running and has a cluster OR if the cluster has terminated but has a
  // SparkContextId defined, then display links to the Spark UI and driver logs. For terminated
  // clusters, these links will automatically redirect to the HistoryServer. Since this
  // requires a SparkContextId, this will only work for notebook jobs and new JAR jobs.
  _shouldDisplaySparkUIAndDriverLogsLinks(run) {
    return run.clusterId && (run.status === 'Running' || run.sparkContextId);
  },

  _getSparkUIUrl(run) {
    let sparkUIURL = '#setting/sparkui/' + run.clusterId + '/driver';
    if (run.sparkContextId) {
      sparkUIURL += `-${run.sparkContextId}`;
    }
    return sparkUIURL;
  },

  // Show a basic summary of the cluster's configuration (e.g. "120 GB Spot, On-demand, Spark 1.4")
  _getSparkUIAndDriverLogsLinks(model, run) {
    if (!this._shouldDisplaySparkUIAndDriverLogsLinks(run)) {
      return model.getResourceString();
    }
    const noPermissions = this._lacksPermissionOnSparkUIAndDriverLogs();
    let links = (
      <span className={noPermissions ? 'disabled' : ''}>
        {this._getSparkUILink(this._getSparkUIUrl(run), noPermissions)}
        {' / '}
        {this._getDriverLogsLink(run.clusterId, noPermissions)}
      </span>
    );
    if (noPermissions) {
      links = this._getNoPermissionsWrappedElem(links);
    }

    return (
      <span className='spark-ui-driver-logs'>
        {model.getResourceString()}&nbsp;-&nbsp;
        {this._areSparkUIAndDriverLogsReady() ? links : null}
      </span>
    );
  },

  renderHeader() {
    const model = this.props.model;
    const job = model.get('jobInfo');
    const run = model.get('runInfo');
    const runActions = model.get('runActions');

    let durationStatus = null;
    if (run.status !== 'Skipped') {
      let durationTimestamp = '-';
      if (run.active) {
        durationTimestamp = DateTimeFormats.formatDuration(
          parseInt((window.conn.wsClient.serverTime() - run.startTime) / 1000, 10));
      } else if (run.durationMillis > 0) {
        durationTimestamp = DateTimeFormats.formatDuration(run.durationMillis / 1000);
      }
      durationStatus = (
        <li>
          <b>Duration: </b>
          <span className='job-run-duration'>
            {durationTimestamp}
          </span>
        </li>);
    }

    let actionStatus = null;
    if (runActions.length > 0) {
      const runArguments = runActions[0].type === 'jar' ?
        (<li>Arguments: {runActions[0].parameters}</li>) : null;
      const dependentLibs = runActions[0].libraries.length > 0 ? (
        <li>Dependent Libraries:
          <ul>{runActions[0].libraries.map((lib) => this.getLibrary(lib))}</ul>
        </li>) : null;
      actionStatus = (
        <ul className='job-action-status'>
          {runArguments}
          {dependentLibs}
        </ul>);
    }

    let cancelLinkOption = null;
    const canModify = (parseInt(job.organizationId, 10) !== ElasticUtil.INTERNAL_ORG_ID);
    // TODO(ydmao): fix it in PROD-12237. This is dead code since run.status is RUNNING or PENDING.
    // Fix it in the new Jobs UI implementation. Note that /jobs/cancel-run now requires both job
    // id and run id.
    if (canModify && (run.status === 'Running' || run.status === 'Pending')) {
      cancelLinkOption = (<span>&nbsp;-&nbsp;
        <a className='run-cancel-link' onClick={this.onCancel} href='#'>Cancel</a></span>);
    }

    const header = this.props.hideHeader ? null : (<div>
      <h2>{this.getJobRunTitle()}</h2>
      <ul className='unstyled'>
        <li>
          <b>Started: </b>
          <span className='job-run-started'>{DateTimeFormats.formatTimestamp(run.startTime)}</span>
        </li>
        {durationStatus}
        <li>
          <b>Status: </b> <span className='job-run-status'>{run.status}</span>
          {cancelLinkOption}
        </li>
        <li>
          <b>Task: </b> <JobActionElement actions={runActions} />
          {actionStatus}
        </li>
        <li>
          <b>Cluster: </b>
          <span className='job-run-cluster'>
            {this._getSparkUIAndDriverLogsLinks(model, run)}
          </span>
        </li>
        <li>
          {(run.message) ? <span>
                <b>Message: </b>
                <span className='job-run-message'>{run.message}</span>
              </span>
            : <span className='job-run-message'></span>}
        </li>
      </ul>
      <h2>Output</h2>
    </div>);

    return (
      <div className='job-run-view-header'>
        <div className='job-run-view-breadcrumb'>
          <a className='all-jobs-link' href='#joblist'>
            <i className='fa fa-angle-left'></i> All Jobs</a> /&nbsp;
          <a className='job-link' href={'#job/' + job.jobId}>{job.jobName}</a>
          {this.getViewMenu()}
          {this.getExportHtmlBtn()}
        </div>
        {header}
      </div>);
  },

  renderOutput() {
    const model = this.props.model;
    const actionResults = model.get('actionResults');

    if (actionResults.length === 0) {
      return <p>No results available yet.</p>;
    }

    if (actionResults.length > 1) {
      return <p>Multiple actions in job! (Not yet supported.)</p>;
    }

    if (actionResults[0]['@class'].indexOf('SparkJar') !== -1) {
      return this.renderJarOutput();
    }

    if (actionResults[0]['@class'].indexOf('Notebook') !== -1) {
      if (this.props.displayMode === 'dashboard' && this.props.dashboardNUID) {
        return this.renderDashboardView();
      }
      return this.renderNotebook(this.props.displayMode === 'resultsOnly');
    }

    return <pre>{actionResults[0].errorMsg}</pre>;
  },

  renderJarOutput() {
    const model = this.props.model;
    const actionResults = model.get('actionResults');
    _.defer(function() {
      // scroll stdout/stderr to bottom by default
      $('.console-output textarea').each(function(i, el) {
        el.scrollTop = el.scrollHeight;
      });
    });
    return (
      <div>
        <p>
          Standard output: {this.renderLogDownloadLink('stdout')}
        </p>
        <div className='console-output job-run-stdout'>
          <textarea
            readOnly
            defaultValue={actionResults[0].stdout}
            onFocus={this.consoleOutputFocused}
            onBlur={this.consoleOutputBlurred}
          />
        </div>
        <p>
          Standard error: {this.renderLogDownloadLink('stderr')}
        </p>
        <div className='console-output job-run-stderr'>
          <textarea
            readOnly
            defaultValue={actionResults[0].stderr}
            onFocus={this.consoleOutputFocused}
            onBlur={this.consoleOutputBlurred}
          />
        </div>
        <p>
          Log4j: {this.renderLogDownloadLink('log4j')}
        </p>
        <div className='console-output job-run-log4j'>
          <textarea
            readOnly
            defaultValue={actionResults[0].log4j}
            onFocus={this.consoleOutputFocused}
            onBlur={this.consoleOutputBlurred}
          />
        </div>
      </div>);
  },

  renderDashboardView() {
    return this.renderNotebookBasedView(function(notebook) {
      return (<DashboardPresentView
        notebook={notebook}
        dashboardId={this.props.dashboardNUID}
        showExitBtn={false}
        showUpdateBtn={false}
        showInputWidgets={false}
        redirectWhenDashboardNotFound={false}
      />);
    }.bind(this));
  },

  renderNotebook(resultsOnly) {
    return this.renderNotebookBasedView(function(notebook) {
      return (<ReactNotebookCommandListeningListView
        notebook={notebook}
        isLocked
        resultsOnly={resultsOnly}
        showLastDivider={false}
        showSubmitHint={false}
        showCommandRunTime={false}
        showCommandRunUser={false}
        showCommandClusterName={false}
      />);
    });
  },

  renderNotebookBasedView(getNotebookBasedView) {
    if (this.state.notebook) {
      return getNotebookBasedView(this.state.notebook);
    }
    return (<p>Loading notebook...</p>);
  },

  renderLogDownloadLink(type) {
    const model = this.props.model;
    const runActions = model.get('runActions');
    let isJar = false;
    if (runActions.length > 0 && runActions[0].type === 'jar') {
      isJar = true;
    }
    let isJarRunAsNotebook = false;
    if (runActions.length > 0 && runActions[0].runAsNotebook === true) {
      isJarRunAsNotebook = true;
    }
    const isNewJarJob = isJar && isJarRunAsNotebook;
    const run = model.get('runInfo');
    const actionResults = model.get('actionResults');
    const runDesc = 'job-' + model.get('jobInfo').jobId + '-run-' + model.get('runInfo').idInJob;
    if (isNewJarJob) {
      const hrefVal = '/driver-logs/' + run.clusterId +
        '/downloadconcat/' + type + NavFunc.sessionParams();
      return (
        <a href={hrefVal}
          download={runDesc + '-' + type + '.partial.txt'}
        >Full log</a>);
    }
    if (run.active) {
      const hrefVal = '/logfiles/' + actionResults[0].logDirInLogFileStore + '?whitelist=' +
        type + '&blacklist=' + type + '.log';
      return (
        <a href={hrefVal}
          download={runDesc + '-' + type + '.partial.txt'}
        >Full log</a>);
    }
    return (
      <a href={'/logfiles/' + actionResults[0].logDirInLogFileStore + '?whitelist=' + type}
        download={runDesc + '-' + type + '.txt'}
      >Full log</a>);
  },

  /**
   * Set a timeout to refetch the model in 5 seconds, unless the run is in a terminal state
   * (i.e. terminated or error). This will let us keep the page up to date while it's open.
   */
  addRefetchTimeout() {
    const self = this;
    const status = this.props.model.get('runInfo').status;
    if (!this.forceRefetch &&
        (status === 'Succeeded' || status === 'Failed' || status === 'Error')) {
      // keep active in the LRU server-side cache
      $.ajax(self.props.model.url('/keepalive'), {
        error() {
          console.error('Error in render keepalive ping, forcing refetch.');
          self.forceRefetch = true;
        },
      });
      self.refetchTimeout = window.setTimeout(function() {
        if (self.isMounted()) {
          self.addRefetchTimeout();
        }
      }, 5000);
    } else {
      this.forceRefetch = false;
      const onRefetch = function() {
        // Always re-render on refetch to update our duration field
        if (self.isMounted()) {
          self.addRefetchTimeout();
          self.forceUpdate();
        }
      };
      self.refetchTimeout = window.setTimeout(function() {
        self.props.model.fetch({ success: onRefetch, error: onRefetch });
      }, 5000);
    }
  },

  onCancel(e) {
    e.preventDefault();
    DeprecatedDialogBox.confirm({
      message: 'Are you sure you want to cancel this run?',
      confirm: _.bind(function() {
        $.ajax('/jobs/cancel-run', {
          type: 'POST',
          data: JSON.stringify({
            jobId: this.props.model.get('jobInfo').jobId,
            runId: this.props.model.get('runInfo').runId,
          }),
          error(xhr, status, error) {
            $('a.run-cancel-link').removeClass('link-active');
            DeprecatedDialogBox.alert('Request failed: ' + error);
          },
        });
        $('a.run-cancel-link').addClass('link-active');
      }, this),
    });
  },

  consoleOutputFocused(e) {
    $(e.target).css('overflow-y', 'scroll');
  },

  consoleOutputBlurred(e) {
    $(e.target).css('overflow-y', 'hidden');
  },
});

module.exports = JobRunView;
