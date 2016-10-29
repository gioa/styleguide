import _ from 'underscore';

import NavFunc from '../filetree/NavFunc.jsx';

const SearchUtils = {
  /** treeNode type => search category */
  CategoryForType: {
    'folder': 'workspace',
    'table': 'table',
    'shell': 'workspace',
    'dashboard': 'workspace',
    'library': 'workspace',
    'setting': 'menu',
    'help': 'help',
  },

  /**
   * Get the search category for a tree node model.
   *
   * @param model the TreeNode (see filebrowser/TreeNode.js)
   * @returns the search category for this node
   */
  categoryForNode(model) {
    if (model.get('id') < 0) {
      return 'menu';
    } else if (NavFunc.isExampleNode(model.get('id'))) {
      return 'help';
    }
    return this.CategoryForType[model.get('type')];
  },

  /** Get the url for a tree node model */
  urlForNode(model) {
    if (model.has('viewRoute')) {
      return '#' + model.get('viewRoute');
    } else if (model.get('type') === 'shell') {
      return '#notebook/' + model.id;
    }
    return '#' + model.get('type') + '/' + model.id;
  },

  /** Convert a URLInfo object to a URL string */
  urlForUrlInfo(urlInfo) {
    if (urlInfo.type === 'treenode') {
      return '#' + urlInfo.nodeType + '/' + urlInfo.id;
    }
    console.warn('unknown urlInfo type in ', urlInfo);
    return '';
  },

  /** True iff a query matches the SearchContext */
  contextMatches(query, context) {
    if (query === '') {
      return false;
    }
    if (context) {
      switch (context.type) {
        case 'list':
          return _.some(context.matches, (text) => SearchUtils.textMatches(query, text));
        default:
          console.warn('unknown SearchContext type ' + context.type);
          return false;
      }
    } else {
      return false;
    }
  },

  /** True iff the text string contains every word in the query (separated by spaces) */
  textMatches(query, text) {
    // TODO (jeffpang): handle some more complex parsing of solr control words
    const words = _.filter(query.split(' '), (word) => word !== 'AND');
    return _.every(words, (word) => text.toLowerCase().indexOf(word) !== -1);
  },

  /** Searches the list of fetched Spark Packages for a query. */
  sparkPackageMatches(query, sparkPackage) {
    if (sparkPackage) {
      return SearchUtils.textMatches(query, sparkPackage.searchText());
    }
    return null;
  },
};

module.exports = SearchUtils;
