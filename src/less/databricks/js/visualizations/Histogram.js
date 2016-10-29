/* eslint no-var:0, comma-dangle:0, no-unused-vars:0, one-var-declaration-per-line:0,
no-mixed-operators: 0, func-names: 0  */

import $ from 'jquery';
import _ from 'underscore';
import d3 from 'd3';

import PieChartConstants from '../visualizations/PieChartConstants';
import Trellis from '../visualizations/TrellisPlot';

var Histogram = Trellis.extend({

  constructor(parentElement) {
    Trellis.call(this, parentElement);
    this.setDefaultOptions([{
      inputType: 'text',
      label: 'Number of bins',
      key: 'bins',
      value: '20'
    }]);
  },

  getXLabel(data, keys, values) {
    return values[0];
  },

  getYLabel(data, keys, values) {
    return 'Density';
  },

  getXScale(grid, data, keys, values, options) {
    var numBins = parseInt(this.getOption('bins'), 10);
    var binSize;
    var xScaleDomain = d3.extent(data, function(d) {
      return d[keys.length];
    });
    binSize = 2 * (xScaleDomain[1] - xScaleDomain[0]) / numBins;
    return d3.scale.linear()
      .domain([xScaleDomain[0] - binSize, xScaleDomain[1] + binSize]);
  },

  getYScale(grid, data, keys, values, options) {
    var uniqueKeysX, uniqueKeysY;

    if (keys.length > 2) {
      this.showText('Error inferring columns. There should not be more than two keys.');
      return undefined;
    } else if (keys.length === 2) {
      uniqueKeysX = _.uniq(data.map(function(r) {
        return r[0];
      }));
      uniqueKeysY = _.uniq(data.map(function(r) {
        return r[1];
      }));
    } else if (keys.length === 1) {
      uniqueKeysX = _.uniq(data.map(function(r) {
        return r[0];
      }));
    }

    var filterByKey = function(keyValX, keyValY) {
      return function(d) {
        if (keyValX === undefined) {
          // No X or Y key
          return true;
        } else if (keyValY === undefined) {
          // Only a single key
          return (d[0] === keyValX);
        }
        // Both keys are present
        return (d[0] === keyValX && d[1] === keyValY);
      };
    };

    var getKeyVals = function(p) {
      var keyValX, keyValY;
      if (keys.length > 1) {
        keyValY = uniqueKeysY[p.row];
      }
      if (keys.length > 0) {
        keyValX = uniqueKeysX[p.col];
      }
      return {
        X: keyValX,
        Y: keyValY
      };
    };

    if (options.usingAggData === true) {
      var binIndex = keys.length;
      var dataIndex = keys.length + 1;
      var binSize = data[1][binIndex] - data[0][binIndex];

      this.hists = grid.map(function(p) {
        var keyVals = getKeyVals(p);
        var keyData = _.filter(data, filterByKey(keyVals.X, keyVals.Y));
        var sortedKeyData = _.sortBy(keyData, function(sr) { return sr[binIndex]; });
        return _.map(sortedKeyData, function(d) {
          return {
            dx: binSize,
            x: d[binIndex],
            y: d[dataIndex]
          };
        });
      });
    } else {
      var xScale = this.getXScale(grid, data, keys, values, options);

      // Build the histograms and remember it.
      var numBins = parseInt(this.getOption('bins'), 10);

      this.hists = grid.map(function(p) {
        var keyVals = getKeyVals(p);
        var keyData = _.filter(data, filterByKey(keyVals.X, keyVals.Y)
                              ).map(function(d) {
                                return d[keys.length];
                              });

        return d3.layout.histogram()
          .bins(xScale.ticks(numBins))(keyData);
      });
    }

    var len;
    var maxDensities = _.map(this.hists, function(hist) {
      var allLen = hist.map(function(arr) {
        return arr.y;
      });
      len = _.reduce(allLen, function(first, second) {
        return (first + second);
      }, 0);
      if (len === 0) {
        len = 1; // To avoid division by zero
      }
      return _.max(allLen) / len;
    });
    var maxDensity = _.max(maxDensities);
    return d3.scale.linear().domain([0, maxDensity * 1.1]);
  },

  plotPanel(panel, gridCell, keys, plotData, xScale, yScale, options) {
    var _this = this;
    var hist, len;

    hist = this.hists[gridCell.index];
    var allLen = hist.map(function(arr) { return arr.y; });
    // Total number of elements in this panel
    len = d3.sum(allLen);
    if (len === 0) {
      len = 1; // To avoid devision by zero
    }

    if (hist[0] === undefined || hist[0].dx === undefined) {
      return;
    }
    var binWidth = xScale(hist[0].dx);

    if (hist.length > 1) {
      binWidth = xScale(hist[1].x) - xScale(hist[0].x);
    }
    if (binWidth < 1) {
      binWidth = 1; // We cannot display sub-pixel
    }

    panel.selectAll('rect')
      .data(hist)
      .enter().append('rect')
      .attr('width', (Math.floor(binWidth)))
      .attr('transform', function(d) {
        return 'translate(' +
          (xScale(d.x)) + ',' + (yScale(d.y / len) - _this.padding) + ')';
      })
      .attr('height', function(d) {
        var curH = gridCell.height - yScale(d.y / len);
        return curH > 0 ? curH : 0;
      })
      .attr('fill', PieChartConstants.COLOR_SCALE(0))
      .on('mousemove', function(d, i) {
        var curColor = d3.rgb(PieChartConstants.COLOR_SCALE(0));
        d3.select(this).attr('fill', curColor.darker(1));
        // Update the tooltip position and value
        var tooltipText = (parseFloat(d.x).toFixed(2)) +
            ': ' + (parseFloat(d.y / len).toFixed(2));
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
        d3.select(this).attr('fill', PieChartConstants.COLOR_SCALE(0));
        d3.select('#tooltip').classed('hidden', true);
      });
  }
});

module.exports = Histogram;
