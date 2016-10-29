import React from 'react';

import { ElasticJobStatus } from '../jobs/ElasticJobStatus';
import { SideMenuSection } from '../notebook/SideMenu.jsx';
import { BrowserUtils } from '../user_platform/BrowserUtils';

/**
 * The ScheduleItemView renders an ElasticJobStatus. Built for use with the ScheduleSideMenu.
 */
export class ScheduleItemView extends React.Component {
  constructor(props) {
    super(props);
    this.displayName = 'ScheduleItemView';

    this._recordJobLinkClicked = this._recordJobLinkClicked.bind(this);
    this._recordLastRunClicked = this._recordLastRunClicked.bind(this);
  }

  /**
   * Logging helper
   * @return {object} Object with tags to use for logging events.
   */
  tags() {
    const tags = this.props.job.tags();
    tags.source = 'ScheduleItemView';
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

  _recordJobLinkClicked() {
    this._recordClick('job-link-clicked');
  }

  _recordLastRunClicked() {
    this._recordClick('job-last-run-link-clicked');
  }

  renderLastSuccessfulRun(job, jobSubView) {
    const lastRun = job.get('lastRunStatus');

    if (lastRun) {
      const jobId = job.get('jobId');
      let lastRunLink = `#/job/${jobId}/run/latestSuccess`;
      if (jobSubView) {
        lastRunLink += `/${jobSubView}`;
      }

      const lastRunString = Date(lastRun.startTime).toString();
      return (
        <a
          href={lastRunLink}
          title={lastRunString}
          onClick={this._recordLastRunClicked}
        >
          Last successful run:&nbsp;
          <span className='date-time'>
            {lastRunString}
          </span>
        </a>
      );
    }
    return 'Last successful run: none';
  }


  render() {
    const job = this.props.job;
    const jobId = job.get('jobId');
    const jobName = job.get('jobName');
    const schedule = job.getSchedString();
    const status = job.getStatusString();

    return (
      <SideMenuSection>
        <div>
          <a
            className='name'
            title={jobName}
            href={`#/job/${jobId}`}
            onClick={this._recordJobLinkClicked}
          >
            {jobName}
          </a>
          <span className='job-status inlined pull-right' title={status}>
            {status}
          </span>
        </div>
        <div className='schedule' title={schedule}>
          {schedule}
        </div>
        <div className='last-run'>
          {this.renderLastSuccessfulRun(job, this.props.jobSubView)}
        </div>
      </SideMenuSection>
    );
  }
}

ScheduleItemView.propTypes = {
  job: React.PropTypes.instanceOf(ElasticJobStatus).isRequired,
  metricName: React.PropTypes.string,
  /**
   * See the JobSubView typedef for more details.
   * @type {JobSubView}
   */
  jobSubView: React.PropTypes.string,
};

ScheduleItemView.defaultProps = {
  metricName: 'notebook',
};
