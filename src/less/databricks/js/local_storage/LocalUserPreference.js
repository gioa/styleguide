/**
 * Util model for accessing local preference for user
 *
 * Example usage:
 * const localNotebookPreference = new LocalUserPreference(notebook.id);
 * localNotebookPreference.set("resultsonly", true);
 * localNotebookPreference.get("resultsonly"); // => true
 *
 * This model uses HTML5 localStorage to store the local preference, it is accessible
 * in different tabs. The 'preferencechanged' event will triggered every time set function
 * is called(even if it is called in other tabs in the same computer);
 */

import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';

import LocalStorageUtil from '../local_storage/LocalStorageUtil';

const PREFERENCE_CHANGED_EVENT = 'preferenceChanged';

function LocalUserPreference(identifier) {
  const self = this;
  this.store = LocalStorageUtil;
  const userName = window.settings ?
    (window.settings.user + '-' + window.settings.orgId) : 'unknown';
  this.storeKey = userName + '-' + identifier;

  $(window).bind('storage', function storageHandler(e) {
    // cross tab localstorage event listener
    if (e.originalEvent.key && e.originalEvent.key.indexOf(this.storeKey) === 0) {
      self.trigger(PREFERENCE_CHANGED_EVENT);
    }
  });
}

_.extend(LocalUserPreference.prototype, Backbone.Events);

LocalUserPreference.prototype.set = function set(key, val) {
  this.store.set(this.storeKey + '-' + key, val);
  this.trigger(PREFERENCE_CHANGED_EVENT);
};

LocalUserPreference.prototype.get = function get(key) {
  return this.store.get(this.storeKey + '-' + key);
};

LocalUserPreference.prototype.clear = function clear() {
  this.trigger(PREFERENCE_CHANGED_EVENT);
  _.filter(this.store.keys(), function storeKeyFilter(key) {
    return key.indexOf(this.storeKey) === 0; // starts with storeKey
  }).forEach(function removeKeys(key) {
    this.store.remove(key);
  });
};

module.exports = LocalUserPreference;
