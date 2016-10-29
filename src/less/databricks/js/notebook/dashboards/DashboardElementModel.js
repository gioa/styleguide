/* eslint callback-return: 0 */

import _ from 'underscore';
import Backbone from 'backbone';

import DashboardViewConstants from '../../notebook/dashboards/DashboardViewConstants';

const DashboardElementModel = Backbone.Model.extend({

  displayWidth() {
    // TODO(Chaoyu): PROD-7927 better way to figure out the margin
    return (this.gridWidth() * this.dashboard().displayColumnWidth()) - 14;
  },

  displayHeight() {
    return (this.gridHeight() * this.dashboard().displayCellHeight()) +
      (DashboardViewConstants.CELL_VERTICAL_MARGIN * (this.gridHeight() - 1)) - 8;
  },

  gridHeight() {
    const position = this.get('position');
    if (position && position.height) {
      return position.height;
    }
    return DashboardViewConstants.DEFAULT_ELEMENT_HEIGHT;
  },

  gridWidth() {
    const position = this.get('position');
    if (position && position.width) {
      return position.width;
    }
    return DashboardViewConstants.DEFAULT_ELEMENT_WIDTH;
  },

  dashboard() {
    return this.get('dashboard');
  },

  notebook() {
    return this.dashboard().notebook();
  },

  elementNUID() {
    return this.get('elementNUID');
  },

  getCommandModel() {
    return this.notebook().commandByNUID(this.elementNUID());
  },

  updateOptions(options, callback) {
    this.dashboard().updateElementOptions(this.get('guid'), options, callback);
  },

  saveLocalOptions(callback) {
    this.dashboard().updateElementOptions(this.get('guid'), this.get('options'), callback);
  },

  setLocalOptions(options, callback) {
    this.set('options', _.defaults(options, this.get('options')));
    if (callback) { callback(); }
  },

  _getCommandTitleAsDefaultOption() {
    const command = this.getCommandModel();
    if (command && command.get('showCommandTitle') && !command.isMarkdownCommand()) {
      return {
        title: command.getTitle(),
        showTitle: true,
      };
    }
    return {
      showTitle: false,
    };
  },

  getOptions() {
    let options = _.defaults(this.get('options') || {},
      DashboardViewConstants.DEFAULT_ELEMENT_OPTIONS);

    // if options.title is empty, use command title as default
    if (options.showTitle === undefined) {
      options = _.extend(options, this._getCommandTitleAsDefaultOption());
      this.setLocalOptions(options);
    }

    return options;
  },

  getOption(key) {
    return this.getOptions()[key];
  },

  tags() {
    const tags = this.dashboard().tags();
    _.extend(tags, this.getCommandModel().tags());
    tags.source = 'DashboardElementModel';
    return tags;
  },
});

module.exports = DashboardElementModel;
