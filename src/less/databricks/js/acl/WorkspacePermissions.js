/* eslint complexity: 0, global-require: 0, func-names: 0 */

/**
 * Constants for Workspace, Cluster & Job ACL Permissions
 * @NOTE(lrichie) 3-30-16: right now job ACLs are only (and always) used when cluster ACLs are
 * enabled, to disable modify & execute permissions for everyone except the creator of a job.
 * Users cannot configure jobs ACLs at the moment.
 */

import _ from 'underscore';

// acl object types. each type can have a different set of display permissions
const WORKSPACE_TYPE = 'workspace';
const CLUSTER_ROOT_TYPE = 'cluster_root';
const CLUSTER_TYPE = 'cluster';
const MOUNTPOINT_TYPE = 'mount';
const JOB_ROOT_TYPE = 'job_root';
const JOB_TYPE = 'job';
const IAM_ROLE_TYPE = 'instance-profiles';
const IAM_ROOT_TYPE = 'instance-profiles_root';

// workspace display permissions
const NONE = 'No Permissions';
const VIEW = 'Can Read';
const RUN = 'Can Run';
const EDIT = 'Can Edit';
// cluster-specific display permissions
const ATTACH = 'Can Attach To';
const RESTART = 'Can Restart';
const CREATE_CLUSTERS = 'Can Create Clusters';
// job-specific display permissions
const CREATE_JOBS = 'Can Create Jobs';
// instance profile-specific display permissions
const USE_ROLE = 'Can Use IAM Role';
// shared display permissions
const MANAGE = 'Can Manage';

/**
 * Workspace actions:
 * Note that ClusterCreateAction is specific to the /clusters object. It is handled differently
 * than all the other actions, as it is not used on specific clusters or in the edit permissions
 * dialog, and doesn't follow the same pattern mapping to display strings to show to the user.
 * (If & when we allow users to configure job ACLs, the same will be true for JobCreateAction)
 */
const ReadAction = 'read',
  ExecuteAction = 'execute',
  ModifyAction = 'modify',
  CreateAction = 'create',
  RemoveAction = 'remove',
    // cluster actions
  ClusterCreateAction = 'cluster_create',
  AttachAction = 'attach',
  RestartAction = 'restart',
    // job actions
  JobCreateAction = 'job_create',
    // instance profile actions
  InstanceProfileUseAction = 'instance_profile_use',
    // shared actions
  ModifyPermissionsAction = 'modify_permissions',
  AllAction = '*';

const permissionToActions = {};
permissionToActions[NONE] = [];
permissionToActions[VIEW] = [ReadAction];
permissionToActions[RUN] = [ReadAction, ExecuteAction];
permissionToActions[EDIT] = [ReadAction, ExecuteAction, ModifyAction];
permissionToActions[MANAGE] = [ReadAction, ExecuteAction, ModifyAction, CreateAction,
  RemoveAction, ModifyPermissionsAction];

const clusterPermissionToActions = {};
clusterPermissionToActions[NONE] = [];
clusterPermissionToActions[ATTACH] = [AttachAction];
clusterPermissionToActions[RESTART] = [AttachAction, RestartAction];
clusterPermissionToActions[MANAGE] = [AttachAction, RestartAction, AllAction];

const iamPermissionToActions = {};
iamPermissionToActions[NONE] = [];
iamPermissionToActions[USE_ROLE] = [InstanceProfileUseAction];

const notebookDescription = {};
notebookDescription[NONE] = 'has no permissions';
notebookDescription[VIEW] = 'can view and comment on the notebook';
notebookDescription[RUN] = 'can view, comment, attach/detach, and run commands in the notebook';
notebookDescription[EDIT] =
  'can view, comment, attach/detach, run commands, and edit the notebook';
notebookDescription[MANAGE] =
  'can view, comment, attach/detach, run commands, edit, and change permissions ' +
  'of the notebook';

const folderDescription = {};
folderDescription[VIEW] = 'can view and comment on notebooks in the folder';
folderDescription[RUN] = 'can view, comment, attach/detach, and run commands ' +
  'in notebooks in the folder';
folderDescription[EDIT] =
  'can view, comment, attach/detach, run commands, and edit notebooks in the folder';
folderDescription[MANAGE] =
  folderDescription[EDIT] + ', ' +
  'and can create, delete, and change permissions of items in the folder';

// do not need to encode Read, because it is implicit that users across organizations
// cannot see other users’ clusters
const clusterDescription = {};
clusterDescription[NONE] = 'has no permissions';
clusterDescription[ATTACH] = 'can attach to cluster';
clusterDescription[RESTART] = 'can attach to and restart cluster';
clusterDescription[MANAGE] = 'can attach to, restart, delete, resize cluster';

// nodeType -> permission -> description of permission for this nodeType
const permissionToDescription = {
  shell: notebookDescription,
  folder: folderDescription,
  cluster: clusterDescription,
};

/** All permissions in ascending order of access controls. */
const allWorkspacePermissions = [NONE, VIEW, RUN, EDIT, MANAGE];
const allClusterPermissions = [NONE, ATTACH, RESTART, MANAGE];
const allIamRolePermissions = [USE_ROLE];

const allActions = [ReadAction, ExecuteAction, ModifyAction, CreateAction, RemoveAction,
  ClusterCreateAction, AttachAction, RestartAction, InstanceProfileUseAction,
  ModifyPermissionsAction, AllAction];

const actionsToPermissionJobRoot = (actions) => {
  if (_.contains(actions, AllAction)) {
    return MANAGE;
  } else if (_.contains(actions, JobCreateAction)) {
    return CREATE_JOBS;
  }
  return NONE;
};

/** Convert a list of actions to the corresponding workspace permission */
const actionsToPermission = function(actions, nodeType) {
  if (nodeType === CLUSTER_TYPE) {
    if (_.contains(actions, AllAction) || _.contains(actions, ModifyPermissionsAction)) {
      return MANAGE;
    } else if (_.contains(actions, AttachAction) && !_.contains(actions, RestartAction)) {
      return ATTACH;
    } else if (_.contains(actions, RestartAction)) {
      return RESTART;
    }
    return NONE;
  } else if (nodeType === CLUSTER_ROOT_TYPE) {
    if (_.contains(actions, AllAction)) {
      return MANAGE;
    } else if (_.contains(actions, ClusterCreateAction)) {
      return CREATE_CLUSTERS;
    }
    return NONE;
  } else if (nodeType === WORKSPACE_TYPE || nodeType === JOB_TYPE) {
    if (_.contains(actions, AllAction) || _.contains(actions, ModifyPermissionsAction)) {
      return MANAGE;
    } else if (_.contains(actions, ModifyAction)) {
      return EDIT;
    } else if (_.contains(actions, ExecuteAction)) {
      return RUN;
    } else if (_.contains(actions, ReadAction)) {
      return VIEW;
    }
    return NONE;
  } else if (nodeType === JOB_ROOT_TYPE) {
    return actionsToPermissionJobRoot(actions);
  } else if (nodeType === IAM_ROLE_TYPE) {
    return _.contains(actions, InstanceProfileUseAction) ? USE_ROLE : NONE;
  }
  throw new Error('unknown nodeType: ' + nodeType);
};

/** Given a UserEffectivePermissions list that contains Actions, return the display permission */
const getCurrentPermission = function(userPerm, nodeType) {
  const actions = userPerm ? _.map(userPerm.permission, function(p) { return p.permission; }) : [];
  return actionsToPermission(actions, nodeType);
};

/** Given the UserEffectivePermissions list, return the greatest inherited display permission */
const getInheritedPermission = function(userPerm, node) {
  const inherited = _.filter(userPerm.permission, function(p) {
    return !_.isUndefined(_.find(p.sourceIds, function(id) {
      return id.type !== node.getAclObjectType() || id.id !== node.getAclObjectId();
    }));
  });
  const actions = _.map(inherited, function(p) { return p.permission; });
  return actionsToPermission(actions, node.getAclObjectType());
};

/**
 * Given the UserEffectivePermissions list, return an array of folder names that node inherits
 * permissions from.
 */
const getInheritedSourceIds = function(userPerm, node) {
  const sourceLists = _.map(userPerm.permission, function(p) { return p.sourceIds; });
  const filteredSourceLists = _.filter(_.flatten(sourceLists), function(id) {
    return id.type !== node.getAclObjectType() || id.id !== node.getAclObjectId();
  });
  return _.uniq(filteredSourceLists, function(id) { return id.type + ':' + id.id; });
};

/**
 * Given an Acl Object ID, return the display name for the object that it points to.
 */
const getDisplayNameForAclObjectid = function(id) {
  // included here to avoid circular reference
  const NavFunc = require('../filetree/NavFunc.jsx');

  if (id.type === WORKSPACE_TYPE) {
    let path = NavFunc.getFullPath(id.id);
    if (path === '/') {
      path = 'Workspace Root: /';
    }
    return path;
  } else if (id.type === CLUSTER_TYPE) {
    const cluster = window.clusterList.findWhere({ clusterId: id.id });
    return cluster ? cluster.get('clusterName') : '???';
  } else if (id.type === CLUSTER_ROOT_TYPE) {
    return 'All Clusters';
  }
  throw new Error('unknown acl object id type: ', id.type);
};

const jobRunCreateClusterWarning = 'Warning: You do not have permissions to create clusters. ' +
  'This job will fail if run on a new cluster. To create new clusters, please ask your ' +
  'administrator for permission.';
const noViewPermissionsWarning = 'You do not have permissions to view this. ' +
  'Please contact your administrator.';

const WorkspacePermissions = {
  ReadAction: ReadAction,
  ExecuteAction: ExecuteAction,
  ModifyAction: ModifyAction,
  CreateAction: CreateAction,
  RemoveAction: RemoveAction,
  // cluster actions
  ClusterCreateAction: ClusterCreateAction,
  AttachAction: AttachAction,
  RestartAction: RestartAction,
  // job actions
  JobCreateAction: JobCreateAction,
  // IAM role actions
  InstanceProfileUseAction: InstanceProfileUseAction,
  // shared actions
  ModifyPermissionsAction: ModifyPermissionsAction,
  AllAction: AllAction,

  WORKSPACE_TYPE: WORKSPACE_TYPE,
  CLUSTER_ROOT_TYPE: CLUSTER_ROOT_TYPE,
  CLUSTER_TYPE: CLUSTER_TYPE,
  MOUNTPOINT_TYPE: MOUNTPOINT_TYPE,
  JOB_TYPE: JOB_TYPE,
  JOB_ROOT_TYPE: JOB_ROOT_TYPE,
  IAM_ROLE_TYPE: IAM_ROLE_TYPE,
  IAM_ROOT_TYPE: IAM_ROOT_TYPE,

  NONE: NONE,
  VIEW: VIEW,
  RUN: RUN,
  EDIT: EDIT,
  // cluster
  ATTACH: ATTACH,
  RESTART: RESTART,
  CREATE_CLUSTERS: CREATE_CLUSTERS,
  // job
  CREATE_JOBS: CREATE_JOBS,
  // IAM role
  USE_ROLE: USE_ROLE,
  // shared
  MANAGE: MANAGE,

  ALL_ACTIONS: allActions,
  ALL_WORKSPACE_PERMISSIONS: allWorkspacePermissions,
  ALL_CLUSTER_PERMISSIONS: allClusterPermissions,
  ALL_IAM_ROLE_PERMISSIONS: allIamRolePermissions,

  // Only used for the cluster root object. Does not map to a user-facing string to display.
  CLUSTER_CREATE_ACTION: ClusterCreateAction,

  getCurrentPermission: getCurrentPermission,

  getInheritedPermission: getInheritedPermission,

  getInheritedSourceIds: getInheritedSourceIds,

  getDisplayNameForAclObjectid: getDisplayNameForAclObjectid,

  actionsToPermission: actionsToPermission,

  actionsToPermissionJobRoot: actionsToPermissionJobRoot,

  /** Get the node type used in permissionToDescription */
  getNodeType(node) {
    if (node.getAclObjectType() === CLUSTER_TYPE ||
      node.getAclObjectType() === CLUSTER_ROOT_TYPE ||
      node.getAclObjectType() === IAM_ROLE_TYPE ||
      node.getAclObjectType() === IAM_ROOT_TYPE) {
      return node.getAclObjectType();
    }
    return node.get('type');
  },

  /** Get initial permission to add for AddPermissionView */
  getInitialPermissionToAdd(nodeType) {
    const isCluster = nodeType === CLUSTER_TYPE;
    const isIamRole = nodeType === IAM_ROLE_TYPE;
    let permissionToAdd = VIEW;
    if (isCluster) {
      permissionToAdd = ATTACH;
    } else if (isIamRole) {
      permissionToAdd = USE_ROLE;
    }

    return permissionToAdd;
  },

  /**
   * Get a description of a permission on a nodeType. The description is prefixed by the
   * subject, if provided. e.g., permissionToDescription(VIEW, "shell", "You") returns
   * a sentence like "You can view and comment on the notebook".
   */
  permissionToDescription(permission, nodeType, subject) {
    subject = subject === undefined ? 'Users' : subject;
    const descriptions = permissionToDescription[nodeType];
    if (descriptions && descriptions[permission]) {
      return subject + ' ' + descriptions[permission] + '.';
    }
    console.error('unknown permission ' + permission + ' for nodeType ' + nodeType);
    return undefined;
  },

  /** convert a display permission to the Actions that the webapp understands */
  toActions(permission, nodeType) {
    if (nodeType === CLUSTER_TYPE) {
      return clusterPermissionToActions[permission];
    } else if (nodeType === IAM_ROLE_TYPE) {
      return iamPermissionToActions[permission];
    }
    return permissionToActions[permission];
  },

  canView(permission) {
    return permission === VIEW || permission === RUN || permission === EDIT ||
      permission === MANAGE;
  },

  canRun(permission) {
    return permission === RUN || permission === EDIT || permission === MANAGE;
  },

  canEdit(permission) {
    return permission === EDIT || permission === MANAGE;
  },

  canManage(permission) {
    return permission === MANAGE;
  },

  canAttach(permission) {
    return permission === ATTACH || permission === RESTART || permission === MANAGE;
  },

  canRestart(permission) {
    return permission === RESTART || permission === MANAGE;
  },

  canCreateClusters(permission) {
    return permission === CREATE_CLUSTERS || permission === MANAGE;
  },

  canUseRole(permission) {
    return permission === USE_ROLE;
  },

  toUsageTags(actions) {
    return {
      'aclRead': _.contains(actions, ReadAction),
      'aclExecute': _.contains(actions, ExecuteAction),
      'aclModify': _.contains(actions, ModifyAction),
      'aclCreate': _.contains(actions, CreateAction),
      'aclRemove': _.contains(actions, RemoveAction),
      'aclClusterCreate': _.contains(actions, ClusterCreateAction),
      'aclAttach': _.contains(actions, AttachAction),
      'aclRestart': _.contains(actions, RestartAction),
      'aclUseRole': _.contains(actions, InstanceProfileUseAction),
      'aclModifyPermissions': _.contains(actions, ModifyPermissionsAction),
      'aclAllPermissions': _.contains(actions, AllAction),
    };
  },

  /** Parse the username, permission, and path out of a permission denied error */
  parsePermissionError(message) {
    const matches = message.match(
      /(.+) does not have (.+) permissions on (.+). Please contact/
    );
    if (matches) {
      const username = matches[1];
      const permission = matches[2];
      const path = matches[3];
      return { username: username, permission: permission, path: path };
    }
    return null;
  },

  JOB_CREATE_CLUSTER_WARNING: jobRunCreateClusterWarning,
  NO_VIEW_PERMISSIONS_WARNING: noViewPermissionsWarning,
};

module.exports = WorkspacePermissions;
