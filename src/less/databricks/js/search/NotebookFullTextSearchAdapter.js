import _ from 'underscore';

import WebsocketSearch from '../search/WebsocketSearch';
import SearchUtils from '../search/SearchUtils';

import IconsForType from '../ui_building_blocks/icons/IconsForType';

// The webapp search API returns an array of json objects
function toResults(data) {
  return _.map(data, (json) => ({
    id: json.id,
    category: json.category,
    itemType: json.itemType,
    icon: IconsForType[json.itemType],
    displayName: json.displayName,
    fullName: json.fullName,
    url: SearchUtils.urlForUrlInfo(json.urlInfo),
    context: json.context,
    highlighter: json.highlighter,
    rankHint: json.rankHint,
  }));
}

/** Search using the webapp websocket API */
function NotebookFullTextWebsocketSearch(adapter, query, cb) {
  const toQueryData = function toQueryData(queryVal) {
    return {
      adapter: 'NotebookFullText',
      query: queryVal,
    };
  };
  return new WebsocketSearch(adapter.wsClient, query, cb, 'search', toQueryData, toResults);
}

/**
 * Implements SearchAdapter.
 */
function NotebookFullTextSearchAdapter(wsClient) {
  this.wsClient = wsClient;
}

/** Implements SearchAdapter.search */
NotebookFullTextSearchAdapter.prototype.search = function search(query, cb) {
  return new NotebookFullTextWebsocketSearch(this, query, cb);
};

module.exports = NotebookFullTextSearchAdapter;
