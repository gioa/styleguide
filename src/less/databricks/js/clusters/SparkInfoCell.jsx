import React from 'react';

import { AclUtils } from '../acl/AclUtils.jsx';
import WorkspacePermissions from '../acl/WorkspacePermissions';

import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

/**
 * Simple wrapper for showing the Spark UI and Logs links in the "Spark" column.
 * Used in ReactClusterListView.
 */
export class SparkInfoCell extends React.Component {
  metricFunction(metric, tags) {
    window.recordEvent(metric, tags);
  }

  _getSparkUiMetricFunc() {
    return this.metricFunction.bind(
      this,
      'clusterDetailsVisited',
      {
        'clusterDetailsTabVisited': 'Spark UI',
        'clusterDetailsTabVisitedOrigin': this.props.viewName,
      }
    );
  }

  _shouldDisableSparkUILink() {
    return AclUtils.clusterAclsEnabled() && !this.props.userCanAttach;
  }

  _getSparkUILink() {
    const disableLink = this._shouldDisableSparkUILink();
    let link = (
      <a className='spark-ui-link'
        href={this.props.driverUrl}
        onClick={disableLink ? null : this._getSparkUiMetricFunc()}
        disabled={disableLink}
      >
        Spark UI
      </a>
    );
    if (disableLink) {
      link = <Tooltip text={WorkspacePermissions.NO_VIEW_PERMISSIONS_WARNING}>{link}</Tooltip>;
    }
    return link;
  }

  _getDriverLogsUILink() {
    const logsMetricFunc = this.metricFunction.bind(
      this,
      'clusterDetailsVisited',
      {
        'clusterDetailsTabVisited': 'Driver Logs',
        'clusterDetailsTabVisitedOrigin': this.props.viewName,
      }
    );

    const disableLink = this._shouldDisableSparkUILink();
    let link = (
      <a className='spark-logs-link'
        href={this.props.driverLogsUrl}
        onClick={disableLink ? null : logsMetricFunc}
        disabled={disableLink}
      >
        Logs
      </a>
    );
    if (disableLink) {
      link = <Tooltip text={WorkspacePermissions.NO_VIEW_PERMISSIONS_WARNING}>{link}</Tooltip>;
    }
    return this.props.enableDriverLogsUI ? link : null;
  }

  render() {
    const terminalUILink = this.props.terminalUrl ?
      <div><a href={this.props.terminalUrl + '/driver'}>Terminal</a></div> : null;

    return (
      <div data-spark-info={this.props.clusterName} className='spark-info-cell'>
        <div>{this._getSparkUILink()}</div>
        {terminalUILink}
        <div>{this._getDriverLogsUILink()}</div>
        <a className='hidden old-spark-ui-link' href={this.props.oldDriverUrl}></a>
      </div>
    );
  }
}

SparkInfoCell.propTypes = {
  clusterName: React.PropTypes.string.isRequired,
  driverUrl: React.PropTypes.string.isRequired,
  enableDriverLogsUI: React.PropTypes.bool.isRequired,
  driverLogsUrl: React.PropTypes.string,
  oldDriverUrl: React.PropTypes.string,
  terminalUrl: React.PropTypes.string,
  userCanAttach: React.PropTypes.bool,
  viewName: React.PropTypes.string,
};

SparkInfoCell.defaultProps = {
  userCanAttach: true,
};
