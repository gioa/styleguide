/* eslint react/prefer-es6-class: 0 */

import _ from 'underscore';
import React from 'react';
import ClassNames from 'classnames';

import PermissionSelection from '../acl/PermissionSelection.jsx';
import WorkspacePermissions from '../acl/WorkspacePermissions';

import NavFunc from '../filetree/NavFunc.jsx';

/**
 * Used by PermissionEditView to create the list of users/groups who currently
 * have permissions on the given object.
 */
const PermissionList = React.createClass({
  propTypes: {
    permissions: React.PropTypes.array.isRequired,
    setPermission: React.PropTypes.func,
    node: React.PropTypes.object,
    viewOnly: React.PropTypes.bool,
  },

  getDefaultProps() {
    return {
      viewOnly: false,
      setPermission() {},
    };
  },

  setPermission(userId, value) {
    this.props.setPermission(
      userId,
      WorkspacePermissions.toActions(value, this.props.node.getAclObjectType())
    );
  },

  clearPermission(userId) {
    this.props.setPermission(userId, []);
  },

  _getSortedPermissions() {
    return _.sortBy(this.props.permissions, function extractUsername(userPerm) {
      const username = userPerm.user.fullName.trim();
      return userPerm.affected ? username.toUpperCase() : username.toLowerCase();
    });
  },

  _getCurrentPermission(userPerm, node) {
    return WorkspacePermissions.getCurrentPermission(userPerm, node.getAclObjectType());
  },

  _getInheritedPermission(userPerm, node) {
    return WorkspacePermissions.getInheritedPermission(userPerm, node);
  },

  _getInheritedSourceIds(userPerm, node) {
    return WorkspacePermissions.getInheritedSourceIds(userPerm, node);
  },

  render() {
    const permissions = this._getSortedPermissions();

    return (<div className='acl-user-list'>{
      _.map(permissions, function renderSinglePermission(userPerm) {
        const icon = userPerm.user.kind === 'group' ? 'fa-users' : 'fa-user';
        const subName = userPerm.user.kind === 'group' ? 'group' : userPerm.user.username;
        const classes = ClassNames({
          'acl-user': true,
          'changed': userPerm.changed || userPerm.affected,
        });
        const node = this.props.node;
        const inheritedPermission = this._getInheritedPermission(userPerm, node);
        const hasInheritPermission = inheritedPermission !== WorkspacePermissions.NONE;
        const isAdminGroupOnRoot = node.id === 0 && userPerm.user.kind === 'group' &&
          userPerm.user.username === 'admins';
        const isHomeFolderOwner = NavFunc.isHomeFolderForUser(node, userPerm.user.id);
        const viewOnly = isAdminGroupOnRoot || isHomeFolderOwner || this.props.viewOnly;
        const boundClearPermission = this.clearPermission.bind(this, userPerm.user.id);
        const removeButton = (hasInheritPermission || viewOnly) ? null : (
          <div className='acl-user-control'>
            <a data-action='remove'
              onClick={boundClearPermission}
            >
              <i className='fa fa-times'></i>
            </a>
          </div>
        );

        return (
          <div className={classes}
            data-user={userPerm.user.username}
            key={userPerm.user.id}
            ref={userPerm.user.id}
          >
            <div
              ref='acl-user-name'
              className='acl-user-name ellipsis'
              title={userPerm.user.username}
            >
              <i className={'fa fa-fw ' + icon}></i> {userPerm.user.fullName}
              <span ref='user-email' className='user-email'>({subName})</span>
            </div>
            <div className='acl-user-permission'>
              <PermissionSelection
                ref='permission-selection'
                principalName={userPerm.user.fullName}
                nodeType={WorkspacePermissions.getNodeType(node)}
                currentPermission={this._getCurrentPermission(userPerm, node)}
                inheritedPermission={inheritedPermission}
                inheritedSourceIds={this._getInheritedSourceIds(userPerm, node)}
                onChange={_.partial(this.setPermission, userPerm.user.id)}
                disabled={viewOnly}
              />
            </div>
            {removeButton}
          </div>);
      }, this)
    }</div>);
  },
});

module.exports = PermissionList;
