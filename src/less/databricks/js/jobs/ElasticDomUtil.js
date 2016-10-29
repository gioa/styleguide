/* eslint func-names: 0 */

/**
 * Util functions for elastic spark support that require the DOM.
 */

import _ from 'underscore';
import $ from 'jquery';

import { ClusterUtil } from '../clusters/Common.jsx';
import { SparkVersionUtils } from '../clusters/SparkVersionUtils';

import ElasticUtil from '../jobs/ElasticUtil';

import { DateTimeFormats } from '../user_platform/DateTimeFormats';

require('../../lib/jquery-cron'); // jquery-cron

const ElasticDomUtil = {};

function pad2(number) {
  number = String(number);
  if (number.length === 1) {
    return '0' + number;
  }
  return number;
}

function formatCronExpr(cronExpr) {
  const node = $('<div>').cron({ initial: cronExpr });
  const text = [];
  // Walks the cron widget and extracts visible text into an array.
  $.each(node.children('span'), function() {
    if ($(this).css('display') !== 'none') {
      // Each field consists of multiple child spans and select dropdowns.
      $.each($(this).children(), function() {
        const subpart = $(this);
        if (subpart.is('select')) {
          if (subpart.prop('name') !== 'cron-timezone') {
            text.push(subpart.find(':selected').text());
          }
        } else {
          text.push(subpart.text());
        }
      });
    }
  });
  const result = text.join(' ')
      .replace(/ : /g, ':')
      .replace(/ [ ]+/g, ' ')
      .replace(
          /([0-9]+) minutes after the hour/g,
        function(match, minute) {
          return 'at 00:' + pad2(minute);
        })
      .replace(
          / (starting )?at ([0-9][0-9]):([0-9][0-9])/g,
        function(match, prefix, hour, minute) {
          if (parseInt(hour, 10) === 0 && parseInt(minute, 10) === 0) {
            return '';
          }
          hour = parseInt(hour, 10);
          let suffix = 'am';
          if (hour >= 12) {
            suffix = 'pm';
            console.log(hour, ((hour + 11) % 12) + 1);
          }
          return ' ' + (prefix || '') + 'at ' + (((hour + 11) % 12) + 1) + ':' + minute + suffix;
        });
  console.debug("Formatted '" + cronExpr + "' as '" + result + "'");
  return result;
}

const formatTriggerCached = _.memoize(function(trigger) {
  const timeZone = '(' + trigger.triggerTimeZone.replace('GMT', 'UTC') + ')';
  if (trigger.triggerType === 'cron') {
    try {
      return formatCronExpr(
        ElasticUtil.fromQuartzCronExpression(trigger.triggerValue)) + ' ' + timeZone;
    } catch (error) {
      console.warn('Could not format cron expr', trigger.triggerValue, error);
    }
  }
  const typeName = trigger.triggerType.charAt(0).toUpperCase() + trigger.triggerType.slice(1);
  return typeName + ': ' + trigger.triggerValue + ' ' + timeZone;
}, JSON.stringify);

function formatSparkVersionString(resources) {
  return SparkVersionUtils.formatSparkVersion(resources.sparkVersion);
}

function formatResourceTypeString(resources) {
  let string;
  if (!resources.useSpot) {
    string = ClusterUtil.onDemandDisplayStr();
  } else {
    if (resources.firstOnDemand > 0) {
      string = ClusterUtil.hybridDisplayStr();
    } else {
      string = ClusterUtil.spotDisplayStr();
    }
    if (resources.fallbackToOndemand) {
      string += ', fall back to ' + ClusterUtil.onDemandDisplayStr();
    }
  }
  if (resources.maxWorkers) {
    string += ', autoscaling';
  }
  return string;
}

/**
 * Used by ElasticDomUtil.formatResourceString to get the worker node type object
 * @param {object} resources - object describing cluster resources for a given job
 * @return {object or undefined}
 */
ElasticDomUtil._getWorkerNodeType = function(resources) {
  let workerNodeType;
  if (resources.nodeTypeId) {
    workerNodeType = ClusterUtil.getNodeType(resources.nodeTypeId.id);
  }
  return workerNodeType;
};

/**
 * Used by ElasticDomUtil.formatResourceString to get the worker node type object
 * @param {object} resources - object describing cluster resources for a given job
 * @return {object or undefined}
 */
ElasticDomUtil._getDriverNodeType = function(resources) {
  let workerNodeType;
  if (resources.driverNodeTypeId) {
    workerNodeType = ClusterUtil.getNodeType(resources.driverNodeTypeId.id);
  }
  return workerNodeType;
};

/**
 * Used by ElasticDomUtil.formatResourceString to get the worker node type description string
 * @param {object} workerNodeType
 * @return {string} - worker node type description string
 */
ElasticDomUtil._getWorkerNodeTypeDescription = function(workerNodeType) {
  let workerNodeTypeDescription = workerNodeType ? workerNodeType.description : undefined;
  // @NOTE(lauren) 2016-7-19: Ideally we shouldn't hardcode 'Memory Optimized' as default, but we
  // do for now since legacy jobs may not have a node type set. Check with Shard Services for more
  // and about when this can be removed.
  if (!workerNodeTypeDescription) {
    workerNodeTypeDescription = 'Memory Optimized';
  }
  return workerNodeTypeDescription;
};

/**
 * Used by ElasticDomUtil.formatResourceString to get the driver node type description string
 * @param {object} resources - object describing cluster resources for a given job
 * @param {string} workerNodeTypeDescription - string to use as default if driver type not set
 * @return {string} - e.g., "Memory Optimized"
 */
ElasticDomUtil._getDriverNodeTypeDescription = function(resources, workerNodeTypeDescription) {
  let driverNodeTypeDescription;
  if (resources.driverNodeTypeId) {
    const driverNodeType = ClusterUtil.getNodeType(resources.driverNodeTypeId.id);
    driverNodeTypeDescription = driverNodeType ? driverNodeType.description : undefined;
  }
  if (!driverNodeTypeDescription) {
    // if it is not set, we assume it is the same as nodeType
    driverNodeTypeDescription = workerNodeTypeDescription;
  }
  return driverNodeTypeDescription;
};

ElasticDomUtil.formatResourceString = function(resources) {
  if (resources.runOnNewCluster) {
    let result;

    const workerNodeType = ElasticDomUtil._getWorkerNodeType(resources);
    const workerNodeTypeDescription = ElasticDomUtil._getWorkerNodeTypeDescription(workerNodeType);
    result = `Workers: ${workerNodeTypeDescription}, `;

    const driverNodeType = ElasticDomUtil._getDriverNodeType(resources);
    const driverNodeTypeDescription = ElasticDomUtil._getDriverNodeTypeDescription(resources,
      workerNodeTypeDescription);
    result = `Driver: ${driverNodeTypeDescription}, ` + result;

    if (workerNodeType && workerNodeType.description === 'Compute Optimized (legacy)') {
      result += ClusterUtil.workersToCores(resources.newClusterNumWorkers, workerNodeType)
        + ' cores';
    } else {
      const memGB = ClusterUtil.containersToMemoryGB(
        resources.newClusterNumWorkers, workerNodeType, driverNodeType, true);
      if (!result) {
        result = '';
      }
      result += (memGB + ' GB');
    }
    result += ', ' + formatResourceTypeString(resources);
    if (window.settings.enableSparkVersionsUI) {
      result += ', ' + formatSparkVersionString(resources);
    }
    if (resources.zoneId && resources.zoneId !== window.settings.defaultZoneId) {
      result += ', ' + resources.zoneId;
    }
    return result;
  }
  const cluster = window.clusterList.getAttachableCluster(resources.clusterId);
  if (cluster) {
    return cluster.shortDescription();
  }
  return '(Terminated)';  // The cluster with that ID was deleted
};

ElasticDomUtil.formatSchedString = function(triggers) {
  const result = triggers.filter(function(trigger) {
    return trigger.triggerType !== 'manual' && trigger.triggerType !== 'retry';
  }).map(formatTriggerCached).join(', ');
  if (result.length > 0) {
    return result;
  }
  return 'None';
};

ElasticDomUtil.getRetryTriggers = function(triggers) {
  return triggers.filter(function(trigger) {
    return trigger.triggerType === 'retry';
  });
};

ElasticDomUtil.retryPending = function(triggers) {
  return ElasticDomUtil.getRetryTriggers(triggers).length > 0;
};

ElasticDomUtil.formatStatusString = function(activeRuns, triggers) {
  const numRetryTriggers = ElasticDomUtil.getRetryTriggers(triggers).length;
  if (activeRuns.length === 0 && numRetryTriggers === 0) {
    return 'Idle';
  }
  const statusCount = {};
  activeRuns.forEach(function(run) {
    if (run.status in statusCount) {
      statusCount[run.status] += 1;
    } else {
      statusCount[run.status] = 1;
    }
  });
  if (numRetryTriggers > 0) {
    statusCount['Retry pending'] = numRetryTriggers;
  }
  const statusComponents = [];
  for (const status in statusCount) {
    if ({}.hasOwnProperty.call(statusCount, status)) {
      const count = statusCount[status];
      const statusString = (count === 1) ? status : (status + ' (' + count + ')');
      statusComponents.push(statusString);
    }
  }
  return statusComponents.join(', ');
};

// return the given timestamp's countdown string
ElasticDomUtil.getCountdownString = function(time, serverTime) {
  const delta = Math.max(0, time - serverTime);
  return DateTimeFormats.formatDuration(Math.floor(delta / 1000));
};

/**
 * Is a job's configuration valid to allow runs? It needs to have actions set and either be using
 * an existing cluster that is still around, or a new cluster.
 */
ElasticDomUtil.isRunnableConfiguration = function(jobActions, resources) {
  return jobActions.length > 0 &&
    (resources.runOnNewCluster || window.clusterList.getAttachableCluster(resources.clusterId));
};

module.exports = ElasticDomUtil;
