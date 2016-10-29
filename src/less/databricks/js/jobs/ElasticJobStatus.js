/**
 * Keep in sync with com.databricks.webapp.ElasticJobStatus
 * @NOTE: The difference between this and FullElasticJobStatus is that FullElasticJobStatus
 * is used on the job details page, whereas this is used on the jobs list page
 */

import Backbone from 'backbone';

import ElasticUtil from '../jobs/ElasticUtil';
import ElasticDomUtil from '../jobs/ElasticDomUtil';
import FullElasticJobStatus from '../jobs/FullElasticJobStatus';

const ElasticJobStatus = Backbone.Model.extend({
  defaults: {
    deltaVersion: -1,
    userName: 'Unknown',
    organizationId: '0',
    jobId: '',
    jobName: '',
    activeRuns: [],
    lastRunStatus: '',
    resources: {
      runOnNewCluster: true,
      totalMemMb: 0,
      useSpot: false,
      fallbackToOndemand: false,
      sparkVersion: 'Unknown spark version',
      minWorkers: 0,
      maxWorkers: 0,
    },
    retryPolicy: {},
    maxConcurrentRuns: 1,
    timeoutSeconds: 0,
    onStartEmail: [],
    onSuccessEmail: [],
    onErrorEmail: [],
    jobActions: [],
    jobTriggers: [],
    libraries: [],
  },

  /**
   * Get the logging tags for this job.
   * @return {Object} An object of the tags to log for this job.
   */
  tags() {
    return {
      jobId: this.get('jobId'),
    };
  },

  getResourceString() {
    return ElasticDomUtil.formatResourceString(this.get('resources'));
  },

  getStatusString() {
    return ElasticDomUtil.formatStatusString(this.get('activeRuns'), this.get('jobTriggers'));
  },

  getSchedString() {
    return ElasticDomUtil.formatSchedString(this.get('jobTriggers'));
  },

  // TODO(cg): Remove this after the Jobs upgrade button is removed (2.14)
  needsUpgrade() {
    return ElasticUtil.jobNeedsUpgrade(this.get('resources'));
  },

  isRunnable() {
    const isRunnableConfiguration = ElasticDomUtil.isRunnableConfiguration(
        this.get('jobActions'), this.get('resources'));
    return this.get('activeRuns').length < this.get('maxConcurrentRuns') &&
      isRunnableConfiguration;
  },

  isCancellable() {
    const activeRuns = this.get('activeRuns');
    const runStatus = activeRuns.map((run) => run.status);
    return runStatus.includes(FullElasticJobStatus.RunLifeCycleState.PENDING) ||
      runStatus.includes(FullElasticJobStatus.RunLifeCycleState.RUNNING);
  },
});

module.exports = ElasticJobStatus;
