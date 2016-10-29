/* eslint max-lines: 0 */

/**
 * Do not use this as an example for tables; it needs to be refactored to use
 * ReactTable's Table and Column. For now, see ClusterDetailsLibrariesList and
 * ClusterDetailsLibrariesListView.
 */

import $ from 'jquery';
import _ from 'underscore';
import React from 'react';

import ClusterList from '../clusters/ClusterList';
import { SparkVersionUtils } from '../clusters/SparkVersionUtils';

import CollectionDeltaReceiver from '../delta_receiver/CollectionDeltaReceiver';

import ElasticJobStatus from '../jobs/ElasticJobStatus';
import ElasticUtil from '../jobs/ElasticUtil';
import { JobActionElement } from '../jobs/JobActionElement.jsx';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';
import IconsForType from '../ui_building_blocks/icons/IconsForType';
import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

import { NameUtils } from '../user_info/NameUtils';

import { DbGuideUrls } from '../urls/DbGuideUrls';
import DbGuideLinks from '../urls/DbGuideLinks';

function createJob() {
  $.ajax('/jobs/create', {
    type: 'POST',
    data: JSON.stringify({
      name: 'Untitled',
      workers: null,
      memoryTotalMb: 2 * window.settings.defaultMemoryPerContainerMB,
      sparkVersion: SparkVersionUtils.getDefaultSparkVersion(),
    }),
    success: (data) => {
      window.router.navigate('#job/' + data.jobId.toString() + '/new', { trigger: true });
    },
    error: (xhr, status, error) => {
      DeprecatedDialogBox.alert('Failed to create job: ' + error);
    },
  });
}

export class DisabledJobsOverlay extends React.Component {
  componentWillUnmount() {
    // Un-gray out the topbar so that the changes don't carry over into other views
    $('#topbar').css('background', '');
  }

  render() {
    // terrible hack to gray out topbar
    $('#topbar').css('background', 'rgba(0,0,0,0.25)');

    return (
        <div className='disabled-jobslist'>
          <div className='disabled-jobslist-overlay'>
            <div className='disabled-jobslist-inner'>
              <h2 className='disabled-jobslist-h2'>
                Learn more about{' '}
                <a href={DbGuideUrls.getDbGuideUrl(DbGuideLinks.JOBS_URL)}>Jobs</a>.
                <br />
                {Tooltip.getGenericUpgradeElement('For access')}
              </h2>
            </div>
          </div>
          {this.props.children}
        </div>
    );
  }
}

DisabledJobsOverlay.propTypes = {
  children: React.PropTypes.node,
};

function JobLink({ onClick, jobName, jobId, linkClasses, content }) {
  return (
    <span>
      <a onClick={onClick}
        data-job-name={jobName}
        data-job-id={jobId}
        className={linkClasses}
      >
        {content}
      </a>
    </span>
  );
}

JobLink.propTypes = {
  onClick: React.PropTypes.func.isRequired,
  jobName: React.PropTypes.string.isRequired,
  jobId: React.PropTypes.number.isRequired,
  linkClasses: React.PropTypes.string.isRequired,
  content: React.PropTypes.node.isRequired,
};

export class JobUpdateLink extends React.Component {
  doUpgradeJob(id) {
    $.ajax('/jobs/update-sparkversions', {
      type: 'POST',
      data: JSON.stringify({ 'jobId': id }),
      success: () => { },
      error: (xhr, status, error) => {
        DeprecatedDialogBox.alert(`Failed to update job with ID ${id}: ${error}`);
      },
    });
  }

  showUpgradeJobsDialog(id) {
    console.debug(`Updating Job with ID: ${id}`);
    DeprecatedDialogBox.confirm({
      message: 'This will update the Ubuntu version of the clusters that are launched by this ' +
      'job. Active runs will not be affected.',
      confirmButton: 'Update',
      cancelButton: 'Cancel',
      confirm: this.doUpgradeJob.bind(this, id),
    });
  }

  render() {
    const boundDialog = this.showUpgradeJobsDialog.bind(this, this.props.job.get('jobId'));
    return (
        <a onClick={boundDialog}>
          Update Job
        </a>
    );
  }
}

JobUpdateLink.propTypes = {
  job: React.PropTypes.shape({
    get: React.PropTypes.func,
  }).isRequired,
};

function JobContainerUpdateButton({ numUpgradableJobs }) {
  const tooltipText = (
    <span>
      {numUpgradableJobs} of your Jobs are using an old version of Ubuntu that
      will be deprecated. The same Spark versions are supported and all jobs can be updated
      with the links below.
    </span>);

  return (
    <span>
      <h5>Update Your Jobs</h5>
      <Tooltip text={tooltipText}>
        <i className='fa fa-exclamation-circle state-message-icon' />
      </Tooltip>
    </span>);
}

JobContainerUpdateButton.propTypes = {
  numUpgradableJobs: React.PropTypes.number.isRequired,
};

class JobListHeader extends React.Component {
  constructor() {
    super();
    // Binding is a common pattern in our ES6 constructors. Since this method changes the browser
    // hash on user input for every single letter, this method should be debounced so that we change
    // the hash once for a general change other than for every single letter, otherwise the user has
    // to click the back button far too many times :)
    this.onJobSearch = _.debounce(this.onJobSearch.bind(this), 500);
  }

  componentDidMount() {
    this.jobsFilterInput.focus();
  }

  onJobSearch() {
    // Do not trigger navigation because the Backbone Router will re-render, causing the whole view
    // to be re-mounted, flickering, causing loss of focus, and other issues!
    window.router.navigate('joblist/' + encodeURI(this.jobsFilterInput.value), { trigger: false });
    if (this.props.onChange) {
      this.props.onChange(this.jobsFilterInput.value);
    }
  }

  getWarning() {
    return <h5 className='job-list-warning'>Warning: {this.props.warning}</h5>;
  }

  shouldUpgradeJobs() {
    return window.settings.enableJobsSparkUpgrade && this.props.numUpgradableJobs > 0;
  }

  render() {
    const updateHeaderRef = (ref) => this.jobsUpdateHeader = ref;
    const jobsFilterRef = (ref) => this.jobsFilterInput = ref;
    return (
        <div className='job-list-header'>
          <h5>
            <a onClick={createJob}
              disabled={this.props.disabled}
              className='btn btn-primary add-button job-add-button'
            >
              <i className='fa fa-plus' /> Create Job
            </a>
          </h5>
          {this.shouldUpgradeJobs() ?
           <JobContainerUpdateButton
             key='jobsUpdateButton'
             ref={updateHeaderRef}
             numUpgradableJobs={this.props.numUpgradableJobs}
           /> : null }
          <input
            key='jobsFilterInput'
            ref={jobsFilterRef}
            type='text'
            onChange={this.onJobSearch}
            defaultValue={this.props.initialFilter}
            placeholder='Filter jobs'
            className='job-list-filter'
          />
          {this.props.warning ? this.getWarning() : null}
        </div>
    );
  }
}

JobListHeader.propTypes = {
  onChange: React.PropTypes.func,
  warning: React.PropTypes.string,
  numUpgradableJobs: React.PropTypes.number.isRequired,
  disabled: React.PropTypes.bool,
  initialFilter: React.PropTypes.string,
};

export class JobListTable extends React.Component {
  constructor(props) {
    super(props);
    this._forceUpdate = this._forceUpdate.bind(this);
  }

  componentDidMount() {
    // Watch clusters because the state of the jobs changes when clusters are running
    this.props.clusters.on('add change remove reset', _.throttle(this._forceUpdate, 500), this);
    // Start the collection watching the webapp
    this.props.collection.startWatching();
    // Watch changes in the collection to add and update jobs as it happens.
    this.props.collection.on('add change remove reset', _.throttle(this._forceUpdate, 500), this);
  }

  _forceUpdate() {
    this.forceUpdate();
  }

  componentWillUnmount() {
    // Unhook this component from the collections
    this.props.clusters.off(null, null, this);
    // Turn off the collection delta watching
    this.props.collection.stopWatching();
    // Disable the event hooks
    this.props.collection.off(null, null, this);
  }

  // @TODO(jengler) 2015-11-12: We should discuss how we want to do filtering
  // across different interfaces. I do not recommend following this example.
  // It was put together to quickly resolve PROD-8129. I personally prefer
  // to have the models expose a "matches" method. However, this makes filtering
  // focused on the model attributes instead of the presentation.
  doesJobMatchFilter(filterWords, job) {
    const content = [
      job.get('jobName'),
      job.get('userName'),
      job.getResourceString(),
      job.getSchedString(),
      this.lastRunState(job),
      job.getStatusString(),
      job.isCancellable() ? 'Cancel' : 'Run Now',
    ].join(' ').toLowerCase();

    for (const i in filterWords) {
      if (content.indexOf(filterWords[i]) < 0) {
        return false;
      }
    }
    return true;
  }

  lastRunState(job) {
    const lastRun = job.get('lastRunStatus');
    return lastRun ? lastRun.status : '';
  }

  onJobRun(jobId, e) {
    e.preventDefault();
    this.handleLinkClicked(jobId, '/jobs/run', e);
  }

  onJobRemove(jobId, jobName, e) {
    e.preventDefault();
    DeprecatedDialogBox.confirm({
      message: `Are you sure you want to delete '${jobName}'? This action cannot be undone.`,
      confirm: () => {
        this.handleLinkClicked(jobId, '/jobs/remove', e);
      },
    });
  }

  onJobCancel(jobId, jobName, e) {
    e.preventDefault();
    DeprecatedDialogBox.confirm({
      message: `Are you sure you want to cancel all runs of '${jobName}'?`,
      confirm: () => {
        this.handleLinkClicked(jobId, '/jobs/cancel-all-runs', e);
      },
    });
  }

  handleLinkClicked(jobId, endpoint, e) {
    // Note: jquery expression cannot be captured by nested functions. So define a const to allow
    // error and success function to access e.target.
    const target = $(e.target);
    $.ajax(endpoint, {
      type: 'POST',
      data: jobId.toString(),
      error(xhr, status, error) {
        target.removeClass('link-active');
        DeprecatedDialogBox.alert('Request failed: ' + error);
      },
      success: () => {
        target.removeClass('link-active');
      },
    });
    target.addClass('link-active');
  }

  getLegacyJarTooltip(jobId, actionElement) {
    const tooltipText = (
        <div className='job-tooltip-text'>
          <div>
            This JAR uses a legacy Spark API, which is now deprecated. We recommend updating it.
          </div>
          <div className='tooltip-edit-jar-link'>
            Go to <a href={`#job/${jobId}/editJar`}>edit JAR</a>
          </div>
        </div>
    );

    return (
        <Tooltip text={tooltipText}>
          {actionElement} <i className='fa fa-exclamation-circle state-message-icon' />
        </Tooltip>
    );
  }

  getTask(job) {
    const isTypeJar = job.attributes.jobActions[0] && job.attributes.jobActions[0].type === 'jar';
    const isJarRunAsNotebook = isTypeJar && job.attributes.jobActions[0].runAsNotebook;

    // only show the tooltip if the (JAR) job is run on a legacy JAR
    if (isTypeJar && !isJarRunAsNotebook) {
      return this.getLegacyJarTooltip(job.get('jobId'),
          <JobActionElement actions={job.get('jobActions')} />);
    }
    return <JobActionElement actions={job.get('jobActions')} />;
  }

  getCancelLink(jobId, jobName) {
    const boundJobCancel = this.onJobCancel.bind(this, jobId, jobName);
    return (
      <JobLink
        jobId={jobId}
        jobName={jobName}
        content={"Cancel All"}
        onClick={boundJobCancel}
        linkClasses={"job-cancel-link"}
      />
    );
  }

  getRunLink(jobId, jobName) {
    const boundJobRun = this.onJobRun.bind(this, jobId);
    return (
      <JobLink
        jobId={jobId}
        jobName={jobName}
        content={"Run Now"}
        onClick={boundJobRun}
        linkClasses={"job-run-link"}
      />
    );
  }

  getRemoveLink(jobId, jobName) {
    const removeIcon = (
      <i data-job-name={jobName}
        data-job-id={jobId}
        className={'fa fa-' + IconsForType.close}
      />);
    const boundJobRemove = this.onJobRemove.bind(this, jobId, jobName);
    return (
      <JobLink
        jobId={jobId}
        jobName={jobName}
        content={removeIcon}
        onClick={boundJobRemove}
        linkClasses={"job-remove-link"}
      />
    );
  }

  getActionColumn(job) {
    const jobName = job.get('jobName');
    const jobId = job.get('jobId');
    const runNowLink = job.isRunnable() ? (<span>{this.getRunLink(jobId, jobName)}</span>) : null;
    const cancelLink =
      job.isCancellable() ? (<span>{this.getCancelLink(jobId, jobName)}</span>) : null;
    if (runNowLink !== null && cancelLink !== null) {
      return (
        <span>
          {runNowLink}
          <span>{this.getRemoveLink(jobId, jobName)}</span>
          <br />
          {cancelLink}
        </span>
      );
    }
    return (
      <span>
        {runNowLink}
        {cancelLink}
        <span>{this.getRemoveLink(jobId, jobName)}</span>
      </span>
    );
  }

  getLastRunColumn(jobId, lastRun) {
    const lastRunHref = `#job/${jobId}/run/${lastRun.idInJob}`;
    return <a href={lastRunHref}>{lastRun.status}</a>;
  }

  jobNeedsUpdate(job) {
    return window.settings.enableJobsSparkUpgrade && job.needsUpgrade();
  }

  renderJob(job) {
    const jobName = job.get('jobName');
    const jobId = job.get('jobId');

    const canModify = parseInt(job.get('organizationId'), 10) !== ElasticUtil.INTERNAL_ORG_ID;
    const lastRun = job.get('lastRunStatus');

    return (
        <tr
          key={jobId}
          className='job-row'
          data-job-id={jobId}
          data-job-name={jobName}
          data-job-status={job.getStatusString()}
        >
          <td><a className='job-link' href={`#job/${jobId}`}>{jobName}</a></td>
          <td>{NameUtils.capitalizeAllNames(job.get('userName'))}</td>
          <td className='job-task-column'>{this.getTask(job)}</td>
          <td>
            <span>{job.getResourceString()} </span>
            {this.jobNeedsUpdate(job) ? <JobUpdateLink job={job} /> : null}
           </td>
          <td>{job.getSchedString()}</td>
          <td>{lastRun ? this.getLastRunColumn(jobId, lastRun) : null}</td>
          <td>{job.getStatusString()}</td>
          <td>{canModify ? this.getActionColumn(job) : null}
          </td>
        </tr>
    );
  }

  getJobRows() {
    let jobRows = [];
    if (this.props.collection) {
      if (this.props.filterText) {
        const filterWords = this.props.filterText.toLowerCase().split(' ');
        jobRows = this.props.collection.filter((job) => this.doesJobMatchFilter(filterWords, job))
            .map((job) => this.renderJob(job));

        // No results found
        if (jobRows.length === 0) {
          jobRows = [<tr><td colSpan={8}>No matching jobs.</td></tr>];
        }
      } else {
        // If jobRows is empty, we do not have a row so an empty table is ok.
        jobRows = this.props.collection.map((job) => this.renderJob(job));
      }
    }
    return jobRows;
  }

  render() {
    return (
        <tbody className='jobs-table'>
          {this.getJobRows()}
        </tbody>
    );
  }
}

JobListTable.propTypes = {
  clusters: React.PropTypes.instanceOf(ClusterList).isRequired,
  collection: React.PropTypes.instanceOf(CollectionDeltaReceiver).isRequired,
  filterText: React.PropTypes.string,
};

/**
 * This is a first try at pulling apart the monitoring and rendering of Jobs into a re-usable
 * component. JobList is used by instantiating it and providing a renderWith prop, which will
 * be invoked with each job in the job list. Job list is responsible for binding to the job
 * collection and updating the list on changes. Optionally, the filter prop can be used to
 * only render a subset of jobs.
 */
export class JobList extends React.Component {
  constructor(props) {
    super(props);
    this.displayName = 'JobList';
    this.renderJobs = this.renderJobs.bind(this);
    this._forceUpdate = this._forceUpdate.bind(this);

    this.state = {
      collection: [],
      warning: null,
    };

    this._factory = React.createFactory(this.props.renderWith);
  }

  componentDidMount() {
    this.setupCollectionDelta();
  }

  componentWillUnmount() {
    const collection = this.state.collection;
    // When we first create the componet, the collection will just be a simple array, instead of
    // a CollectionDeltaReceiver so we do not need to stopWatching  if it has not yet been loaded.
    if (collection && collection.on) {
      collection.on(null, null, this);
      collection.stopWatching();
    }

    // Abort the ajax request to prevent it from calling methods after we have unmounted.
    if (this._ajaxXHR) {
      this._ajaxXHR.abort();
    }
  }

  /**
   * Wrapper for force update.
   * @return {none}
   */
  _forceUpdate() {
    this.forceUpdate();
  }

  /**
   * Setup the collection delta reciever.
   *
   * @return {none}
   */
  setupCollectionDelta() {
    // Setup the CollectionDeltaReceiver of ElasticJobStatus
    this._ajaxXHR = $.ajax('/jobs/root', {
      success: (data) => {
        this._ajaxXHR = undefined;
        let warning = null;
        if (data.timeSinceLastUpdate > this.stuckBackendWarningThresholdMillis) {
          warning = 'Jobs backend unreachable, this page may be out of date.';
        }

        const collection = new CollectionDeltaReceiver([],
          { deltaPublisherRoot: data.root, model: ElasticJobStatus });
        collection.startWatching();
        collection.on('add remove reset change', _.throttle(this._forceUpdate, 500), this);

        const newState = {
          collection: collection,
          warning: warning,
        };
        this.setState(newState);
      },
      error: (error) => {
        this._ajaxXHR = undefined;
        console.error('Failed to initialize job list:', error);
      },
    });
  }

  /**
   * Filter the jobs collection if the filter prop is provided.
   *
   * @return {ElasticJobStatus[]} The jobs matching the filter.
   */
  filteredJobs() {
    if (this.props.filter) {
      return this.state.collection.filter(this.props.filter);
    }
    return this.state.collection;
  }

  renderNoJobs() {
    return (<h4>None</h4>);
  }

  /**
   * Render the jobs that match the current filter with the provided renderWith
   * React.Component.
   *
   * @param {ElasticJobStatus[]} jobs An array of the jobs to render.
   * @return {React.Component[]} An array of the jobs mapped to React.Components.
   */
  renderJobs(jobs) {
    return jobs.map((job) => this._factory(_.extend({
      key: job.get('jobId'),
      job: job,
    }, this.props)));
  }

  render() {
    const filteredJobs = this.filteredJobs();
    return (
      <div>
        {filteredJobs.length ?
          this.renderJobs(filteredJobs)
          :
          this.renderNoJobs()
        }
      </div>
      );
  }
}

JobList.propTypes = {
  renderWith: React.PropTypes.func.isRequired,
  filter: React.PropTypes.func,
};


export class JobListView extends React.Component {
  constructor(props) {
    super(props);

    this.onFilterChange = this.onFilterChange.bind(this);

    this.stuckBackendWarningThresholdMillis = 60 * 1000;
    this.state = {
      collection: null,
      filterText: JobListView.getFilterFromHash(location.hash),
      warning: null,
    };
    this.setupCollectionDelta();
  }

  static getFilterFromHash(hash) {
    return decodeURI(hash.substring('#joblist/'.length, hash.length));
  }

  setupCollectionDelta() {
    // Setup the CollectionDeltaReceiver of ElasticJobStatus
    $.ajax('/jobs/root', {
      success: (data) => {
        let warning = null;
        if (data.timeSinceLastUpdate > this.stuckBackendWarningThresholdMillis) {
          warning = 'Jobs backend unreachable, this page may be out of date.';
        }

        const collection = new CollectionDeltaReceiver([],
              { deltaPublisherRoot: data.root, model: ElasticJobStatus });
        const newState = {
          collection: collection,
          warning: warning,
        };
        this.setState(newState);
      },
      error: (error) => {
        console.error('Failed to initialize job list:', error);
      },
    });
  }

  getUpgradeableJobs() {
    if (this.state.collection) {
      return this.state.collection.filter((job) => job.needsUpgrade());
    }
    return [];
  }

  onFilterChange(newFilterText) {
    this.setState({ filterText: newFilterText });
  }

  getMainContent() {
    /**
     * Do not use this as an example for tables; it needs to be refactored to use
     * ReactTable's Table and Column. For now, see ClusterDetailsLibrariesList and
     * ClusterDetailsLibrariesListView.
     */
    const jobListHeaderRef = (ref) => this.jobListHeader = ref;
    const jobListTableRef = (ref) => this.jobListTable = ref;
    return (
        <div key='jobs-list-view' className='jobs-list-view'>
          <JobListHeader
            key='jobListHeader'
            ref={jobListHeaderRef}
            disabled={this.props.disabled}
            warning={this.state.warning}
            onChange={this.onFilterChange}
            numUpgradableJobs={this.getUpgradeableJobs().length}
            initialFilter={this.state.filterText}
          />
          <table className='table table-bordered-outer'>
            <thead>
              <tr>
                <th className='span2'>Name</th>
                <th className='span2'>Created by</th>
                <th className='span2'>Task</th>
                <th className='span2'>Cluster</th>
                <th className='span2'>Schedule</th>
                <th className='span2'>Last run</th>
                <th className='span2'>Status</th>
                <th className='span2'></th>
              </tr>
            </thead>
            {this.state.collection ?
             <JobListTable
               key='jobListTable'
               ref={jobListTableRef}
               clusters={this.props.clusters}
               collection={this.state.collection}
               filterText={this.state.filterText}
             /> : null}
          </table>
        </div>
    );
  }

  render() {
    /**
     * Do not use this as an example for tables; it needs to be refactored to use
     * ReactTable's Table and Column. For now, see ClusterDetailsLibrariesList and
     * ClusterDetailsLibrariesListView.
     */
    if (this.props.disabled) {
      const disabledJobsRef = (ref) => this.disabledJobs = ref;
      return (
          <DisabledJobsOverlay
            ref={disabledJobsRef}
          >
            {this.getMainContent()}
          </DisabledJobsOverlay>
      );
    }
    return this.getMainContent();
  }
}

JobListView.createJob = createJob;

JobListView.propTypes = {
  clusters: React.PropTypes.instanceOf(ClusterList).isRequired,
  disabled: React.PropTypes.bool,
};

JobListView.defaultProps = {
  disabled: false,
};
