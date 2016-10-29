/* eslint func-names: 0 */

import _ from 'underscore';
import Backbone from 'backbone';

import AclModelMixin from '../acl/AclModelMixin';
import WorkspacePermissions from '../acl/WorkspacePermissions';

import { ClusterUtil } from '../clusters/Common.jsx';
import { SparkVersionUtils } from '../clusters/SparkVersionUtils';

import Presence from '../presence/Presence';

const Cluster = Backbone.Model.extend({
  defaults: {
    clusterName: '',
    clusterId: '',
    zoneId: '',
    sparkContextId: '',
    creator: '',
    sparkVersion: '',
    memory: 0,
    workersUrl: [],
    notebooks: [],
    stateMessage: '',
    driverIsHealthy: true,
    defaultCluster: false,
    useSpotInstance: false,
    isDriverOnSpot: false,
    numActiveSpotExecutors: 0,
    libraries: [],
  },

  // override default backbone isNew function so that save({patch: true}) always does a PATCH
  // if we don't do this, then the save will be a POST if a fetch() was not performed, which
  // is the case when we use the CollectionDeltaReceiver to populate this model
  isNew() {
    return false;
  },

  getName() {
    return this.get('clusterName');
  },

  /** Measurement tags for this cluster. */
  tags() {
    return {
      sparkVersion: this.get('sparkVersion'),
      clusterId: this.get('clusterId'),
      clusterName: this.get('clusterName'),
      clusterMemory: (this.get('memory') * 1024).toString(),
      clusterCreator: this.get('creator'),
      clusterType: this.get('useSpotInstance') ? 'spot' : 'ondemand',
    };
  },

  /**
   * A short, human-readable description of the cluster that gives vital informations (size,
   * status).
   * @returns {string}
   */
  shortDescription() {
    const extraInfos = [];
    if (this.displayMemoryGB()) {
      const memInfo = this.displayMemoryGB() + ' GB';
      extraInfos.push(memInfo);
    }
    const libInfo = this.displayState();
    if (libInfo) {
      extraInfos.push(libInfo);
    }
    if (window.settings.enableSparkVersionsUI) {
      extraInfos.push(this.sparkVersion());
    }
    if (this.get('zoneId') && this.get('zoneId') !== window.settings.defaultZoneId) {
      extraInfos.push(this.get('zoneId'));
    }
    return this.get('clusterName') + ' (' + extraInfos.join(', ') + ')';
  },

  // Just cluster size and spark version
  sizeAndSparkVersion() {
    const extraInfos = [];
    if (this.displayMemoryGB()) {
      const memInfo = this.displayMemoryGB() + ' GB';
      extraInfos.push(memInfo);
    }
    if (window.settings.enableSparkVersionsUI) {
      extraInfos.push(this.sparkVersion());
    }
    return '(' + extraInfos.join(', ') + ')';
  },

  isSpotOnly() {
    return this.get('useSpotInstance') &&
      (!this.get('firstOnDemand') || this.get('firstOnDemand') === 0);
  },

  isOnDemandOnly() {
    return !this.get('useSpotInstance');
  },

  isHybrid() {
    return this.get('useSpotInstance') && this.get('firstOnDemand') > 0;
  },

  numSpotWorkers() {
    if (this.isOnDemandOnly()) {
      return 0;
    } else if (this.isHybrid()) {
      // @NOTE(jengler) 2016-05-20: Ensure that value is not 0. This is done because the numWorkers
      // can be zero when the cluster is being created. one of the firstOnDemand workers is the
      // driver, so subtract 1 (note: numWorkers does NOT include the driver)
      // @TODO(jengler) 2016-05-20: We should document the number of "active"
      // workers from the number of configured/target workers. This will prevent the confusion in
      // this logic
      return Math.max(this.get('numWorkers') - (this.get('firstOnDemand') - 1), 0);
    }
    return this.get('numWorkers');
  },

  numOnDemandWorkers() {
    if (this.isOnDemandOnly()) {
      return this.get('numWorkers');
    } else if (this.isHybrid()) {
      // @NOTE(jengler) 2016-05-20: Ensure that value is not 0. This is done because the numWorkers
      // can be zero when the cluster is being created. One of the firstOnDemand workers is the
      // driver, so subtract 1 (note: numWorkers does NOT include the driver)
      // @TODO(jengler) 2016-05-20: We should document the number of "active"
      // workers from the number of configured/target workers. This will prevent the confusion in
      // this logic
      return Math.max(this.get('firstOnDemand') - 1, 0);
    }
    return 0;
  },

  workerUrls() {
    const _this = this;
    return this.get('workersUrl') === null ? [] :
      _.map(_.range(this.get('workersUrl').length), function(n) {
        return '#setting/sparkui/' + _this.get('clusterId') + '/worker/' + n;
      });
  },

  masterUrl() {
    return '#setting/sparkui/' + this.get('clusterId') + '/master';
  },

  driverUrl() {
    return '#setting/sparkui/' + this.get('clusterId') + '/driver-' + this.get('sparkContextId');
  },

  driverLogsUrl() {
    return '#setting/sparkui/' + this.get('clusterId') + '/driver-logs';
  },

  terminalUrl() {
    return '#terminal/' + this.get('clusterId');
  },

  displayMemoryGB() {
    if (!this.get('memory')) {
      // total memory can be 0 when nodes are still being setup
      return 0;
    }
    const numWorkers = this.workerUrls().length;
    let nodeType = null;
    const nodeTypeId = this.get('nodeTypeId');
    let driverNodeType;
    const driverNodeTypeId = this.get('driverNodeTypeId');
    if (nodeTypeId && nodeTypeId.id) {
      nodeType = ClusterUtil.getNodeType(nodeTypeId.id);
    }
    if (driverNodeTypeId && driverNodeTypeId.id) {
      driverNodeType = ClusterUtil.getNodeType(driverNodeTypeId.id);
    }

    return Math.floor(
      ClusterUtil.containersToMemoryGB(numWorkers, nodeType, driverNodeType, true));
  },

  url() {
    if (this.get('clusterId')) {
      return '/clusters/' + this.get('clusterId');
    }
    return '/clusters';
  },

  isDriverHealthy() {
    // driverIsHealthy field only make sense for Running and Reconfiguring state
    if (this.get('state') === 'Running' || this.get('state') === 'Reconfiguring') {
      return this.get('driverIsHealthy');
    }
    return true;
  },

  sparkVersion() {
    return SparkVersionUtils.formatSparkVersion(this.get('sparkVersion'));
  },

  /**
   * The state of the cluster, including some information about the libraries.
   */
  displayState() {
    const s = this.get('state');

    if (!this.isDriverHealthy()) {
      if (s === 'Running') {
        return 'Recovering driver...';
      } else if (s === 'Reconfiguring') {
        return 'Reconfiguring and Recovering driver...';
      }
    }

    if (s === 'Running') {
      // Add more information about libraries.
      const errorLibs = _.filter(this.get('libraries'), function(lib) {
        return lib.clusterStatus.status === 'error';
      });
      if (errorLibs.length > 0) {
        return 'Failed to attach ' + errorLibs.length + ' libraries';
      }
      const attachingLibs = _.filter(this.get('libraries'), function(lib) {
        return lib.clusterStatus.status === 'pending';
      });
      if (attachingLibs.length > 0) {
        return 'Attaching ' + attachingLibs.length + ' libraries';
      }
    }

    if (s === 'Error') {
      return 'Terminated due to Error';
    }
    if (s === 'TerminateWhenReady') {
      return 'Terminating';
    }
    // For all other statuses, return normal output.
    return s;
  },

  /** Very short display state to show on the notebook context bar when not attached. */
  shortDisplayState() {
    const s = this.get('state');

    if (!this.isDriverHealthy()) {
      if (s === 'Running' || s === 'Reconfiguring') {
        return 'Recovering';
      }
    }

    if (s === 'Running') {
      const attachingLibs = _.filter(this.get('libraries'), function(lib) {
        return lib.clusterStatus.status === 'pending';
      });
      if (attachingLibs.length > 0) {
        return 'Attaching Libraries';
      }
    }

    if (s === 'TerminateWhenReady') {
      return 'Terminating';
    }

    return s;
  },

  elasticSparkRunUrl() {
    if (!this.isElasticSparkCluster()) {
      return null;
    }
    const matches = this.get('clusterName').match(/^job-(.+)-run-(.+)$/);
    if (matches) {
      return '#job/' + matches[1] + '/run/' + matches[2];
    }
    console.warn('Jobs cluster has malformed name: ' + this.get('clusterName'));
    return null;
  },

  isElasticSparkCluster() {
    return this.get('creator') === 'JobLauncher';
  },

  isValid() {
    return (this.get('clusterName') !== '');
  },

  /** True iff this cluster is not attachable but will eventually become attachable */
  isInProgress() {
    return !this.isAttachable() &&
      !this.isElasticSparkCluster() &&
      this.get('state') !== 'Terminating' &&
      this.get('state') !== 'Terminated' &&
      this.get('state') !== 'Error';
  },

  isAttachable() {
    return (this.get('state') === 'Running' || this.get('state') === 'Reconfiguring') &&
      !this.isElasticSparkCluster() && this.isDriverHealthy();
  },

  canRunQuery() {
    return this.get('state') === 'Running' &&
      !this.isElasticSparkCluster() &&
      this.isDriverHealthy() &&
      this.get('defaultCluster');
  },

  isConfigurable() {
    if (window.settings.enableRestrictedClusterCreation) {
      return false;
    }

    if (this.isElasticSparkCluster()) {
      return false;
    }

    if (this.get('state') === 'Running') {
      return true;
    }

    return false;
  },

  isRestartable() {
    if (this.isElasticSparkCluster()) {
      return false;
    }

    if (this.get('state') === 'Running') {
      return true;
    }

    return false;
  },

  canTerminate() {
    return !(this.displayState() === 'Terminating' || this.isTerminated());
  },

  canManagePermissions() {
    return !this.isTerminated() && this.get('state') !== 'Terminating';
  },

  /**
   * Is the cluster currently being terminated.
   * @return {Boolean} True iff the cluster is currently marked as being terminated.
   */
  isTerminating() {
    return this.get('state') === 'Terminating';
  },

  /** True iff this cluster is terminated (either normally or with error) */
  isTerminated() {
    return this.get('state') === 'Terminated' || this.get('state') === 'Error';
  },

  restart() {
    this.set('state', 'Restarting');
    this.save({ restart: true }, { patch: true });
    // TODO(ekl) push this from the backend once new WCM is in
    Presence.pushHistory('Restarted ' + this.get('clusterName'), null, 'setting/clusters');
  },

  // the object type in the acl handler
  getAclObjectType() { return WorkspacePermissions.CLUSTER_TYPE; },

  // the id of the object in the acl handler
  getAclObjectId() { return this.get('clusterId'); },
});

_.extend(Cluster.prototype, AclModelMixin);

/** The model that represents /clusters in ACLs */
const ClusterRoot = Backbone.Model.extend({
  getAclObjectType() { return WorkspacePermissions.CLUSTER_ROOT_TYPE; },
  getAclObjectId() { return '*'; },
  getName() { return WorkspacePermissions.CLUSTER_ROOT_TYPE; },
});

_.extend(ClusterRoot.prototype, AclModelMixin);

Cluster.ROOT = new ClusterRoot();

module.exports = Cluster;
