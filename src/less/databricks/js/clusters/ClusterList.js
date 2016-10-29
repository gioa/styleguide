/* eslint func-names: 0 */

import _ from 'underscore';

import CollectionDeltaReceiver from '../delta_receiver/CollectionDeltaReceiver';

import Cluster from '../clusters/Cluster';

const ClusterList = CollectionDeltaReceiver.extend({

  url() {
    return CollectionDeltaReceiver.prototype.url.call(this);
  },

  // Must be set to determine whether to show the home page "create cluster to get started"
  // tooltip. Once this value is true, this.reset() must be called to notify the home page.
  finishedInitialFetch: false,

  model(attrs, options) {
    return new Cluster(attrs, options);
  },

  attachableClusters() {
    return this.filter(function(c) {
      return c.isAttachable();
    });
  },

  attachableOrInProgressClusters() {
    return this.filter(function(c) {
      return c.isAttachable() || c.isInProgress();
    });
  },

  isAttachableOrInProgress(clusterId) {
    return Boolean(_.find(this.attachableOrInProgressClusters(), function(c) {
      return c.get('clusterId') === clusterId;
    }));
  },

  getAttachableCluster(clusterId) {
    return _.find(this.attachableClusters(), function(c) {
      return c.get('clusterId') === clusterId;
    });
  },

  getDefaultCluster() {
    return this.find(function(c) {
      return c.get('defaultCluster');
    });
  },

  isDefaultClusterUsable() {
    const defaultCluster = this.getDefaultCluster();
    return defaultCluster &&
      defaultCluster.get('state') === 'Running' &&
      defaultCluster.isDriverHealthy();
  },

  // Given a possible name for a cluster, renames it such that it can be created successfully.
  // For example, "My Cluster" gets renamed to "My Cluster (2)" if "My Cluster" already exists.
  resolveNameConflicts(originalName) {
    const parts = originalName.split(' ');
    // Remove the conflict resolution suffix if present.
    if (parts[parts.length - 1].search(/\([0-9]+\)/) === 0) {
      originalName = parts.slice(0, parts.length - 1).join(' ');
    }
    // Add a conflict resolution suffix if necessary.
    let i = 2;
    let clusterName = originalName;
    const self = this;
    function hasConflict() {
      return self.filter(function(c) {
        return !c.isTerminated() && c.get('clusterName') === clusterName;
      }).length > 0;
    }
    while (i < 100 && hasConflict(clusterName)) {
      clusterName = originalName + ' (' + i + ')';
      i += 1;
    }
    return clusterName;
  },

  /**
   * Get the active clusters for a given user id.
   * @param  {number} userId The user id.
   *
   * @return {Cluster[]}        [description]
   */
  activeClustersForUser(userId) {
    userId = userId.toString();
    return this.activeClusters().filter((cluster) => cluster.get('userId').toString() === userId);
  },

  /**
   * Get all clusters that are currently active and usable.
   *
   * @return {Cluster[]} Returns an array of cluster models for clusters that are not terminated or
   *                             in the process of being terminated.
   */
  activeClusters() {
    return this.filter((c) => !c.isTerminated() && !c.isTerminating());
  },

  /**
   * Get all clusters from the list that are terminating, but not yet terminated.
   * @return {Cluster[]} An array of cluster models representing all models that are in terminating
   *                        state
   */
  terminatingClusters() {
    return this.filter((c) => c.isTerminating());
  },

  /**
   * Clusters which are terminated.
   */
  terminatedClusters() {
    return this.filter((c) => c.isTerminated());
  },

  autoUpdate() {
    const that = this;
    this.startWatching();
    this.once('reset', function() {
      that.finishedInitialFetch = true;
      that.trigger('reset');
    });
  },
});

module.exports = ClusterList;
