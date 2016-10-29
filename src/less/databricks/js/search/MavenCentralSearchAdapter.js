/* eslint consistent-return: 0 */

import $ from 'jquery';

import MavenPackage from '../libraries/search/MavenPackage';

import RestSearch from '../search/RestSearch';

function toResults(searchResult) {
  try {
    const list = [];
    if (searchResult.response) {
      $.each(searchResult.response.docs, (idx, p) => {
        const newPackage = new MavenPackage();
        // searchResult doesn't have a field isTest when coming from Maven. This is a hack to
        // prevent the fetching of releases from Maven Central during tests.
        const parsed = newPackage.parse(p, searchResult.isTest);
        if (parsed.isValid()) {
          list.push(parsed);
        }
      });
    }
    return list;
  } catch (err) {
    console.warn('MavenCentralSearch error parsing results:', err);
  }
}

function MavenCentralSearch(query, cb) {
  const advancedQuery = $.param({
    q: query,
    wt: 'json',
    rows: 20, // receive 20 results in JSON format
  });
  return new RestSearch(
    advancedQuery, cb, 'http://search.maven.org/solrsearch/select?', toResults, true, true);
}

/**
 * Implements SearchAdapter.
 */
const MavenCentralSearchAdapter = () => {};

/** Implements SearchAdapter.search */
MavenCentralSearchAdapter.prototype.search = function search(query, cb) {
  return new MavenCentralSearch(query, cb);
};

module.exports = MavenCentralSearchAdapter;
