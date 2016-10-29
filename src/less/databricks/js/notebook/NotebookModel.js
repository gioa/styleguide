/* eslint callback-return: 0, consistent-return: 0, max-lines: 0, func-names: 0 */

import _ from 'underscore';
import Backbone from 'backbone';

import AclModelMixin from '../acl/AclModelMixin';
import WorkspacePermissions from '../acl/WorkspacePermissions';

import CollectionDeltaReceiver from '../delta_receiver/CollectionDeltaReceiver';

import { PathNameUtils } from '../filetree/PathNameUtils';

// dashboard view v3
import DashboardViewModel from '../notebook/dashboards/DashboardViewModel.js';

import Presence from '../presence/Presence';

import CommentModel from '../notebook/CommentModel';
import BackboneRpcMixin from '../notebook/BackboneRpcMixin';
import InputWidgetManager from '../notebook/InputWidgetManager';
import NotebookCommandModel from '../notebook/NotebookCommandModel';
import NotebookConstants from '../notebook/NotebookConstants';
import NotebookUtilities from '../notebook/NotebookUtilities';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';

import { BrowserUtils } from '../user_platform/BrowserUtils';

const CommandCollectionDeltaReceiver = CollectionDeltaReceiver.extend({
  loaded: false,

  fetchAndUpdate(options) {
    const self = this;
    Backbone.sync('read', this, {
      complete() {
        self.loaded = true;
      },
      success(resp) {
        self.updateCollection(self, resp);
        if (options && options.success) {
          options.success();
        }
      },
      error(resp) {
        console.error(resp);
        if (options && options.error) {
          options.error(resp);
        }
      },
      // Use a custom url so that we don't hit the TreeHandler
      url: '/notebook/' + this.deltaPublisherRoot + '/command',
    });
  },

  updateCollection(collection, response) {
    _.each(response, function(model) {
      this.setModelParent(model);
    }, this);

    // We use set instead of reset here because in NotebookCommandView, shouldComponentUpdate uses
    // the 'changed' hash in the command Backbone model to update the view. Collection.reset does
    // not compare each model in the collection with previous model to generate the 'changed' hash
    collection.set(response);
  },
});

const NotebookModel = Backbone.Model.extend({

  urlRoot: '/notebook',

  // TODO(ahirreddy): Remove this custom destroy once we no longer have to go through the Tree for
  // deletes
  destroy(options) {
    const opts = _.extend({ url: '/tree/' + this.id }, options || {});
    return Backbone.Model.prototype.destroy.call(this, opts);
  },

  // TODO(jeffoang): Remove this custom save once we no longer have to go through the Tree for
  // file browser moves
  save(attrs, options) {
    // this should only be used by FileBrowserView:nodeDropped to move notebooks in the
    // filebrowser and rename in the filebrowser (and eventually we should eliminate those)
    // and by changes to the sort index for a node.
    // Fail fast otherwise.
    if (!attrs ||
        (!_.isEqual(_.keys(attrs), ['parentId']) &&
         !_.isEqual(_.keys(attrs), ['name']) &&
         !_.isEqual(_.keys(attrs), ['sortIndex']))) {
      throw new Error(
        'NotebookModel.save is deprecated, use rpc to call the NotebookHandler instead');
    }
    const opts = _.extend({ url: '/tree/' + this.id }, options || {});
    return Backbone.Model.prototype.save.call(this, attrs, opts);
  },

  /**
   * @param attrs {object} attributes passed into the backbone model
   * @param opts {object} must contain the option {conn: window.conn} for this model to be setup
   * properly. The only reason it should not be passed in is if this is in a test where the window
   * is not setup.
   */
  initialize(attrs, opts) {
    if (opts && opts.conn !== undefined) {
      // a reference to the MultiplexConnection object.
      this._conn = opts.conn;
    } else {
      // TODO(chaoyu/jeffpang/ahirreddy): cleaner way to mock this out
      this._conn = null;
    }

    // the command collection delta receiver
    this._commandCollection = null;
    // contexts that have registeredInterest in this model
    this._interestedContexts = [];
    this.inputs = new InputWidgetManager(this);
  },

  getName() {
    return this.get('name');
  },

  /**
   * Clears all command results
   */
  clearResults() {
    this.getCommands().forEach((c) => c.clearLocalCmdResult());
    this._notebookRpc('clearNotebookResults', {});
  },

  /**
   * Start listening for events on this notebook and its commands. If an error occurs in
   * fetching the initial notebook state, the attribute notebookFetchError will be set
   * to the error response (containing status and statusText attributes),
   * otherwise it will be null.
   *
   * @param {object} context register this object as a listener. Used in stopListening.
   * @param {object} options
   * @param {bool} options.registerCommandCollectionOnly only subscribe to command collection
   * @param {func} options.success callback on command collection fetch success
   */
  registerInterest(context, options) {
    options = _.defaults(options || {}, { registerCommandCollectionOnly: false });
    if (this._interestedContexts.length === 0) {
      this._registerCommandCollectionReceiver(options.done);
      if (!options.registerCommandCollectionOnly) {
        this.updateCommentsInAllCommands();
        this.fetchPermissionLevel();
        this.commandCollection().on('add remove reset', this.updateCommentsInCommand, this);
        this.on('change:presenceMarks', this.updateCollectionPresenceMarks);
      }
    }
    if (this._interestedContexts.indexOf(context) === -1) {
      this._interestedContexts.push(context);
    }
  },

  /**
   * Stop listening to  events on this notebook and its commands.
   *
   * @param context {object} deregister this object as a listener. Same as in startListening.
   */
  unregisterInterest(context) {
    // defer unsubscribe to CommandCollection to avoid a full fetch while switching between
    // notebook view and a dashboard view.
    _.defer(function() {
      this._interestedContexts = _.filter(this._interestedContexts, function(e) {
        return e !== context;
      });
      if (this._interestedContexts.length === 0) {
        this._unregisterCommandCollectionReceiver();
        this.off(null, null, this);
        this.commandCollection().off(null, null, this);
      }
    }.bind(this));
  },

  numInterested() {
    return this._interestedContexts.length;
  },

  validate() {
    // TODO (ahirreddy): Add some validation such that in the next update we verify that the
    // optomisticChanges we made are matched by subsequent model updates. This will help ensure we
    // are consistent in what values we change in local sets.
  },

  attach(clusterId, clusterName, errorHandler) {
    const curTags = this.tags();
    curTags.clusterId = clusterId;
    curTags.clusterName = clusterName;

    window.recordEvent('attachNotebook', curTags);
    this._notebookRpc('attach', { clusterId: clusterId }, {
      optimisticChanges: { clusterId: clusterId },
      error: errorHandler,
    });
  },

  detach() {
    window.recordEvent('detachNotebook', this.tags());
    this._notebookRpc('detach', {}, { clusterId: '' }, {
      optimisticChanges: { clusterId: '' },
    });
  },

  detachAndAttach(clusterId) {
    this._notebookRpc('detachAndAttach', { clusterId: clusterId }, {
      optimisticChanges: { clusterId: clusterId },
    });
  },

  isRunnable() {
    if (window.settings.allowRunOnPendingClusters) {
      return this.isAttached() ||
        window.clusterList.isAttachableOrInProgress(this.get('targetClusterId'));
    }
    return this.isAttached();
  },

  isAttached() {
    // clusterId is an empty string in detached state
    return this.get('clusterId') !== '' && this.get('clusterReady');
  },

  _notebookRpc(method, attrs, options) {
    options = options || {};
    if (!options.error) {
      options.error = NotebookUtilities.handleRpcError;
    }

    this.rpc(method, attrs, options);
  },

  /** Send a Github related rpc. */
  sendGitRPC(rpcName, obj, success, failure, httpMethod) {
    if (window.settings.enableNotebookGitVersioning) {
      this.rpc(rpcName, obj, {
        url: '/notebook/' + this.id + '/git',
        success: success,
        error: failure,
        httpMethod: httpMethod || 'POST',
      });
    }
  },

  // The tests directly install a list of clusters instead of a backbone collection, which causes
  // some issues with filtering the collection.
  clusterModel(clusterId) {
    if (!window.clusterList) {
      return null;
    }
    if (window.clusterList.where) {
      // It is a backbone collection.
      return window.clusterList.where({ clusterId: clusterId })[0];
    }
    return _.where(window.clusterList, { clusterId: clusterId })[0];
  },

  tags() {
    const path = this.get('path');
    const tags = {
      notebookId: this.get('id'),
      notebookLanguage: this.get('language'),
      notebookName: this.get('name'),
      path: PathNameUtils.generatePathNamesFromPathIds(path),
    };
    const clusterModel = this.clusterModel(this.get('clusterId'));
    if (clusterModel) {
      const clusterTags = clusterModel.tags();
      for (const i in clusterTags) {
        if (clusterTags.hasOwnProperty(i)) {
          tags[i] = clusterTags[i];
        }
      }
    }
    return tags;
  },

  tagsForCommand(command) {
    const tags = this.tags();
    const commandTags = command.tags();
    return _.extend(tags, commandTags);
  },

  _getOutstandingCommands() {
    return this.getCommands().filter(function(command) {
      return command.isRunning();
    });
  },

  _hasOutstandingCommands() {
    return !_.isEmpty(this._getOutstandingCommands());
  },

  _getMissingRunNotebookRequirements(options) {
    options = options || {};

    const missingRequirements = [];
    if (!this.isRunnable() && !options.allowRunPendingAttach) {
      missingRequirements.push(NotebookConstants.state.NO_CLUSTER_ATTACHED);
    }

    if (this.isRunning()) {
      missingRequirements.push(NotebookConstants.state.ALREADY_RUNNING);
    }

    return missingRequirements;
  },

  _getMissingRunCommandRequirements(command) {
    const missingRequirements = [];

    if (_.isEmpty(command.get('command'))) {
      missingRequirements.push(NotebookConstants.state.COMMAND_EMPTY);
    }

    return missingRequirements;
  },

  _getMissingRunSelectedRequirements(commands) {
    commands = commands || [];
    const missingRequirements = [];

    const runningCmds = _.filter(commands, (cmd) => (cmd.isRunning()));
    if (runningCmds.length > 0) {
      missingRequirements.push(NotebookConstants.state.SELECTED_COMMAND_RUNNING);
    }

    if (commands.length === 0) {
      missingRequirements.push(NotebookConstants.state.COMMAND_LIST_EMPTY);
    }

    return missingRequirements;
  },

  _triggerRunErrorEvent(data) {
    if (!data) {
      throw new Error('Missing run error data');
    }

    this.trigger('message', {
      type: NotebookConstants.message.RUN_ERROR,
      data: data,
    });
  },

  _handleRunCommandError(command, errors) {
    const id = command.get('id');

    this._triggerRunErrorEvent({
      commandId: id,
      errorType: errors,
    });
  },

  _handleRunNotebookError(errors) {
    this._triggerRunErrorEvent({
      errorType: errors,
    });
  },

  _handleRunSelectedError(errors) {
    this._triggerRunErrorEvent({
      errorType: errors,
    });
  },

  // @TODO(jengler) 2015-11-16: This should be isRunningFromRunAll, as that is what it actually
  // exposes. Either that or it should be changed to actually detect if the commands are running.
  isRunning() {
    return this.get('runStatus') === 'runningFromRunAll';
  },

  canRunNotebook() {
    return this._getMissingRunNotebookRequirements().length === 0;
  },

  canRunCommand(command) {
    return this.canRunNotebook() && this._getMissingRunCommandRequirements(command).length === 0;
  },

  runCommand(command, options) {
    if (!command) {
      throw new Error('No command provided to run command.');
    }

    // Check if command can be run
    const missingNotebookRequirements = this._getMissingRunNotebookRequirements(options);
    if (missingNotebookRequirements.length) {
      this._handleRunCommandError(command, missingNotebookRequirements);
      return false;
    }

    const missingCommandRequirements = this._getMissingRunCommandRequirements(command);
    if (missingCommandRequirements.length) {
      this._handleRunCommandError(command, missingCommandRequirements);
      return false;
    }

    return this._runCommand(command, options);
  },

  _runCommand(commandModel, options) {
    options = options || {};

    Presence.pushHistory('Ran a command');
    window.recordEvent('runSingleCommand', this.tagsForCommand(commandModel));

    if (this.canEdit() && !options.saveResultsToDBFS) {
      return commandModel._runCommand(options);
    }
    return commandModel._runExistingCmd(options);
  },

  runAll(options) {
    const missingNotebookRequirements = this._getMissingRunNotebookRequirements(options);
    if (missingNotebookRequirements.length) {
      this._handleRunNotebookError(missingNotebookRequirements);
      return false;
    }

    if (this._hasOutstandingCommands()) {
      // @TODO(jengler) 2015-11-16: Showing this dialog should be the responsibility of the view,
      // not the model.
      DeprecatedDialogBox.confirm({
        message: "You can't Run All while individual commands are executing. Do you want " +
          'to cancel existing executions and do a Run All?',
        confirmButton: 'Yes',
        cancelButton: 'No',
        confirm: this._runAll.bind(this),
      });
    } else {
      this._runAll();
    }
    return true;
  },

  /**
   * Run all commands that have accessed any of the giving arguments(called getArgument in code)
   * @param args [String] list of arguments
   */
  runByAccessedArgs(args) {
    if (!args || args.length === 0) { return; }
    const commands = this.getTopLevelCommands().filter((cmd) => {
      const accessedArgs = _.keys(cmd.get('accessedArgs'));
      return _.any(accessedArgs, (argName) => _.contains(args, argName));
    });
    const commandNUIDs = _.map(commands, (cmd) => cmd.get('nuid'));
    if (commandNUIDs.length > 0) {
      return this.runSelected(commandNUIDs);
    }
    return false;
  },

  _runAll() {
    window.recordEvent('runAll', this.tags());
    this._notebookRpc('runAll', {});
    // optimistically set notebook and command state to running so we get spinners immediately
    this.set('runStatus', 'runningFromRunAll');
    _.each(this.getCommands(), function(command) {
      command.set('state', 'running');
    });
    Presence.pushHistory('Ran this notebook');
  },

  /**
   * @NOTE(jengler) 2015-11-16: This is currently only used by the old dashboards
   *
   * Runs the selected subset of commands.
   * @param commandNUIDs the NUIDs of the commands to run.
   * @NOTE(Chaoyu): 'bindings' is deprecated, backend will use current notebook bindings
   * @param bindings a map of maps: commandNUID -> binding name -> new value
   *
   * The commands will be resorted by their notebook position before being
   * submitted to execution. This is useful for dashboards, which do not preserve the order of
   * the commands.
   */
  runSelected(commandNUIDs, bindings) {
    const missingNotebookRequirements = this._getMissingRunNotebookRequirements();
    if (missingNotebookRequirements.length > 0) {
      this._handleRunNotebookError(missingNotebookRequirements);
      return false;
    }

    const self = this;
    // Remove the duplicates. They are not relevant when running commands.
    const uniqueCommandNUIDs = _.uniq(commandNUIDs);
    const newBindings = {};
    const cmds = _.flatten(_.map(uniqueCommandNUIDs, function(nuid) {
      const cmd = self.commandByNUID(nuid);
      // TODO(Chaoyu): clean up "old bindings" logic
      if (cmd) {
        const bdgs = bindings && bindings[nuid];
        if (bdgs) {
          newBindings[String(cmd.id)] = bdgs;
        }
        return [cmd];
      }
      return [];
    }));

    const missingRunSelectedRequirements = this._getMissingRunSelectedRequirements(cmds);
    if (missingRunSelectedRequirements.length > 0) {
      this._handleRunSelectedError(missingRunSelectedRequirements);
      return false;
    }

    // Sort using the commands' positions. Otherwise, the order is random (depends on the
    // operation order on the command elements)
    const sortedCmds = _.sortBy(cmds, function(cmd) {
      return cmd.get('position');
    });
    const commandIds = _.map(sortedCmds, (cmd) => cmd.id);
    this._notebookRpc('runSelected', {
      commandIds: commandIds,
      newBindings: newBindings,
    });
  },

  cancelRunAll() {
    Presence.pushHistory('Cancelled notebook execution');
    window.recordEvent('cancelAll', this.tags());
    this._notebookRpc('cancelRunAll', {});
  },

  addCommand(commandText, position, execute, onCommandAdd) {
    Presence.pushHistory('Added a command');

    const guid = BrowserUtils.generateGUID();

    // create local command model optimistically
    this._commandCollection.addItem({
      // type field tells commandCollection to use NotebookCommand as model, see _getModel
      type: 'command',
      commandText: commandText,
      position: position,
      guid: guid,
      lastModifiedBy: BrowserUtils.getBrowserTabId(),
    });

    if (onCommandAdd) {
      _.delay(onCommandAdd, 100);
    }

    this._notebookRpc('addCmd', {
      commandText: commandText,
      position: position,
      guid: guid,
      execute: execute,
      lastModifiedBy: BrowserUtils.getBrowserTabId(),
    });
  },

  pasteCommand(commandAttrs, position, onCommandAdd) {
    const guid = BrowserUtils.generateGUID();

    commandAttrs = _.clone(commandAttrs);
    commandAttrs.id = undefined;
    commandAttrs.position = position;
    commandAttrs.guid = guid;

    // create local command model optimistically
    this._commandCollection.addItem(_.extend({
      type: 'command',
      lastModifiedBy: BrowserUtils.getBrowserTabId(),
    }, commandAttrs));

    if (onCommandAdd) {
      _.defer(onCommandAdd);
    }

    this._notebookRpc('pasteCmd', { cmdAttrs: commandAttrs });
  },

  draggingCommand: null,
  registerDraggingCommand(command) {
    this.draggingCommand = command;
  },

  saveDropPosition() {
    if (!this.draggingCommand) {
      return;
    }
    Presence.pushHistory('Rearranged commands');
    window.recordEvent('reorderCommands', this.tags());
    this.draggingCommand.forceUpdateCommand({
      position: this.draggingCommand.get('position'),
    });
  },

  updateDraggingPosition(newPosition) {
    if (!this.draggingCommand) {
      return;
    }
    this.draggingCommand.set('position', newPosition);
  },

  updatePresenceCommand(commandId) {
    Presence.updateCurrentCommand(this.get('id'), commandId);
  },

  updateCursorPosition(commandId, from, to) {
    Presence.updateCursorPosition(this.get('id'), commandId, from, to);
  },

  setPresenceCallback() {
    Presence.updateMarks = this.updatePresenceMarks.bind(this);
  },

  updatePresenceMarks(result) {
    this.set('presenceMarks', _.filter(result.reverse(), function(item) {
      return (item.commandId && item.cursorEnd && item.cursorStart);
    }));
  },

  updateCollectionPresenceMarks() {
    this._commandCollection.each(function(command) {
      command.set('presenceMarks', _.where(
        this.get('presenceMarks'), { commandId: command.get('id') }));
    }, this);
  },

  /**
   * Find the command model in this notebook
   *
   * @param {string} key The command id or command guid
   * @return {NotebookCommandModel}
   */
  getCommand(key) {
    return this.commandCollection().findWhere({ id: key }) ||
            this.commandCollection().findWhere({ guid: key });
  },

  /**
   * All the commands currently stored in this model, sorted by their position in the page.
   */
  getCommands() {
    const commands = this.commandCollection().filter(function(node) {
      return node.get('type') === 'command';
    });
    // Sort the command by position in order to give results with a stable order.
    return _.sortBy(commands, function(cmd) { return cmd.get('position') || 0.0; });
  },

  getTopLevelCommands() {
    // filtering out child commands, and sort commands by position
    return _.sortBy(this.getCommands().filter(function(command) {
      return !command.isChild();
    }), function(command) {
      return command.get('position');
    });
  },

  getSubCommandMap() {
    const subCommands = this.getCommands().filter(function(command) {
      return command.isChild();
    });
    // a map from parentGuid => list of subCommands for that toplevel command
    const subCommandMap = _.groupBy(subCommands, function(command) {
      return command.parentGuid();
    });
    // sort the subcommands for each parentGuid by position
    _.each(subCommandMap, function(subCommandsList, k) {
      subCommandMap[k] = _.sortBy(subCommandsList, function(command) {
        return command.get('position');
      });
    });
    return subCommandMap;
  },

  /**
   * Get the giving command's index in the command list
   *
   * @param {string} key The command id or command guid
   * @return {NotebookCommandModel}
   */
  getCommandIndex(cmdKey) {
    const commands = this.getTopLevelCommands();
    for (let i = 0; i < commands.length; i += 1) {
      const command = commands[i];
      if (command.get('id') === cmdKey || command.get('guid') === cmdKey) {
        return i;
      }
    }
    console.error('Key not found in top level commands', cmdKey);
    return -1;
  },

  getMaxPosition() {
    return _.max(this.getTopLevelCommands().map(function(command) {
      return command.get('position');
    }).concat(0));
  },

  getCommandIds() {
    return _.map(this.getTopLevelCommands(), function(command) {
      return command.get('id');
    });
  },

  /**
   * The commands that can be displayed in a dashboard: these commands must have results or be in
   * error state.
   */
  getCommandsForDashboard() {
    return this.getCommands().filter(function(cmd) {
      return cmd.get('results') || cmd.get('error') || cmd.get('displayType') === 'markdown';
    });
  },

  getComments() {
    const commandsNUIDMap = _.groupBy(this.getCommands(), function(command) {
      return command.get('nuid');
    });

    // Get all the comments whose commandNUID is an active command
    return this.commandCollection().filter(function(node) {
      return node.get('type') === 'comment' && commandsNUIDMap[node.get('commandNUID')];
    }, this);
  },

  newLocalComment(commandNUID, reference) {
    // TODO(Chaoyu): pass userinfo in, instead of accessing global settings
    const attrs = {
      type: 'comment',
      guid: BrowserUtils.generateGUID(),
      commandNUID: commandNUID,
      commentReference: reference,
      userId: window.settings.userId,
      userName: window.settings.user,
      userFullname: window.settings.userFullname,
    };
    return this._commandCollection.addItem(attrs);
  },

  commentsForCommand(commandNUID) {
    return this.commandCollection().filter(function(node) {
      return node.get('type') === 'comment' && node.get('commandNUID') === commandNUID;
    });
  },

  /**
   * Update the comments for all command objects.
   *
   * @return {None} Has the side effect of updating command models if they have comments.
   */
  updateCommentsInAllCommands() {
    const comments = this.getComments();

    this.commandNUIDToComments = _.groupBy(comments, function(comment) {
      return comment.get('commandNUID');
    });

    _.each(this.getCommands(), function(command) {
      command.set('comments', this.commandNUIDToComments[command.get('nuid')]);
    }, this);
  },

  /**
   * Update the comments in a command. This is used to keep the comment nodes in sync with the
   * command nodes when ever either is added/deleted/reset.
   *
   * @TODO(jengler) 2016-02-01: This should not be being resolved on the client side (or outside)
   * of the store. As far as I know, this is being done to act as a cache so that when we render
   * the CommandView it is a constant time lookup for the command's comments.
   *
   * @param  {Backbone.Model} model      A backbone model.

   * @return {None} Has side effect of updating the associated command model.
   */
  updateCommentsInCommand(model) {
    if (model) {
      const modelType = model.get('type');
      // If either a comment or a command has been updated, synchronize the comments.
      if (modelType === 'comment') {
        const commandNUID = model.get('commandNUID');
        const command = this.commandByNUID(commandNUID);

        // It is possible that the comment is for a deleted command. If so, don't attempt to update.
        if (command) {
          const comments = this.commentsForCommand(commandNUID);
          command.set('comments', comments);
        }
      } else if (modelType === 'command') {
        const commandNUID = model.get('nuid');

        const comments = this.commentsForCommand(commandNUID);
        model.set('comments', comments);
      }
    }
  },

  /**
   * Returns all dashboard views of this notebook
   */
  getDashboardViewModels() {
    return this.commandCollection().filter(function(node) {
      return node.get('type') === 'dashboardView';
    });
  },

  /**
   * Returns dashboard view model by id
   */
  getDashboardViewModelById(dashboardId) {
    return this.commandCollection().find(function(node) {
      return node.get('type') === 'dashboardView' && node.id === dashboardId;
    });
  },

  /**
   * Returns dashboard view model by nuid
   */
  getDashboardViewModelByNuid(dashboardNUID) {
    return this.commandCollection().find(function(node) {
      return node.get('type') === 'dashboardView' && node.get('nuid') === dashboardNUID;
    });
  },

  /**
   * Creates a new dashboard view of current notebook. The success callback function is expecting
   * an argument which is an object containing the new dashboard id: {dashboardId: 285}
   */
  createNewDashboardView(callback, title, commandNUIDs) {
    commandNUIDs = commandNUIDs || this.plottableCommandNUIDs();

    this._notebookRpc('newDashboardView', {
      title: title, commandNUIDs: commandNUIDs,
    }, { success: callback });
  },

  plottableCommandNUIDs() {
    return this.getCommands()
      .filter(function(cmd) {
        return cmd.isComplexResult() && !cmd.isChild();
      })
      .map(function(cmd) { return cmd.get('nuid'); });
  },

  /**
   * Returns a command from the notebook, using the NUID.
   * @param nuid the NUID that identifies the command
   */
  commandByNUID(nuid) {
    return _.find(this.getCommands(), (cmd) => cmd.get('nuid') === nuid);
  },

  _getModel(attrs, options) {
    switch (attrs.type) {
      case 'command':
        return new NotebookCommandModel(attrs, options);
      // TODO(dli): clean up old dashboard legacy code (dashboardV2 and dashboardPage)
      // after followup backend PR.
      case 'dashboardV2':
        return new Backbone.Model(attrs, options);
      case 'dashboardPage':
        return new Backbone.Model(attrs, options);
      case 'comment':
        return new CommentModel(attrs, options);
      case 'dashboardView':
        return new DashboardViewModel(attrs, options);
      default:
        console.error('_getModel', 'unknown type', attrs.type, attrs);
    }
  },

  // Lazily initialize and cache the command collection and the CommandCollectionDeltaReceiver
  // TODO(tjh) this should be renamed, this is command+dashboardV2+dashboardPage
  commandCollection() {
    const self = this;
    if (this._commandCollection === null) {
      const commandCollection = new CommandCollectionDeltaReceiver([], {
        deltaPublisherRoot: this.id,
        model: self._getModel,
        parent: self,
      });
      commandCollection.shellId = this.id;
      commandCollection.path = this.get('path');
      this._commandCollection = commandCollection;
    }
    return this._commandCollection;
  },

  // Returns true if the notebook's children have been loaded by the browser. This will
  // eventually return true assuming network connectivity is ok.
  loaded() {
    const cmds = this.commandCollection();
    return cmds && cmds.loaded;
  },

  /** The error response fetching the notebook, if any, otherwise null */
  notebookFetchError() {
    return this.get('notebookFetchError');
  },

  // register the command collection to receive updates
  _registerCommandCollectionReceiver(cb) {
    const self = this;
    const collection = this.commandCollection();
    if (this._conn) {
      self.set({ notebookFetchError: null });
      collection.fetchAndUpdate({
        success() {
          // only setup delta handler if the fetch succeeds
          // TODO(jeffpang/ahirreddy): is there a potential race here if there are updates between
          // the fetch and the first delta poll?
          self._conn.setDataHandler(collection.path, function(item) {
            collection.updateItem(item);
          });
          if (cb) { cb(); }
        },
        error(errorResp) {
          self.set({ notebookFetchError: errorResp });
          if (cb) { cb(); }
        },
      });
    }
  },

  // unregister the command collection from receiving updates
  _unregisterCommandCollectionReceiver() {
    if (this._conn) {
      this._conn.removeDataHandler(this.get('path') + '/');
    }
  },

  // the object type in the acl handler
  getAclObjectType() { return WorkspacePermissions.WORKSPACE_TYPE; },

  // the id of the object in the acl handler
  getAclObjectId() { return this.id; },
});

_.extend(NotebookModel.prototype, BackboneRpcMixin);
_.extend(NotebookModel.prototype, AclModelMixin);

module.exports = NotebookModel;
