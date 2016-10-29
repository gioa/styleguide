/* eslint consistent-return: 0, func-names: 0 */

import $ from 'jquery';
import Backbone from 'backbone';
import _ from 'underscore';

import WorkspacePermissions from '../acl/WorkspacePermissions';

import { BrowserUtils } from '../user_platform/BrowserUtils';

Backbone.$ = $;

/**
 * AclService for granting permissions on a single workspace, cluster, or /clusters object.
 * The service must be initialized each time to refresh its view of the permissions
 * (otherwise they may be stale).
 *
 * Normal Usage:
 *
 * // this will fetch the model from the server
 * // the model must implement AclModelMixin
 * const aclSvc = new WorkspaceAcl({id: treeNode.id, model: treeNode});
 *
 * // show the current effective permissions for each user
 * // (see the data structure definitions below)
 * const domElems = _.map(avlSvc.currentPermissions(), function(p) {
 *   return <UserRow user={p.user} permission={p.permission} localChanges={p.changed} />
 * });
 *
 * // change some permissions locally (not yet committed to the server)
 * val userId = aclSvc.currentPermissions()[0].user.id
 * aclSvc.setPermission(userId, ["read", "execute", "modify"]);
 *
 * // at this point, avlSvc.currentPermissions() will reflect the local changes made as well
 *
 * // maybe reset some changes made
 * aclSvc.resetChanges(userId);
 *
 * // commit the changes to the server
 * aclSvc.commit({
 *   success: function() { console.log("success!"}; }
 *   error: function() { console.log("failure"); }
 *   sync: true // re-fetch the model from the server after success
 * });
 *
 * The avlSvc.currentPermissions() returns an array of CurrentEffectivePermission, defined as:
 *
 * Principal =
 *   {id: Number, username: String, fullName: String, kind: String}
 *   This gives you enough information to display a principal, where kind = {user, group}
 *
 * EffectivePermission =
 *   {permission: String, sourceIds: Array<{type: String, id: String}>}
 *   This refers to one permission on an object (e.g., Read, Modify). The sourceIds are the
 *   ancestor IDs that contributed this permission to this object. In other words, in order
 *   to deny this permission, it must be removed from all the sourceId objects.
 *
 * CurrentEffectivePermission =
 *   {user: Principal, permission: Array<EffectivePermission>, changed: Boolean}
 *   This gives you the effective permissions on this object for a user. The effective
 *   permissions include changes that are made locally on the model and are not yet committed.
 *   If there are local changes, changed is true.
 *
 *
 * Evaluate a Move Usage:
 *
 * // this will fetch the effective permissions if id were moved as a child of moveTargetId
 * const aclSvc = new WorkspaceAcl({
 *   id: treeNode.id,
 *   model: treeNode,
 *   moveTargetId: newParentNode.id
 * });
 *
 */
const WorkspaceAcl = Backbone.Model.extend({

  urlRoot: '/acl',

  url() {
    const objType = this.get('model').getAclObjectType();
    const objId = this.get('model').getAclObjectId();

    if (this.get('moveTargetId')) {
      // we are evaluating the permissions of this object as if it were moved under a new parent
      return this.urlRoot + '/' + objType + '/' + objId + '/moveEffective/' +
        this.get('moveTargetId');
    }
    // we are evaluating the permissions of this object in its current location
    return this.urlRoot + '/' + objType + '/' + objId + '/listEffective';
  },

  // The acl object id for this object which is a {type: string, id: {string,number}} struct
  aclId() {
    return { type: this.get('model').getAclObjectType(), id: this.get('model').getAclObjectId() };
  },

  defaults: {
    // treeNode ID of the object
    id: null,
    // (optional) the id of the target parent node to move this node into
    moveTargetId: null,
    // the current list of UserEffectivePermissions on this object, this contains all users
    permissions: [],
    // the set of local UserPermission changes to permissions, map from userId -> permission
    changes: {},
  },

  initialize(attrs) {
    // some checks to fail fast
    if (!attrs.model) {
      throw new Error('WorkspaceAcl created without an model');
    }
    if (!attrs.model.getAclObjectType) {
      throw new Error('WorkspaceAcl model does not have getAclObjectType()');
    }
    if (!attrs.model.getAclObjectId) {
      throw new Error('WorkspaceAcl model does not have getAclObjectId()');
    }
  },

  _addAclId(list, item) {
    const contains = _.find(list, function(i) {
      return _.isEqual(i, item);
    });
    if (contains) {
      return list;
    }
    return list.concat([item]);
  },

  _removeAclId(list, item) {
    return _.filter(list, function(i) {
      return !_.isEqual(i, item);
    });
  },

  // given the existing effective permissions and the proposed changes,
  // return the new effective permissions with the changes applied
  _mergePermissions(effective, changes) {
    const newPerms = [];
    _.each(WorkspacePermissions.ALL_ACTIONS, function(perm) {
      const changesContains = _.contains(changes, perm);
      const eperm = _.find(effective, function(someEperm) {
        return someEperm.permission === perm;
      });
      const effectiveContains = !_.isUndefined(eperm);
      let newSourceIds;
      if (!changesContains && !effectiveContains) {
        // neither the existing permissions or the changes have this permission
      } else if (changesContains && !effectiveContains) {
        // new permission granted on this object
        newPerms.push({ permission: perm, sourceIds: [this.aclId()] });
      } else if (changesContains && effectiveContains) {
        // possibly granted permission on object that as already effective
        newSourceIds = this._addAclId(eperm.sourceIds, this.aclId());
        newPerms.push({ permission: perm, sourceIds: newSourceIds });
      } else { // !changesContains && effectiveContains
        // possibly removed a permission on the object, see if it is still effective
        newSourceIds = this._removeAclId(eperm.sourceIds, this.aclId());
        if (newSourceIds.length > 0) {
          newPerms.push({ permission: perm, sourceIds: newSourceIds });
        }
      }
    }, this);
    return newPerms;
  },

  /**
   * Get the current effective permissions for all users, reflecting all local changes made
   * and are not yet committed.
   *
   * @returns {Array<object>} an array of CurrentEffectivePermissions
   */
  currentPermissions() {
    return _.map(this.get('permissions'), function(eperm) {
      const userId = eperm.user.id;
      const changes = this.get('changes')[userId];
      if (!_.isNull(changes) && !_.isUndefined(changes)) {
        return {
          user: eperm.user,
          permission: this._mergePermissions(eperm.permission, changes),
          changed: true,
        };
      }
      return {
        user: eperm.user,
        permission: eperm.permission,
        changed: false,
      };
    }, this);
  },

  /**
   * Set the permission for the user. Does NOT persist this change until you call commit.
   * Usage example:
   *
   * val userId = aclSvc.currentPermissions()[0].user.id
   * aclSvc.setPermission(userId, ["read", "execute", "modify"]);
   *
   * @param {number} userId
   * @param {Array<string>} newPermission
   */
  setPermission(userId, newPermission) {
    const newChanges = _.clone(this.get('changes'));
    newChanges[String(userId)] = newPermission;
    this.set({ changes: newChanges });
    // Send usage metrics with full permission change details
    const tags = WorkspacePermissions.toUsageTags(newPermission);
    tags.changeType = 'set';
    tags.aclUserId = String(userId);
    window.recordEvent('aclChange', BrowserUtils.getMeasurementTags(tags));
  },

  /**
   * Reset all local changes of permissions for the user. Usage example:
   *
   * val userId = aclSvc.currentPermissions()[0].user.id
   * aclSvc.setPermission(userId, ["read", "execute", "modify"]);
   * ...
   * aclSvc.resetChanges(userId);
   *
   * @param {number} userId
   */
  resetChanges(userId) {
    const newChanges = _.omit(this.get('changes'), String(userId));
    this.set({ changes: newChanges });
  },

  /**
   * Reset all the local acl changes made locally. Usage example:
   *
   * aclSvc.setPermission(user1, ["read", "execute", "modify"]);
   * aclSvc.setPermission(user2, ["read", "execute", "modify"]);
   * ...
   * aclSvc.resetAllChanges()
   */
  resetAllChanges() {
    this.set({ changes: {} });
    // Send usage metrics with permission change details
    window.recordEvent('aclChange', BrowserUtils.getMeasurementTags({ 'changeType': 'reset' }));
  },

  hasChanges() {
    return !_.isEmpty(this.get('changes'));
  },

  hasRemovedManagePermission() {
    if (window.settings && window.settings.isAdmin) {
      return false; // admins group always have MANAGE permission
    }
    const userPerm = this.getUserCurrentPermission();
    const usersGroupPerm = this.getUsersGroupCurrentPermission();

    return (userPerm !== WorkspacePermissions.MANAGE &&
            usersGroupPerm !== WorkspacePermissions.MANAGE);
  },

  /**
   * Saves all pending ACL changes. As the dialog is changed there are NOT any changes persisted
   * until the user clicks the Save box which calls commit.
   *
   * @param options hash containing callbacks for success and error. The sync option
   *   will synchronize the model with the server after a successful commit (default = false).
   *   If you do not sync the model, the state is no longer valid after success.
   * @return jQuery promise. This does not have to be used.
   */
  commit(options) {
    const objType = this.get('model').getAclObjectType();
    const objId = this.get('model').getAclObjectId();

    const _this = this;
    const data = {
      type: 'set',
      permissions: this.get('changes'),
    };

    // Send usage metrics with full permission change details
    window.recordEvent(
        'aclChange',
        BrowserUtils.getMeasurementTags({ 'changeType': 'save' }),
        JSON.stringify(this.get('changes')));

    return $.ajax({
      type: 'POST',
      url: this.urlRoot + '/' + objType + '/' + objId,
      data: JSON.stringify(data),
      success() {
        if (options.sync) {
          // fetch the model after successfully committing changes
          _this.set({ changes: {} });
          _this.fetch();
        }
        if (options.success) {
          options.success();
        }
      },
      error() {
        if (options.error) {
          options.error();
        }
      },
    });
  },

  isEqual(that, option) {
    option = option || {};
    const nodeType = this.get('model').getAclObjectType();
    function getPermissionsList(permissions) {
      const permissionList = _.map(permissions, function(userPerm) {
        return {
          userId: userPerm.user.id,
          // PROD-12180 convert the list of permissions into the permission that the frontend uses
          permissions: WorkspacePermissions.getCurrentPermission(userPerm, nodeType),
        };
      });
      return _.sortBy(permissionList, function(userPerm) {
        return userPerm.userId;
      });
    }
    let thisPermissions = getPermissionsList(this.currentPermissions());
    let thatPermissions = getPermissionsList(that.currentPermissions());

    if (option.ignoreCurrentUser) {
      const currentUserId = window.settings && window.settings.userId;
      const filter = function(userPerm) {
        return userPerm.userId === currentUserId;
      };
      thisPermissions = _.reject(thisPermissions, filter);
      thatPermissions = _.reject(thatPermissions, filter);
    }
    return _.isEqual(thisPermissions, thatPermissions);
  },

  _findCurrentPermission(userName) {
    const currentPermissions = this.currentPermissions();
    return _.find(currentPermissions, function(userPerm) {
      return userPerm.user.username === userName;
    });
  },

  // return users groups' current permission
  getUsersGroupCurrentPermission() {
    return WorkspacePermissions.getCurrentPermission(
      this._findCurrentPermission('users'),
      this.get('model').getAclObjectType()
    );
  },

  // return current user's current permission
  getUserCurrentPermission() {
    if (!window.settings) {
      return;
    }
    return WorkspacePermissions.getCurrentPermission(
      this._findCurrentPermission(window.settings.user),
      this.get('model').getAclObjectType()
    );
  },

  /**
   * Return boolean indicating whether user has a given permission.
   * Does not take into account group permissions.
   */
  userHasPermission(user, permission) {
    let hasPermission = false;
    const userPerms = _.find(this.currentPermissions(), function(effectivePerm) {
      return effectivePerm.user.id === user.id;
    });

    if (userPerms) {
      userPerms.permission.forEach(function(perm) {
        if (perm.permission === permission) {
          hasPermission = true;
        }
      });
    }

    return hasPermission;
  },
});

module.exports = WorkspaceAcl;
