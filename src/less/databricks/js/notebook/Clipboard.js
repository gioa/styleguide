/* eslint func-names: 0 */

/**
 * Util model for accessing clipboard - cut/copy/paste
 */

import _ from 'underscore';
import $ from 'jquery';
import Backbone from 'backbone';

import store from '../local_storage/LocalStorageUtil';

const CLIPBOARD_STORE = 'clipboardCommand';
const CLIPBOARD_CMODE = 'clipboardCurrentMode';
const CLIPBOARD_EVENT = 'clipboardChanged';

const Clipboard = {};
_.extend(Clipboard, Backbone.Events);

$(window).bind('storage', function(e) {
  // cross tab localstorage event listener
  if (e.originalEvent.key === CLIPBOARD_STORE) {
    Clipboard.trigger(CLIPBOARD_EVENT);
  }
});

// TODO(Chaoyu): Clipboard mode(cut/copy) is not used here, but will be useful later
Clipboard.getMode = function() {
  return store.get(CLIPBOARD_CMODE);
};

Clipboard.setMode = function(mode) {
  return store.set(CLIPBOARD_CMODE, mode);
};

const shouldIgnoreExtraAttrs = function(cmd) {
  // should not copry cmd in running/input state
  return (cmd.state !== 'finished' && cmd.state !== 'error') ||
    (cmd.results && cmd.results.type === 'image');
  // TODO (Chaoyu): Not copying results related attrs when resultType == image
  // Because image file may be removed from filestore
};

Clipboard.filterValidAttrs = function(cmd) {
  if (shouldIgnoreExtraAttrs(cmd)) {
    return _.pick(cmd, [
      'command',
      'commandType',
      'bindings',
      'displayType']);
  }
  return _.pick(cmd, [
    'command',
    'commandType',
    'state',
    'resultType',
    'results',
    'error',
    'errorSummary',
    'startTime',
    'submitTime',
    'finishTime',
    'collapsed',
    'bindings',
    'inputWidgets',
    'arguments',
    'displayType',
    'height',
    'width',
    'xColumns',
    'yColumns',
    'pivotColumns',
    'pivotAggregation',
    'customPlotOptions',
    'commandTitle',
    'showCommandTitle',
    'hideCommandCode',
    'hideCommandResult',
  ]);
};

Clipboard._cachedCommand = null;

Clipboard.putCommand = function(cmd, mode) {
  Clipboard._cachedCommand = this.filterValidAttrs(cmd);

  Clipboard.setMode(mode);
  store.set(CLIPBOARD_STORE, Clipboard._cachedCommand);
  Clipboard.trigger(CLIPBOARD_EVENT);
};

Clipboard.getCommand = function() {
  if (Clipboard._cachedCommand) {
    return Clipboard._cachedCommand;
  }

  Clipboard._cachedCommand = store.get(CLIPBOARD_STORE);
  return Clipboard._cachedCommand;
};

Clipboard.isEmpty = function() {
  return !Clipboard._cachedCommand;
};

Clipboard.load = function() {
  Clipboard._cachedCommand = undefined;
  Clipboard.getCommand();
};

Clipboard.on(CLIPBOARD_EVENT, Clipboard.load);

Clipboard.load();

module.exports = Clipboard;
