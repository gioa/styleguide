/* eslint no-mixed-operators: 0, func-names: 0 */

/**
 * Functionality for generating Receiver Operating Characteristic (ROC) plots.
 */
import $ from 'jquery';
import d3 from 'd3';

import Chart from '../visualizations/Chart';
import ChartConstants from '../visualizations/ChartConstants';
import PieChartConstants from '../visualizations/PieChartConstants';
import ScatterPlotConstants from '../visualizations/ScatterPlotConstants';
import Util from '../visualizations/DomUtil';
import VizUtil from '../visualizations/VizUtil';

const ROCPlot = Chart.extend({
  constructor(parentElement) {
    Chart.call(this);
    this.svg = d3.select(parentElement).append('svg').attr({
      width: this.width,
      height: this.height,
      'class': 'chart',
    });
  },

  prepareData(rawData, schema, xColumns, yColumns) {
    return VizUtil.projectColumns(rawData, schema, xColumns, yColumns);
  },

  removePlot() {
    Chart.prototype.removePlot.call(this);
    this.svg.selectAll('.lineContainer').remove();
  },

  plot(rawdata, keys, valueColumnNames, width, height) {
    Chart.prototype.plot.call(this, rawdata, keys, valueColumnNames, width, height);
    const self = this;

    if (rawdata[0].length < 1) {
      this.removePlot();
      this.showText('ROC requires exactly two variables (TPR vs FPR)');
      return;
    }

    // convert data to (color, fpr, tpr, threshold)
    const data = [];
    for (let i = 0; i < rawdata.length; i++) {
      const row = [];
      row[0] = PieChartConstants.COLOR_SCALE(0);
      for (let j = 0; j < 3; j++) {
        const value = rawdata[i][j];
        const parsedValue = parseFloat(value);
        if (isNaN(parsedValue)) {
          const msg = 'ROC plots are possible only for numerical columns';
          this.removePlot();
          this.showText(msg);
          console.error(msg,
                        'Column ', j, ' Row ', (i + 1),
                        " doesn't contain numerical values: ", value);
          return;
        }
        row.push(parsedValue);
      }
      data.push(row);
    }

    // Clear and sets up plot
    d3.select(this.canvas).remove();
    this.removePlot();

    this.lineContainer = this.svg.append('g')
      .attr('class', 'lineContainer');

    const fontSize = ChartConstants.FONT_SIZE;
    const domains = [undefined, [0, 1], [0, 1]];

    // Maximum label width of each dimension of data
    const maxLabelWidthY = [undefined, 24 * 1.4, 24 * 1.4];

    const fixedDigits = d3.format('.2f');

    const MaxLabelWidth = d3.max(maxLabelWidthY);
    const margin = ScatterPlotConstants.BORDER_SIZE / 2;
    const gap = MaxLabelWidth + 1;
    const padding = 2;

    const side = (this.width > this.height) ? this.height : this.width;
    const w = side - 2 * gap;
    const cellDim = w - margin;
    self.cellDim = w - margin;

    // Default X and Y scales (will be updated for each dimension)
    const xScale = d3.scale.linear().range([padding, cellDim - padding]);
    const yScale = d3.scale.linear().range([cellDim - padding, padding]);

    if (rawdata.length < 1) {
      this.removePlot();
      this.showText('No data to plot.');
      return;
    }

    // Tooltip showing value of currently hovered point
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
      .attr('class', 'tooltip-text')
      .attr('font-size', '12px')
      .attr('text-anchor', 'middle')
      .attr('fill', 'white');

    // Line showing x and y coordinates
    this.hoverLineGroup = this.tooltip.append('g')
      .attr('class', 'hover-line');
    this.hoverLineX = this.hoverLineGroup.append('line')
      .attr('x1', 10).attr('x2', 10) // vertical line so same value on each
      .attr('y1', 0).attr('y2', cellDim) // top to bottom
      .attr('stroke', '#6E7B8B');
    this.hoverLineY = this.hoverLineGroup.append('line')
      .attr('x1', 0).attr('x2', cellDim) // left to right
      .attr('y1', 10).attr('y2', 10) // horizontal so same value on each
      .attr('stroke', '#6E7B8B');
    this.hoverLineGroup.classed('hide', true); // hide by default

    // Labels on the axes of the hoverline
    this.hoverLabelX = this.hoverLineGroup.append('text')
      .attr('font-size', '12px')
      .attr('text-anchor', 'start')
      .attr('fill', 'black')
      .attr('stroke', null);

    this.hoverLabelY = this.hoverLineGroup.append('text')
      .attr('font-size', '12px')
      .attr('text-anchor', 'start')
      .attr('fill', 'black')
      .attr('stroke', null);

    /**
     * Plots the ROC curve.
     */
    function plotROCCurve() {
      xScale.domain(domains[1]).range([padding, cellDim - padding]);
      yScale.domain(domains[2]).range([cellDim - padding, padding]);

      // Functions to compute the X and Y of a data point
      const xPos = function(d) { return xScale(d[1]) + padding; };
      const yPos = function(d) { return yScale(d[2]) + padding; };

      // Draw and transition an SVG path for the line
      const cell = self.lineContainer;
      const line = d3.svg.line().x(xPos).y(yPos);
      const path = cell.append('g').selectAll('.line').data([data]);
      path.enter().append('path')
        .attr('class', 'line' + 0)
        .attr('fill', 'none')
        .attr('stroke', ChartConstants.COLOR_SCALE(0))
        .attr('stroke-width', '2px')
        .attr('opacity', 0)
        .attr('d', line)
        .transition()
        .attr('opacity', 1);

      // Circle over the current threshold point in ROC
      const focus = cell.append('g')
          .attr('class', 'focus')
          .style('display', 'none');

      focus.append('circle')
          .attr('r', 4.5)
          .attr('fill', 'none')
          .attr('stroke', '#6E7B8B')
          .attr('stroke-width', '2px');

      // Update `tooltip` and `focus` depending on mouse x-position
      const bisectX = d3.bisector(function(d) { return d[1]; }).left;
      function mousemove() {
        /* jshint validthis:true */

        // Get the closest datapoint d
        const x0 = xScale.invert(d3.mouse(this)[0]),
          i = bisectX(data, x0, 1),
          d0 = data[i - 1],
          d1 = data[i],
          d = x0 - d0[1] > d1[1] - x0 ? d1 : d0;

        // Update selected point and tooltip
        focus.attr('transform', 'translate(' + xPos(d) + ',' + yPos(d) + ')');
        self.showTooltip(xPos(d), yPos(d) + 10, 'threshold: ' + fixedDigits(d[3]));

        // Update hoverLineGroup
        self.hoverLineGroup.classed('hide', false);
        self.hoverLineX.attr('x1', xPos(d)).attr('x2', xPos(d));
        self.hoverLineY.attr('y1', yPos(d)).attr('y2', yPos(d));

        // Update hoverLineText
        self.hoverLabelX
          .text(fixedDigits(d[2]))
          .attr('x', 2)
          .attr('y', yPos(d));
        self.hoverLabelY
          .text(fixedDigits(d[1]))
          .attr('x', xPos(d))
          .attr('y', cellDim - 2);
      }

      cell.append('rect')
          .attr('class', 'overlay')
          .attr('opacity', 0)
          .attr('width', cellDim - 2 * padding)
          .attr('height', cellDim - 2 * padding)
          .on('mouseover', function() {
            focus.style('display', null);
            self.tooltip.style('display', null);
          })
          .on('mouseout', function() {
            focus.style('display', 'none');
            self.tooltip.style('display', 'none');
            self.hoverLineGroup.classed('hide', true);
          })
          .on('mousemove', mousemove);
    }

    /**
     * Plot the axes and ticks.
     */
    function plotAxes() {
      /* jshint validthis: true */
      const cell = self.lineContainer;

      xScale.domain(domains[1]);
      yScale.domain(domains[2]);

      const yTicks = Math.floor(cellDim / maxLabelWidthY[1]);
      const xTicks = Math.floor(
        cellDim / (Util.strSize(fixedDigits(0.9901), fontSize).width * 1.5)
      );

      const xAxis = d3.svg.axis().scale(xScale).ticks(xTicks);
      const yAxis = d3.svg.axis().scale(yScale).ticks(yTicks);

      cell.append('g')
        .attr('class', 'y axis')
        .attr('transform', 'translate(' + padding + ', 0)')
        .attr('font-size', fontSize + 'px')
        .call(yAxis.orient('left').tickFormat(fixedDigits));

      cell.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(0,' + (cellDim - padding) + ')')
        .attr('font-size', fontSize + 'px')
        .call(xAxis.orient('bottom').tickFormat(fixedDigits));

      // Create X axis
      cell.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(0,' + (cellDim - padding) + ')')
        .attr('font-size', fontSize + 'px')
        .call(xAxis.orient('top').tickFormat(''));

      cell.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(0,' + padding + ')')
        .attr('font-size', fontSize + 'px')
        .call(xAxis.orient('bottom').tickFormat(''));

      // Create Y axis
      cell.append('g')
        .attr('class', 'y axis')
        .attr('transform', 'translate(' + padding + ', 0)')
        .attr('font-size', fontSize + 'px')
        .call(yAxis.orient('right').tickFormat(''));

      cell.append('g')
        .attr('class', 'y axis')
        .attr('transform', 'translate(' + (cellDim - padding) + ', 0)')
        .attr('font-size', fontSize + 'px')
        .call(yAxis.orient('left').tickFormat(''));

      // In single panel mode show X and Y labels outside the panel
      const xLabel = valueColumnNames[0];
      const labelFontSize = ChartConstants.LABEL_FONT_SIZE;
      const labelFontWeight = ChartConstants.LABEL_FONT_WEIGHT;
      cell.selectAll('.xlabel').data([1]).enter().append('text')
        .attr('class', 'xlabel')
        .text(xLabel)
        .attr('text-anchor', 'middle')
        .attr('x', padding + gap + 20 + cellDim / 2 - Util.strSize(xLabel, labelFontSize).width / 2)
        .attr('y', cellDim + 3 * Util.strSize(xLabel, labelFontSize).height)
        .attr('font-size', labelFontSize + 'px')
        .attr('fill', '#333')
        .style('font-weight', labelFontWeight);

      const yLabel = valueColumnNames[1];
      const labelSize = Util.strSize(yLabel, labelFontSize);
      cell.selectAll('.ylabel').data([valueColumnNames]).enter().append('text')
        .attr('class', 'ylabel')
        .attr('transform', 'translate(' +
              -1 * (Util.strSize(fixedDigits('1'), fontSize).width + labelSize.height) +
              ', ' + cellDim / 2 + ') rotate(-90)')
        .text(yLabel)
        .text(yLabel)
        .attr('text-anchor', 'middle')
        .attr('font-size', labelFontSize + 'px')
        .attr('fill', '#333')
        .style('font-weight', ChartConstants.LABEL_FONT_WEIGHT);
    }

    plotAxes();
    plotROCCurve();

    // Plot baseline model (45-degree line)
    this.lineContainer.selectAll('baseline').data([1])
      .enter().append('line')
      .attr('class', 'whisker')
      .attr('x1', xScale(0))
      .attr('y1', yScale(0))
      .attr('x2', xScale(1))
      .attr('y2', yScale(1));

    // Adjustment needed to fit x and y axes and label
    this.lineContainer.attr(
        'transform',
        'translate(' + (padding + gap + 20) + ',' + (padding + gap - 30) + ')');
    this.tooltip
      .attr(
        'transform',
        'translate(' + (padding + gap + 20) + ',' + (padding + gap - 30) + ')');

    $(this.canvas).css('cursor', 'auto');
  },

  showTooltip(x, y, text) {
    const tooltip = this.tooltip;
    const tooltipBackground = tooltip.select('rect');
    const tooltipArrow = tooltip.select('polygon');
    const tooltipText = tooltip.select('.tooltip-text');
    let roundedY = Math.round(y);
    tooltipArrow
      .attr('points',
            (x - 3) + ' ' + roundedY + ',' +
              (x + 3) + ' ' + roundedY + ',' +
              x + ' ' + (roundedY - 6));
    tooltipText
      .text(text);

    const width = tooltipText.node().getComputedTextLength() + 10;
    const height = tooltipBackground.node().height.baseVal.value + 12;
    // Correct for the case where the tooltip would go off our right edge
    if (x + width / 2 > this.cellDim) {
      x -= (x + width / 2) - this.cellDim;
    } else if (x - width / 2 < 0) {
      x += (width / 2 - x);
    }
    // Correct for case where the tooltip would go off our bottom edge
    if (roundedY + height > this.cellDim) {
      roundedY -= height;
    }
    tooltipText
      .attr('x', x)
      .attr('y', roundedY + 12);
    tooltipBackground
      .attr('x', x - width / 2)
      .attr('y', roundedY)
      .attr('width', width);
    tooltip.attr('opacity', 1);
  },
});

module.exports = ROCPlot;
