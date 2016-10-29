/* eslint callback-return: 0 */

import $ from 'jquery';
import _ from 'underscore';

import SearchUtils from '../search/SearchUtils';

/**
 * Start a new Search to a REST-based search service.
 *
 * @param query {string} the query string to send
 * @param cb {function(Array)} the callback called when results are received
 * @param urlPrefix {string} the URL of the REST service. An ajax call will be made to
 *   "$urlPrefix$encodedQuery$", where $encodedQuery is the encoded query string. For example,
 *   if urlPrefix = "http://google.com/#q=" and the query is "foo bar", then we will send a ajax
 *   request to "http://google.com/#q=foo%20bar"
 * @param toResultsFunc {function(data)} a function that coverts the response of the ajax
 *   request to an array of SearchResults. This function will be called once when the entire
 *   ajax response is received.
 * @param proxy {boolean} if true, proxy the GET through the webapp
 * @param dontEncodeQuery don't run encodeURIComponent on the query
 * @param delayMillis wait for this many milliseconds before initialing the ajax call. If the
 *   search is canceled before this time, no ajax call will be made. This is useful to prevent
 *   searches from running while a user is typing.
 */
const RestSearch = function RestSearch(
    query, cb, urlPrefix, toResultsFunc, proxy, dontEncodeQuery, delayMillis) {
  this.searchId = _.random(0, 9007199254740992);
  this.query = query.trim();
  this.request = null;

  if (this.query === '') {
    this.finished = true;
    cb(null);
    return;
  }

  const startQuery =
    _.bind(this._startQuery, this, query, cb, urlPrefix, toResultsFunc, proxy, dontEncodeQuery);
  if (delayMillis) {
    _.delay(startQuery, delayMillis);
  } else {
    startQuery();
  }
};

RestSearch.prototype._startQuery = function _startQuery(
    query, cb, urlPrefix, toResultsFunc, proxy, dontEncodeQuery) {
  if (this.finished) {
    return;
  }

  const self = this;
  let targetUrl = urlPrefix;
  if (!dontEncodeQuery) {
    targetUrl += encodeURIComponent(this.query);
  } else {
    targetUrl += this.query;
  }
  const url = proxy ? '/proxy/' + encodeURIComponent(targetUrl) : targetUrl;
  this.request = $.ajax({
    type: 'GET',
    url: url,
    success(data) {
      const results = toResultsFunc(data);
      _.each(results, (result) => result.__searchId = self.searchId);
      // only send results if this request was not canceled
      if (results && self.request !== null) {
        cb(results);
      }
      self.request = null;
      self.finished = true;
      cb(null);
    },
    error(jqXHR, textStatus, errorThrown) {
      // only print error if it wasn't due to a call to stop()
      if (textStatus !== 'abort') {
        console.error("RestSearch '" + url + "' failed with error:", errorThrown);
      }
      self.request = null;
      self.finished = true;
      cb(null);
    },
  });
};

/**
 * Implements Search.matches. This default implementation returns true if and only if the
 * result came from this search or if the context matches the query.
 */
RestSearch.prototype.matches = function matches(result) {
  return result.__searchId === this.searchId ||
    SearchUtils.contextMatches(this.query, result.context);
};

/** Implements Search.stop */
RestSearch.prototype.stop = function stop() {
  this.finished = true;
  if (this.request !== null) {
    this.request.abort();
    this.request = null;
  }
};

/** Implements Search.isFinished */
RestSearch.prototype.isFinished = function isFinished() {
  return this.finished;
};

module.exports = RestSearch;
