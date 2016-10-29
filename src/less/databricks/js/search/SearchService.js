/* eslint func-names: 0 */

import _ from 'underscore';

import { ArrayUtils } from '../js_polyfill/ArrayUtils';

/**
 * See this design doc for more information about the interfaces for the SearchService:
 * http://docs.google.com/a/databricks.com/document/d/1dZ1gO46HNVqa8hTYS3ZKuD5yqa8cb1KlEybUW-Ei27c
 *
 * @param adapters {array} an array of SearchAdapters. NOTE: when the search(query, cb) method of
 *   the adapter is called, it may NOT call the callback cb during the execution of the method.
 *   Instead, any results that are available immediately should be deferred. E.g., via
 *   _.defer(function() { cb(results); });
 * @constructor
 */
const SearchService = function(adapters) {
  const self = this;
  self.searches = [];
  self.results = [];
  self.searching = true;
  self.searchAdapters = adapters;
  // strictly increasing index of search results received, used for preserving order
  self.resultReceiveIndex = 0;
};

/**
 * Private method.
 *
 * @param results the raw results from (possibly old) searches to refine
 * @returns the refined list of search results (one result per key)
 */
SearchService.prototype._refineResults = function(results) {
  const self = this;
  // ask each outstanding search to filter the current set of results
  const filteredGroups = _.map(self.searches, function(search) {
    return _.filter(results, function(result) { return search.matches(result); });
  });
  // merge the filtered results to get one per key
  const groupedGroups = _.groupBy(_.flatten(filteredGroups), function(result) {
    return result.id;
  });
  const mergedGroups = _.map(groupedGroups, function(group) {
    // TODO(jeffpang): more intelligent merging of results, for now take the highest ranking
    return ArrayUtils.argmax(group, function(r) { return r.rankHint; });
  });
  // first sort by receive time so results are in the order in which they were received
  const sortedByTime = _.sortBy(mergedGroups, function(r) {
    return r._searchServiceReceiveTime;
  });
  // next stably sort by rank so higher rank items are closer to the top
  const sortedByRank = _.sortBy(sortedByTime, function(r) {
    return -r.rankHint;
  });
  return sortedByRank;
};

/**
 * Start a search in all the search adapters.
 *
 * @param query {string} the query text
 * @param onUpdate {function(Array, boolean)} a callback that is called when the search results
 *   are updated. The callback will be called with all the search results we have so far
 *   and a status indicator whether the search is finished or not.
 * @param useOldResults {boolean} Try to match the query against cached results. This is useful
 *   to prevent results from "flickering" by appearing and disappearing, but may result in stale
 *   results being preserved (e.g., if a search result matches but the document was since removed)
 */
SearchService.prototype.search = function(query, onUpdate, useOldResults) {
  const self = this;
  self.searching = true;

  const updateResults = function() {
    // refine the stale results (re-order, merge, etc.)
    self.results = self._refineResults(self.results);
    if (onUpdate) {
      onUpdate(self.results, self.searching);
    }
  };

  // callback to process search results
  const cb = function(results) {
    if (!results) {
      self.searching =
        !_.every(self.searches, function(s) { return s.isFinished(); });
    } else {
      for (let i = 0; i < results.length; i += 1) {
        // attach an index on the result to preserve ordering in ranking
        results[i]._searchServiceReceiveTime = self.resultReceiveIndex;
        self.resultReceiveIndex += 1;
        self.results.push(results[i]);
      }
    }
    updateResults();
  };

  // stop old searches
  _.each(self.searches, function(s) { s.stop(); });

  if (!useOldResults) {
    // empty query always matches nothing
    self.results = [];
  }
  // start new searches
  self.searches = _.map(self.searchAdapters, function(adapter) {
    return adapter.search(query, cb);
  });
  updateResults();
};

/**
 * @returns true iff all the searches started with the last call to search() are finished
 */
SearchService.prototype.isFinished = function() {
  return _.every(this.searches, function(s) { return s.isFinished(); });
};

module.exports = SearchService;
