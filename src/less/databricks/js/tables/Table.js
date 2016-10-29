/**
 * Individual file as part of user repository
 *
 * DEPENDENCIES: Backbone
 */

import Backbone from 'backbone';

const Table = Backbone.Model.extend({
  defaults: {
    type: 'table',
    name: 'Untitled',
    progress: false,
    fractionCached: 0.0,
    canCache: false,
    viewRoute: null,
    hasError: false,
    comments: '',
  },

  nodeMapKey() {
    return 'table-' + this.get('name');
  },

  url() {
    return '/tables/table-' + this.get('name');
  },
});

module.exports = Table;
