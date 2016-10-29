/* eslint no-mixed-operators: 0, func-names: 0 */

/**
 * A class that represents an updatable bar chart, based on D3. Given a parent DOM element, this
 * constructor creates a SVG inside it and returns an object with a function for updating the
 * graph based on new data.
 *
 * DEPENDENCIES: CategoricalChart
 */
import d3 from 'd3';

import CategoricalChart from '../visualizations/CategoricalChart';
import ChartConstants from '../visualizations/ChartConstants';
import VizUtil from '../visualizations/VizUtil';

const BarChart = CategoricalChart.extend({

  constructor(parentElement) {
    CategoricalChart.call(this, parentElement);
    this.setDefaultOptions([{
      inputType: 'radio',
      label: 'Grouped',
      key: 'grouped',
      value: true,
    }, {
      inputType: 'radio',
      label: 'Stacked',
      key: 'stacked',
      value: false,
    }, {
      inputType: 'radio',
      label: '100% Stacked',
      key: '100_stacked',
      value: false,
    }]);
  },

  getBarX(plotParams, groupIdx, serieIdx) {
    let seriesOffset;
    if (this.getOption('stacked') || this.getOption('100_stacked')) {
      seriesOffset = 0.125;
    } else { // numSeries bars per group
      seriesOffset = 0.125 + 0.75 * serieIdx / plotParams.numSeries;
    }
    return this.xMargin + (groupIdx + seriesOffset) * plotParams.groupWidth;
  },

  getBarWidth(plotParams) {
    let width;
    if (this.getOption('stacked') || this.getOption('100_stacked')) {
      width = 0.75 * plotParams.groupWidth;
    } else { // numSeries bars per group
      width = 0.75 * plotParams.groupWidth / plotParams.numSeries;
    }
    return width;
  },

  getBarHeight(plotParams, serieData, serieIdx) {
    const yScale = plotParams.yScale;
    let height = Math.abs(yScale(0) - yScale(serieData[serieIdx + 1]));

    if (this.getOption('100_stacked')) {
      let total = 0.0;
      for (let w = 1; w < serieData.length; w++) {
        total += Math.abs(serieData[w]);
      }
      if (total === 0.0) {
        height = 0.0;
      } else {
        height = 100.0 * height / total;
      }
    }

    return height;
  },

  plotSeries(data, s, plotParams) {
    const keyFunc = plotParams.keyFunc;
    const yScale = plotParams.yScale;
    const domain = yScale.domain();
    if (domain[0] > 0) {
      domain[0] = 0;
      yScale.domain(domain).nice();
    }
    if (domain[1] < 0) {
      domain[1] = 0;
      yScale.domain(domain).nice();
    }
    plotParams.drawYAxis();
    plotParams.drawXAxis();

    const that = this;
    const rects = this.foreground.selectAll('.series' + s)
        .data(data, keyFunc);
    rects.enter().append('rect')
      .attr('class', 'series' + s)
      .attr('y', yScale(0))
      .attr('x', function(d, i) { return that.getBarX(plotParams, i, s); })
      .attr('height', 0)
      .attr('width', that.getBarWidth(plotParams))
      .attr('fill', ChartConstants.COLOR_SCALE(s));
    rects.transition()
      .attr('y', function(d) {
        const stackY = VizUtil.getBarY.call(that, d, s, VizUtil.plotType.BAR_PLOT);
        return yScale(stackY);
      })
      .attr('x', function(d, i) { return that.getBarX(plotParams, i, s); })
      .attr('height', function(d) {
        return that.getBarHeight(plotParams, d, s);
      })
      .attr('width', that.getBarWidth(plotParams));
    rects.exit()
      .transition()
      .attr('y', yScale(0))
      .attr('height', 0)
      .remove();

    // Add tooltip on hover
    const format = VizUtil.tooltipNumFormat;
    const _this = this;
    rects.on('mouseover', function(d, i) {
      const curColor = d3.rgb(ChartConstants.COLOR_SCALE(s));
      d3.select(this).attr('fill', curColor.darker(1));
      const x = that.getBarX(plotParams, i, s) + that.getBarWidth(plotParams) / 2.0;
      const y = yScale(VizUtil.getBarY.call(that, d, s, VizUtil.plotType.BAR_PLOT)) - 6;
      _this.showTooltip(x, y, d[0] + ': ' + format(d[s + 1]));
    });
    rects.on('mouseout', function() {
      d3.select(this).attr('fill', ChartConstants.COLOR_SCALE(s));
      _this.hideTooltip();
    });
  },

  removeSeries(data, s, plotParams) {
    const yScale = plotParams.yScale;
    this.foreground.selectAll('.series' + s)
      .attr('class', 'removed')
      .transition()
      .attr('y', yScale(0))
      .attr('height', 0)
      .remove();
  },

});

module.exports = BarChart;
