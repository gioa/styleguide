/**
 * Keep in sync with com.databricks.webapp.FullElasticRunStatus
 */

import Backbone from 'backbone';

import ElasticDomUtil from '../jobs/ElasticDomUtil';

const FullElasticRunStatus = Backbone.Model.extend({
  // Set this to true if you want fetches to skip notebook results.
  deltaUpdate: false,

  defaults: {
    jobInfo: {
      userName: 'Unknown',
      organizationId: '0',
      jobId: '',
      jobName: '',
      jobStatus: '',
      lastRan: '',
      jobActions: [],
      jobTriggers: [],
      libraries: [],
    },
    runInfo: {
      runId: '',
      idInJob: 0,
      originalAttemptId: '',
      startTime: 0,
      durationMillis: 0,
      status: '',
      active: false,
      trigger: undefined,
      message: '',
    },
    runActions: [],
    actionResults: [],
    renderedNotebookIds: [],
    resources: {
      runOnNewCluster: true,
      totalMemMb: 0,
      useSpot: false,
      fallbackToOndemand: false,
      sparkVersion: 'Unknown spark version',
    },
  },

  getResourceString() {
    return ElasticDomUtil.formatResourceString(this.get('resources'));
  },

  url(suffix) {
    let base = '/jobs/runs/' + this.get('jobId') + '/' + this.get('runId');
    if (suffix) {
      base += suffix;
    } else if (this.deltaUpdate) {
      base += '?deltaUpdate=1';
    }
    return base;
  },
});

module.exports = FullElasticRunStatus;
