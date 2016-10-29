/* eslint func-names: 0 */

/**
 * A simple wrapper for accessing HTML5 local storage
 */

import localStorageMock from '../local_storage/LocalStorageMock';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';

const store = {};

function isLocalStorageSupported() {
  const testKey = 'testKey';
  const storage = window.localStorage;
  try {
    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
    return true;
  } catch (error) {
    return false;
  }
}

store.initialize = function() {
  if (window.localStorage && isLocalStorageSupported()) {
    this.storage = window.localStorage;
    return this;
  }
  DeprecatedDialogBox.alert('Local storage is not supported by your browser. ' +
                  'Please exit "Private Mode", or upgrade to a modern browser.');

  // In private mode or older browser where localStorage is not supported,
  // we use an ephemeral localStorage mock so that user can preceed
  this.storage = localStorageMock.storageMock();
  return this;
};

store.serialize = function(value) {
  return JSON.stringify(value);
};

store.deserialize = function(value) {
  if (typeof value !== 'string') { return undefined; }
  try {
    return JSON.parse(value);
  } catch (e) {
    return value || undefined;
  }
};

store.remove = function(key) {
  this.storage.removeItem(key);
};

store.clear = function() {
  this.storage.clear();
};

store.set = function(key, val) {
  if (val === undefined) {
    return this.remove(key);
  }
  this.storage.setItem(key, store.serialize(val));
  return val;
};

store.get = function(key, defaultVal) {
  const val = this.deserialize(this.storage.getItem(key));
  return (val === undefined ? defaultVal : val);
};

store.has = function(key) {
  return Boolean(this.storage.getItem(key));
};

store.keys = function() {
  const keys = [];
  for (let i = 0, len = this.storage.length; i < len; i++) {
    keys.push(this.storage.key(i));
  }
  return keys;
};

module.exports = store.initialize();
