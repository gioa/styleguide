/* eslint consistent-return: 0, func-names: 0 */

/* @flow weak */

/**
 * Core set of utility functions
 */
// TODO(ahirreddy) move to Notebook model once it is implemented.

import _ from 'underscore';
import $ from 'jquery';

import HiveSchema from '../tables/HiveSchema';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';
import ReactDialogBox from '../ui_building_blocks/dialogs/ReactDialogBox.jsx';

const NotebookUtilities = {};

NotebookUtilities.isRunning = function(notebookModel, commandCollection) {
  return NotebookUtilities.isRunningAll(notebookModel) ||
    NotebookUtilities.isRunningSingleCommand(notebookModel, commandCollection);
};

NotebookUtilities.isRunningAll = function(notebookModel) {
  const runStatus = notebookModel.get('runStatus');
  const targetAction = notebookModel.get('jsRunAllAction');

  if (targetAction === 'RunAll') {
    return true;
  }

  if (runStatus === 'runningFromRunAll') {
    return true;
  }

  return false;
};

/**
 * Returns true if any command in the collection is in running status, or if it is scheduled to
 * run by the frontend.
 * @param notebookModel
 * @param commandCollection
 * @returns {boolean}
 */
NotebookUtilities.isRunningSingleCommand = function(notebookModel, commandCollection) {
  const runStatus = notebookModel.get('runStatus');

  if (runStatus === 'running') {
    return true;
  }

  // If we check if any individual commands are running
  const runningCommands = commandCollection ?
      commandCollection.where({ running: true }).length : 0;
  const shouldRunCommands = commandCollection ?
      commandCollection.where({ shouldRun: true }).length : 0;
  return runningCommands + shouldRunCommands > 0;
};

NotebookUtilities.isCancelling = function(notebookModel, commandCollection) {
  const runStatus = notebookModel.get('runStatus');
  const targetAction = notebookModel.get('jsRunAllAction');

  if (targetAction === 'Cancel' && runStatus !== 'idle') {
    return true;
  }

  if (commandCollection.where({ state: 'cancelling' }).length > 0) {
    return true;
  }

  return false;
};

/**
 * Generic handler for Notebook RPC errors. This should only be used for reporting rare errors
 * that we don't have any other way to deal with.
 */
NotebookUtilities.handleRpcError = function(xhr, status, error, dialogOptions) {
  let message;
  if (xhr.status === 403) {
    message = 'Permission denied: ' + xhr.statusText;
  } else if (xhr.readyState !== 4) {
    message = 'Oops! Network error. Please check your network connection.';
  } else {
    message = 'Oops! Server error: ' + xhr.statusText;
  }
  const options = {
    message: message,
    confirmButton: 'Reload page',
    cancelButton: 'Close',
    confirm() { window.location.reload(true); },
  };
  _.extend(options, dialogOptions);
  DeprecatedDialogBox.confirm(options);
};

/**
 * Attach notebook to target cluster, with confirmation if cluster is already in attached or
 * attaching state
 *
 * @param {NotebookModel} notebook
 * @param {Cluster} cluster
 */
NotebookUtilities.attachToCluster = function(notebook, cluster) {
  const name = cluster.get('clusterName');
  const clusterId = cluster.get('clusterId');
  const errorHandler = (xhr) => {
    const errorMsg = xhr && xhr.statusText;
    // TODO(Chaoyu): need proper way of propagate server side error type to frontend other than
    // parsing error message string
    if (errorMsg && errorMsg.startsWith('Failed to attach')) {
      // Attach Failure: notebook is already in Attached or Attaching state
      ReactDialogBox.confirm({
        title: 'Failed to attach notebook',
        message: `${errorMsg} Do you want to force re-attach? This will clear all computed
          variable values from this notebook.`,
        confirmButton: 'Yes',
        cancelButton: 'No',
        confirm: () => notebook.detachAndAttach(clusterId),
      });
    } else {
      // use default rpc error handler for non notebook attach related error
      NotebookUtilities.handleRpcError(xhr);
    }
  };
  notebook.attach(clusterId, name, errorHandler);
};

/**
 * @param type The parsed HiveSchema type.
 */
NotebookUtilities.isNumeric = function(type) {
  const numericTypes = [
    'int',
    'double',
    'bigint',
    'smallint',
    'tinyint',
    'decimal',
    'float',
    'long',
    'short'];
  return type instanceof HiveSchema.AtomType && _.contains(numericTypes, type.typeName);
};

NotebookUtilities.getDisplayType = function(command) {
  if (command) {
    const firstWord = command.trim().split(/\s/)[0];
    if (firstWord === '%md') {
      return 'markdown';
    }
  }
  return 'table';
};

NotebookUtilities.fixLength = function(str) {
  const result = str === 'auto' ? 'auto' : parseInt(str, 10) + 'px';
  if (result === '0px') {
    return 'auto';
  }
  return result;
};

NotebookUtilities.isDownloadable = function(displayType) {
  const excludedTypes = ['markdown', 'image', 'html', 'htmlSandbox'];
  return !_.contains(excludedTypes, displayType);
};

NotebookUtilities.isResizable = function(displayType) {
  return (displayType !== 'markdown' && displayType !== 'html');
};

const TOPBAR_HEIGHT = 80;

/**
 * This function only works for elements inside command list view
 */
NotebookUtilities.isOutOfView = function($el) {
  const elOffsetTop = $el.offset().top;
  const elHeight = $el.height();
  const viewPortHeight = $el.scrollParent().height();

  if (elOffsetTop + elHeight < TOPBAR_HEIGHT) {
    return true;
  }

  if (elOffsetTop > viewPortHeight) {
    return true;
  }

  return false;
};

/*
 * detach a list of notebooks
 */
NotebookUtilities.detachNotebooks = function(ids, success, error) {
  if (!Array.isArray(ids)) {
    console.error('NotebookUtilities.detachNotebooks takes a list of notebook ids');
    return;
  }
  return $.ajax({
    type: 'POST',
    url: '/notebook/detach',
    data: JSON.stringify({ notebookIds: ids }),
    success: success,
    error: error,
    dataType: 'json',
  });
};

module.exports = NotebookUtilities;
