/* eslint react/prefer-es6-class: 0, func-names: 0 */

import _ from 'underscore';
import React from 'react';

import WorkspacePermissions from '../acl/WorkspacePermissions';

import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

import { DbGuideUrls } from '../urls/DbGuideUrls';
import DbGuideLinks from '../urls/DbGuideLinks';

/**
 * Creates the dropdown selection of permissions used in the add permissions
 * dialog. Used by AddPermissionView and PermissionList.
 *
 */

const PermissionSelection = React.createClass({
  propTypes: {
    // name of the principal for which we are selecting permissions (for the tooltip description)
    principalName: React.PropTypes.string,
    // the type of node for which we are selecting permissions on (for the tooltip description)
    nodeType: React.PropTypes.string,
    // the inherited display permission; we won't allow selecting any permission lower than this
    inheritedPermission: React.PropTypes.string,
    // the IDs of folders that we inherited permissions from (for the tooltip description)
    inheritedSourceIds: React.PropTypes.array,
    currentPermission: React.PropTypes.string.isRequired,
    onChange: React.PropTypes.func.isRequired,
    disabled: React.PropTypes.bool,
    showPermissionDescriptions: React.PropTypes.bool,
    hideNoPermissionsOption: React.PropTypes.bool,
  },

  getDefaultProps() {
    return {
      inheritedPermission: WorkspacePermissions.NONE,
      inheritedSourceIds: [],
    };
  },

  getInitialState() {
    return {
      value: this.props.currentPermission,
    };
  },

  componentWillReceiveProps(nextProps) {
    this.setState({ value: nextProps.currentPermission });
  },

  onChange(event) {
    const value = event.target.value;
    this.setState({ value: value });
    this.props.onChange(value);
  },

  getAllPermissions() {
    if (this.props.nodeType === WorkspacePermissions.CLUSTER_TYPE) {
      return WorkspacePermissions.ALL_CLUSTER_PERMISSIONS;
    } else if (this.props.nodeType === WorkspacePermissions.IAM_ROLE_TYPE) {
      return WorkspacePermissions.ALL_IAM_ROLE_PERMISSIONS;
    }
    return WorkspacePermissions.ALL_WORKSPACE_PERMISSIONS;
  },

  getAllPermissionsWithoutNone() {
    return _.filter(this.getAllPermissions(), function(p) {
      return p !== WorkspacePermissions.NONE;
    });
  },

  getPermissionOptions() {
    let permissions = _.clone(this.getAllPermissions());

    // Remove 'No Permission' from options list
    if (this.props.hideNoPermissionsOption) {
      permissions = _.clone(this.getAllPermissionsWithoutNone());
    }

    // remove all permissions lower than the inherited permission
    if (this.props.inheritedPermission !== WorkspacePermissions.NONE) {
      while (permissions.length > 0 && permissions[0] !== this.props.inheritedPermission) {
        permissions.shift();
      }
    }

    return _.map(permissions, function(permission) {
      return (<option key={permission} value={permission}>{permission}</option>);
    });
  },

  render() {
    const description = [];
    const allPermissionsWithoutNone = this.getAllPermissionsWithoutNone();

    // If there are one or none permissions to choose from, don't show a select.
    // For example, IAM roles only has one permission: Use. No reason to show the select.
    if (allPermissionsWithoutNone.length <= 1) {
      return <div></div>;
    }

    if (this.props.showPermissionDescriptions) {
      for (const i in allPermissionsWithoutNone) {
        if (!allPermissionsWithoutNone.hasOwnProperty(i)) {
          continue;
        }
        const perm = allPermissionsWithoutNone[i];
        description.push(
          <span key={perm}>
            <i>{perm}</i> - {WorkspacePermissions.permissionToDescription(
              perm, this.props.nodeType, this.props.principalName)}
            <span key={i}><br /><br /></span>
          </span>);
      }

      const docUrl = DbGuideUrls.getDbGuideUrl(DbGuideLinks.ACL_WORKSPACE_URL);
      description.push(
        <span key='link'>
          See the <a target='_blank' href={docUrl}>Databricks Guide</a> to learn more.
        </span>
      );
    }

    const filteredInheritedSourceIds = _.filter(this.props.inheritedSourceIds, function(id) {
      return id.type !== WorkspacePermissions.CLUSTER_ROOT_TYPE;
    });
    if (filteredInheritedSourceIds.length > 0) {
      let links = _.map(filteredInheritedSourceIds, function(id) {
        // TODO(jeffpang/chaoyu): add a link to the permission dialog for this node here
        const name = WorkspacePermissions.getDisplayNameForAclObjectid(id);
        return <i>{name}</i>;
      });
      if (links.length > 1) {
        const last = links.pop();
        if (links.length > 1) {
          links = _.flatten(_.map(links, function(link) {
            return [link, ', '];
          }));
        }
        links.push(' and ', last);
      }

      if (this.props.disabled) {
        description.push(
          <span key={'disabled:' + links}>
            {"Some permissions are inherited from "}
            {links}
            {". To remove these permissions, change the permissions of these folders first."}
          </span>);
      } else {
        description.push(
          <span key={'inherited:' + links}>
            {"Some permissions cannot be removed because they are inherited from "}
            {links}
            {". To remove these permissions, change the permissions of these folders first."}
          </span>);
      }
    }

    let tooltip = null;
    if (description.length > 0) {
      tooltip = (
        <Tooltip text={description}>
          <i className='fa fa-question-circle help-icon' />
        </Tooltip>);
    }

    return (
      <div className='permission-selection'>
        <select
          ref='selector'
          value={this.state.value}
          onChange={this.onChange}
          disabled={this.props.disabled ? true : null}
        >
          {this.getPermissionOptions()}
        </select>
        {tooltip}
      </div>
    );
  },
});

module.exports = PermissionSelection;
