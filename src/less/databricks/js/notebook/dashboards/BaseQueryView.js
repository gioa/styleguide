/* eslint callback-return: 0 */

/**
 * A view for BaseQueries. This gets nested inside DashboardView.
 */

import _ from 'underscore';
import Backbone from 'backbone';

import dashboardBaseQueryTemplate from '../../templates/dashboardBaseQuery.html';

import DeprecatedDialogBox from '../../ui_building_blocks/dialogs/DeprecatedDialogBox';

const BaseQueryView = Backbone.View.extend({
  initialize(options) {
    this.parent = options.parent;
    this.listenTo(this.model, 'change:command', this.modelCommandChanged);
    this.listenTo(this.model, 'change:type', this.modelTypeChanged);

    // As a huge hack, we'll save the whole dashboard whenever we have a change() event
    this.listenTo(this.model, 'change', this.modelChanged);
  },

  modelChanged() {
    // Fire a change event on the parent later, because otherwise we get a cycle of us calling
    // modelChanged() and it calling set() on us with new values before this change event is
    // done.
    const _this = this;
    setTimeout(function callModelChanged() { _this.parent.modelChanged(); }, 0);
  },

  events: {
    'click .delete-query-button': 'removeFromDashboard',
    'change .command-box': 'localCommandChanged',
    'blur .command-box': 'localCommandChanged',
    'change .command-type': 'localTypeChanged',
  },

  render() {
    this.$el.html(dashboardBaseQueryTemplate({ model: this.model.toJSON() }));
  },

  removeFromDashboard(e) {
    e.preventDefault();

    const callback = function callback() {
      const dashboard = this.parent.model;
      dashboard.set('baseQueries', _.without(dashboard.get('baseQueries'), this.model));
      this.model.destroy();
      this.parent.baseQueryViews = _.without(this.parent.baseQueryViews, this);
      delete this.parent.guidToBaseQueryView[this.model.get('guid')];
      this.parent.modelChanged();
      this.remove();
    }.bind(this);

    if (e.shiftKey) {
      callback();
    } else {
      DeprecatedDialogBox.confirm({
        message: 'Are you sure you want to delete this query?',
        confirm: callback,
      });
    }
  },

  localCommandChanged() {
    this.model.set('command', this.$('.command-box').val());
  },

  localTypeChanged() {
    this.model.set('type', this.$('.command-type').val());
  },

  modelCommandChanged() {
    this.$('.command-box').val(this.model.get('command'));
  },

  modelTypeChanged() {
    this.$('.command-type').val(this.model.get('type'));
  },
});

module.exports = BaseQueryView;
