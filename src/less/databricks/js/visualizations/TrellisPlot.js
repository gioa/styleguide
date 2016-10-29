/* eslint no-var:0, no-unused-vars:0, one-var-declaration-per-line:0, no-use-before-define:0,
padded-blocks:0, spaced-comment:0, comma-dangle:0, max-len:0, indent:0, semi-spacing:0,
space-before-blocks:0, no-else-return:0, no-mixed-operators:0, func-names: 0 */

/**
 * Bare bone implementation of a trellis (grid) plot.
 * Override the plotPanel function to modify implementation.
 */
import $ from 'jquery';
import _ from 'underscore';
import d3 from 'd3';

import Chart from '../visualizations/Chart';
import ChartConstants from '../visualizations/ChartConstants';
import DomUtil from '../visualizations/DomUtil';
import PlotLayout from '../visualizations/PlotLayout';
import ScatterPlotConstants from '../visualizations/ScatterPlotConstants';
import VizUtil from '../visualizations/VizUtil';

var TrellisPlot = Chart.extend({

  /**
   * Overrdes Chart.inferColumns
   * @param schema
   */
  inferColumns(schema) {
    return VizUtil.findColumns(1, 2, schema);
  },

  /**
   * Overrides Chart.preparData
   *
   * @param rawData
   * @param schema
   * @param xColumns As returned by inferColumns
   * @param yColumns As returned by inferColumns
   */
  prepareData(rawData, schema, xColumns, yColumns) {
    return VizUtil.projectColumns(rawData, schema, xColumns, yColumns);
  },

  /**
   * Return the X axis label.
   *
   * @param data Array containing all data, first argument of Chart.plot
   * @param keys same as second argument of Chart.plot
   * @param values column value names, third argument of Chart.plot
   */
  getXLabel(data, keys, values) {
    return 'X Label';
  },

  /**
   * Return the Y axis label.
   *
   * @param data Array containing all data, first argument of Chart.plot
   * @param keys same as second argument of Chart.plot
   * @param values column value names, third argument of Chart.plot
   */
  getYLabel(data, keys, values) {
    return 'Y Label';
  },

  /**
   * Generate the content of a single panel. You do not need to be concerned with positioning
   * the content of the panel.
   *
   * @param panel is the SVG element to receive all panel elements
   * @param gridCell information about current grid position {index, row, column, x, y,
   *                  width, height}
   * @param keys  array of keys
   * @param plotData data that belongs to this panel
   * @param xScale X Scale function
   * @param yScale Y Scale function
   */
  plotPanel(panel, gridCell, keys, plotData, xScale, yScale, options) {},

  /** Margin between panels */
  margin: ScatterPlotConstants.BORDER_SIZE / 4,

  /** Gap with the borders */
  gap: 55,

  /** Padding inside each panel */
  padding: 2,

  /** Maximum number of unique values in each key. */
  maxUniqueKey: 10,

  /**
   * Returns the X Scale function
   * @param grid The entire grid information. An array of {index, row, column, x, y,
   *                  width, height}
   * @param data All plotting data, the first argument of Chart.plot
   * @param keys Plotting keys, same as the second argument of Chart.plot
   * @param values Plotting value names, same as third argument of Chart.plot
   */
  getXScale(grid, data, keys, values, options) {
    return d3.scale.linear();
  },

  /**
   * Returns the Y Scale function
   * @param grid The entire grid information. An array of {index, row, column, x, y,
   *                  width, height}
   * @param data All plotting data, the first argument of Chart.plot
   * @param keys Plotting keys, same as the second argument of Chart.plot
   * @param values Plotting value names, same as third argument of Chart.plot
   */
  getYScale(grid, data, keys, values, options) {
    return d3.scale.linear();
  },

  removePlot() {
    Chart.prototype.removePlot.call(this);
    this.svg.selectAll('.cell').remove();
    this.svg.selectAll('.ylabel').remove();
    this.svg.selectAll('.xlabel').remove();
  },

  /**
   * Overrides Chart.plot
   */
  plot(data, keys, valueColumnNames, width, height, options) {
    Chart.prototype.plot.call(this, data, keys, valueColumnNames, width, height, options);
    var self = this;
    var key = keys.length === 0 ? [] : keys.split(', ');

    if (data.length < 1) {
      this.showText('No data to plot.');
      $(this.svg.node()).empty();
      return;
    }

    if (data[0].length < 1) {
      this.showText('Need at least one column to create a Trellis plot.');
      return;
    }

    var facetTitleHeight = 0;
    var facetTitleWidth = 0;

    var fontSize = ChartConstants.FONT_SIZE;
    var labelFontSize = ChartConstants.LABEL_FONT_SIZE;
    var labelFontWeight = ChartConstants.LABEL_FONT_WEIGHT;

    var fixedDigitsY = d3.format('.2s');
    var fixedDigitsX = d3.format('.2s');

    var uniqueKeysX, uniqueKeysY;
    var numUniqueKeysX = 1, numUniqueKeysY = 1;
    var grid;

    if (key.length > 2) {
      this.removePlot();
      this.showText('Error inferring columns. There should not be more than two keys.');
      console.error(data, keys, valueColumnNames);
      return;
    } else if (key.length === 2) {
      uniqueKeysX = _.uniq(data.map((r) => r[0]));
      numUniqueKeysX = uniqueKeysX.length;

      uniqueKeysY = _.uniq(data.map((r) => r[1]));
      numUniqueKeysY = uniqueKeysY.length;

      facetTitleHeight = 20;
      facetTitleWidth = 20;

    } else if (key.length === 1) {
      uniqueKeysX = _.uniq(data.map((r) => r[0]));

      numUniqueKeysX = uniqueKeysX.length;
      facetTitleHeight = 20;
    }

    if (numUniqueKeysX > this.maxUniqueKey) {
      this.showText('Too many key values, limiting to first ' + this.maxUniqueKey + ' values');
      numUniqueKeysX = this.maxUniqueKey;
    }
    if (numUniqueKeysY > this.maxUniqueKey) {
      this.showText('Too many key values, limiting to first ' + this.maxUniqueKey + ' values');
      numUniqueKeysY = this.maxUniqueKey;
    }

    grid = PlotLayout.getGridLayout(numUniqueKeysX, numUniqueKeysY,
                                    facetTitleWidth, facetTitleHeight,
                                    this.width, this.height, this.margin, this.gap);

    var plotCell = function(p) {
      var cell = d3.select(this),
          bestLabelFontSize;

      var xTicks = Math.floor(
        p.width / (DomUtil.strSize(fixedDigitsX(0.9901), fontSize).width * 1.5)
      );
      var xAxis = d3.svg.axis().scale(xScale).ticks(xTicks);

      var inityTicks = Math.floor(p.height / (DomUtil.strSize('100', fontSize).height * 1.2));
      var yTicks = inityTicks > 15 ? 15 : inityTicks;
      var yAxis = d3.svg.axis().scale(yScale).ticks(yTicks);

      var keyValX, keyValY ;
      if (key.length > 1) {
        keyValY = uniqueKeysY[p.row];
      }
      if (key.length > 0) {
        keyValX = uniqueKeysX[p.col];
      }
      var keyData;
      keyData = _.filter(data, function(d) {
        if (keyValX === undefined) {
          // No X or Y key
          return true;
        } else if (keyValY === undefined){
          // Only a single key
          return (d[0] === keyValX);
        } else {
          // Both keys are present
          return (d[0] === keyValX && d[1] === keyValY);
        }
      });

      self.plotPanel(cell, p, key, keyData, xScale, yScale, options);

      // Adding Axis tick marks and labels on the outside of this panel
      // But do it on every other panel.
      if (p.col === 0 && (p.row % 2) === 0) {
        cell.append('g')
          .attr('class', 'y axis')
          .attr('transform', 'translate(' + (self.padding - facetTitleWidth) + ', 0)')
          .attr('font-size', fontSize + 'px')
          .attr('fill', '#333')
          .call(yAxis.orient('left').tickFormat(fixedDigitsY));
      }
      if (p.col === (numUniqueKeysX - 1) && (p.row % 2) !== 0) {
        cell.append('g')
          .attr('class', 'y axis')
          .attr('transform', 'translate(' + (p.width - self.padding) + ', 0)')
          .attr('font-size', fontSize + 'px')
          .attr('fill', '#333')
          .call(yAxis.orient('right').tickFormat(fixedDigitsY));
      }
      if (p.row === 0 && (p.col % 2) !== 0) {
        cell.append('g')
          .attr('class', 'x axis')
          .attr('transform', 'translate(0,' + (self.padding - facetTitleHeight) + ')')
          .attr('font-size', fontSize + 'px')
          .attr('fill', '#333')
          .call(xAxis.orient('top').tickFormat(fixedDigitsX));
      }
      if (p.row === (numUniqueKeysY - 1) && (p.col % 2) === 0) {
        cell.append('g')
          .attr('class', 'x axis')
          .attr('transform', 'translate(0,' + (p.height - self.padding) + ')')
          .attr('font-size', fontSize + 'px')
          .attr('fill', '#333')
          .call(xAxis.orient('bottom').tickFormat(fixedDigitsX));
      }

      cell.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(0,' + (p.height - self.padding) + ')')
        .attr('font-size', fontSize + 'px')
        .attr('fill', '#333')
        .call(xAxis.orient('top').tickFormat(''));

      cell.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(0,' + self.padding + ')')
        .attr('font-size', fontSize + 'px')
        .attr('fill', '#333')
        .call(xAxis.orient('bottom').tickFormat(''));

      // Add facet labels inside a gray rectangle on the top
      if (p.row === 0) {
        cell.append('rect')
          .attr('class', 'extent')
          .attr('width', p.width)
          .attr('height', facetTitleHeight)
          .attr('transform', 'translate(0,' + (self.padding - facetTitleHeight) + ')')
          .attr('font-size', fontSize + 'px')
          .on('mousemove', function(d, i) {
            //Update the tooltip position and value
            var tooltipText = key[0] + ': ' + keyValX;
            var tooltipFontSize = $('#tooltip').css('font-size');
            tooltipFontSize = parseFloat(tooltipFontSize.slice(0, tooltipFontSize.length - 2));
            d3.select('#tooltip')
              .style('left',
                     (d3.event.pageX - (tooltipFontSize * tooltipText.length / 3)) + 'px')
              .style('top', (d3.event.pageY - 2 * tooltipFontSize) + 'px')
              .select('#value')
              .text(tooltipText);

            //Show the tooltip
            d3.select('#tooltip').classed('hidden', false);
          })
          .on('mouseout', function() {
            //Hide the tooltip
            d3.select('#tooltip').classed('hidden', true);
          });

        bestLabelFontSize = DomUtil.findMaxFontSize(keyValX,
                                                    labelFontSize,
                                                    p.width - self.padding,
                                                    facetTitleHeight - self.padding);

        cell.append('text')
          .attr('class', 'axis')
          .attr('transform', 'translate(0,' + (self.padding) + ')')
          .attr('x', p.width / 2)
          .attr('y', self.margin - facetTitleHeight / 2 + 2)
          .attr('font-size', bestLabelFontSize + 'px')
          .attr('text-anchor', 'middle')
          .text(keyValX)
          .on('mousemove', function(d, i) {
            //Update the tooltip position and value
            var tooltipText = key[0] + ': ' + keyValX;
            var tooltipFontSize = $('#tooltip').css('font-size');
            tooltipFontSize = parseFloat(tooltipFontSize.slice(0, tooltipFontSize.length - 2));
            d3.select('#tooltip')
              .style('left',
                     (d3.event.pageX - (tooltipFontSize * tooltipText.length / 3)) + 'px')
              .style('top', (d3.event.pageY - 2 * tooltipFontSize) + 'px')
              .select('#value')
              .text(tooltipText);

            //Show the tooltip
            d3.select('#tooltip').classed('hidden', false);
          })
          .on('mouseout', function() {
            //Hide the tooltip
            d3.select('#tooltip').classed('hidden', true);
          });
      }

      // Add facet labels inside a gray rectangle on the left
      if (p.col === 0 && keyValY !== undefined) {
        cell.append('rect')
          .attr('class', 'extent')
          .attr('width', facetTitleWidth)
          .attr('height', p.height)
          .attr('transform', 'translate(' + -facetTitleWidth + ',' + (self.padding) + ')')
          .attr('font-size', fontSize + 'px')
          .on('mousemove', function(d, i) {
            //Update the tooltip position and value
            var tooltipText = key[1] + ': ' + keyValY;
            var tooltipFontSize = $('#tooltip').css('font-size');
            tooltipFontSize = parseFloat(tooltipFontSize.slice(0, tooltipFontSize.length - 2));
            d3.select('#tooltip')
              .style('left',
                     (d3.event.pageX - (tooltipFontSize * tooltipText.length / 3)) + 'px')
              .style('top', (d3.event.pageY - 2 * tooltipFontSize) + 'px')
              .select('#value')
              .text(tooltipText);

            //Show the tooltip
            d3.select('#tooltip').classed('hidden', false);
          })
          .on('mouseout', function() {
            //Hide the tooltip
            d3.select('#tooltip').classed('hidden', true);
          });

        bestLabelFontSize = DomUtil.findMaxFontSize(keyValY,
                                                    labelFontSize,
                                                    p.height - self.padding,
                                                    facetTitleWidth - self.padding);

        cell.append('text')
          .attr('class', 'axis')
          .attr('transform', 'rotate(90,' + (0) + ',' + (0) + ')' +
            'translate(' + facetTitleWidth / 2 + ',' + (facetTitleHeight + self.padding) + ')'
           )
          .attr('text-anchor', 'left')
          .attr('x', p.height / 2 - DomUtil.strSize(keyValY, labelFontSize).width)
          .attr('y', self.margin - facetTitleHeight / 2)
          .attr('font-size', bestLabelFontSize + 'px')
          .text(keyValY)
          .on('mousemove', function(d, i) {
            //Update the tooltip position and value
            var tooltipText = key[1] + ': ' + keyValY;
            var tooltipFontSize = $('#tooltip').css('font-size');
            tooltipFontSize = parseFloat(tooltipFontSize.slice(0, tooltipFontSize.length - 2));
            d3.select('#tooltip')
              .style('left',
                     (d3.event.pageX - (tooltipFontSize * tooltipText.length / 3)) + 'px')
              .style('top', (d3.event.pageY - 2 * tooltipFontSize) + 'px')
              .select('#value')
              .text(tooltipText);

            //Show the tooltip
            d3.select('#tooltip').classed('hidden', false);
          })
          .on('mouseout', function() {
            //Hide the tooltip
            d3.select('#tooltip').classed('hidden', true);
          });
      }

      //create Y axis
      cell.append('g')
        .attr('class', 'y axis')
        .attr('transform', 'translate(' + self.padding + ', 0)')
        .attr('font-size', fontSize + 'px')
        .attr('fill', '#333')
        .call(yAxis.orient('right').tickFormat(''));

      cell.append('g')
        .attr('class', 'y axis')
        .attr('transform', 'translate(' + (p.width - self.padding) + ', 0)')
        .attr('font-size', fontSize + 'px')
        .attr('fill', '#333')
        .call(yAxis.orient('left').tickFormat(''));
    };

    this.removePlot();

    var xScale = this.getXScale(grid, data, key, valueColumnNames, options)
        .range([this.padding, grid[0].width - this.padding]);

    var yScale = this.getYScale(grid, data, key, valueColumnNames, options)
        .range([grid[0].height - this.padding, this.padding]);

    this.svg.selectAll('.cell')
      .data(grid)
      .enter()
      .append('g')
      .attr('class', 'cell')
      .attr('transform', function(d) {
        return 'translate(' + (self.padding + d.x) + ',' + (self.padding + d.y) + ')';
      })
      .each(plotCell);

    var xLabel = self.getXLabel(data, keys, valueColumnNames);
    var yLabel = self.getYLabel(data, keys, valueColumnNames);
    this.svg.selectAll('.xlabel').data([1]).enter().append('text')
      .attr('class', 'xlabel')
      .text(xLabel)
      .attr('text-anchor', 'middle')
      .attr('x', this.width / 2 - DomUtil.strSize(xLabel, labelFontSize).width / 2)
      .attr('y', this.height - DomUtil.strSize(xLabel, labelFontSize).height)
      .attr('font-size', labelFontSize + 'px')
      .attr('fill', '#333')
      .style('font-weight', labelFontWeight);

    this.svg.selectAll('.ylabel').data(valueColumnNames).enter().append('text')
      .attr('class', 'ylabel')
      .attr('transform', 'translate(' +
            (DomUtil.strSize(valueColumnNames, labelFontSize).height - 2) +
            ', ' + this.height / 2 + ') rotate(-90)')
      .text(yLabel)
      .attr('text-anchor', 'middle')
      .attr('font-size', labelFontSize + 'px')
      .attr('fill', '#333')
      .style('font-weight', labelFontWeight);
  }
});

module.exports = TrellisPlot;
