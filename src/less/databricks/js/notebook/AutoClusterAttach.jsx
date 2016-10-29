/* eslint prefer-spread: 0, func-names: 0 */

import $ from 'jquery';
import _ from 'underscore';

import React from 'react';

import { AclUtils } from '../acl/AclUtils.jsx';

import Cluster from '../clusters/Cluster';
import { ClusterUtil } from '../clusters/Common.jsx';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';
import { StringRenderers } from '../ui_building_blocks/text/StringRenderers';

const AutoClusterAttach = {};


/**
 * Prompts for launching or attaching to an existing cluster. After attach the command will be
 * run. The actual action is automatically determined based on the notebook's attach history
 * and if there are any clusters available.
 *
 * @param noClusterAttachedError the original error from attempting to run a command.
 * @param commandId the command that should be run upon successful attach.
 * @param clusters reference to the global ClusterList.
 * @param notebook reference to the notebook to run the command in.
 * @param contextBar reference to the global contextBar.
 */
AutoClusterAttach.promptForClusterAttach = function(
    noClusterAttachedError, commandId, clusters, notebook, contextBar) {
  if (!AclUtils.clusterAclsEnabled()) {
    const attachAction = AutoClusterAttach.getAttachAction(
      notebook.get('clusterMetadata'), clusters);

    AutoClusterAttach._showPrompt(
      attachAction, noClusterAttachedError, commandId, clusters, notebook, contextBar);
  } else {
    // Before we call getAttachAction (which determines how to get notebook attached to a cluster),
    // we need to asynchronously fetch permissions for both cluster creation and for attaching to
    // individual clusters. We first fetch cluster create permissions, and then in the success
    // function, we fetch individual cluster permissions. We use $.when and $.done to ensure all
    // asynchronous permission fetches are completed before we pass the list of permissable
    // clusters to getAttachAction.
    Cluster.ROOT.fetchPermissions(() => {
      // generate a list of Deferreds to pass to $.when to resolve
      const deferreds = [];
      const attachableOrInProgressClusters = clusters.attachableOrInProgressClusters();
      attachableOrInProgressClusters.forEach((cluster) => {
        deferreds.push(cluster.fetchPermissionLevel());
      });

      // only gather the list of permissable clusters after permissions for all are fetched
      $.when.apply($, deferreds).done(() => {
        const permissableClusters = _.filter(
          attachableOrInProgressClusters,
          (cluster) => cluster.canAttach()
        );

        const attachAction =
          AutoClusterAttach.getAttachAction(notebook.get('clusterMetadata'), clusters, Cluster.ROOT,
            permissableClusters);

        if (attachAction) {
          AutoClusterAttach._showPrompt(
            attachAction, noClusterAttachedError, commandId, clusters, notebook, contextBar);
        } else {
          contextBar.showRunCommandHighlight(noClusterAttachedError);
        }
      });
    });
  }
};

// Schedules the command or notebook for running upon successful attach.
function scheduleCommandForExecution(notebook, commandId) {
  if (commandId) {
    const command = notebook.getCommand(commandId);
    if (command) {
      notebook.runCommand(command, { allowRunPendingAttach: true });
    }
  } else {
    notebook.runAll({ allowRunPendingAttach: true });
  }
}

AutoClusterAttach._showPrompt = function(
  attachAction, noClusterAttachedError, commandId, clusters, notebook, contextBar) {
  if (window.prefs.get('autoLaunchAndAttach')) {
    const ok = AutoClusterAttach.runAttachAction(attachAction, clusters, notebook, contextBar);
    if (ok) {
      scheduleCommandForExecution(notebook, commandId);
    }
    return;
  }

  DeprecatedDialogBox.confirm({
    message: (<div>
      {attachAction.message}
      <br /><br />
      <input className='pref-autolaunch' type='checkbox'>
        &nbsp;Automatically launch and attach to clusters without prompting
      </input>
    </div>),
    confirmButton: attachAction.confirmText,
    confirm() {
      if ($('input.pref-autolaunch').prop('checked')) {
        window.prefs.set('autoLaunchAndAttach', true);
      }
      const ok = AutoClusterAttach.runAttachAction(attachAction, clusters, notebook, contextBar);
      if (ok) {
        scheduleCommandForExecution(notebook, commandId);
      }
    },
    cancel() {
      contextBar.showRunCommandHighlight(noClusterAttachedError);
    },
  });
};

/**
 * Gets existing cluster to attach to; used in getAttachAction.
 *
 * @param clusters global ClusterList.
 * @param {array} permissableClusters Optional clusters that user has attach permissions on
 *                (used if cluster ACLs are enabled)
 *
 * @returns cluster or undefined.
 */
AutoClusterAttach._getTargetCluster = (clusters, permissableClusters) => {
  const defaultCluster = clusters && clusters.getDefaultCluster();
  if (!AclUtils.clusterAclsEnabled()) {
    return AutoClusterAttach._getTargetClusterNoAcls(clusters, defaultCluster);
  }
  return AutoClusterAttach._getTargetClusterWithAcls(permissableClusters, defaultCluster);
};

/**
 * Gets existing cluster to attach to when ACLs are not enabled.
 *
 * @param clusters global ClusterList.
 * @param {cluster or undefined} default cluster
 *
 * @returns cluster or undefined.
 */
AutoClusterAttach._getTargetClusterNoAcls = (clusters, defaultCluster) => {
  const availableClusters = clusters && clusters.attachableOrInProgressClusters();
  if (defaultCluster && clusters.isAttachableOrInProgress(defaultCluster.get('clusterId'))) {
    return defaultCluster;
  }
  return availableClusters && availableClusters[0];
};


/**
 * Gets existing cluster to attach to when ACLs are enabled. Checks if default cluster is part
 * of permissable clusters list; if not, returns the first permissable cluster.
 *
 * @param {array} permissableClusters Clusters that user has attach permissions on
 * @param {cluster or undefined} default cluster
 *
 * @returns cluster or undefined.
 */
AutoClusterAttach._getTargetClusterWithAcls = (permissableClusters, defaultCluster) => {
  if (!permissableClusters || permissableClusters.length === 0) {
    return undefined;
  }
  let targetCluster;
  if (defaultCluster) {
    targetCluster = _.find(
      permissableClusters,
      (cluster) => cluster.get('clusterId') === defaultCluster.get('clusterId')
    );
  }
  if (!targetCluster) {
    targetCluster = permissableClusters[0];
  }
  return targetCluster;
};

/**
 * Figures out what to do to get this notebook running on a cluster again.
 *
 * @param previousCluster attributes of the past attached clusters, or null if a new notebook.
 * @param clusters global ClusterList.
 * @param {object} (clusterRoot) Optional cluster Root object to use for checking cluster ACLs.
 * @param {array} (permissableClusters) Optional clusters that user has attach permissions on.
 *                If passed in, will be used instead of clusters.
 *
 * @returns {object|null} with attributes
 *   message: a message (list of react DOM elements) to show to the user.
 *   confirmText: confirmation message for the action.
 *   newCluster: if present, specifies the model of a cluster to launch.
 *   existingCluster: if present, specifies the cluster to attach to.
 */
AutoClusterAttach.getAttachAction = function(previousCluster, clusters, clusterRoot,
  permissableClusters) {
  const result = {
    message: [],
    confirmText: 'Attach and Run',
    newCluster: false,
    existingCluster: false,
  };

  if (previousCluster) {
    result.message.push(<span>This notebook's cluster has been shut down</span>);
  } else {
    result.message.push(<span>This notebook is not attached to a cluster</span>);
  }

  // Existing cluster case.
  const targetCluster = AutoClusterAttach._getTargetCluster(clusters, permissableClusters);
  if (targetCluster) {
    result.message.push(
      <span>, however another cluster is available. Would you like to attach to </span>);
    result.message.push(<b>{StringRenderers.htmlEscape(targetCluster.get('clusterName'))}</b>);
    if (previousCluster) {
      result.message.push(<span> to continue running commands?</span>);
    } else {
      result.message.push(<span> to start running commands?</span>);
    }

    // If this cluster has more than 20 notebooks attached to it, warn the user that they might
    // experience degrading performance.
    if (ClusterUtil.warnTooManyNotebooks(targetCluster)) {
      result.message.push(ClusterUtil.getTooManyAttachedNotebooksWarning(targetCluster));
    }
    result.existingCluster = targetCluster;
    return result;
  }

  if (clusterRoot && !clusterRoot.canCreateClusters()) {
    return null;
  }

  // Have to launch a new cluster.
  const clusterData = {
    clusterName: clusters.resolveNameConflicts('My Cluster'),
    memory: Math.floor(ClusterUtil.containersToMemoryGB(
      window.settings.defaultNumWorkers)),
    sparkVersion: window.settings.defaultSparkVersion.key,
    zoneId: ClusterUtil.getInitialZoneId(),
    sparkConf: {},
    state: 'Pending',
  };
  if (previousCluster) {
    // TODO(ekl) any other attributes we want to copy from the previously attached cluster?
    clusterData.sparkVersion = previousCluster.sparkVersion;
    clusterData.sparkConf = previousCluster.sparkConf;
    clusterData.useSpotInstance = previousCluster.useSpotInstance;
    clusterData.zoneId = previousCluster.zoneId;
    clusterData.memory = previousCluster.memory;
    clusterData.clusterName = previousCluster.clusterName;
  }
  const newCluster = new Cluster(clusterData);
  if (previousCluster) {
    // This is done after we show the dialog, so that we show the old name to the user.
    newCluster.set(
      'clusterName', clusters.resolveNameConflicts(previousCluster.clusterName));
  }
  if (previousCluster) {
    result.message.push(<span>. Would you like to relaunch </span>);
    result.message.push(
      <b>{previousCluster.clusterName + ' ' + newCluster.sizeAndSparkVersion()}</b>);
    result.message.push(<span> to continue running commands?</span>);
    result.confirmText = 'Relaunch and Run';
  } else {
    result.message.push(<span>. Would you like to launch a new cluster </span>);
    result.message.push(<b>{newCluster.sizeAndSparkVersion()}</b>);
    result.message.push(<span> to start running commands?</span>);
    result.confirmText = 'Launch and Run';
  }
  result.newCluster = newCluster;
  return result;
};

function showAutoAttachHint(contextBar, targetCluster) {
  const maybeWarningMessage = ClusterUtil.warnTooManyNotebooks(targetCluster)
      ? ClusterUtil.getTooManyAttachedNotebooksWarning(targetCluster)
      : null;
  contextBar.showAttachDetachHighlight(
    { tooltip: (<div>
        {'This notebook is now running on ' + targetCluster.get('clusterName')}
        <br />
        <a href='#setting/account/prefs'>Auto-attach&nbsp;Settings</a>
        {maybeWarningMessage}
      </div>),
     autoHideTooltip: true,
     duration: 3000,
     animate: false });
}

/**
 * Attaches the notebook to a new or existing cluster as specified.
 * @param action attach action returned by getAttachAction()
 * @return whether the action was successful
 */
AutoClusterAttach.runAttachAction = function(action, clusters, notebook, contextBar) {
  if (action.existingCluster) {
    const targetCluster = action.existingCluster;
    showAutoAttachHint(contextBar, targetCluster);
    notebook.attach(targetCluster.get('clusterId'), targetCluster.get('clusterName'));
  } else if (action.newCluster) {
    // We need this check here since cluster limits are enforced by the backend only after the
    // cluster creation request has been acked. TODO(ekl) we should fix this in ClusterManager.
    if (ClusterUtil.exceedsClusterLimit(clusters.activeClusters().length)) {
      DeprecatedDialogBox.alert('Could not create cluster: too many active clusters');
      return false;
    }
    action.newCluster.save({}, {
      skipRequestQueue: true,  // don't care about ordering, just create asap
      error(model, response) {
        DeprecatedDialogBox.alert('Failed to create cluster: ' + response.statusText);
      },
      success(model, resp) {
        notebook.attach(resp.id, model.get('clusterName'));
        showAutoAttachHint(contextBar, model);
      },
    });
  } else {
    console.error('Unknown attach action', action);
    return false;
  }
  return true;
};

module.exports = AutoClusterAttach;
