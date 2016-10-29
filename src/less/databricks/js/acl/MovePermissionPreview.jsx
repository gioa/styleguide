/* eslint react/prefer-es6-class: 0, func-names: 0 */

import _ from 'underscore';
import React from 'react';

import PermissionList from '../acl/PermissionList.jsx';
import WorkspaceAcl from '../acl/WorkspaceAcl';
import WorkspacePermissions from '../acl/WorkspacePermissions';

import ReactModal from '../ui_building_blocks/dialogs/ReactModal.jsx';
import ReactModalUtils from '../ui_building_blocks/dialogs/ReactModalUtils';

const MovePermissionPreview = React.createClass({

  propTypes: {
    workspaceAcl: React.PropTypes.instanceOf(WorkspaceAcl).isRequired,
    previewWorkspaceAcl: React.PropTypes.instanceOf(WorkspaceAcl).isRequired,
    onConfirm: React.PropTypes.func,
  },

  _confirm() {
    if (this.props.onConfirm) {
      this.props.onConfirm();
    }
    this._destroyModal();
  },

  _destroyModal() {
    ReactModalUtils.destroyModal();
  },

  _getFooter() {
    return (
      <div>
        <a className='btn' onClick={this._destroyModal}>
          Cancel
        </a>
        <a className='btn btn-primary confirm-button' onClick={this._confirm}>
          Confirm and Move
        </a>
      </div>);
  },

  _setAffectedUsers(currentPermissions, previewPermissions) {
    const nodeType = this.props.workspaceAcl.get('model').getAclObjectType();
    _.each(currentPermissions, function(userPerm) {
      const userId = userPerm.user.id;
      const previewUserPerm = _.find(previewPermissions, function(_previewUserPerm) {
        return _previewUserPerm.user.id === userId;
      });

      const currentPerm = WorkspacePermissions.getCurrentPermission(userPerm, nodeType);
      const previewPerm = WorkspacePermissions.getCurrentPermission(previewUserPerm, nodeType);

      // TODO(Chaoyu): should use group information to decide whether the actual permission has
      // been affected, Right now this will skip current user since it must still has MANAGE
      // permission here, but for other users it may show 'affected' without taking acount of the
      // group permission
      if (currentPerm !== previewPerm && userId !== window.settings.userId) {
        userPerm.affected = true;
        previewUserPerm.affected = true;
      } else {
        userPerm.affected = false;
        previewUserPerm.affected = false;
      }
    });
  },

  render() {
    let currentPermissions = this.props.workspaceAcl.currentPermissions();
    let previewPermissions = this.props.previewWorkspaceAcl.currentPermissions();

    this._setAffectedUsers(currentPermissions, previewPermissions);

    currentPermissions = _.filter(currentPermissions, function(userPerm) {
      return userPerm.affected;
    });
    previewPermissions = _.filter(previewPermissions, function(userPerm) {
      return userPerm.affected;
    });

    const header = (<h4>Permissions changes after moving:
      <p className='title'>{this.props.workspaceAcl.get('name')}</p>
    </h4>);

    const body = (<div className='preview-lists-wrapper'>
      <div className='permission-list current'>
        <p className='user-list-title'>Current Permissions:</p>
        <PermissionList
          ref={"userList"}
          permissions={currentPermissions}
          node={this.props.workspaceAcl.get('model')}
          viewOnly
        />
      </div>

      <div className='permission-list after'>
        <p className='user-list-title'>Permissions after move:</p>
        <PermissionList
          ref={"userList"}
          permissions={previewPermissions}
          node={this.props.previewWorkspaceAcl.get('model')}
          viewOnly
        />
      </div>
    </div>);

    return (
      <ReactModal
        modalName='workspace-acl'
        classes={"move-preview"}
        header={header}
        body={body}
        footer={this._getFooter()}
      />);
  },
});

module.exports = MovePermissionPreview;
