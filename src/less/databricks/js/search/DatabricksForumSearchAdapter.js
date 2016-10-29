/* eslint consistent-return: 0, func-names: 0 */

import _ from 'underscore';

import RestSearch from '../search/RestSearch';

import IconsForType from '../ui_building_blocks/icons/IconsForType';

const toResults = function(data) {
  try {
    return _.map(data.list, function(json) {
      const url = 'http://forums.databricks.com/questions/' + json.id + '/' + json.slug + '.html';
      return {
        id: 'com.databricks.forum.' + json.id,
        category: 'forum',
        itemType: 'help',
        icon: IconsForType.help,
        displayName: json.title,
        fullName: json.title,
        url: url,
        context: null, // TODO(jeffpang)
        highlighter: null, // TODO(jeffpang)
        rankHint: 1.0, // TODO(jeffpang)
      };
    });
  } catch (err) {
    console.warn('DatabricksForumSearch error parsing results:', err);
  }
};

const DatabricksForumSearch = function(query, cb) {
  return new RestSearch(
    query, cb, 'http://forums.databricks.com/services/v2/question.json?q=', toResults, true);
};

/**
 * Implements SearchAdapter.
 */
const DatabricksForumSearchAdapter = function() {};

/** Implements SearchAdapter.search */
DatabricksForumSearchAdapter.prototype.search = function(query, cb) {
  return new DatabricksForumSearch(query, cb);
};

module.exports = DatabricksForumSearchAdapter;
