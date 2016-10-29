/**
 * Do not use this as an example for tables; it needs to be refactored to use
 * ReactTable's Table and Column. For now, see ClusterDetailsLibrariesList and
 * ClusterDetailsLibrariesListView.
 */

import $ from 'jquery';
import Backbone from 'backbone';

import HiveSchema from '../tables/HiveSchema';

import Nestify from '../ui_building_blocks/Nestify';
import { StringRenderers } from '../ui_building_blocks/text/StringRenderers';

import previewTableTemplate from '../templates/previewTableTemplate.html';

const PreviewTableView = Backbone.View.extend({
  initialize() {
    this.listenTo(this.model, 'change', this.render);
  },

  tagName: 'div',

  className: 'inner',

  events: {
    'change input.column-name': 'nameChanged',
    'change select.column-type': 'typeChanged',
  },

  nameChanged() {
    const columnNames = this.$('input.column-name');
    const numCols = columnNames.length;
    const colNames = [];

    for (let idx = 0; idx < numCols; idx++) {
      colNames[idx] = $(columnNames[idx]).val();
    }
    this.model.updateColNames(colNames);
  },

  typeChanged() {
    const columnTypes = this.$('.column-type');
    const numCols = columnTypes.length;
    const colTypes = [];

    for (let idx = 0; idx < numCols; idx++) {
      colTypes[idx] = $(columnTypes[idx]).val();
    }
    this.model.updateColTypes(colTypes);
  },

  /**
   * This method converts each object from each row to a JSON string that represents this
   * object. A length cap of 200 is used for each string. Result is returned in a new array of
   * the same dimensions as the one we passed as input.
   */
  convertToDetailedStrings(rows) {
    const converted = [];
    for (let i = 0; i < rows.length; i++) {
      const convertedRow = [];
      for (let j = 0; j < rows[i].length; j++) {
        convertedRow.push(StringRenderers.renderString(rows[i][j], 200));
      }
      converted.push(convertedRow);
    }
    return converted;
  },

  render() {
    /**
     * Do not use this as an example for tables; it needs to be refactored to use
     * ReactTable's Table and Column. For now, see ClusterDetailsLibrariesList and
     * ClusterDetailsLibrariesListView.
     */
    const rows = this.model.get('rows');
    const schema = this.model.get('schema');
    const names = this.model.get('colNames');
    const types = this.model.get('colTypes');
    const canModifySchema = this.model.get('canModifySchema');
    const options = [];

    const generateOption = function generateOption(i, t) {
      if (types[i].toUpperCase() === t) {
        return $('<div>').append($('<option selected>').text(t)).html();
      }
      return $('<div>').append($('<option>').text(t)).html();
    };
    for (let i = 0; i < types.length; i++) {
      options[i] = this.model.get('cTypes').map(generateOption.bind(this, i));
    }

    this.$el.html(previewTableTemplate({
      typeOptions: options,
      colNames: names,
      colTypes: types,
      rows: this.convertToDetailedStrings(rows),
      canModifySchema: canModifySchema,
    }));

    const tableEntries = this.$('.table-preview td');

    const numCols = schema.length;
    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      for (let colIdx = 0; colIdx < numCols; colIdx++) {
        const entry = tableEntries[(rowIdx * numCols) + colIdx];
        if (rows[rowIdx][colIdx] !== null && typeof rows[rowIdx][colIdx] === 'object') {
          entry.__nfData__ = HiveSchema.apply(rows[rowIdx][colIdx], schema[colIdx]);
          entry.classList.add('nestify');
        }
      }
    }
    Nestify.enable(this.$('table'));
  },
});

module.exports = PreviewTableView;
