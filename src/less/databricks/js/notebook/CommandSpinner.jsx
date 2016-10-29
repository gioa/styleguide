/* eslint react/prefer-es6-class: 0, func-names: 0 */

import React from 'react';
import _ from 'underscore';
import ClassNames from 'classnames';

import { AclUtils } from '../acl/AclUtils.jsx';
import WorkspacePermissions from '../acl/WorkspacePermissions';

import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';
import { CommandStateUtils } from '../notebook/CommandUtils';
import EmbeddedSparkUI from '../notebook/NotebookEmbeddedSparkUI.jsx';

import { ResourceUrls } from '../urls/ResourceUrls';

const CommandSpinner = React.createClass({

  propTypes: {
    cancelQuery: React.PropTypes.func.isRequired,
    state: React.PropTypes.string.isRequired,
    stages: React.PropTypes.array.isRequired,
    showCancel: React.PropTypes.bool.isRequired,
    collapsed: React.PropTypes.bool,
    clusterId: React.PropTypes.string,
    sparkCtxId: React.PropTypes.string,
    hasSubCommands: React.PropTypes.bool,
    embeddedSparkUI: React.PropTypes.object,
  },

  getDefaultProps() {
    return {
      embeddedSparkUI: EmbeddedSparkUI,
    };
  },

  getInitialState() {
    return {
      collapsed: true,
      expandedMap: {},
      hideWhenInactive: false,
      userCanAttachToCluster: !AclUtils.clusterAclsEnabled(),
    };
  },

  componentDidUpdate(prevProps) {
    const attachedClusterHasChanged = prevProps.clusterId !== this.props.clusterId;
    if (attachedClusterHasChanged && !this.state.collapsed) {
      this.fetchClusterAcls();
    }
  },

  fetchClusterAcls() {
    this.clusterAclFetch = AclUtils.fetchPermissions(
      [this.props.clusterId],
      WorkspacePermissions.CLUSTER_TYPE,
      this.onClusterAclFetchSuccess
    );
    return this.clusterAclFetch;
  },

  onClusterAclFetchSuccess(permissionsMap) {
    this.setState({
      userCanAttachToCluster: AclUtils.canAttach(permissionsMap, this.props.clusterId),
    });
  },

  initializeEmbeddedSparkUI() {
    // Initialize the DOM and EmbeddedSparkUI instance if it's not already created
    this.props.embeddedSparkUI.init();
    // TODO(Chaoyu): update expand map when user click on links inside iframe
    // const forceUpdate = function() {
    //   if (this.isMounted()) {
    //     this.forceUpdate();
    //   }
    // }.bind(this);
    // this.props.embeddedSparkUI.events().on("onLoad", forceUpdate, this);
    // this.props.embeddedSparkUI.events().on("onHide", forceUpdate, this);
  },

  componentWillUnmount() {
    // TODO(Chaoyu): update expand map when user click on links inside iframe
    // this.props.embeddedSparkUI.events().off(null, null, this);
    if (this.clusterAclFetch) {
      this.clusterAclFetch.abort();
      this.clusterAclFetch = null;
    }
  },

  getOpenSparkUIFunc(url) {
    return (e) => {
      if (!e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.initializeEmbeddedSparkUI();
        this.props.embeddedSparkUI.showOrHide(url);
      }
    };
  },

  componentWillReceiveProps() {
    if (CommandStateUtils.isRunning(this.props.state)) {
      this.setState({ collapsedMap: {} });
    }
  },

  renderSpinner() {
    const spinner = (
      <div className='progress-bar-wrapper'>
        <img className='progress-bar-shadow'
          src={ResourceUrls.getResourceUrl('img/spinnerAnimation.gif')}
        />
      </div>
    );

    if (CommandStateUtils.isCancelling(this.props.state)) {
      return (<div className='spinner command-result-cancelling'>
        <div className='command-control flex-div'>
          {spinner}
          <div className='cancel-wrapper'>
            Cancelling...
          </div>
        </div>
      </div>);
    }

    if (!CommandStateUtils.isRunning(this.props.state)) {
      return null;
    }

    const cancelLink = this.props.showCancel ? (
      <a
        className='cancel-query-button'
        onClick={this.props.cancelQuery}
      >
        Cancel
      </a>) : null;

    return (
      <div className='spinner running'>
        <div className='command-control flex-div'>
          {spinner}
          <div className='cancel-wrapper'>
            {cancelLink}
          </div>
        </div>
      </div>
    );
  },

  getSparkUILink() {
    const clusterId = this.props.clusterId;
    const sparkCtxId = this.props.sparkCtxId;
    return '/sparkui/' + clusterId + '/driver-' + sparkCtxId;
  },

  getJobLink(jobId) {
    return this.getSparkUILink() + '/jobs/job?id=' + jobId;
  },

  getStageLink(stageId) {
    // TODO(Chaoyu): should get current attempt id from backend
    return this.getSparkUILink() + '/stages/stage?id=' + stageId + '&attempt=0';
  },

  toggleCollapsed() {
    this.setState({ collapsed: !this.state.collapsed });
  },

  toggleJobDetails(jobId) {
    const expandedMap = this.state.expandedMap;
    if (expandedMap[jobId]) {
      delete expandedMap[jobId];
    } else {
      expandedMap[jobId] = {};
    }
    this.setState({ expandedMap: expandedMap });
  },

  _sum(array, field) {
    return _.reduce(
      _.map(array, function(obj) { return parseInt(obj[field], 10); }),
      function(a, b) { return a + b; }
    );
  },

  _renderSparkUILinkElem(innerElem, url) {
    const disableSparkUI = !this.state.userCanAttachToCluster;
    let viewLink = (
      <a className='spark-ui-link'
        href={'#setting' + url}
        disabled={disableSparkUI}
        onClick={disableSparkUI ? null : this.getOpenSparkUIFunc(url)}
      >
        {innerElem}
      </a>
    );
    if (disableSparkUI) {
      viewLink = this._getNoPermissionsWrappedElem(viewLink);
    }
    return <span className='spark-ui-link-wrapper'>{viewLink}</span>;
  },

  _renderInfoIcon() {
    return <i className='fa fa-info-circle' />;
  },

  renderJobs(jobToStages) {
    const isRunning = CommandStateUtils.isRunning(this.props.state);
    const jobIds = _.keys(jobToStages);
    _.each(this.props.stages, function(stage) {
      stage.finished = stage.numCompletedTasks === stage.totalTasks;
    });

    const jobLinks = _.map(jobIds, function(id) {
      let i = <i className='fa fa-caret-right fa-fw' />;
      const stages = _.sortBy(jobToStages[id], 'stageId');
      let jobDetails;
      let progressBar;

      if (this.state.expandedMap[id]) {
        i = <i className='fa fa-caret-down fa-fw' />;
        const stageLinks = _.map(stages, function(stage) {
          const link = this.getStageLink(stage.stageId);
          if (isRunning) {
            const completedTasks = stage.numCompletedTasks;
            const activeTasks = stage.numActiveTasks;
            const totalTasks = Math.max(stage.totalTasks, 1);
            const percentActive = Math.round((activeTasks / totalTasks) * 100);
            const percentComplete = Math.round((completedTasks / totalTasks) * 100);
            return (<li key={stage.stageId}>
              <p>Stage {stage.stageId}:</p>
              <Tooltip text='succeeded / total tasks'>
                <div className='progress'>
                  <span className='progress-bar-text'>
                    {completedTasks}/{totalTasks} ({activeTasks} running)
                  </span>
                  <div className='bar bar-completed' style={{ width: percentComplete + '%' }}></div>
                  <div className='bar bar-running' style={{ width: percentActive + '%' }}>
                  </div>
                </div>
              </Tooltip>
              {this._renderSparkUILinkElem(this._renderInfoIcon(), link)}
            </li>);
          }
          return (
            <li key={stage.stageId}>
              Stage {stage.stageId}: <Tooltip text='succeeded / total tasks'>
                {stage.numCompletedTasks}/{stage.totalTasks}
              </Tooltip>
              &nbsp;
              {this._renderSparkUILinkElem(this._renderInfoIcon(), link)}
              {stage.finished ? null : 'skipped'}
            </li>);
        }, this);
        jobDetails = <ul className='stages'>{stageLinks}</ul>;
      } else if (isRunning) {
        const totalTasks = Math.max(this._sum(stages, 'totalTasks'), 1);
        const completedTasks = this._sum(stages, 'numCompletedTasks');
        const percentComplete = Math.round((completedTasks / totalTasks) * 100);
        progressBar = (
          <div className='progress-bar'>
            <div className='progress-bar-fill' style={{ width: percentComplete + '%' }}></div>
          </div>);
      }

      let stageSummary;
      if (isRunning) {
        stageSummary = <p>({stages.length} stages)</p>;
      } else {
        const skippedStages = _.where(stages, { finished: false });
        const numOfSkippedStages = skippedStages.length;
        const numOfStages = stages.length - numOfSkippedStages;
        if (numOfSkippedStages === 0) {
          stageSummary = <p>(Stages: {numOfStages}/{numOfStages})</p>;
        } else {
          stageSummary = (<p>
            (Stages: {numOfStages}/{numOfStages}, {numOfSkippedStages} skipped)
          </p>);
        }
      }

      const link = this.getJobLink(id);
      const toggleThisJob = this.toggleJobDetails.bind(this, id);
      return (<li key={id} data-job-id={id}>
        <p className='text-link' onClick={toggleThisJob}>
          {i}Job {id}&nbsp;
        </p>
        {progressBar}
        {this._renderSparkUILinkElem('View', link)}
        {stageSummary}
        {jobDetails}
      </li>);
    }, this);
    return <ul className='jobs'>{jobLinks}</ul>;
  },

  _getNoPermissionsWrappedElem(elem) {
    const tooltipText = WorkspacePermissions.NO_VIEW_PERMISSIONS_WARNING;
    return <Tooltip text={tooltipText}>{elem}</Tooltip>;
  },

  _getCancelLink() {
    return (
      <div className='cancel-wrapper'>
        <a className='cancel-query-button' onClick={this.props.cancelQuery}>
          Cancel
        </a>
      </div>
    );
  },

  _permissionsFetchedOrFetching() {
    // jQuery's deferred.state() can either be 'resolved', 'pending', or 'rejected'
    return this.clusterAclFetch &&
      (this.clusterAclFetch.state() === 'resolved' || this.clusterAclFetch.state() === 'pending');
  },

  _onExpandSparkJobs() {
    if (AclUtils.clusterAclsEnabled() && !this._permissionsFetchedOrFetching()) {
      this.fetchClusterAcls();
    }
    this.toggleCollapsed();
  },

  _renderProgressBar() {
    const stages = this.props.stages;
    const totalTasks = Math.max(this._sum(stages, 'totalTasks'), 1);
    const completedTasks = this._sum(stages, 'numCompletedTasks');
    let percentComplete = Math.round((completedTasks / totalTasks) * 100);
    percentComplete = percentComplete > 100 ? 100 : percentComplete;
    return (
      <div className='progress-bar'>
        <div className='progress-bar-fill' style={{ width: percentComplete + '%' }}></div>
      </div>
    );
  },

  _renderCollapsedState(cancelLink, jobIds) {
    return (
      <div className={this._getWrapperClasses()}>
        <p onClick={this._onExpandSparkJobs}>
          <i className='fa fa-caret-right fa-fw' />
          ({jobIds.length}) Spark Jobs
        </p>
        {this._isRunning() ? this._renderProgressBar() : null}
        {cancelLink}
      </div>
    );
  },

  _shouldRenderSpinner() {
    const enabled = window.settings && window.settings.enableNewProgressReportUI;
    const isCancelling = this.props.state === 'cancelling';

    return !enabled || // feature flag
      this.props.hasSubCommands || // TODO(Chaoyu): stage progress don't work with %run commands
      this.props.collapsed || // hide stage progress for minimized cell
      isCancelling ||
      _.isEmpty(this.props.stages) || !this.props.clusterId || !this.props.sparkCtxId;
  },

  _isRunning() {
    return CommandStateUtils.isRunning(this.props.state);
  },

  _getWrapperClasses() {
    const classes = {
      spinner: true,
      expanded: !this.state.collapsed,
      running: this._isRunning(),
    };
    classes['command-stage-info'] = true;
    return ClassNames(classes);
  },

  render() {
    if (this._shouldRenderSpinner()) {
      return this.renderSpinner();
    }

    const cancelLink = (this.props.showCancel && this._isRunning()) ? this._getCancelLink() : null;
    const jobToStages = _.groupBy(this.props.stages, 'jobId');
    const jobIds = _.keys(jobToStages);

    if (this.state.collapsed) {
      return this._renderCollapsedState(cancelLink, jobIds);
    }

    return (
      <div className={this._getWrapperClasses()}>
        <p onClick={this.toggleCollapsed}>
          <i className='fa fa-caret-down fa-fw' />
          ({jobIds.length}) Spark Jobs
        </p>
        {cancelLink}
        {this.renderJobs(jobToStages)}
      </div>);
  },
});

module.exports = CommandSpinner;
