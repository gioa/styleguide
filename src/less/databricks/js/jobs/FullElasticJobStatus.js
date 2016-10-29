/**
 * Keep in sync with com.databricks.webapp.FullElasticJobStatus
 * @NOTE: The difference between this and ElasticJobStatus is that ElasticJobStatus
 * is used on the jobs list page, whereas this is used on the job details page
 */

import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';

import AclModelMixin from '../acl/AclModelMixin';
import WorkspacePermissions from '../acl/WorkspacePermissions';

import ElasticUtil from '../jobs/ElasticUtil';
import ElasticDomUtil from '../jobs/ElasticDomUtil';

const FullElasticJobStatus = Backbone.Model.extend({
  defaults: {
    publisherRootId: null,
    basicInfo: {
      userName: 'Unknown',
      organizationId: '0',
      jobId: '',
      jobName: '',
      activeRuns: [],
      lastRan: '',
      resources: {
        runOnNewCluster: true,
        totalMemMb: 0,
        useSpot: false,
        fallbackToOndemand: false,
        sparkVersion: 'Unknown spark version',
        zoneId: null,
        minWorkers: 0,
        maxWorkers: 0,
      },
      retryPolicy: {},
      timeoutSeconds: 0,
      maxConcurrentRuns: 1,
      onStartEmail: [],
      onSuccessEmail: [],
      onErrorEmail: [],
      jobActions: [],
      jobTriggers: [],
      libraries: [],
    },
    history: [],
  },

  // TODO(cg/lauren): Remove this after the Jobs upgrade button is removed (2.14)
  needsUpgrade() {
    return ElasticUtil.jobNeedsUpgrade(this.get('basicInfo').resources);
  },

  /**
   * Send an AJAX request to change an attribute on a job
   *
   * @param endpoint webapp endpoint to call
   * @param data JSON data to post; either an object or the jobID (string)
   * @param onSuccess optional function to call on success
   * @param onError optional function to call on error
   */
  editJob(endpoint, data, onSuccess, onError) {
    $.ajax(endpoint, {
      type: 'POST',
      data: data.toString(),
      error: (xhr, status, error) => {
        if (onError) { onError(error); }
      },
      success: () => {
        if (onSuccess) { onSuccess(); }
      },
    });
  },

  hasActiveRuns() {
    return _.where(this.attributes.history, { active: true }).length > 0;
  },

  hasJarAction() {
    let hasJar = false;
    // @TODO(jengler) 2016-05-18: Replace this with a find so we only look for the first jar, not
    // all actions.
    _.forEach(this.get('basicInfo').jobActions, (action) => {
      if (action.type === 'jar') {
        hasJar = true;
      }
    });
    return hasJar;
  },

  getTimeoutString() {
    const timeoutSeconds = this.get('basicInfo').timeoutSeconds;
    if (!timeoutSeconds || timeoutSeconds <= 0) {
      return 'None';
    }
    const timeoutMinutes = parseInt(timeoutSeconds / 60, 10);
    if (timeoutMinutes === 1) {
      return timeoutMinutes + ' minute';
    }
    return timeoutMinutes + ' minutes';
  },

  getMaxConcurrentRuns() {
    const maxConcurrentRuns = this.get('basicInfo').maxConcurrentRuns;
    if (maxConcurrentRuns < 0) {
      return 1;
    }
    return maxConcurrentRuns;
  },

  getRetryString() {
    const policy = this.get('basicInfo').retryPolicy;
    if (policy.maxAttempts === 1 && policy.minRetryIntervalMillis === 0 &&
        policy.retryWindowMillis === -1) {
      return 'None';
    }
    let delayString = '';
    if (policy.minRetryIntervalMillis > 0) {
      ElasticUtil.RETRY_POLICY_DELAY_MILLIS_OPTIONS.forEach((entry) => {
        if (entry[1] === policy.minRetryIntervalMillis) {
          delayString = ', ' + entry[0] + ' delay';
        }
      });
    }
    let timeoutString = '';
    if (policy.retryOnTimeout && window.settings.enableJobsRetryOnTimeout) {
      timeoutString = ' and retry on timeouts';
    }
    return 'Limit ' + (policy.maxAttempts - 1) + 'x ' + delayString + timeoutString;
  },

  getCronSched() {
    const trigger = this.getCronTrigger();
    if (trigger === null) {
      return null;
    }
    return trigger.triggerValue;
  },

  getCronTimeZone() {
    const trigger = this.getCronTrigger();
    if (trigger === null) {
      return null;
    }
    return trigger.triggerTimeZone.replace('GMT', 'UTC');
  },

  getCronTrigger() {
    const triggers = this.get('basicInfo').jobTriggers;
    for (const i in triggers) {
      if (triggers[i].triggerType === 'cron') {
        return triggers[i];
      }
    }
    return null;
  },

  getResourceString() {
    return ElasticDomUtil.formatResourceString(this.get('basicInfo').resources);
  },

  retryPending() {
    return ElasticDomUtil.retryPending(
      this.get('basicInfo').jobTriggers);
  },

  // Returns an array of scheduled retry times, assuming some retries are currently pending.
  getRetryTimes() {
    const triggers = this.get('basicInfo').jobTriggers;
    const retryTriggers = ElasticDomUtil.getRetryTriggers(triggers);
    return retryTriggers.map((trigger) => trigger.triggerTime);
  },

  getSchedString() {
    return ElasticDomUtil.formatSchedString(this.get('basicInfo').jobTriggers);
  },


  isRunnableConfiguration() {
    return ElasticDomUtil.isRunnableConfiguration(
      this.get('basicInfo').jobActions,
      this.get('basicInfo').resources);
  },

  hitMaxConcurrentRuns() {
    return this.get('basicInfo').activeRuns.length >= this.get('basicInfo').maxConcurrentRuns;
  },

  url() {
    return '/jobs/get/' + this.get('jobId');
  },

  // the object type in the acl handler
  getAclObjectType() { return WorkspacePermissions.JOB_TYPE; },

  // the id of the object in the acl handler
  getAclObjectId() { return this.get('jobId'); },

  getName() { return this.get('basicInfo').jobName; },
});

_.extend(FullElasticJobStatus.prototype, AclModelMixin);

// IMPORTANT: Keep this enum in sync with the function in JobHandler.scala
// TODO(hhd): Report run status more cleanly to the frontend.
FullElasticJobStatus.RunLifeCycleState = {
  PENDING: 'Pending',
  RUNNING: 'Running',
  TERMINATING: 'Terminating',
  TERMINATED: 'Terminated',
  SKIPPED: 'Skipped',
  INTERNAL_ERROR: 'Internal Error',
};

/** The model that represents /jobs in ACLs */
const JobRoot = Backbone.Model.extend({
  getAclObjectType() { return WorkspacePermissions.JOB_ROOT_TYPE; },
  getAclObjectId() { return WorkspacePermissions.AllAction; },
  getName() { return WorkspacePermissions.JOB_ROOT_TYPE; },
});

_.extend(JobRoot.prototype, AclModelMixin);

FullElasticJobStatus.ROOT = new JobRoot();

module.exports = FullElasticJobStatus;
