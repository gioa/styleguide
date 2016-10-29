/* eslint no-var:0, no-unused-vars:0, one-var-declaration-per-line:0, comma-dangle:0, no-shadow:0,
no-mixed-operators:0, func-names: 0 */

/**
 * Created by hossein on 4/14/14.
 */
import $ from 'jquery';
import _ from 'underscore';
import d3 from 'd3';
import regression from 'regression';

import PieChartConstants from '../visualizations/PieChartConstants';
import TrellisPlot from '../visualizations/TrellisPlot';
import VizUtil from '../visualizations/VizUtil';

var QQPlot = TrellisPlot.extend({

  // Helper function to get data domain. If domain length is zero
  // we extend the domain range by +- 10% of the center value
  getDomain(data, pos) {
    var dataDomain = d3.extent(data, (d) => d[pos]);
    if (dataDomain[0] === dataDomain[1]) {
      var value = dataDomain[0];
      dataDomain[0] = value - 0.1 * value;
      dataDomain[1] = value + 0.1 * value;
    }
    return dataDomain;
  },

  // X and Y scales:
  // Note: For grid of QQ-plots it is critical to have fixed x-scale and
  // y-scale for all plots to aid visual linking and comparing of quantile values.
  getXScale(grid, data, keys, values, options) {
    return d3.scale.linear().domain(this.getDomain(data, keys.length));
  },

  getYScale(grid, data, keys, values, options) {
    var yScale = d3.scale.linear().domain([-4, 4]);
    if (values.length > 1) {
      yScale = d3.scale.linear().domain(this.getDomain(data, keys.length + 1));
    }
    return yScale;
  },

  getXLabel(data, keys, values) {
    return values[0] + ' Quantiles';
  },

  getYLabel(data, keys, values) {
    var label = values.length > 1 ? values[1] : 'Normal';
    return label + ' Quantiles';
  },

  plotPanel(panel, gridCell, keys, plotData, xScale, yScale, options) {
    if (plotData.length === 0 || plotData[0].length === keys.length) {
      // No data values to plot.
      console.error('No data values to plot');
      return;
    }
    var firstRow = plotData[0];
    if (typeof firstRow[keys.length] === 'string') {
      console.error('First value is not numeric');
      return;
    }
    if (firstRow[keys.length + 1] && typeof firstRow[keys.length + 1] === 'string') {
      console.error('Second value is not numeric');
      return;
    }

    function normal() {
      var x = 0, y = 0, rds, c;
      do {
        x = Math.random() * 2 - 1;
        y = Math.random() * 2 - 1;
        rds = x * x + y * y;
      } while (rds === 0 || rds > 1);
      c = Math.sqrt(-2 * Math.log(rds) / rds); // Box-Muller transform
      return x * c; // throw away extra sample y * c
    }

    var sortedX = _.sortBy(plotData, function(d) {
      return d[keys.length];
    }).map((d) => d[keys.length]);

    var sortedY = [];
    // If there is only one value, generate standard normal Q-Q plot
    if (firstRow.length === keys.length + 1) {
      var normalData = [];
      for (var i = 0; i < plotData.length; i++) {
        normalData[i] = normal();
      }
      sortedY = _.sortBy(normalData, function(d) {
        return d;
      });
    } else {
      sortedY = _.sortBy(plotData, function(d) {
        return d[keys.length + 1];
      }).map((d) => d[keys.length + 1]);
    }

    var data = _.zip(sortedX, sortedY);

    if (data.length > 1) {
      var xDomain = xScale.domain();
      var yDomain = yScale.domain();

      // Fitting an ordinary least squares line to data
      var regLine = regression('linear', data);
      var slope = regLine.equation[0];
      var intercept = regLine.equation[1];

      if (slope && intercept) {
        // Segment of the fitted line that fals inside the panel.
        var segment = VizUtil.boxBoundedLine(slope, intercept,
                                             xDomain[0], yDomain[0], xDomain[1], yDomain[1]);

        // Plotting the fitted line
        panel.selectAll('line').data([1])
          .enter().append('line')
          .attr('class', 'whisker')
          .attr('x1', xScale(segment.x1))
          .attr('y1', yScale(segment.y1))
          .attr('x2', xScale(segment.x2))
          .attr('y2', yScale(segment.y2));
      }
    }

    panel.selectAll('circle')
      .data(data)
      .enter().append('circle')
      .attr('class', 'plot')
      .attr('cx', function(d) { return xScale(d[0]); })
      .attr('cy', function(d) { return yScale(d[1]); })
      .attr('fill', PieChartConstants.COLOR_SCALE(0))
      .attr('r', 3)
      .on('mousemove', function(d, i) {
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
        // Hide the tooltip
        d3.select('#tooltip').classed('hidden', true);
      });
  }
});

module.exports = QQPlot;
