/* eslint react/prefer-es6-class: 0, func-names: 0 */

import _ from 'underscore';
import React from 'react';

import PermissionList from '../acl/PermissionList.jsx';
import AddPermissionView from '../acl/AddPermissionView.jsx';
import WorkspaceAcl from '../acl/WorkspaceAcl';
import WorkspacePermissions from '../acl/WorkspacePermissions';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';
import ReactModal from '../ui_building_blocks/dialogs/ReactModal.jsx';
import ReactModalUtils from '../ui_building_blocks/dialogs/ReactModalUtils';

const viewName = 'PermissionEditView';

const PermissionEditView = React.createClass({

  propTypes: {
    workspaceAcl: React.PropTypes.instanceOf(WorkspaceAcl).isRequired,
  },

  getInitialState() {
    return {
      currentPermissions: this.props.workspaceAcl.currentPermissions(),
      loading: false,
    };
  },

  componentDidMount() {
    this.props.workspaceAcl.on('change', this.forceUpdate.bind(this, null), this);
  },

  componentWillUnmount() {
    this.props.workspaceAcl.off(null, null, this);
  },

  _confirm() {
    if (!this.props.workspaceAcl.hasChanges()) {
      return;
    }

    window.recordEvent('aclChange', { 'aclChangeOrigin': viewName });

    const commitChanges = () => {
      this.props.workspaceAcl.commit({
        sync: true,
        success: this._destroyModal,
        error: this._showError,
      });
      this.setState({ loading: true });
    };

    if (this.props.workspaceAcl.hasRemovedManagePermission()) {
      DeprecatedDialogBox.confirm({
        messageHTML: '<p>You are removing your <b>' + WorkspacePermissions.MANAGE + '</b> ' +
          "permission on this item and you won't be able to view or change permissions on this " +
          ' item any more. Are you sure you want to continue?</p>',
        confirmButton: 'Yes, Remove my manage permission',
        cancelButton: 'No, Cancel',
        confirm: commitChanges,
      });
    } else {
      commitChanges();
    }
  },

  _showError(err) {
    this.setState({ loading: false });
    // TODO(Chaoyu): set error state and display error message
    console.error(err);
  },

  _cancel() {
    this.props.workspaceAcl.resetAllChanges();
    this._destroyModal();
  },

  _destroyModal() {
    ReactModalUtils.destroyModal();
  },

  _getFooter(hasChanges) {
    const confirmLink = hasChanges ? (
      <a
        className='btn btn-primary confirm-button'
        data-action='save'
        onClick={this._confirm}
      >Save Changes</a>) : (
        <a
          className='btn btn-primary confirm-button'
          data-action='done'
          onClick={this._destroyModal}
        >Done</a>);

    const cancelLink = hasChanges ? (
      <a className='btn'
        data-action='cancel'
        onClick={this._cancel}
      >
        Cancel
      </a>) : null;

    return (<div>
      {cancelLink}
      {confirmLink}
    </div>);
  },

  render() {
    const workspaceAcl = this.props.workspaceAcl;
    const hasChanges = workspaceAcl.hasChanges();

    const header = (<h4>Permission Settings for:
      <p className='title'>{workspaceAcl.get('model').getName()}</p>
    </h4>);

    const body = <PermissionEditBody workspaceAcl={this.props.workspaceAcl} />;

    const footer = this._getFooter(hasChanges);

    return (
      <ReactModal
        modalName='workspace-acl'
        header={header}
        body={body}
        footer={footer}
      />);
  },
});

const PermissionEditBody = React.createClass({
  propTypes: {
    workspaceAcl: React.PropTypes.instanceOf(WorkspaceAcl).isRequired,
  },

  onAddPermission(userPerm) {
    const self = this;
    _.defer(function() {
      // TODO(lauren/someone) refactor this
      if (self.isMounted() && self.refs.userList.refs[userPerm.user.id]) {
        const userRow = self.refs.userList.refs[userPerm.user.id];
        userRow.scrollIntoView(false);
      }
    });
  },

  render() {
    const workspaceAcl = this.props.workspaceAcl;
    const node = workspaceAcl.get('model');
    const hasChanges = workspaceAcl.hasChanges();
    const currentPermissions = workspaceAcl.currentPermissions();

    const usersWithAccess = _.filter(currentPermissions, function(p) {
      return !_.isEmpty(p.permission);
    });
    const usersWithoutAccess = _.filter(currentPermissions, function(p) {
      return _.isEmpty(p.permission);
    });

    const hint = hasChanges ? (<span className='save-changes-hint'>
      You have made changes that you need to save
    </span>) : null;

    const setPermission = workspaceAcl.setPermission.bind(workspaceAcl);

    return (<div>
      <p className='user-list-title'>Who has access: {hint}</p>
      <PermissionList
        ref={"userList"}
        permissions={usersWithAccess}
        setPermission={setPermission}
        node={node}
      />

      <p className='add-user-title'>Add Users and Groups:</p>
      <AddPermissionView
        permissions={usersWithoutAccess}
        setPermission={setPermission}
        onAddPermission={this.onAddPermission}
        nodeType={WorkspacePermissions.getNodeType(node)}
      />
    </div>);
  },
});

module.exports.PermissionEditBody = PermissionEditBody;
module.exports.PermissionEditView = PermissionEditView;
