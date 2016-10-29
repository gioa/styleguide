/**
 * A Backbone model for a base query run periodically to support a dashboard.
 *
 * DEPENDENCIES: Backbone, Utility
 */

import Backbone from 'backbone';

import { BrowserUtils } from '../../user_platform/BrowserUtils';

const BaseQuery = Backbone.Model.extend({
  initialize() {
    // Common properties on all widgets to define their position
    this.set('command', this.get('command') || '');
    this.set('type', this.get('type') || 'sql');
    if (!this.has('guid')) {
      this.set('guid', BrowserUtils.generateGUID());
    }
  },
});

module.exports = BaseQuery;
