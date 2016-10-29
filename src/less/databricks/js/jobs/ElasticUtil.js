/**
 * Util functions for elastic spark support.
 */

const ElasticUtil = {};

ElasticUtil.DEFAULT_ORG_ID = 0;       // Keep in sync with JobHandler.elasticJobUser
ElasticUtil.INTERNAL_ORG_ID = 53212;  // Keep in sync with MonitoringClient.jobUser

const DAY_OF_MONTH = 3;
const DAY_OF_WEEK = 5;

ElasticUtil.RETRY_COUNT_OPTIONS = [
  ['1 time', 1],
  ['2 times', 2],
  ['3 times', 3],
  ['4 times', 4],
  ['5 times', 5],
  ['6 times', 6],
  ['7 times', 7],
  ['8 times', 8],
  ['9 times', 9],
  ['10 times', 10],
  ['20 times', 20],
  ['30 times', 30]];

ElasticUtil.RETRY_POLICY_DELAY_MILLIS_OPTIONS = [
  ['no time', 0],
  ['5 sec', 5 * 1000],
  ['10 sec', 10 * 1000],
  ['30 sec', 30 * 1000],
  ['1 min', 1 * 60 * 1000],
  ['2 min', 2 * 60 * 1000],
  ['5 min', 5 * 60 * 1000],
  ['10 min', 10 * 60 * 1000],
  ['15 min', 15 * 60 * 1000],
  ['30 min', 30 * 60 * 1000],
  ['1 hour', 60 * 60 * 1000],
  ['2 hours', 120 * 60 * 1000],
  ['3 hours', 180 * 60 * 1000]];

// Translates our 5-field jquery-cron expression to that of Quartz.
ElasticUtil.toQuartzCronExpression = function toQuartzCronExpression(cronExpr) {
  if (cronExpr === null) {
    return null;
  }
  const parts = cronExpr.split(' ');
  parts.splice(0, 0, '0');  // Prepends seconds field.
  // Quartz doesn't allow both day-of-month and day-of-week to be '*'. If one if set, change
  // the other one to '?' for Quartz compatibility.
  if (parts[DAY_OF_MONTH] !== '*') {
    parts[DAY_OF_WEEK] = '?';
  } else if (parts[DAY_OF_WEEK] !== '*') {
    parts[DAY_OF_MONTH] = '?';
  } else {
    parts[DAY_OF_WEEK] = '?';  // Pick one to clear arbitrarily.
  }
  if (!isNaN(parts[DAY_OF_WEEK])) {
    parts[DAY_OF_WEEK] = parseInt(parts[DAY_OF_WEEK], 10) + 1;
  }
  return parts.join(' ');
};

// Parses quartz cron expression, or null if not parseable.
ElasticUtil.fromQuartzCronExpression = function fromQuartzCronExpression(quartzCronExpr) {
  if (quartzCronExpr === null) {
    return null;
  }
  const parts = quartzCronExpr.split(' ').map((part) => {
    if (part === '?') {
      return '*';  // Undo the conversions we made for compatibility with Quartz.
    }
    return part;
  });
  if (parts.length !== 6 || parts[0] !== '0') {
    return 'invalid';  // note: non-null, to force jquery-cron to treat this as invalid
  }
  if (!isNaN(parts[DAY_OF_WEEK])) {
    parts[DAY_OF_WEEK] = parseInt(parts[DAY_OF_WEEK], 10) - 1;
  }
  const withoutSecondsField = parts.splice(1);
  return withoutSecondsField.join(' ');
};

const SPARK_VERSIONS_NEEDING_UPGRADE = ['1.3.x', '1.4.x', '1.5.x', '1.6.x'];
/**
 * @WARNING(jengler) 2016-10-11: The code paths around this function are only designed to support
 * upgrading customers from Ubuntu14 images to 15. Before attempting to use it for any other type
 * of job upgrade scenario, ensure that the functions using the check are updated to support your
 * upgrade scenario.
 *
 * @param  {object} jobResources The job resource attribute from an ElasticJob model.
 * @return {bool}             True, if the job needs to be upgraded from Ubuntu14 to 15.
 */
ElasticUtil.jobNeedsUpgrade = function jobNeedsUpgrade(jobResources) {
  const sparkKey = jobResources.sparkVersion;

  return jobResources.runOnNewCluster &&
    !!SPARK_VERSIONS_NEEDING_UPGRADE.find((v) => v === sparkKey);
};

module.exports = ElasticUtil;
