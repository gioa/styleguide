import _ from 'underscore';
import React from 'react';

import { ClusterUtil } from '../clusters/Common.jsx';
import IconsForType from '../ui_building_blocks/icons/IconsForType';
import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

const WARNING_ICON = <i className={'fa fa-' + IconsForType.warning} />;

export class LibraryClusterRow extends React.Component {
  renderCheckbox() {
    if (this.props.autoAttach) {
      // User has no choice for the cluster, the library is always attached everywhere.
      return (<em>Always attached</em>);
    }
    const checkboxRef = (ref) => this.checkbox = ref;
    const tooltipRef = (ref) => this.tooltip = ref;
    const inputElem = (
      <input
        ref={checkboxRef}
        type='checkbox'
        disabled={!this.props.hasAttachPermissions}
        className='cluster-attach'
        checked={this.props.shouldAttach}
        onChange={this.props.handleClusterAttachChange}
      />
    );
    const tooltipText = 'You do not have permissions to attach to this cluster. ' +
                        'Please contact your administrator.';
    const tooltipInputElem = (
      <Tooltip
        ref={tooltipRef}
        text={tooltipText}
        customPosition={{ contentLeft: '1px' }}
      >
        {inputElem}
      </Tooltip>
    );
    return this.props.hasAttachPermissions ? inputElem : tooltipInputElem;
  }

  render() {
    // Auto-attach property overrides the default property.
    const shouldAttach = this.props.autoAttach || this.props.shouldAttach;
    const shortStatus = this.getShortClusterStatus(shouldAttach, this.props.status);
    const longStatus = this.getClusterStatus(shouldAttach, this.props.status);
    const statusIcon = this.getClusterStatusIcon(shouldAttach, this.props.status);
    const clusterDetailsLinks = ClusterUtil.getDetailsLinks(this.props.clusterId);
    return (
        <tr key={this.props.clusterId}
          className={this.props.hasAttachPermissions ? null : 'no-attach-row'}
          data-cluster-name={this.props.clusterName}
          data-cluster-status={shortStatus}
        >
          <td className='attach-checkbox'>{this.renderCheckbox()}</td>
          <td>
            <a href={clusterDetailsLinks.libraries}>{this.props.clusterName}</a>
          </td>
          <td>{statusIcon}{longStatus}</td>
        </tr>
    );
  }

  // A short, standardized status that is used by selenium to query the status of a cluster.
  // The following statuses are valid: error, attached, attaching, detached, detaching,
  // unknown.
  getShortClusterStatus(shouldAttach, reportedStatus) {
    const longStatus = this.getClusterStatus(shouldAttach, reportedStatus).toLowerCase();
    // Remove all the error messages, we just want a short status.
    if (longStatus.indexOf('error') >= 0) {
      return 'error';
    }
    return longStatus;
  }

  // A longer, human-friendly status of the library for a specific cluster.
  getClusterStatus(shouldAttach, reportedStatus) {
    const status = reportedStatus ? reportedStatus.status : undefined;
    const alarms = reportedStatus ? reportedStatus.alarms : [];
    if (status === 'error') {
      let msg = 'Error';
      _.each(alarms, function appendToMessage(s) {
        msg = msg + ': ' + s;
      });
      return msg;
    }
    if (shouldAttach === true) {
      if (status === 'loaded') {
        return 'Attached';
      }
      return 'Attaching';
    }
    if (shouldAttach === false) {
      if (!status) {
        return 'Detached';
      }
      return 'Detach pending a cluster restart';
    }
    return 'Unknown';
  }

  getClusterStatusIcon(shouldAttach, reportedStatus) {
    const status = reportedStatus ? reportedStatus.status : undefined;
    // This is a detaching state. Look at getClusterStatus for the logic path
    return !shouldAttach && status ?
      <span className='cell-icon-left-of-text'>{WARNING_ICON}</span> : null;
  }
}

LibraryClusterRow.propTypes = {
  libraryId: React.PropTypes.number.isRequired,
  clusterName: React.PropTypes.string.isRequired,
  sparkContextId: React.PropTypes.string.isRequired,
  clusterId: React.PropTypes.string.isRequired,
  shouldAttach: React.PropTypes.bool.isRequired,
  // should be true unless cluster ACLs enabled
  hasAttachPermissions: React.PropTypes.bool.isRequired,
  handleClusterAttachChange: React.PropTypes.func.isRequired,
  status: React.PropTypes.object, // A ClusterLibraryStatus, may be null
  autoAttach: React.PropTypes.bool,
};
