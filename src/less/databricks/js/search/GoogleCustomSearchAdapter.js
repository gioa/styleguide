/* eslint consistent-return: 0 */

import _ from 'underscore';

const RestSearch = require('../search/RestSearch');

function GoogleCustomSearch(query, cb, adapter) {
  this.adapter = adapter;
  // The webapp will rewrite the URL and append the API key
  const fields = 'items(title,link,snippet)';
  const queryString = 'fields=' + fields + '&q=';
  // Make sure to keep the uri prefix in-sync with ProxyHandler.scala
  const url = 'GoogleCustomSearch/' + adapter.cx + '/' + queryString;
  return new RestSearch(query, cb, url, this.toResults.bind(this), true, false, 500);
}

GoogleCustomSearch.prototype.getCategoryParams = function getCategoryParams(url) {
  const ssp = url.replace(/^https?:\/\//, '');

  for (let i = 0; i < this.adapter.categoryParams.length; i += 1) {
    const map = this.adapter.categoryParams[i];
    if (ssp.indexOf(map.urlPrefix) === 0) {
      return map;
    }
  }

  return null;
};

GoogleCustomSearch.prototype.toResults = function toResults(data) {
  const self = this;

  try {
    if (!data || !data.items) {
      return [];
    }
    const results = data.items.map((json) => {
      const params = self.getCategoryParams(json.link);
      if (!params) {
        console.warn("didn't find category params for ", json.link);
        return null;
      }

      return {
        id: 'gcse:' + json.link,
        category: params.category,
        itemType: 'help',
        icon: params.icon,
        displayName: params.getDisplayName ? params.getDisplayName(json) : json.title,
        fullName: json.snippet,
        url: json.link,
        context: { type: 'list', matches: [json.snippet] },
        highlighter: null,
        rankHint: 1.0,
      };
    });

    return _.filter(results, (result) => result !== null);
  } catch (err) {
    console.warn('GoogleCustomSearchAdapter error parsing results:', err);
  }
};

/**
 * Search via a Google Custom Search. We proxy all requests through the webapp, which
 * appends the API key for making the actual GET request to Google. Thus, in order to add a new
 * Google Custom Search and have it work, you must add it to ProxyHandler.scala:rewriteUrl().
 *
 * Implements SearchAdapter.
 *
 * @categoryParams an array of objects that describe how to to map each google result to our
 *   internal search categories. e.g.,
 *   [{
 *     urlPrefix: "spark.apache.org", // the prefix of the URL that matches this object (required)
 *     category: "help", // identifier of the internal category (required)
 *     icon: IconsForType.document, // icon for elements in the list (optional)
 *     iconType: "help", // iconType for elements in the list (optional)
 *     getDisplayName: function(item) { // function to rewrite the title of the document (optional)
 *       ...
 *     }
 *   }]
 *   this would map all results that start with "apache.spark.org" into the "help" category
 *   with the associated icons and display name. If multiple objects match the result URL,
 *   the first one is used.
 * @cx the identifier of the google custom search engine
 */
function GoogleCustomSearchAdapter(cx, categoryParams) {
  this.cx = cx;
  this.categoryParams = categoryParams;
}

/**
 * Implements SearchAdapter.search
 */
GoogleCustomSearchAdapter.prototype.search = function search(query, cb) {
  return new GoogleCustomSearch(query, cb, this);
};

module.exports = GoogleCustomSearchAdapter;
