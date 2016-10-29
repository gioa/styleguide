import $ from 'jquery';

import WorkspaceAcl from '../acl/WorkspaceAcl';
import WorkspacePermissions from '../acl/WorkspacePermissions';

/**
 * A mixin that should be mixed into all TreeNode models that have permissions
 * (e.g., TreeNode and NotebookModel). Use this.fetchPermissions() to set the current
 * user's permissions on the node (should only be called once each time you want
 * to refresh permissions). This will set two attributes:
 *
 *   permissionLevel - current user's permissions on this node
 *   workspaceAcl - if the current user has manage permissions on this object, the
 *     WorkspaceAcl model used to change the permissions of this object.
 *
 * Models that use this mixin MUST implement:
 *
 * // returns string
 * // the id of this acl object in the acl handler (typically id)
 * getAclObjectId: function() { ... }
 *
 * // returns string
 * // the type of acl object this is; one of {workspace, cluster, cluster_root}
 * getAclObjectType: function() { ... }
 *
 * TODO(jeffpang): eventually this mixin will go away when we will propagate the ACL
 * information in the TreeNodes directly as part of the normal delta collection receiver.
 */
const AclModelMixin = {

  /**
   * Fetch the current user's permission level and, if he has manage permissions, the
   * WorkspaceAcl object used to manage this node's permissions.
   */
  fetchPermissions(onSuccess) {
    return this.fetchPermissionLevel(function successFunc() {
      if (this.getPermissionLevel() === WorkspacePermissions.MANAGE) {
        this.fetchWorkspaceAcl(onSuccess);
      } else if (onSuccess) {
        onSuccess.call(this);
      }
    });
  },

  /** Fetch the current user's permissions on this node and set the permissionLevel attribute */
  fetchPermissionLevel(onSuccess) {
    const nodeType = this.getAclObjectType();

    return $.ajax({
      url: '/acl/' + this.getAclObjectType() + '/' + this.getAclObjectId() + '/list',
      type: 'GET',
      context: this,
      success(resp) {
        this.set({
          permissionLevel: WorkspacePermissions.actionsToPermission(resp, nodeType),
        });
        if (onSuccess) {
          onSuccess.call(this);
        }
      },
      error(xhr, textStatus) {
        // TODO(jeffpang): possibly show a dialog here. Don't show one now since this will
        // duplicate the dialog for permission denied on the command collection
        if (textStatus !== 'abort') {
          // (PROD-10953) error hook of ajax call is triggered if ajax call is aborted
          const aclObjectId = this ? this.getAclObjectId() : '';
          console.error('failed to fetch permissions for node ' + aclObjectId);
        }
      },
    });
  },

  /** Fetch the workspace permissions object used to manage permissions on this object */
  fetchWorkspaceAcl(onSuccess) {
    const workspaceAcl = new WorkspaceAcl({
      id: this.getAclObjectId(),
      name: this.getName(),
      // save a reference to the tree node model which contains the workspaceAcl model
      model: this,
    });

    workspaceAcl.fetch({
      success: function success(_workspaceAcl) {
        this.set({ workspaceAcl: _workspaceAcl });
        if (onSuccess) {
          onSuccess.call(this, _workspaceAcl);
        }
      }.bind(this),
    });
  },

  /** Get the current user's permission level on this object */
  getPermissionLevel() {
    return this.get('permissionLevel') ? this.get('permissionLevel') : WorkspacePermissions.NONE;
  },

  /** True iff 'permissionLevel' has been set on the object */
  permissionsHaveBeenFetched() {
    return !!this.get('permissionLevel');
  },

  /** True iff the current user can view this object */
  canView() {
    return WorkspacePermissions.canView(this.getPermissionLevel());
  },

  /** True iff the current user can edit this object */
  canEdit() {
    return WorkspacePermissions.canEdit(this.getPermissionLevel());
  },

  /** True iff the current user can manage permissions of this object */
  canManage() {
    return WorkspacePermissions.canManage(this.getPermissionLevel());
  },

  /** True iff the current user can attach to a given cluster */
  canAttach() {
    return WorkspacePermissions.canAttach(this.getPermissionLevel());
  },

  /** True iff the current user can restart a given cluster */
  canRestart() {
    return WorkspacePermissions.canRestart(this.getPermissionLevel());
  },

  /** True iff the current user can create clusters */
  canCreateClusters() {
    return WorkspacePermissions.canCreateClusters(this.getPermissionLevel());
  },

  /** True iff the current user can run this object */
  canRun() {
    return WorkspacePermissions.canRun(this.getPermissionLevel());
  },
};

module.exports = AclModelMixin;
