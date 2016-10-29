/* eslint no-mixed-operators: 0, complexity: 0, max-depth: 0, func-names: 0 */

/**
 * Functionality for generating ScatterPlot Matrices
 */
import $ from 'jquery';
import _ from 'underscore';
import d3 from 'd3';
import science from 'science';

import Chart from '../visualizations/Chart';
import ChartConstants from '../visualizations/ChartConstants';
import PieChartConstants from '../visualizations/PieChartConstants';
import PlotLayout from '../visualizations/PlotLayout';
import Legend from '../visualizations/Legend';
import ScatterPlotConstants from '../visualizations/ScatterPlotConstants';
import Util from '../visualizations/DomUtil';
import VizUtil from '../visualizations/VizUtil';

const ScatterPlotMatrix = Chart.extend({

  constructor(parentElement) {
    Chart.call(this, parentElement);
    this.setDefaultOptions([{
      inputType: 'checkbox',
      label: 'Show LOESS',
      key: 'loess',
      value: false,
    }, {
      inputType: 'slider',
      label: 'Bandwidth',
      key: 'bandwidth',
      value: 0.3,
    }]);
  },

  /**
   *  For scatter plot matrix we can plot all numeric columns.
   *  By default we pick at most five numeric columns for values and a single key
   */
  inferColumns(schema) {
    return VizUtil.findColumns(5, 0, schema);
  },

  prepareData(rawData, schema, xColumns, yColumns) {
    return VizUtil.projectColumns(rawData, schema, xColumns, yColumns);
  },

  removePlot() {
    Chart.prototype.removePlot.call(this);
    this.svg.selectAll('.cell').remove();
    this.svg.selectAll('.legend').remove();
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.width, this.height);
    }
  },

  plot(rawdata, keys, valueColumnNames, width, height) {
    Chart.prototype.plot.call(this, rawdata, keys, valueColumnNames, width, height);
    d3.select(this.canvas).style({
      'z-index': 0,
    });
    this.ctx = this.canvas.getContext('2d');
    const n = valueColumnNames.length;
    const key = keys.length === 0 ? [] : keys.split(', ');
    const hasKeys = key.length > 0;
    let uniqueKeys = [];  // All unique key values
    const keyIndex = {};    // Inverted index to lookup index of a key value
    if (hasKeys) {
      uniqueKeys = _.uniq(rawdata.map((r) => r[0]));
      for (let indx = 0; indx < uniqueKeys.length; indx++) {
        keyIndex[uniqueKeys[indx]] = indx;
      }
    }
    const self = this;

    if (key.length > 1) {
      this.removePlot();
      this.showText('Cannot handle more than one key column');
      return;
    }

    if (rawdata.length < 1) {
      this.removePlot();
      this.showText('No data to plot.');
      return;
    }

    if (rawdata[0].length < 1) {
      this.removePlot();
      this.showText('Need at least two variables to create a scatter plot.');
      return;
    }
    // convert strings containing numbers to numbers
    const data = [];
    for (let i = 0; i < rawdata.length; i++) {
      const row = [];
      if (hasKeys === true) {
        row[0] = PieChartConstants.COLOR_SCALE(keyIndex[rawdata[i][0]]);
      } else {
        row[0] = PieChartConstants.COLOR_SCALE(0);
      }
      for (let j = 0 + key.length; j < n + key.length; j++) {
        const value = rawdata[i][j];
        const parsedValue = parseFloat(value);
        if (isNaN(parsedValue)) {
          const msg = 'Scatterplots are possible only for numerical columns';
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

    // Linearly map range between 10 to 1000 to the range of 5 to 1
    function getRectSize(len) {
      const maxSize = 5;
      const minSize = 1;
      const minLen = 10;
      const maxLen = 40000;
      const minSide = Math.min(self.width, self.height);

      let interm = ((maxSize - minSize) / (minLen - maxLen)) * (len - maxLen) + minSize;
      interm = interm * minSide / 800;
      return Math.max(Math.floor(interm), 1);
    }

    this.removePlot();

    const fontSize = ChartConstants.FONT_SIZE;
    const domains = []; // Domain of each dimension of data
    const maxLabelWidthX = []; // Maximum label width of each dimension of data
    const maxLabelWidthY = []; // Maximum label width of each dimension of data
    const fixedDigits = d3.format('.3s');
    const ndim = data.length;
    const rectSize = getRectSize(ndim * n * (n - 1));

    function getDim(dim) {
      return function(d) { return d[dim]; };
    }
    for (let dim = 1; dim <= n; dim++) {
      domains[dim] = d3.extent(data, getDim(dim));
      maxLabelWidthX[dim] = Util.strSize(fixedDigits(domains[dim].head), fontSize).width * 1.4;
      maxLabelWidthY[dim] = Util.strSize(fixedDigits(domains[dim].head), fontSize).height * 1.4;
    }

    const MaxLabelWidth = d3.max(maxLabelWidthX);
    const margin = ScatterPlotConstants.BORDER_SIZE / 2;
    const gap = MaxLabelWidth + 1;
    const padding = 2;

    // Computing the maximum length of vertical legend
    let legendWidth = 0;
    if (hasKeys) {
      const longestKey = _.max(uniqueKeys, (k) => k.length);
      legendWidth = Util.strSize(longestKey, fontSize).width + 5 * fontSize;
    }

    this.selectedPoints = []; // Points selected by the brush

    this.singlePanel = false;
    // If there are only two variables, display a single panel instead of the full matrix
    if (n === 2) {
      this.singlePanel = true;
      this.grid = PlotLayout.getSquareGridLayout(1, this.width - legendWidth, this.height,
                                                 margin, gap);
      this.grid[0].row = 0;
      this.grid[0].col = 1;
      this.grid[0].x = this.grid[0].x + 20; // Adjustment needed to fit y label
      this.grid[0].y = this.grid[0].y - 30; // Adjustment needed to fit y label
    } else if (n > 2) {
      // Generating a grid (matrix) for scatterplots
      this.grid = PlotLayout.getSquareGridLayout(n, this.width - legendWidth, this.height,
                                                 margin, gap);
    } else {
      this.removePlot();
      this.showText('Need at least two variables to create a scatter plot.');
      return;
    }
    const nondiagonals = _.filter(this.grid, function(g) { return g.row !== g.col; });

    // Default X and Y scales (will be updated for each dimension)
    const xScale = d3.scale.linear().range([padding, this.grid[0].width - padding]);
    const yScale = d3.scale.linear().range([this.grid[0].height - padding, padding]);

    const panelFontSize = (this.grid[0].width > 80) ?
        ChartConstants.LABEL_FONT_SIZE + 3 : this.grid[0].width / 5;

    if (hasKeys === true) {
      const firstRow = self.grid.filter(function(g) { return g.col === 1; });
      const lastCell = _.max(firstRow, function(g) { return g.row; });
      Legend.plotVerticalLegend(this.svg, uniqueKeys, 0,
                                lastCell.x + lastCell.width + 4 * fontSize, 30, fontSize,
                                PieChartConstants.COLOR_SCALE, true, key);
    }
    /**
     * Plots a single scatter plot panel. If replot is false it will not erase and will only
     * plot selected ponits.
     * @param p
     * @param replot
     */
    function plotScatter(p, replot) {
      xScale.domain(domains[p.row + 1]).range([padding, p.width - padding]);
      yScale.domain(domains[p.col + 1]).range([p.height - padding, padding]);

      let cx;
      let cy;
      if (replot === true) {
        self.ctx.clearRect(p.x, p.y, p.width, p.height);
        let i;
        let d;
        let lastFill = -1;
        const selectCount = self.selectedPoints.length;

        if (rectSize <= 3) {
          for (i = 0; i < ndim; i++) {
            d = data[i];
            self.ctx.beginPath();
            if (d[0] !== lastFill) {
              self.ctx.fillStyle = d[0];
            }
            cx = xScale(d[p.row + 1]) + p.x + padding;
            cy = yScale(d[p.col + 1]) + p.y + padding;
            self.ctx.fillRect(cx, cy, rectSize, rectSize);
            if (d[0] !== lastFill) {
              self.ctx.closePath();
            }
            lastFill = d[0];
          }

          if (selectCount > 0) {
            self.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            self.ctx.beginPath();

            for (i = 0; i < selectCount; i++) {
              d = self.selectedPoints[i];
              cx = xScale(d[p.row + 1]) + p.x + padding;
              cy = yScale(d[p.col + 1]) + p.y + padding;
              self.ctx.rect(cx, cy, rectSize, rectSize);
            }
            self.ctx.fill();
          }
        } else {
          const radius = Math.min(rectSize, 2.5);
          for (i = 0; i < ndim; i++) {
            d = data[i];
            cx = xScale(d[p.row + 1]) + p.x + padding;
            cy = yScale(d[p.col + 1]) + p.y + padding;
            if (d[0] !== lastFill) {
              self.ctx.beginPath();
              self.ctx.fillStyle = d[0];
            }
            self.ctx.moveTo(cx, cy);
            self.ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
            if (d[0] !== lastFill) {
              self.ctx.closePath();
            }
            self.ctx.fill();
            lastFill = d[0];
          }
          self.ctx.closePath();
          self.ctx.fill();

          if (selectCount > 0) {
            self.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            self.ctx.beginPath();

            for (i = 0; i < selectCount; i++) {
              d = self.selectedPoints[i];
              cx = xScale(d[p.row + 1]) + p.x + padding;
              cy = yScale(d[p.col + 1]) + p.y + padding;
              self.ctx.moveTo(cx, cy);
              self.ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
            }
            self.ctx.fill();
          }
        }

        if (self.getOption('loess')) {
          const pairs = _.sortBy(
            data.map(function(point) {
              return [
                xScale(point[p.row + 1]) + p.x + padding,
                yScale(point[p.col + 1]) + p.y + padding,
              ];
            }),
            function(x) { return x[0]; });
          const fit = self.getOption('bandwidth') ?
            self.loessFit(pairs, parseFloat(self.getOption('bandwidth'))) : [];
          if (_.some(fit, function(x) { return isNaN(x[1]); })) {
            $('.plot-options#slider-value').text(': Error - too small!');
          } else {
            self.ctx.beginPath();
            self.ctx.moveTo(fit[0][0], fit[0][1]);
            for (i = 1; i < fit.length; i++) {
              d = fit[i];
              self.ctx.lineTo(d[0], d[1]);
            }
            self.ctx.strokeStyle = 'red';
            self.ctx.lineWidth = 1;
            self.ctx.stroke();
            self.ctx.closePath();
          }
        }
      }
    }

    /**
     * Put tick labels on every other outer panel
     * @param p
     */
    function plotAxes(p) {
      /* jshint validthis: true */
      const cell = d3.select(this);

      xScale.domain(domains[p.row + 1]);
      yScale.domain(domains[p.col + 1]);

      const yTicks = Math.floor(p.height / maxLabelWidthY[p.col]);
      const xTicks = Math.floor(
        p.width / (Util.strSize(fixedDigits(0.9901), fontSize).width * 1.5)
      );

      const xAxis = d3.svg.axis().scale(xScale).ticks(xTicks);
      const yAxis = d3.svg.axis().scale(yScale).ticks(yTicks);

      if ((p.row === 0 && (p.col % 2) === 0) || self.singlePanel) {
        cell.append('g')
          .attr('class', 'y axis')
          .attr('transform', 'translate(' + padding + ', 0)')
          .attr('font-size', fontSize + 'px')
          .call(yAxis.orient('left').tickFormat(fixedDigits));
      }
      if (p.row === (n - 1) && (p.col % 2) !== 0) {
        cell.append('g')
          .attr('class', 'y axis')
          .attr('transform', 'translate(' + (p.width - padding) + ', 0)')
          .attr('font-size', fontSize + 'px')
          .call(yAxis.orient('right').tickFormat(fixedDigits));
      }
      if (p.col === 0 && (p.row % 2) !== 0) {
        cell.append('g')
          .attr('class', 'x axis')
          .attr('transform', 'translate(0,' + (padding) + ')')
          .attr('font-size', fontSize + 'px')
          .call(xAxis.orient('top').tickFormat(fixedDigits));
      }
      if ((p.col === (n - 1) && (p.row % 2) === 0) || self.singlePanel) {
        cell.append('g')
          .attr('class', 'x axis')
          .attr('transform', 'translate(0,' + (p.height - padding) + ')')
          .attr('font-size', fontSize + 'px')
          .call(xAxis.orient('bottom').tickFormat(fixedDigits));
      }

      // Create X axis
      cell.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(0,' + (p.height - padding) + ')')
        .attr('font-size', fontSize + 'px')
        .call(xAxis.orient('top').tickFormat(''));

      cell.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(0,' + padding + ')')
        .attr('font-size', fontSize + 'px')
        .call(xAxis.orient('bottom').tickFormat(''));

      // create Y axis
      cell.append('g')
        .attr('class', 'y axis')
        .attr('transform', 'translate(' + padding + ', 0)')
        .attr('font-size', fontSize + 'px')
        .call(yAxis.orient('right').tickFormat(''));

      cell.append('g')
        .attr('class', 'y axis')
        .attr('transform', 'translate(' + (p.width - padding) + ', 0)')
        .attr('font-size', fontSize + 'px')
        .call(yAxis.orient('left').tickFormat(''));

      // In single panel mode show X and Y labels outside the panel
      if (self.singlePanel) {
        const xLabel = valueColumnNames[0];
        const labelFontSize = ChartConstants.LABEL_FONT_SIZE;
        const labelFontWeight = ChartConstants.LABEL_FONT_WEIGHT;
        cell.selectAll('.xlabel').data([1]).enter().append('text')
          .attr('class', 'xlabel')
          .text(xLabel)
          .attr('text-anchor', 'middle')
          .attr('x', padding + p.width / 2)
          .attr('y', p.y + p.height + 3 * Util.strSize(xLabel, labelFontSize).height)
          .attr('font-size', labelFontSize + 'px')
          .attr('fill', '#333')
          .style('font-weight', labelFontWeight);

        const yLabel = valueColumnNames[1];
        const labelSize = Util.strSize(yLabel, labelFontSize);
        cell.selectAll('.ylabel').data([valueColumnNames]).enter().append('text')
          .attr('class', 'ylabel')
          .attr('transform', 'translate(' +
                -1 * (Util.strSize(fixedDigits('10000'), fontSize).width + labelSize.height) +
                ', ' + p.height / 2 + ') rotate(-90)')
          .text(yLabel)
          .text(yLabel)
          .attr('text-anchor', 'middle')
          .attr('font-size', labelFontSize + 'px')
          .attr('fill', '#333')
          .style('font-weight', ChartConstants.LABEL_FONT_WEIGHT);
      }
    }

    /**
     * Plot a density plot on diagonal panels.
     * @param p
     */
    function plotDensity(p) {
      if (p.col !== p.row) {
        return;
      }
      /* jshint validthis: true */
      const cell = d3.select(this);

      xScale.domain(domains[p.row + 1]);
      yScale.domain(domains[p.col + 1]);

      const curlabel = valueColumnNames[p.col];

      const thisPanelFontSize = (panelFontSize * curlabel.length > p.width) ?
          Math.ceil(p.width / curlabel.length) + 5 : panelFontSize;

      cell.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', padding + p.width / 2)
        .attr('y', p.height / 4)
        .attr('font-size', thisPanelFontSize + 'px')
        .attr('fill', 'gray')
        .text(curlabel);

      const curDim = data.map((d) => d[p.row + 1]);
      const samplePoints = xScale.ticks(100);
      const kde = self.kernelDensityEstimator(self.epanechnikovKernel(20), samplePoints);
      const densityData = kde(curDim);

      const yDensity = d3.scale.linear()
          .domain(d3.extent(densityData, function(d) { return d[1]; }))
          .range([p.height - padding, padding]);

      const line = d3.svg.line()
          .x(function(d) { return xScale(d[0]); })
          .y(function(d) { return yDensity(d[1]); });

      cell.append('path')
        .datum(densityData)
        .attr('class', 'line')
        .attr('d', line);
    }

    this.svg.selectAll('.cell')
      .data(this.grid)
      .enter()
      .append('g')
      .attr('class', 'cell')
      .attr('transform', function(d) {
        return 'translate(' + (padding + d.x) + ',' + (padding + d.y) + ')';
      })
      .each(plotAxes)
      .each(plotDensity);

    nondiagonals.map(function(p) {
      return plotScatter(p, true);
    });

    /** Get current mouse coordinate */
    function getMousePos(e) {
      const rect = self.canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }

    /** Given a grid panel and a selected rectangle return all selected points */
    function identifyPoints(p, rect) {
      xScale.domain(domains[p.row + 1]);
      yScale.domain(domains[p.col + 1]);

      return _.filter(data, function(d) {
        const x = xScale(d[p.row + 1]) + p.x + padding;
        const y = yScale(d[p.col + 1]) + p.y + padding;
        return x >= rect.x0 && y >= rect.y0 && x <= rect.x1 && y <= rect.y1;
      });
    }

    /** Tracks every mouse movement and updates selected points */
    function trackMouse(e) {
      if (self.singlePanel) {
        return;
      }
      const loc = getMousePos(e);
      // Currently selected rectangle
      const curRect = {
        x0: Math.min(self.selectionStart.x, loc.x),
        y0: Math.min(self.selectionStart.y, loc.y),
        x1: Math.max(self.selectionStart.x, loc.x),
        y1: Math.max(self.selectionStart.y, loc.y),
      };

      // Shrink the rectangle to within bounds of current panel
      const rect = {
        x0: Math.max(self.curPanel.x, curRect.x0),
        y0: Math.max(self.curPanel.y, curRect.y0),
        x1: Math.min(self.curPanel.x + self.curPanel.width, curRect.x1),
        y1: Math.min(self.curPanel.y + self.curPanel.height, curRect.y1),
      };

      rect.width = rect.x1 - rect.x0;
      rect.height = rect.y1 - rect.y0;
      self.selectedPoints = identifyPoints(self.curPanel, rect);

      plotScatter(self.curPanel, true);
      self.ctx.fillStyle = 'rgba(211, 211, 211, 0.1)';
      self.ctx.rect(rect.x0, rect.y0, rect.width, rect.height);
      self.ctx.fill();
    }

    /** Given mouse coordinates find the currently selected panel */
    function getPanels(mouse) {
      return _.filter(self.grid, function(g) {
        return mouse.x > g.x &&
          mouse.y > g.y &&
          mouse.x < (g.x + g.width) &&
          mouse.y < (g.y + g.height);
      });
    }

    /** Finds selected panel and starts tracking mouse movements */
    function startTracking(e) {
      self.selectionStart = getMousePos(e);
      self.curPanel = getPanels(self.selectionStart)[0];
      self.selectedPoints = [];

      if (self.curPanel && self.curPanel.col !== self.curPanel.row) {
        self.canvas.addEventListener('mousemove', trackMouse, false);
      }
    }

    /** Render the entire plot again to update selected points in all other panels
     * We have to clear the entire canvas to clear previous selections.
     */
    function stopTracking() {
      self.canvas.removeEventListener('mousemove', trackMouse, false);

      self.ctx.clearRect(0, 0, self.width, self.height);
      nondiagonals.map(function(p) {
        return plotScatter(p, true);
      });
    }

    this.canvas.addEventListener('mousedown', startTracking, false);
    this.canvas.addEventListener('mouseup', stopTracking, false);
    if (this.singlePanel === false) {
      $(this.canvas).css('cursor', 'crosshair');
    } else {
      $(this.canvas).css('cursor', 'auto');
    }
  },

  /**
   * Return a function that computes smoothed fit given a kernel function at each point.
   */
  kernelDensityEstimator(kernel, xs) {
    return function(sample) {
      return xs.map(function(x) {
        return [x, d3.mean(sample, function(v) { return kernel(x - v); })];
      });
    };
  },

  epanechnikovKernel(scale) {
    return function(u) {
      u /= scale;
      return Math.abs(u) <= 1 ? 0.75 * (1 - u * u) / scale : 0;
    };
  },

  loessFit(pairs, bandwidth) {
    const loess = science.stats.loess().bandwidth(bandwidth);
    const xs = pairs.map(function(d) { return d[0]; });
    const ys = pairs.map(function(d) { return d[1]; });
    return d3.zip(xs, loess(xs, ys));
  },
});

module.exports = ScatterPlotMatrix;
