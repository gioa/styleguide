/* eslint func-names: 0 */

import $ from 'jquery';
import _ from 'underscore';
import d3 from 'd3';

import HiveSchema from '../tables/HiveSchema';
import Nestify from '../ui_building_blocks/Nestify';

const DomUtil = {};

/**
 * Starts with the suggested font size, reduces it until the given text
 * fits in a box with given width and height
 */
DomUtil.findMaxFontSize = function findMaxFontSize(text, maxSize, width, height) {
  let fontSize = maxSize + 0.5;
  let curDim;
  do {
    fontSize -= 0.5;
    curDim = this.strSize(text, fontSize);
  } while ((curDim.height > height || curDim.width > width) && fontSize > 1);

  return fontSize;
};

/**
 * DEPRECATED! Instead, use ReactTable's Table and Column. See ClusterDetailsLibrariesList
 * and ClusterDetailsLibrariesListView for an example of usage.
 * Create an HTML table as a DOM element using D3, from data and a schema.
 */
DomUtil.createTable = function createTable(data, columnNames, hiveSchemas) {
  // Utility function that expands a row to match the # of columns in the schema, since
  // some Hive DDL commands, like "describe", will not return a value for some columns
  const expandRow = function(row) {
    while (row.length < columnNames.length) {
      row.push('');
    }
    return row;
  };

  const element = document.createElement('table');
  const table = d3.select(element)
      .attr('class', 'table table-bordered table-condensed table-hover');
  table.append('thead')
    .append('tr').selectAll('th').data(columnNames)
    .enter().append('th').text(String);
  const tbody = table.append('tbody');

  // By default we only create the first 100 rows of the table, and add more rows
  // incrementally while user scrolls down the table
  let linesVisible = 100;

  if (window.testMode) {
    linesVisible = Infinity; // show all results at once in test
  }

  function update(newData) {
    tbody.selectAll('tr').data(newData)
      .enter().append('tr')
      .selectAll('td').data(expandRow)
      .enter().append('td')
      .each(function(obj, i) {
        if (obj !== null && typeof obj === 'object') {
          if (hiveSchemas && hiveSchemas[i]) {
            this.__nfData__ = HiveSchema.apply(obj, hiveSchemas[i]);
          } else {
            this.__nfData__ = obj;
          }
        }
      })
      .classed({
        'nestify'() { return Boolean(this.__nfData__); },
        'nestify-expandable'() { return Boolean(this.__nfData__); },
      })
      .html(function(d) {
        return Nestify.initializeCollapsedHTML(d, this.__nfData__);
      });
  }

  function initializeScrollCallback() {
    const $table = $(element);
    const $parent = $table.parent();
    const dataLength = data.length;

    $parent.scroll(function() {
      if (linesVisible < dataLength &&
          $table.height() - $parent.scrollTop() < 500) {
        // update table with 100 more rows of data
        update(data.slice(0, linesVisible += 100));
      }
    });
  }

  update(data.slice(0, linesVisible));

  // this is a workaround to bind scroll event to the parent of table after the table is append
  // to DOM, as we are creating jQuery objects here and the parent doesn't exist yet.
  // This assume we will append the returned element synchronously
  _.defer(initializeScrollCallback);

  return element;
};

/**
 * Attaches div element with given text to the DOM as hidden, and measures values of requested
 * CSS keys.
 */
DomUtil.getCSSProperty = function getCSSProperty(text, options, cssKeys) {
  const styles = $.extend({}, options, {
    'position': 'absolute',
    'visibility': 'hidden',
  });
  const tempLabel = $('<div/>').text(text)
      .css(styles).appendTo($('body'));
  const cssValues = tempLabel.css(cssKeys);
  tempLabel.remove();
  return cssValues;
};

DomUtil.strSize = function strSize(str, fontSize) {
  const fSize = fontSize || 12;
  const f = fSize + 'px arial';
  const o = $('<div/>').text(str)
      .css({ 'position': 'absolute',
            'float': 'left',
            'white-space': 'nowrap',
            'visibility': 'hidden',
            'font': f })
      .appendTo($('body'));
  const w = o.width();
  const h = o.height();
  o.remove();
  return { width: w, height: h };
};

module.exports = DomUtil;
