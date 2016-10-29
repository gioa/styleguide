import _ from 'underscore';
import Backbone from 'backbone';

import AclModelMixin from '../acl/AclModelMixin';
import WorkspacePermissions from '../acl/WorkspacePermissions';

const TreeNode = Backbone.Model.extend({
  defaults: {
    globalVars: {},
  },

  urlRoot: '/tree',

  getName() {
    return this.get('name');
  },

  // the object type in the acl handler
  getAclObjectType() { return WorkspacePermissions.WORKSPACE_TYPE; },

  // the id of the object in the acl handler
  getAclObjectId() { return this.id; },
});

_.extend(TreeNode.prototype, AclModelMixin);

module.exports = TreeNode;
