/* eslint consistent-return: 0 */

import $ from 'jquery';
import WorkspacePermissions from '../acl/WorkspacePermissions';

/**
 * Used to analyze the various feature flags that govern if ACLs are on for different parts of the
 * workspace (notebooks, clusters, dbfs) & various utility functions for getting permissions
 *
 * ==== Cluster ACLs ====
 * enableClusterAclsByTier: Tier flag for cluster ACLs
 * enableClusterAcls: Feature flag for cluster ACLs
 * enableClusterAclsConfig: dynamic config true if customer has enabled
 *
 * ==== Workspace ACLs ====
 * enableWorkspaceAcls: Tier flag for Workspace acls enabled by customer tier
 * enableWorkspaceAclsConfig: dynamic config true if customer has enabled workspace ACLs
 *
 * ==== Mount Point ACLs ====
 * enableMountAclService: TierFlag for mount point ACLs
 * enableMountAcls: Feature flag for mount point ACLs
 * enableMountAclsConfig: dynamic config true if customer has enabled
 *
 */
export class AclUtils {

  /**
   * Returns TRUE if cluster ACLs are on -- the feature flag is on, the correct tier, and
   * the customer has turned it on.
   *
   * @returns {boolean}
   */
  static clusterAclsEnabled() {
    return window.settings.enableClusterAclsByTier &&
        window.settings.enableClusterAcls &&
        window.settings.enableClusterAclsConfig;
  }

  /**
   * Returns true if Cluster ACLs are feature flagged on and available for the customer tier
   *
   * @returns {boolean}
   */
  static clusterAclsAvailable() {
    return window.settings.enableClusterAclsByTier &&
        window.settings.enableClusterAcls;
  }

  /**
   * Returns true if Cluster ACLs are feature flagged on but not available for the customer tier.
   *
   * @returns {boolean}
   */
  static clusterAclsAvailableWithTierUpgrade() {
    return window.settings.enableClusterAcls
      && !window.settings.enableClusterAclsByTier;
  }

  /**
   * Returns TRUE if cluster ACLs feature flagged on. This does not check if it is on for the
   * tier, or if the customer has turned them on.
   *
   * @returns {boolean}
   */
  static clusterAclsFeatureFlag() {
    return window.settings &&
      window.settings.enableClusterAcls;
  }

  /**
   * Returns TRUE:
   * if the feature flag is on
   * if the tier can support cluster ACLs
   * if cluster ACLs are currently disabled
   *
   * @returns {boolean}
   */
  static couldEnableClusterAcls() {
    return window.settings.enableClusterAclsByTier &&
        window.settings.enableClusterAcls &&
        !window.settings.enableClusterAclsConfig;
  }

  /**
   * Returns TRUE if mount point ACLs are on -- the feature flag is on, the correct tier, and
   * the customer has turned it on.
   *
   * @returns {boolean}
   */
  static mountPointAclsEnabled() {
    return window.settings.enableMountAclService &&
        window.settings.enableMountAcls &&
        window.settings.enableMountAclsConfig;
  }


  /**
   * Returns true if Mount Point ACLs are feature flagged on and available for the customer tier
   *
   * @returns {boolean}
   */
  static mountPointAclsAvailable() {
    return window.settings.enableMountAclService &&
        window.settings.enableMountAcls;
  }

  /**
   * Returns TRUE if mount point ACLs feature flagged on.
   *
   * @returns {boolean}
   */
  static mountPointAclsFeatureFlag() {
    // TODO(lauren/cg) reenable when ready
    // return window.settings.enableMountAclService;
    return false;
  }

  /**
   * This makes a HTTP request to the webapp to enable ACLs of a particular type.
   *
   * @param aclType the type of ACL to enable: workspace, cluster, or mount
   * @param currentAclState the current state of ACLs
   * @param success callback for success
   * @param error callback for error
   */
  static toggleAclSetting(aclType, currentAclState, success, error) {
    if (aclType === WorkspacePermissions.WORKSPACE_TYPE) {
      window.recordEvent('aclToggle', { 'aclState': currentAclState });
    } else if (aclType === WorkspacePermissions.CLUSTER_TYPE) {
      window.recordEvent('aclToggle', { 'aclStateClusters': currentAclState });
    } else if (aclType === WorkspacePermissions.MOUNTPOINT_TYPE) {
      window.recordEvent('aclToggle', { 'aclStateMountPoint': currentAclState });
    } else {
      throw new Error('unknown aclType in AclSettingsView: ' + aclType);
    }

    const newConfig = !currentAclState;
    $.ajax({
      type: 'POST',
      url: '/acl/' + aclType + '/config',
      data: JSON.stringify({
        enableAclsConfig: newConfig,
      }),
      success: (data) => success(data),
      error: () => error(),
    });
  }

  /**
   * fetch current user's permission on a list of objects
   *
   * @param {Array [string]} ids list of aclObject ids
   * @param String aclObjectType acl object type, see definitions in constants/WorkspacePermissions
   * @param func success success callback, taking one parameter which is a map from object id to
   *  list of user's permissions
   */
  static fetchPermissions(ids, aclObjectType, success) {
    if (!Array.isArray(ids)) {
      console.error('AclUtils.fetchPermissions takes a list of aclObject ids');
      return;
    }
    if (ids.length === 0) {
      console.error('List of ids passed to AclUtils.fetchPermissions is empty');
      return;
    }
    return $.ajax({
      url: '/acl/' + aclObjectType + '/list',
      type: 'GET',
      data: { ids: ids },
      success(permsMap) {
        if (success) {
          success(permsMap);
        }
      },
      error() {
        console.error(`failed to fetch permissions for type "${aclObjectType}", id in ${ids}`);
      },
    });
  }

  /**
   * Calls fetchPermissions (above), but takes a list of models instead of aclObjectIds,
   * on which we set the permission level after fetching permissions, so that we can use
   * AclModelMixin methods on the models. These methods are our main interface for interacting
   * with ACLs and provide a lot of functions (e.g. canManage, canView, etc.) that work across
   * different ACL object types.
   *
   * @param {array} list of models - must inherit from AclModelMixin
   * @param {string} aclObjectType (see definitions in constants/WorkspacePermissions)
   * @param {func} success callback, taking one parameter which is a map from object id to
   *  list of user's permissions
   */
  static fetchAndSetPermissions(models, aclObjectType, success) {
    if (!Array.isArray(models)) {
      console.error('AclUtils.fetchAndSetPermissions takes a list of models');
      return;
    }
    if (models.length === 0) {
      console.error('List of models passed to AclUtils.fetchAndSetPermissions is empty');
      return;
    }
    const listOfIDs = models.map((aclObj) => aclObj.getAclObjectId());
    return AclUtils.fetchPermissions(listOfIDs, aclObjectType, (permsMap) => {
      models.forEach((model) => {
        const perms = permsMap[model.getAclObjectId()];
        model.set({
          permissionLevel: WorkspacePermissions.actionsToPermission(perms, aclObjectType),
        });
      });
      if (success) {
        success(permsMap);
      }
    });
  }

  /**
   * Fetch all users' permissions on a list of objects. Note: this will throw a
   * WorkspacePermissionDeniedException exception if the user does not have manage permissions,
   * but it is only used in the admin console so should not throw.
   *
   * @param {array} ids list of aclObject ids (strings)
   * @param {string} aclObjectType (see definitions in constants/WorkspacePermissions)
   * @param {function} success success callback, taking one parameter which is a map from object id
   *  to list of user's permissions
   */
  static bulkFetchEffectivePermissions(ids, aclObjectType, success) {
    if (!Array.isArray(ids)) {
      console.error('AclUtils.bulkFetchEffectivePermissions takes a list of aclObject ids');
      return;
    }
    if (ids.length === 0) {
      console.error('List of ids passed to AclUtils.bulkFetchEffectivePermissions is empty');
      return;
    }
    return $.ajax({
      url: '/acl/' + aclObjectType + '/listEffective',
      type: 'GET',
      data: { ids: ids },
      success(permsMap) {
        if (success) {
          success(permsMap);
        }
      },
      error() {
        console.error(`failed to fetch permissions for type "${aclObjectType}", id in ${ids}`);
      },
    });
  }

  /**
   * Determines whether a user has attach permissions on a cluster. This is primarily used when
   * there is no cluster model available (PROD-12032).
   *
   * @param {object} permissionsMap  map from object ID to list of user's permissions (returned
   *                                 from fetchPermissions above)
   * @param {string} aclObjectId  id of the object for which we are fetching permissions
   * @return {boolean}
   */
  static canAttach(permissionsMap, aclObjectId) {
    const permissionsList = permissionsMap[aclObjectId];
    return WorkspacePermissions.toUsageTags(permissionsList).aclAttach;
  }
}
