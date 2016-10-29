import React from 'react';
import $ from 'jquery';

import { SparkVersionUtils } from '../clusters/SparkVersionUtils';

import { SideMenu, SideMenuSection } from './SideMenu.jsx';

import { PathNameUtils } from '../filetree/PathNameUtils';

import { CronSchedule } from '../jobs/CronSchedule.jsx';
import { JobList } from '../jobs/JobListView.jsx';

import NotebookModel from '../notebook/NotebookModel';
import { ScheduleItemView } from '../notebook/ScheduleItemView.jsx';

import ReactDialogBox from '../ui_building_blocks/dialogs/ReactDialogBox.jsx';

import { BrowserUtils } from '../user_platform/BrowserUtils';

/**
 * The jobSubView is string that is appended to the URI for a job run. It is used to allow
 * different views that load the ScheduleSideMenu to specify they want to open job runs to that
 * specific job page. For example,
 *   if the user clicks to load the the last run for job X with no JobSubView specified, the URI
 *     would be default to:
 *       "/jobs/X/lastSuccess".
 *   if the user user specified a JobSubView of "dashboard/<dashoard-NUID>" when instantiating the
 *     ScheduleSideMenuView, then that same link would now point to:
 *       "/jobs/X/lastSuccess/dashboard/<dashboard-NUID>"
 *
 * This is used in ReactNotebookView to switch between the "notebook" view and "resultsOnly" view.
 * It is also used in the DashboardEditView to have the latest run links open to the
 * current dashboard.
 *
 * @typedef {string} JobSubView
 */

/**
 * ScheduleSideMenuView
 * Wrapper for the schedule side menu.
 */
export class ScheduleSideMenuView extends React.Component {
  constructor(props) {
    super(props);

    this.newSchedule = this.newSchedule.bind(this);
    this.handleCreateScheduleSuccess = this.handleCreateScheduleSuccess.bind(this);
    this.handleCreateScheduleError = this.handleCreateScheduleError.bind(this);

    // @NOTE(jengler) 2016-02-24: Binding the filter function so that we do not keep computing
    // the notebook path and filter function each time we render. This assumes that we will not
    // be changing the path of the notebook while viewing the job list. If that changes, then
    // we will need to update this.
    const notebookPath =
      '/' + PathNameUtils.generatePathNamesFromPathIds(this.props.notebook.get('path'));
    this._isNotebookAttachedToJobBound = this._isNotebookAttachedToJob.bind(this, notebookPath);
  }

  componentWillUnmount() {
    // Abort outstanding ajax requets
    if (this._createXHR) {
      this._createXHR.abort();
    }
  }

  /**
   * Logging helper
   * @return {object} Object with tags to use for logging events.
   */
  tags() {
    const tags = this.props.notebook.tags();
    tags.source = 'ScheduleSideMenu';
    return tags;
  }

  /**
   * Helper for click events. Responsible for getting tags, setting the event type and actually
   * triggering the recordEvent call.
   *
   * @param  {string} eventType Event type
   * @return {none}
   */
  _recordClick(eventType) {
    const tags = BrowserUtils.getMeasurementTags(this.tags());
    tags.eventType = eventType;
    window.recordEvent(this.props.metricName, tags);
  }

  /**
   * Success handler for the create schedule/job ajax request.
   * @return {none}
   */
  handleCreateScheduleSuccess() {
    this._createXHR = undefined;
  }

  /**
   * Error handler for the create schedul/job ajax request.
   *
   * @param  {jqXHR} xhr    The XMLHttpRequest event object
   * @param  {string} (status) The status of the request (e.g. "error")
   * @param  {string} (error)  Exception message.
   * @return {none}
   */
  handleCreateScheduleError(xhr, status, error) {
    this._createXHR = undefined;
    console.log('Create job error', xhr, status, error);
    if (xhr.statusText === 'Connection failed') {
      ReactDialogBox.alert('Schedule creation failed. Unable to connect to Jobs Service.');
    } else {
      ReactDialogBox.alert(xhr.statusText);
    }
  }

  /**
   * Create a schedule for the provided cronSchedule.
   * @TODO(jengler) 2016-02-24: We should move this behind a service class for creating schedules.
   *
   * @param  {string} notebookId   The id of the notebook to create the schedule for.
   * @param  {object} cronSchedule The cron schedule for the job.
   * @param  {string} (scheduleName) Optional. A name for the schedule. Default: Untitled.
   * @return {none}
   */
  createSchedule(notebookId, cronSchedule, scheduleName) {
    const jobAttributes = {
      notebookId: notebookId,
      cronExpr: cronSchedule.quartzCronExpression,
      timeZone: cronSchedule.timeZoneId,
      name: scheduleName || 'Untitled',
      workers: null,
      memoryTotalMb: 2 * window.settings.defaultMemoryPerContainerMB,
      sparkVersion: SparkVersionUtils.getDefaultSparkVersion(),
    };

    this._createXHR = $.ajax('/jobs/create', {
      type: 'POST',
      data: JSON.stringify(jobAttributes),
      success: this.handleCreateScheduleSuccess,
      error: this.handleCreateScheduleError,
    });
  }

  _createDialogConfirmHandler() {
    const notebook = this.props.notebook;

    this.createSchedule(
      notebook.get('id'),
      this._cronSchedule.value(),
      notebook.get('name'));

    this._cronSchedule = undefined;
    this._recordClick('confirm-create-schedule');
  }

  /**
   * Show dialog for user to create a new schedule.
   *
   * @return {none}
   */
  newSchedule() {
    this._recordClick('create-schedule');
    /*
     * @NOTE(jengler) 2016-02-19: Holding on to a reference of the cronSchedule so we can
     * get the values from it if the users clicks the dialog confirm button.
     */
    const refFunc = (r) => this._cronSchedule = r;
    const message = ([
      (<CronSchedule
        ref={refFunc}
      />),
      (<div>
        <br />
        <p>
          A new cluster will be created each time this schedule runs.
          You can modify settings from the <a href='#joblist' target='_blank'>
            Jobs page
          </a> once the job is created.
        </p>
      </div>),
    ]);

    ReactDialogBox.confirm({
      title: 'Create Schedule',
      name: 'create-schedule-dialog',
      message: message,
      confirmButton: 'Ok',
      cancelButton: 'Cancel',
      confirm: (e) => {
        this._createDialogConfirmHandler(e);
      },
      cancel: () => {
        this._cronSchedule = undefined;
        this._recordClick('cancel-create-schedule');
      },
    });
  }

  /**
   * Helper function for checking if a job targets a notebook. This is bound to the current
   * props.model notebook path in the constructor.
   *
   * @param  {string} notebookPath  The path to the notebook, e.g. /User/workspace/notebook
   * @param  {ElasticJobStatus} job The job to check
   * @return {bool}                 True iff the job has an action that targets the notebook path.
   */
  _isNotebookAttachedToJob(notebookPath, job) {
    // Check the jobActions to see if any of them target this notebook.
    return !!job.get('jobActions').find((action) => action.notebookPath === notebookPath);
  }

  render() {
    return (
      <SideMenu addClass='schedule-side-menu'>
        <SideMenuSection addClass='title-section'>
          <h3 className='title inlined'>Schedule job</h3>
          <button onClick={this.newSchedule}
            title={"Create a job to run this notebook periodically"}
            className='btn btn-primary add-button title-action pull-right'
          >
            <i className='fa fa-fw fa-plus' /> New
          </button>
        </SideMenuSection>
        <div className='list-section'>
          <JobList
            filter={ this._isNotebookAttachedToJobBound }
            renderWith={ScheduleItemView}
            jobSubView={this.props.jobSubView}
            metricName={this.props.metricName}
          />
        </div>
      </SideMenu>
    );
  }
}

ScheduleSideMenuView.propTypes = {
  notebook: React.PropTypes.instanceOf(NotebookModel).isRequired,
  metricName: React.PropTypes.string,
  /**
   * See the JobSubView typedef for more details.
   * @type {JobSubView}
   */
  jobSubView: React.PropTypes.string,
};

ScheduleSideMenuView.defaultProps = {
  metricName: 'notebook',
};
