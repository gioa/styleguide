/* eslint callback-return: 0 */

import _ from 'underscore';

import SearchUtils from '../search/SearchUtils';

/**
 * Start a new Search to a Websocket-based search service.
 *
 * @param {object} wsClient a websocket client
 * @param query {string} the query string
 * @param cb {function(Array)} the callback called when results are received
 * @param method {string} the method to use in the websocket RPC
 * @param toQueryData {function(string)} a function taht converts a query string to the
 *   data sent in the websocket RPC request.
 * @param toResultsFunc {function(data)} a function that coverts the update responses of the
 *   request to an array of SearchResults. This function will be called once for each
 *   streaming response sent by the websocket.
 */
const WebsocketSearch = function WebsocketSearch(
  wsClient,
  query,
  cb,
  method,
  toQueryData,
  toResultsFunc
) {
  const self = this;
  this.searchId = _.random(0, 9007199254740992);
  this.query = query.trim();
  this.request = null;

  if (this.query === '') {
    cb(null);
    return;
  }

  const data = toQueryData(query);
  this.request = wsClient.sendRPC(method, {
    data: data,
    success() {
      self.request = null;
      cb(null);
    },
    update(streamingResult) {
      const results = toResultsFunc(streamingResult);
      _.each(results, (result) => { result.__searchId = self.searchId; });
      // only send results if this request was not canceled
      if (results && self.request !== null) {
        cb(results);
      }
    },
    error(error) {
      if (error !== 'RPC cancelled') {
        console.error("WebsocketSearch '" + method + "' with", data, 'failed with error', error);
      }
      self.request = null;
      cb(null);
    },
  });
};

/**
 * Implements Search.matches. This default implementation returns true if and only if the
 * result came from this search or if the context matches the query.
 */
WebsocketSearch.prototype.matches = function matches(result) {
  return result.__searchId === this.searchId ||
    SearchUtils.contextMatches(this.query, result.context);
};

/** Implements Search.stop */
WebsocketSearch.prototype.stop = function stop() {
  if (this.request !== null) {
    this.request.cancel();
    this.request = null;
  }
};

/** Implements Search.isFinished */
WebsocketSearch.prototype.isFinished = function isFinished() {
  return this.request === null;
};

module.exports = WebsocketSearch;
