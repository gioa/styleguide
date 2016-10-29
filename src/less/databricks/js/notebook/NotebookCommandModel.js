/* eslint consistent-return: 0, func-names: 0 */

/**
 * Model representing a single shell command within a ShellSession;
 */

import _ from 'underscore';
import Backbone from 'backbone';

import Presence from '../presence/Presence';

import BackboneRpcMixin from '../notebook/BackboneRpcMixin';
import { CodeModeUtils } from '../notebook/CodeModeUtils';
import { CommandStateUtils } from '../notebook/CommandUtils';
import NotebookUtilities from '../notebook/NotebookUtilities';

import { BrowserUtils } from '../user_platform/BrowserUtils';

const NotebookCommandModel = Backbone.Model.extend({

  defaults: {
    deltaVersion: -1,
    // Used to cheaply track changes to the model. Similar to deltaVersion, and will update to
    // deltaVersion on remote updates. However, on local updates it will also increment (by
    // 0.0001) so that we correctly re-render.
    localVersion: 1,
    running: false,
    state: 'input',
    shouldRun: false,
    rerunning: false,
    stages: [],
    guid: BrowserUtils.generateGUID(),
    commandType: 'auto',
    command: '',
    commandVersion: 0,
    results: null,
    errorSummary: null,
    error: null,
    startTime: 0,
    submitTime: 0,
    finishTime: 0,
    collapsed: false,
    bindings: {},
    displayType: 'table',
    width: 'auto',
    height: 'auto',
    xColumns: null,
    yColumns: null,
    pivotColumns: null,
    commentThread: [],
    commentsVisible: false,
    parentHierarchy: [],
    diffInserts: [],
    diffDeletes: [],
    presenceMarks: [],
    commandTitle: null,
    showCommandTitle: false,
    hideCommandCode: false,
    hideCommmandResult: false,
    accessedArgs: {},
  },

  initialize() {
    this.listenTo(this, 'change:results', this.parseNonNumericEntries);
    this.listenTo(this, 'change:width change:height', _.debounce(this.formatWidthHeight, 1), this);
    this.formatWidthHeight();

    const enableLegacySQLWidgetUI = window.settings && window.settings.enableLegacySQLWidgets;
    if (enableLegacySQLWidgetUI) {
      this.listenTo(this, 'change:arguments', this.saveLocalBindings);
      this.saveLocalBindings();
    }

    // Setup array of comments - need to do it here in order to be unique to each shellCommand;
    if (!this.get('commentThread')) {
      this.set('commentThread', []);
    }
  },

  formatWidthHeight() {
    const width = this.get('width');
    const height = this.get('height');

    if (width !== 'auto' && isNaN(parseInt(width, 10))) {
      this.set({ 'width': 'auto' });
    }

    if (width !== 'auto' && isNaN(parseInt(height, 10))) {
      this.set({ 'height': 'auto' });
    }
  },

  // Attributes that can be changed from the UI
  localModifiableAttrs: [
    'position',
    'command',
    'height',
    'width',
    'bindings',
    'displayType',
    'customPlotOptions',
    'pivotAggregation',
    'pivotColumns',
    'xColumns',
    'yColumns',
  ],

  /**
   * If last modification to this command is made by current user, we filter out attributes
   * that have already been set locally before send the update rpc
   * @override
   */
  set(attributes, options) {
    if (!attributes) { return this; }

    if (options && options.deltaEvent &&
        attributes.lastModifiedBy &&
        attributes.lastModifiedBy === BrowserUtils.getBrowserTabId()) {
      if (options.deltaEvent === 'update' || options.deltaEvent === 'full') {
        attributes = _.omit(attributes, this.localModifiableAttrs);
      } else if (options.deltaEvent === 'create') {
        // special case for command creation, since command text can't be changed by backend
        // it must be outdated compare to the command text in user's text editor
        delete attributes.command;
      }
    }

    // Increment the local version on every set. The first run of this method sets the default
    // arguments, so only update the localVersion if it has been previously set.
    if (this.get('localVersion')) {
      Backbone.Model.prototype.set.call(
        this,
        { 'localVersion': this.get('localVersion') + 1 },
        { silent: true });
    }

    return Backbone.Model.prototype.set.call(this, attributes, options);
  },

  commandRpc(method, attrs, options) {
    const self = this;

    options = options || {};

    if (!options.error) {
      options.error = NotebookUtilities.handleRpcError;
    }

    // Don't send unless we have the model id from the server
    options.sendCondition = function() {
      return !!(self.get('id'));
    };

    this.rpc(method, attrs, options);
  },

  urlRoot() {
    return (this.notebook() && this.notebook().url()) + '/command';
  },

  notebook() {
    return this.get('parent');
  },

  forceUpdateCommand(changes) {
    this.commandRpc('updateCmd', { changes: changes }, { optimisticChanges: changes });
  },

  /**
   * Update only changed attributes
   * This method requires EDIT permission on the notebook
   */
  updateCommand(changes, options, rpcOptions) {
    if (!changes) { return false; }
    if (!this.notebook().canEdit()) {
      console.error('Current user has no EDIT permission.');
      return false;
    }

    const changedAttributes = _.filter(_.keys(changes), function(key) {
      return !_.isEqual(this.get(key), changes[key]);
    }, this);
    changes = _.pick(changes, changedAttributes);

    if (_.isEmpty(changes)) {
      return false;
    }
    // lastModifiedBy is being set to all updateCmd rpcs
    changes.lastModifiedBy = BrowserUtils.getBrowserTabId();

    this.set(changes, options);
    this.commandRpc('updateCmd', { changes: changes }, rpcOptions);
    return true;
  },

  /**
   * Update command bindings
   * This method requires only RUN permission on the notebook
   */
  updateBindings(newBindings, options) {
    if (_.isEqual(this.get('bindings'), newBindings)) {
      return; // nothing to change
    }
    this.set({ bindings: newBindings }, options);
    this.commandRpc('updateBindings', { newBindings: newBindings });
  },

  /**
   * Reset results related fields, this is an optimistic update to *local* command model
   * when sending clearCommandResult RPC
   */
  clearLocalCmdResult() {
    // for subcommand, if parent is in running state, don't clear its results
    const parent = this.getParentCommmand();
    if (parent && parent.isRunning()) {
      return;
    }

    // logic here should be synced with NotebookStorageService.clearCommandResult method
    if (this.isRunning()) {
      this.set({
        results: null,
        error: null,
        errorSummary: null,
      });
    } else {
      this.set({
        results: null,
        error: null,
        errorSummary: null,
        startTime: 0,
        finishTime: 0,
        arguments: [],
        stages: [],
      });
    }
  },

  /*
   * Clears all information related to results in the cell:
   * results, error, starTime, finishTime, arguments, stages and %run subcommands
   */
  clearResults() {
    this.clearLocalCmdResult();
    this.commandRpc('clearCommandResult', {});
  },

  // @TODO(jengler) 2015-12-16: This is a quick fix for PROD-8472. We should clean this up to have
  // a consistent interface for getting the display type of a command. Right now, different places
  // are getting it in different ways and some seem to not support all types, for example:
  //  NotebookUtilities.js::getDisplayType: Only returns "markdown" or "table"
  //  NotebookUtilities.js::isDownloadable: Takes a "displayType" param that can be "image"
  //  NotebookUtilities.js::isResizable: Takes a "displayType" param that can be "html"
  displayType() {
    const results = this.get('results');
    if (results) {
      return results.type;
    }
    return NotebookUtilities.getDisplayType(this.get('command'));
  },

  tags() {
    const tags = {
      commandId: this.get('guid'),
      source: 'NotebookCommandModel',
      displayType: this.displayType(),
    };

    if (this.notebook()) {
      tags.commandLanguage = CodeModeUtils.determineCodeLang(
        this.get('command'), this.notebook().get('language'));
    }


    tags.isParamQuery = this.isParamQuery();
    return tags;
  },

  isRunning() {
    return CommandStateUtils.isRunning(this.get('state'));
  },

  _setRunningState() {
    // set state running to local model to trigger spinner to show up
    this.set({
      'state': 'running',
      'stages': [],
    });
  },

  // Requires EDIT and RUN permission, because it updates the command text
  _runCommand(options) {
    options = options || {};
    const command = options.command || this.get('command');
    const bindings = options.bindings || this.get('bindings');

    this._setRunningState();
    this.commandRpc('runCmd', {
      newCommandText: command,
      newBindings: bindings,
    });

    return true;
  },

  // Requires only RUN permission
  _runExistingCmd(options) {
    options = options || {};
    const bindings = options.bindings || this.get('bindings');
    const saveResultsToDBFS = options.saveResultsToDBFS || false;

    this._setRunningState();
    this.commandRpc('runExistingCmd', {
      newBindings: bindings,
      saveResultsToDBFS: saveResultsToDBFS,
    });

    return true;
  },

  runCommand(options) {
    this.notebook().runCommand(this, options);
  },

  getResultDownloadURL(options) {
    this.commandRpc('getResultDownloadURL', {}, options);
  },

  /**
   * Re-run a command and save the results to DBFS.  options.commandFinished will be called once the
   * command completes, not once the RPC completes. All other options are passed on to the RPC.
   */
  runCommandAndSaveResults(options) {
    const handleStateChange = function(e, newState) {
      if (newState === 'finished') {
        if (options.commandFinished) {
          options.commandFinished();
        }
      }

      if (newState !== 'running') {
        // This handler only handles a single transition from running->finished.
        this.off('change:state', handleStateChange);
      }
    }.bind(this);

    this.on('change:state', handleStateChange, this);

    const opts = _.extend({}, options, {
      saveResultsToDBFS: true,
      commandFinished: null,
    });
    this.runCommand(opts);
  },

  cancelCommand() {
    Presence.pushHistory('Cancelled command execution');
    this.commandRpc('cancelCmd');
  },

  removeCommand() {
    Presence.pushHistory('Deleted command');
    this.commandRpc('removeCmd');
  },

  parseNonNumericEntries() {
    // Because JSON does not support Infinity and NaN, we pass them as strings.
    // Here we perform conversion from strings to the Javascript numeric equivalents.
    const results = this.get('results');

    // TODO(someone): Escape sequences because of errors being thrown; find cleaner way to do this
    if (!results) {
      return;
    } else if (!results.data.map) {
      return;
    } else if (results.type === 'collection') {
      _.each(results.collection, this.parseNonNumericEntriesInResult);
    } else {
      this.parseNonNumericEntriesInResult(results);
    }
  },

  parseNonNumericEntriesInResult(results) {
    const _this = this;
    results.data.forEach(function(row, i) {
      row.forEach(function(col, j) {
        if (col === 'Infinity') {
          _this.get('results').data[i][j] = Infinity;
        } else if (col === 'Negative Infinity') {
          _this.get('results').data[i][j] = -Infinity;
        } else if (col === 'NaN') {
          _this.get('results').data[i][j] = NaN;
        }
      });
    });
  },

  getCommand() {
    return this.get('command');
  },

  isChild() {
    // TODO (jeffpang): refactor the NotebookManager to use a flag to indicate this is a subview
    return this.get('parentHierarchy') !== undefined &&
      this.get('parentHierarchy') !== null &&
      this.get('parentHierarchy').length > 0;
  },

  /*
   * Param query are commands that have set parameter via getArgument() or $const in the code
   * for param query we need to render input widgets for update parameter
   * */
  isParamQuery() {
    return !_.isEmpty(this.get('arguments'));
  },

  /*
   * ComplexResult means we will use a dashboard view to display the result
   */
  isComplexResult() {
    const results = this.get('results');
    const cmd = this.get('command');
    return ((results && results.type === 'table' && results.data.length > 0) ||
            (results && results.type === 'image') ||
            (results && results.type === 'htmlSandbox') ||
            (this.isMarkdownCommand(cmd)) ||
            this.isParamQuery());
  },

  isMarkdownCommand(cmd) {
    cmd = cmd || this.get('command');
    return cmd && NotebookUtilities.getDisplayType(cmd) === 'markdown';
  },

  parentGuid() {
    // TODO (jeffpang): refactor the NotebookManager to use a single variable to indicatate parent
    return this.get('parentHierarchy')[0];
  },

  getParentCommmand() {
    if (this.isChild()) {
      return this.notebook().getCommand(this.parentGuid());
    }
  },

  // Analyzes the new command and finds if some the bindings for this command need updating.
  // Update command to new bindings (if any)
  saveLocalBindings() {
    const _arguments = this.get('arguments');
    const bindings = this.get('bindings');
    if (_arguments && !_.isEqual(_.keys(_arguments).sort(),
                                _.keys(bindings).sort())) {
      const newBindings = _.reduce(_.keys(_arguments), function(_newBindings, key) {
        _newBindings[key] = bindings[key] || _arguments[key] || '';
        return _newBindings;
      }, {});

      this.updateBindings(newBindings);
    }
  },

  updatePresenceCommand() {
    this.notebook().updatePresenceCommand(this.get('id'));
  },

  updateCursorPosition(from, to) {
    this.notebook().updateCursorPosition(this.get('id'), from, to);
  },

  getComments() {
    return this.get('comments');
  },

  getTitle() {
    if (_.isEmpty(this.get('commandTitle'))) {
      return 'Untitled';
    }
    return this.get('commandTitle');
  },
});

_.extend(NotebookCommandModel.prototype, BackboneRpcMixin);

module.exports = NotebookCommandModel;
