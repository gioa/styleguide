/* eslint no-var:0, no-unused-vars:0, comma-dangle:0, no-mixed-operators:0, func-names: 0 */

import $ from 'jquery';
import _ from 'underscore';
import d3 from 'd3';

import PieChartConstants from '../visualizations/PieChartConstants';
import TrellisPlot from '../visualizations/TrellisPlot';

var QuantilePlot = TrellisPlot.extend({

  // X and Y scales:
  // Note: For grid of quantile plots it is critically important to have fixed
  // y-scale for all plots to aid visual linking and comparing of quantile values.
  getXScale(grid, data, keys, values, options) {
    return d3.scale.linear()
      .domain([0, 1]);
  },

  getYScale(grid, data, keys, values, options) {
    return d3.scale.linear()
      .domain(d3.extent(data, (d) => d[keys.length]));
  },

  getXLabel(data, keys, values) {
    return 'Quantile';
  },

  getYLabel(data, keys, values) {
    return values[0];
  },

  plotPanel(panel, gridCell, keys, plotData, xScale, yScale, options) {
    if (plotData === undefined || plotData.length === 0) {
      console.error('No data to plot in panel', panel);
      return;
    }

    var firstRow = plotData[0];
    if (firstRow[keys.length] === undefined || typeof firstRow[keys.length] === 'string') {
      console.error('Cannot plot nun-numeric values');
      return;
    }

    var sortedData = _.sortBy(plotData, function(d) {
      return d[keys.length];
    });

    var len = sortedData.length;
    var order = 0;
    var data = sortedData.map(function(r) {
      order++;
      return [order / len, r[keys.length]];
    });

    panel.selectAll('circle')
      .data(data)
      .enter().append('circle')
      .attr('class', 'plot')
      .attr('cx', function(d) { return xScale(d[0]); })
      .attr('cy', function(d) { return yScale(d[1]); })
      .attr('fill', PieChartConstants.COLOR_SCALE(0))
      .attr('r', 3)
      .on('click', function(d, i) {
        var mouse = d3.mouse(this);
        panel.append('line').attr({
          class: 'feedback-grid',
          x1: 0,
          y1: mouse[1],
          x2: gridCell.width,
          y2: mouse[1],
          stroke: 'gray',
          'stroke-width': '1.0',
          'shape-rendering': 'crispEdges',
        });
        panel.append('line').attr({
          class: 'feedback-grid',
          x1: mouse[0],
          y1: 0,
          x2: mouse[0],
          y2: gridCell.height,
          stroke: 'gray',
          'stroke-width': '1.0',
          'shape-rendering': 'crispEdges',
        });
      })
      .on('mousemove', function(d, i) {
        var curColor = d3.rgb(PieChartConstants.COLOR_SCALE(0));
        // Visual feedback
        d3.select(this).attr('fill', curColor.darker(1));
        // Update the tooltip position and value
        var tooltipText = (parseFloat(d[0]).toFixed(2)) + ': ' +
            (parseFloat(d[1]).toFixed(2));
        var tooltipFontSize = $('#tooltip').css('font-size');
        tooltipFontSize = parseFloat(tooltipFontSize.slice(0, tooltipFontSize.length - 2));
        d3.select('#tooltip')
          .style('left', (d3.event.pageX - (tooltipFontSize * tooltipText.length / 3)) + 'px')
          .style('top', (d3.event.pageY - 2 * tooltipFontSize) + 'px')
          .select('#value')
          .text(tooltipText);

        // Show the tooltip
        d3.select('#tooltip').classed('hidden', false);
      })
      .on('mouseout', function() {
        d3.select(this).attr('fill', PieChartConstants.COLOR_SCALE(0));
        panel.selectAll('.feedback-grid').remove();
        // Hide the tooltip
        d3.select('#tooltip').classed('hidden', true);
      });
  }
});

module.exports = QuantilePlot;
