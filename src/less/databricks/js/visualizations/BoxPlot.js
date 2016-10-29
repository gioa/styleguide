/* eslint no-var: 0, no-use-before-define: 0, no-unused-vars: 0, no-shadow: 0,
no-mixed-operators: 0, complexity: 0, func-names: 0 */

/**
 * Created by hossein on 3/28/14.
 */
import $ from 'jquery';
import _ from 'underscore';
import d3 from 'd3';

import Chart from '../visualizations/Chart';
import ChartConstants from '../visualizations/ChartConstants';
import PlotLayout from '../visualizations/PlotLayout';
import Util from '../visualizations/DomUtil';
import VizUtil from '../visualizations/VizUtil';

var BoxPlot = Chart.extend({

  /**
   * Overriding the default showText, to show the message at the buttom of the plot.
   */
  showText(message) {
    this.svg.append('text')
      .text(message)
      .attr('x', '0px')
      .attr('y', this.height - 5)
      .attr('text-align', 'left')
      .attr('fill', '#999');
  },

  /**
   * BoxPlot looks for a single value column and at most a single factor column in the schema.
   * @param schema
   */
  inferColumns(schema) {
    return VizUtil.findColumns(1, 1, schema);
  },

  /**
   * Projects the given xColumns and yColumns, such that the first value in each row is
   * the xColumn and the second one is the yColumn
   */
  prepareData(rawData, schema, xColumns, yColumns) {
    return VizUtil.projectColumns(rawData, schema, xColumns, yColumns);
  },

  removePlot() {
    Chart.prototype.removePlot.call(this);
    this.svg.selectAll('.cell').remove();
    this.svg.selectAll('.axis').remove();
  },

  plot(data, keys, valueColumnNames, width, height) {
    Chart.prototype.plot.call(this, data, keys, valueColumnNames, width, height);
    var key = keys.length === 0 ? [] : keys.split(', ');

    if (data.length < 1) {
      this.showText('No data to plot.');
      $(this.svg.node()).empty();
      return;
    }

    if (data[0].length < 1) {
      this.removePlot();
      this.showText('Need at least one column to create a box-plot.');
      return;
    }

    if (valueColumnNames.length !== 1) {
      this.removePlot();
      this.showText('Need at least one column to create a box-plot.');
      return;
    }

    var firstRow = data[0];
    if (typeof firstRow[key.length] === 'string') {
      this.removePlot();
      this.showText('Cannot plot non-numeric values');
      return;
    }
    var numUniqueKeys = 1; // Default number of boxes
    var uniqueKeys = [];

    if (key.length === 1) {
      uniqueKeys = _.uniq(data.map((r) => r[0]));
      numUniqueKeys = uniqueKeys.length;
    } else if (key.length > 1) {
      var newData = [];
      var newKey;
      var d;
      var tempRow;

      var addFunc = function(a, b) { return a + ', ' + b; };
      for (var i = 0; i < data.length; i++) {
        d = data[i];
        newKey = _.reduce(d.slice(0, key.length), addFunc);
        tempRow = [newKey, d[key.length]];
        newData.push(tempRow);
      }
      key = [keys];
      data = newData;

      uniqueKeys = _.uniq(data.map((r) => r[0]));
      numUniqueKeys = uniqueKeys.length;
    }

    function boxPlotInfo(d) {
      var k = 1.5;
      var q1 = d3.quantile(d, 0.25),
        q2 = d3.quantile(d, 0.5),
        q3 = d3.quantile(d, 0.75);

      var iqr = (q3 - q1) * k;
      var i = 0;
      while (d[i] < q1 - iqr) {
        i++;
      }
      var j = d.length - 1;
      while (d[j] > q3 + iqr) {
        j--;
      }
      return {
        q1: q1,
        q2: q2,
        q3: q3,
        w1: d[i],
        w2: d[j],
      };
    }

    function box(p) {
      var keyVal;
      if (key.length > 0) {
        keyVal = uniqueKeys[p.row];
      }
      var keyData = _.filter(data, function(d) {
        if (keyVal === undefined) {
          // No X or Y key
          return true;
        }
        // Only a single key
        return (d[0] === keyVal);
      }).map((r) => r[key.length]);
      var d = keyData.sort(d3.ascending);
      /* jshint validthis:true */
      var g = d3.select(this);
      var info = boxPlotInfo(d);
      info.label = keyVal;
      var boxHeight = p.height;
      var mar = 2;

      var outliers = _.filter(d, function(x) {
        return x < info.w1 || x > info.w2;
      });

      // Update center line: the vertical line spanning the whiskers.
      var center = g.selectAll('line')
          .data([info]);

      center.enter().append('line')
        .attr('class', 'whisker')
        .attr('x1', (d) => xScale(d.w1))
        .attr('y1', boxHeight / 2)
        .attr('x2', (d) => xScale(d.w2))
        .attr('y2', boxHeight / 2);

      center.enter().append('line')
        .attr('class', 'box')
        .attr('x1', (d) => xScale(d.w1))
        .attr('y1', boxHeight / 4 + mar)
        .attr('x2', (d) => xScale(d.w1))
        .attr('y2', boxHeight * 3 / 4 - mar);

      center.enter().append('line')
        .attr('class', 'box')
        .attr('x1', (d) => xScale(d.w2))
        .attr('y1', boxHeight / 4 + mar)
        .attr('x2', (d) => xScale(d.w2))
        .attr('y2', boxHeight * 3 / 4 - mar);

      center.enter().append('rect')
        .attr('class', 'box')
        .attr('x', (d) => xScale(d.q1))
        .attr('y', mar)
        .attr('width', (d) => xScale(d.q3) - xScale(d.q1))
        .attr('height', boxHeight - 2 * mar)
        .attr('median', (d) => d.q2)
        .on('mousemove', function(d, i) {
          var median = d3.select(this).attr('median');
          var tooltipText = ('Median: ' + fixedDigits(median));
          var tooltipFontSize = $('#tooltip').css('font-size');
          tooltipFontSize = parseFloat(tooltipFontSize.slice(0, tooltipFontSize.length - 2));
          d3.select('#tooltip')
            .style('left', (d3.event.pageX - (tooltipFontSize * tooltipText.length / 3)) + 'px')
            .style('top', (d3.event.pageY - 2 * tooltipFontSize) + 'px')
            .select('#value')
            .text(tooltipText);
          d3.select('#tooltip').classed('hidden', false);
        })
        .on('mouseout', function() {
          d3.select('#tooltip').classed('hidden', true);
        });

      center.enter().append('line')
        .attr('class', 'box')
        .attr('x1', (d) => xScale(d.q2))
        .attr('y1', mar)
        .attr('x2', (d) => xScale(d.q2))
        .attr('y2', boxHeight - mar);

      center.data(outliers).enter().append('circle')
        .attr('class', 'box')
        .attr('cx', (d) => xScale(d))
        .attr('cy', boxHeight / 2)
        .attr('r', 2.5)
        .on('mousemove', function(d, i) {
          var tooltipText = (parseFloat(d).toFixed(2));
          var tooltipFontSize = $('#tooltip').css('font-size');
          tooltipFontSize = parseFloat(tooltipFontSize.slice(0, tooltipFontSize.length - 2));
          d3.select('#tooltip')
            .style('left', (d3.event.pageX - (tooltipFontSize * tooltipText.length / 3)) + 'px')
            .style('top', (d3.event.pageY - 2 * tooltipFontSize) + 'px')
            .select('#value')
            .text(tooltipText);
          d3.select('#tooltip').classed('hidden', false);
        })
        .on('mouseout', function() {
          d3.select('#tooltip').classed('hidden', true);
        });

      if (keyVal !== undefined) {
        center.enter().append('text')
          .attr('class', 'axis')
          .attr('font-size', labelFontSize + 'px')
          .text((d) => d.label)
          .attr('text-anchor', 'left')
          .attr('x', -xPad + gap / 2)
          .attr('y', boxHeight / 2 + labelFontSize / 4);
      }

      center.enter().append('text')
        .attr('class', 'axis')
        .attr('font-size', 10 + 'px')
        .text((d) => fixedDigits(d.q1))
        .attr('text-anchor', 'left')
        .attr('x', (d) => xScale(d.q1) - fixedWidth)
        .attr('y', mar);

      center.enter().append('text')
        .attr('class', 'axis')
        .attr('font-size', 10 + 'px')
        .text((d) => fixedDigits(d.q3))
        .attr('text-anchor', 'right')
        .attr('x', (d) => xScale(d.q3))
        .attr('y', mar);
    }

    this.removePlot();

    var margin = 10;
    var longestKey = '';
    if (uniqueKeys.length > 0) {
      longestKey = _.max(uniqueKeys, function(l) {
        return l.length;
      });
    }
    var gap = 20;
    var yPad = 20;
    var labelFontSize = ChartConstants.LABEL_FONT_SIZE;
    var labelFontWeight = ChartConstants.LABEL_FONT_WEIGHT;
    var fontSize = ChartConstants.FONT_SIZE;
    var xPad = Util.strSize(longestKey, labelFontSize).width * 1.5 + 15;
    var padding = 2;
    var fixedDigits = d3.format('.2s');
    var fixedWidth = Util.strSize(fixedDigits(10000.0001), fontSize).width;

    var grids = PlotLayout.getGridLayout(1, numUniqueKeys,
      xPad, gap, this.width, this.height - 2 * yPad, margin, gap);

    var axisY = grids[numUniqueKeys - 1].y + grids[0].height;
    if (grids[0].height < 15) {
      var keyLimit = numUniqueKeys;
      while ((this.height - 2 * yPad) / keyLimit < 25) {
        keyLimit--;
      }
      this.showText('The plot area is too small. Showing first ' + keyLimit + ' keys.');

      // Update grids with fewer key values
      grids = PlotLayout.getGridLayout(1, keyLimit,
        xPad, gap, this.width, this.height - 2 * yPad, margin, gap);
    }

    var xScale = d3.scale.linear()
        .domain(d3.extent(data, (d) => d[key.length]))
        .range([padding, grids[0].width - padding]);

    this.svg.selectAll('.cell')
      .data(grids)
      .enter()
      .append('g')
      .attr('class', 'cell')
      .attr('transform', function(d) {
        return 'translate(' + (padding + d.x) + ',' + (padding + d.y) + ')';
      })
      .each(box);

    var xAxis = d3.svg.axis().scale(xScale);

    this.svg.append('g')
      .attr('class', 'x axis')
      .attr('transform', 'translate(' + grids[0].x + ',' + (axisY + yPad) + ')')
      .attr('font-size', fontSize + 'px')
      .attr('fill', '#333')
      .call(xAxis.orient('bottom').tickFormat(fixedDigits));

    var xLabel = valueColumnNames[0];
    this.svg.selectAll('.xlabel').data([1]).enter().append('text')
      .attr('class', 'xlabel')
      .text(xLabel)
      .attr('text-anchor', 'middle')
      .attr('x', this.width / 2 - Util.strSize(xLabel, labelFontSize).width / 2)
      .attr('y', axisY + 3 * yPad)
      .attr('font-size', labelFontSize + 'px')
      .attr('fill', '#333')
      .style('font-weight', labelFontWeight);

    if (uniqueKeys.length > 0) {
      var yLabelDim = Util.strSize(key, labelFontSize);
      this.svg.selectAll('.ylabel').data(key).enter().append('text')
        .attr('class', 'ylabel')
        .text((d) => d)
        .attr('text-anchor', 'left')
        .attr('transform', 'translate(0, ' + this.height / 2 + ') rotate(-90)')
        .attr('y', yLabelDim.height - 2)
        .attr('font-size', labelFontSize + 'px')
        .attr('fill', '#333')
        .style('font-weight', labelFontWeight);
    }
  },
});

module.exports = BoxPlot;
