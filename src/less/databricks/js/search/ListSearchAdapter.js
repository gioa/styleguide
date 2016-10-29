/* eslint callback-return: 0 */

import _ from 'underscore';

import SearchUtils from '../search/SearchUtils';

/**
 * Implements Search.
 */
function ListSearch(adapter, query, cb) {
  const self = this;
  this.query = query;
  this.adapter = adapter;
  this.finished = false;

  // searches can not return results in their constructor
  _.defer(() => {
    self.finished = true;
    const matches = _.filter(adapter.list, (result) => adapter.matchFunc(query, result));
    if (matches) {
      cb(matches);
    }
    cb(null);
  });
}

ListSearch.prototype.matches = function matches(result) {
  return this.adapter.matchFunc(this.query, result);
};

/** Implements Search.stop */
ListSearch.prototype.stop = () => {};

/** Implements Search.isFinished */
ListSearch.prototype.isFinished = function isFinished() {
  return this.finished;
};

function defaultMatchFunc(query, result) {
  return SearchUtils.textMatches(query, result.displayName);
}

/**
 * A SearchAdapter that matches against a provided list of results.
 *
 * @param list {array} an array of SearchResult objects that queries will match against.
 * @param matchFunc {function(string, object)} a function that takes the query and a result
 *   and returns true iff the result matches the query. If not provided, the default matchFunc
 *   matches against the displayName of the result.
 */
function ListSearchAdapter(list, matchFunc) {
  this.list = list;
  this.matchFunc = matchFunc || defaultMatchFunc;
}

/** Implements SearchAdapter.search */
ListSearchAdapter.prototype.search = function search(query, cb) {
  return new ListSearch(this, query, cb);
};

module.exports = ListSearchAdapter;
