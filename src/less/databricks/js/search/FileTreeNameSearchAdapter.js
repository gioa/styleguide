/* eslint callback-return: 0, func-names: 0 */

import _ from 'underscore';

import { FileBrowserUtils } from '../filebrowser/FileBrowserUtils';

import SearchUtils from '../search/SearchUtils';

/**
 * extends SearchAdapter
 *
 * @param topLevelFolders the topLevelFolders from the FileBrowserView for the locally cached
 *    file tree. If this reference changes, you must recreate the FileTreeNameSearchAdapter.
 */
const FileTreeNameSearchAdapter = function FileTreeNameSearchAdapter(
  topLevelFolders,
  maxBatchSize,
  filterTopLevel
) {
  this.topLevelFolders = topLevelFolders;
  // maximum number of nodes to process in one batch (set lower to be more interactive)
  this.maxBatchSize = maxBatchSize || 30;
  this.filterTopLevel = filterTopLevel || false;
};

/**
 * extends Search
 *
 * @param adapter the FileTreeNameSearchAdapter that created this search
 * @param query the search query
 * @param cb the callback that will be called when there are new search results
 */
const FileTreeNameSearch = function FileTreeNameSearch(adapter, query, cb) {
  const self = this;

  // queue of items that remain to be searched (including subtrees)
  // each item is a tuple of {node: treeCollectionNode, path: string}
  this.queue = [];
  this.query = query.toLowerCase();
  this.cb = cb;
  this.adapter = adapter;

  if (this.query !== '') {
    this.queue = _.map(this.adapter.topLevelFolders, function(node) {
      return { node: node, path: '' };
    });
    _.delay(function() { self._fillSearchResults(); }, 1);
  } else {
    // nothing to search
    cb(null);
  }
};

FileTreeNameSearch.prototype._isTopLevel = function _isTopLevel(result) {
  return _.any(this.adapter.topLevelFolders, function(f) {
    return f.model.get('id') === result.id;
  });
};

// implements Search.matches
FileTreeNameSearch.prototype.matches = function matches(result) {
  if (this.query === '') {
    return false;
  }
  if (this.adapter.filterTopLevel && this._isTopLevel(result)) {
    return false;
  }
  const typeForSearch = (result.itemType === 'shell' ? 'notebook' : result.itemType);
  return result.displayName.toLowerCase().indexOf(this.query) !== -1 ||
    typeForSearch.toLowerCase().indexOf(this.query) !== -1 ||
    result.category.toLowerCase().indexOf(this.query) !== -1;
};

// private method
FileTreeNameSearch.prototype._fillSearchResults = function _fillSearchResults() {
  const self = this;

  // JS linter doesn't like functions inlined in the for-loop
  const enqueueChildren = function(node, parentPath) {
    if (node.children) {
      _.each(node.children, function(childNode) {
        if (childNode.model.get('hidden') === true) {
          return;
        }
        self.queue.push({ node: childNode, path: parentPath });
      });
    }
  };

  const results = [];
  for (let i = 0; i < this.adapter.maxBatchSize; i++) {
    if (this.queue.length === 0) {
      break;
    }
    const item = this.queue.shift();
    const name = item.node.model.get('name');

    const result = FileTreeNameSearchAdapter.toSearchResult(item.node, item.path);
    if (this.matches(result)) {
      results.push(result);
    }

    const path = item.path + '/' + name;
    enqueueChildren(item.node, path);
  }

  if (results.length > 0) {
    this.cb(results);
  }

  if (this.queue.length === 0) {
    // we're done searching
    this.cb(null);
  } else {
    // continue searching after UI updates so we don't block the UI for too long
    _.delay(function() { self._fillSearchResults(); }, 1);
  }
};

// implements Search.stop
FileTreeNameSearch.prototype.stop = function stop() {
  // empty the queue so the next iteration of _fillSearchResults will return false
  this.queue = [];
};

// implements Search.isFinished
FileTreeNameSearch.prototype.isFinished = function isFinished() {
  return this.queue.length === 0;
};

// private static method (used in FileTreeNameSearch and in tests)
FileTreeNameSearchAdapter.toSearchResult = function toSearchResult(entry, parentPath) {
  const model = entry.model;
  const category = SearchUtils.categoryForNode(model) || 'unknown'; // Default if no type
  const name = model.get('name') || ''; // Default in case name is not defined
  const id = model.has('id') ? model.get('id') : name; // Tables lack IDs
  const icon = FileBrowserUtils.iconsForModel(model).icon;
  const url = entry.url || SearchUtils.urlForNode(model);

  return {
    id: id,
    category: category,
    itemType: model.get('type') || '', // Default in case itemType is not defined.
    icon: icon,
    displayName: name,
    fullName: parentPath + '/' + name,
    url: url,
    context: null, // NA for filename search
    highlighter: null, // TODO(jeffpang)
    rankHint: 2.0, // TODO(jeffpang): for now this is just > than full-text matches
  };
};

// implements SearchAdapter.search
FileTreeNameSearchAdapter.prototype.search = function search(query, cb) {
  return new FileTreeNameSearch(this, query, cb);
};

module.exports = FileTreeNameSearchAdapter;
