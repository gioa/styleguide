/**
 * General Widget superclass
 */

import Backbone from 'backbone';

import { BrowserUtils } from '../user_platform/BrowserUtils';

const Widget = Backbone.Model.extend({
  initialize() {
    // Common properties on all widgets to define their position
    this.setIfMissing('x', 0);
    this.setIfMissing('y', 0);
    this.setIfMissing('width', 'auto');
    this.setIfMissing('height', 'auto');
    this.setIfMissing('guid', BrowserUtils.generateGUID());
  },

  /**
   * Set a default value for a property in a way that works with inheritance
   * (BackBone's "defaults" field does not work in that case).
   */
  setIfMissing(property, value) {
    if (!this.has(property)) {
      this.set(property, value);
    }
  },

  /**
   * Get one of our length properties (width or height) as a CSS-friendly length. This means
   * that for "auto" we return "auto", but for numbers we add "px" as the unit.
   */
  getCSSLength(property) {
    const length = this.get(property);
    return (length === 'auto') ? 'auto' : length + 'px';
  },
});

module.exports = Widget;
