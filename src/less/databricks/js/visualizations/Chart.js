/* eslint func-names: 0 */

/**
 * Databricks Plot.
 */
import Backbone from 'backbone';
import d3 from 'd3';

import NotebookUtilities from '../notebook/NotebookUtilities';

import ChartConstants from '../visualizations/ChartConstants';
import Pivot from '../visualizations/Pivot';

const Chart = function(parentElement) {
  this.width = ChartConstants.DEFAULT_AUTO_WIDTH;
  this.height = ChartConstants.DEFAULT_AUTO_HEIGHT;
  this.parentElement = parentElement;

  this.canvas = d3.select(parentElement).append('canvas')
    .attr({
      'class': 'chart',
      'width': this.width,
      'height': this.height,
    }).node();

  this.svg = d3.select(parentElement).append('svg').attr({
    width: this.width,
    height: this.height,
    'class': 'chart',
  });

  /**
   * Array of objects each defining an option.
   * Each option has a label, inputType, key, and value.
   */
  this._plotOptions = [];

  /**
   * Just the keys and values, for efficient option lookup.
   */
  this._parsedOptions = {};
};

/**
 * The main chart method that generates and populates an SVG and/or HTML5 canvas.
 *
 * @param data
 * @param keys
 * @param valueColumnNames
 * @param width
 * @param height
 */
Chart.prototype.plot = function(data, keys, valueColumnNames, width, height) {
  if (!isNaN(width) && width > 0) {
    this.width = width;
  }
  if (!isNaN(height) && height > 0) {
    this.height = height;
  }
  this.svg.attr({
    width: this.width,
    height: this.height,
  });

  d3.select(this.canvas).attr({
    'width': this.width,
    'height': this.height,
  });
};

/**
 * Clean up all elements added to SVG/canvas by plot()
 */
Chart.prototype.removePlot = function() {
  this.svg.selectAll('text').remove();
};

Chart.prototype.getOptions = function() {
  return this._plotOptions;
};

Chart.prototype.setOptions = function(options) {
  const newOptions = {};
  let i;
  for (i = 0; i < options.length; i++) {
    newOptions[options[i].key] = options[i].value;
  }
  this._parsedOptions = {};
  for (i = 0; i < this._plotOptions.length; i++) {
    const key = this._plotOptions[i].key;
    if (newOptions[key] !== undefined) {
      this._plotOptions[i].value = newOptions[key];
    }
    this._parsedOptions[key] = this._plotOptions[i].value;
  }
};

Chart.prototype.setDefaultOptions = function(options) {
  this._plotOptions = options;
  this.setOptions(options);
};

Chart.prototype.getOption = function(key) {
  return this._parsedOptions[key];
};

/**
 * Function that is responsible for inferring X and Y columns for plotting.
 *
 * @param schema  is the schema of data
 */
Chart.prototype.inferColumns = function(schema) {
  if (schema.length === 0) {
    return { xColumns: ['<id>'], yColumns: [] };
  }

  // We search from the back of the column list towards the front. When we see the
  // first range  of numeric columns, we add those as values, except possibly for the
  // first column in the  table, which we will use as a key. Then after that we add all
  // columns as keys. As a special case, if there's only one numeric column, even if
  // it's at the front, we use  it as a value and add the <id> field representing row
  // ID as a key.
  let pos = schema.length - 1;
  const valueColumnNames = [];
  const keyColumnNames = [];

  while (pos >= 0) {
    if (keyColumnNames.length > 0) {
      // We're already in the key part
      if (keyColumnNames.length < 2) {
        keyColumnNames.push(schema[pos].name);
      }
    } else if (NotebookUtilities.isNumeric(
        schema[pos].type) && (pos > 0 || valueColumnNames.length === 0)) {
      // We're in the value part
      if (valueColumnNames.length < 2) {
        valueColumnNames.push(schema[pos].name);
      }
    } else if (valueColumnNames.length > 0) {
      // We've added some values and this is our first non-numeric column, so make it a key
      if (keyColumnNames.length < 2) {
        keyColumnNames.push(schema[pos].name);
      }
    }
    pos--;
  }
  if (keyColumnNames.length === 0) {
    keyColumnNames.push('<id>');
  }
  keyColumnNames.reverse();
  valueColumnNames.reverse();
  return { xColumns: keyColumnNames, yColumns: valueColumnNames };
};

/**
 * Given the provided schema and column information, massage rawData into desired
 * data structure needed for plotting. The output is then passed to plot() for visualization.
 *
 * @param rawData
 * @param schema
 * @param xColumns
 * @param yColumns
 * @param pivotCols
 * @param aggFunc
 */
Chart.prototype.prepareData = function(rawData,
                                       schema,
                                       xColumns,
                                       yColumns,
                                       pivotCols,
                                       aggFunc) {
  const colNames = schema.concat([{ name: '<id>', metadata: {} }]);
  return Pivot.pivot(rawData, colNames, xColumns, yColumns, pivotCols, aggFunc);
};

/**
 * If the chart needs to display messages (such as errors) to users, this method will be used.
 * Default implementation is provided for convenience.
 * @param message
 */
Chart.prototype.showText = function(message) {
  this.svg.append('text')
    .text(message)
    .attr('x', '0px')
    .attr('y', '20px')
    .attr('text-align', 'left')
    .attr('fill', '#999');
};

Chart.extend = Backbone.Model.extend;

module.exports = Chart;
