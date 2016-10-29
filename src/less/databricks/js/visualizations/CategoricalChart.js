/* eslint no-unused-consts: 0, no-mixed-operators: 0, max-depth: 0, func-names: 0 */

/**
 * Superclass for charts with a categorical axis. This class creates and manages and SVG element
 * inside a parent DOM element, and offers a plot() method for updating the graph with new data.
 * It handles drawing the scales, while subclasses can handle plotSeries() to draw each series.
 *
 */
import d3 from 'd3';

import Chart from '../visualizations/Chart';
import ChartConstants from '../visualizations/ChartConstants';
import DomUtil from '../visualizations/DomUtil';
import Legend from '../visualizations/Legend';
import VizUtil from '../visualizations/VizUtil';

const CategoricalChart = Chart.extend({
  constructor(parentElement) {
    Chart.call(this);
    this.width = 660;
    this.height = 250;
    this.yMargin = 52;
    this.svg = d3.select(parentElement).append('svg').attr({
      width: this.width,
      height: this.height,
      'class': 'chart',
    });
    // Create two <g>s, a background and foreground, to simplify Z-ordering
    this.background = this.svg.append('g');
    this.foreground = this.svg.append('g');
    this.tooltip = this.svg.append('g').attr('opacity', 0);
    this.tooltip.append('rect')
      .attr('fill', '#333')
      .attr('opacity', 0.75)
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('height', 15)
      .attr('width', 300);
    this.tooltip.append('polygon')
      .attr('fill', '#333')
      .attr('opacity', 0.75);
    this.tooltip.append('text')
      .text('TOOLTIP')
      .attr('class', 'tooltip-text')
      .attr('font-size', '12px')
      .attr('text-anchor', 'middle')
      .attr('fill', 'white');
    this.hovers = this.svg.append('g'); // Put them all the way on top to let mouse events work
    this.firstRender = true;
  },

  plotSeries() {},

  removeSeries() {},

  removePlot() {
    this.svg.selectAll('.xlabel').remove();
    this.svg.selectAll('.ylabel').remove();
  },

  inferColumns(schema) {
    const inferred = VizUtil.findColumns(1, 2, schema);
    if (inferred.xColumns.length === 0) {
      inferred.xColumns.push('<id>');
    }
    return inferred;
  },

  setupYScale(data) {
    const isStacked = this.getOption('stacked');
    const is100 = this.getOption('100_stacked');

    let maxY;
    let minY;
    if (isStacked) {  // stack bars to figure out max/min y height
      let stackMaxY = 0;
      let stackMinY = 0;
      for (let x = 0; x < data.length; x++) {
        let sumPos = 0;
        let sumNeg = 0;
        for (let y = 1; y < data[x].length; y++) { // start at 1 to skip labels
          const num = data[x][y];
          if (num >= 0.0) {
            sumPos += num;
          } else {
            sumNeg += num;
          }
        }
        stackMaxY = Math.max(stackMaxY, sumPos);
        stackMinY = Math.min(stackMinY, sumNeg);
      }
      maxY = stackMaxY;
      minY = stackMinY;
    } else if (is100) { // 100% stacked bars, Y-axis is between -100%/0% to 100%/0% always
      const ys1 = data
          .map(function(a) { return a.slice(1); })
          .reduce(function(a, b) { return a.concat(b); });
      maxY = d3.max(ys1) > 0 ? 100.0 : 0;
      minY = d3.min(ys1) < 0 ? -100.0 : 0;
    } else {  // no stacking, just get the max/min bar height across all values
      const ys2 = data
          .map(function(a) { return a.slice(1); })
          .reduce(function(a, b) { return a.concat(b); });
      maxY = d3.max(ys2);
      minY = d3.min(ys2);
    }
    const yScale = d3.scale.linear()
        .domain([minY, maxY])
        .nice();

    const minMargin = (yScale.domain()[1] - yScale.domain()[0]) * 0.02;
    if (!is100 && minMargin > (yScale.domain()[1] - maxY)) { // no slack when +/-100% Y-axis
      // The "niced" domain is very close to the original size. Expand the domain a bit to leave
      // space above for tooltips. This is a small hack until we can show tooltips below a point
      const min = minY === 0 ? 0 : minY - minMargin;
      const max = maxY === 0 ? 0 : maxY + minMargin;
      yScale.domain([min, max]).nice();
    }

    return yScale;
  },

  plot(data, key, valueColumnNames, width, height, options) {
    Chart.prototype.plot.call(this, data, key, valueColumnNames, width, height);
    this.removePlot();
    data = this.dropDuplicateKeys(data);
    const yLabel = options.yColumns ? options.yColumns.join(', ') : '';
    const xLabel = key;
    const labelFontSize = ChartConstants.LABEL_FONT_SIZE;
    const labelFontWeight = ChartConstants.LABEL_FONT_WEIGHT;

    const oldNumSeries = this.oldNumSeries || 0;
    const numSeries = valueColumnNames.length;
    this.oldNumSeries = numSeries;

    width = this.width;     // Pull these into local consts since they're used below in closures
    height = this.height;
    const yMargin = this.yMargin;

    let legendWidth = 0;
    const fontSize = ChartConstants.FONT_SIZE;
    if (numSeries > 1) {
      legendWidth = Legend.getMaxLabelWidth(this.svg, valueColumnNames, fontSize);
      legendWidth += 4 * fontSize;
    }

    const keyFunc = function(a) { return a[0]; };
    const yScale = this.setupYScale(data);

    // Redraw the level lines
    let yTicksHint = (height - yMargin - 25) / fontSize / 2.5;
    yTicksHint = Math.ceil(Math.max(yTicksHint, 2));
    const yTicks = yScale.ticks(yTicksHint);
    const maxYTick = d3.max(yTicks);
    const fixedDigits = d3.format('0,.f');
    const percentDigits = function(d) { return fixedDigits(d) + '%'; };
    this.xMargin = DomUtil.strSize(fixedDigits(maxYTick), labelFontSize).width + 10 +
      DomUtil.strSize(yLabel, labelFontSize).height * 2;
    const xMargin = this.xMargin;

    yScale.range([height - yMargin, 25]);
    const xScale = d3.scale.ordinal()
        .domain(data.map(keyFunc))
        .rangePoints([xMargin, width - 10 - legendWidth], 1.0);
    const groupWidth = (width - 10 - legendWidth - xMargin) / data.length;


    this.svg.selectAll('.xlabel').data([xLabel]).enter().append('text')
      .attr('class', 'xlabel')
      .text((d) => d)
      .attr('text-anchor', 'middle')
      .transition()
      .attr('x', (this.width + xMargin) / 2 - DomUtil.strSize(xLabel, labelFontSize).width / 2)
      .attr('y', this.height - DomUtil.strSize(xLabel, labelFontSize).height)
      .attr('font-size', labelFontSize + 'px')
      .attr('fill', '#333')
      .style('font-weight', labelFontWeight);

    const yLabelDim = DomUtil.strSize(yLabel, labelFontSize);
    this.svg.selectAll('.ylabel').data([yLabel]).enter().append('text')
      .attr('class', 'ylabel')
      .text(yLabel)
      .attr('text-anchor', 'left')
      .attr('transform', 'translate(0, ' + this.height / 2 + ') rotate(-90)')
      .attr('y', yLabelDim.height - 2)
      .attr('font-size', labelFontSize + 'px')
      .attr('fill', '#333')
      .style('font-weight', labelFontWeight);

    const tickLines = this.background.selectAll('.tick-line').data(yTicks);
    tickLines.enter().append('line')
      .attr('class', 'tick-line')
      .style('stroke', '#ccc')
      .attr('opacity', 0);
    tickLines.transition()
      .attr({ x1: xMargin, x2: width - 10 - legendWidth, y1: yScale, y2: yScale, opacity: 1 });
    tickLines.exit()
      .transition()
      .attr('opacity', 0)
      .remove();

    const is100 = this.getOption('100_stacked');
    const drawYAxis = function() {
      // Redraw the Y axis
      this.yAxis = d3.svg.axis()
        .scale(yScale)
        .orient('left')
        .ticks(yTicksHint).tickFormat(fixedDigits);
      if (is100) {
        this.yAxis.tickFormat(percentDigits);
      }
      if (this.firstRender) {
        this.background.append('g')
          .attr('class', 'axis y-axis')
          .attr('opacity', 0);
      }
      this.background.selectAll('.y-axis')
        .transition()
        .attr('transform', 'translate(' + xMargin + ',0)')
        .attr('opacity', data.length ? 1 : 0)
        .call(this.yAxis);
    };

    const drawXAxis = function() {
      // Redraw the X axis
      let maxXTicks = 5;
      if (data.length > 0) {
        const keyLengths = data.map(keyFunc).map(function(x) { return x.length; });
        const averageKeyLength = keyLengths.reduce(function(x, y) { return x + y; }) / data.length;
        maxXTicks = (width - xMargin - legendWidth) / (averageKeyLength * 8);
      }
      const filteredTicks = this.limitTicks(data.map(keyFunc), maxXTicks);
      this.xAxis = d3.svg.axis()
        .scale(xScale)
        .orient('bottom')
        .tickValues(filteredTicks);
      if (this.firstRender) {
        this.background.append('g')
          .attr('class', 'axis x-axis')
          .attr('opacity', 0);
      }
      this.background.selectAll('.x-axis')
        .transition()
        .attr('transform', 'translate(0,' + (height - yMargin) + ')')
        .attr('opacity', data.length ? 1 : 0)
        .call(this.xAxis)
        .attr('transform', 'translate(0,' + (height - yMargin) + ')');
    };

    // Plot all our series
    const plotParams = {
      yScale: yScale,
      xScale: xScale,
      keyFunc: keyFunc,
      groupWidth: groupWidth,
      numSeries: numSeries,
      oldNumSeries: oldNumSeries,
      valueColumnNames: valueColumnNames,
      drawXAxis: drawXAxis.bind(this),
      drawYAxis: drawYAxis.bind(this),
    };

    let s;
    for (s = 0; s < numSeries; s++) {
      this.plotSeries(data, s, plotParams);
    }
    // Remove any old series that are now gone
    for (s = numSeries; s < oldNumSeries; s++) {
      this.removeSeries(data, s, plotParams);
    }

    if (numSeries > 1) {
      Legend.plotVerticalLegend(
        this.svg,
        valueColumnNames, 100,
        width - legendWidth + fontSize,
        yMargin,
        fontSize,
        ChartConstants.COLOR_SCALE,
        true,
        options.pivotColumns ? options.pivotColumns.join(', ') : '');
    } else {
      // We might've had a legend from before so let's remove it
      this.svg.selectAll('.legend').remove();
    }

    this.firstRender = false;
  },

  dropDuplicateKeys(array) {
    // TODO: Dropping duplicate keys is not ideal, but on the other hand we need to use
    // keys for D3 animations; maybe extend each key to be [key, repeatIndex] where
    // repeatIndex is the number of times this key has appeared in the array earlier
    const keysSeen = {};
    const newArray = [];
    array.forEach(function(elem) {
      if (!keysSeen[elem[0]]) {
        keysSeen[elem[0]] = true;
        newArray.push(elem);
      }
    });
    if (newArray.length < array.length) {
      console.warn('Array with duplicate keys passed to CategoricalChart', array);
    }
    return newArray;
  },

  /**
   * Pick a limited set of values from an array to use as ticks
   */
  limitTicks(keys, maxTicks) {
    if (maxTicks >= keys.length) {
      return keys;
    }
    const skip = Math.max(1, Math.ceil(keys.length / maxTicks));
    const filtered = [];
    for (let i = 0; i < keys.length; i += skip) {
      filtered.push(keys[i]);
    }
    return filtered;
  },

  showTooltip(x, y, text) {
    const tooltip = this.tooltip;
    y = Math.round(y);
    tooltip.select('polygon')
      .attr('points',
            (x - 3) + ',' + (y + 3) + ' ' + (x) + ',' + (y + 6) + ' ' + (x + 3) + ' ' + (y + 3));
    tooltip.select('text')
      .text(text)
      .attr('x', x)
      .attr('y', y);
    const width = tooltip.select('text').node().getComputedTextLength() + 10;
    // Correct for the case where the tooltip would go off our right edge
    if (x + width / 2 > this.width) {
      x -= (x + width / 2) - this.width;
      tooltip.select('text').attr('x', x);
    } else if (x - width / 2 < 0) {
      x += (width / 2 - x);
      tooltip.select('text').attr('x', x);
    }
    tooltip.select('rect')
      .attr('x', x - width / 2)
      .attr('y', y - 12)
      .attr('width', width);
    tooltip.attr('opacity', 1);
  },

  hideTooltip() {
    this.tooltip.attr('opacity', 0);
  },

});

module.exports = CategoricalChart;
