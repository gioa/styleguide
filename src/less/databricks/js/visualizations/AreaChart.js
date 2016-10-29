/* eslint no-mixed-operators: 0, prefer-rest-params: 0, func-names: 0 */

/**
 * An updatable area chart based on D3. Given a DOM element, this constructor creates an SVG inside
 * it and returns an object with a plot() method for updating the chart.
 *
 * DEPENDENCIES: CategoricalChart, D3
 */

import _ from 'underscore';
import d3 from 'd3';

import CategoricalChart from '../visualizations/CategoricalChart';
import ChartConstants from '../visualizations/ChartConstants';
import VizUtil from '../visualizations/VizUtil';

const AreaChart = CategoricalChart.extend({

  constructor(parentElement) {
    CategoricalChart.call(this, parentElement);
    this.areaContainer = this.foreground.append('g');
    this.setDefaultOptions([{
      inputType: 'radio',
      label: 'Overlapped',
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

  setupYScale() {
    // setup yScale in the parent first
    const yScale = AreaChart.__super__.setupYScale.apply(this, arguments);

    let yScaleMin = yScale.domain()[0];
    let yScaleMax = yScale.domain()[1];

    // make sure x = 0 exists in the y-domain (needed for area plots to make sense)
    yScaleMin = yScaleMin > 0 ? 0 : yScaleMin;
    yScaleMax = yScaleMax < 0 ? 0 : yScaleMax;
    yScale.domain([yScaleMin, yScaleMax]).nice();

    return yScale;
  },

  plotSeries(data, s, plotParams) {
    const _this = this;

    // important: reverses the order to ensure the highest stacked one is drawn first
    if (data.length > 0) {
      s = data[0].length - s - 2;
    } else {
      s = 0;
    }

    let transparency; // grouped areas often overlap, make them transparent
    if (this.getOption('grouped')) {
      transparency = 0.85;
    } else {
      transparency = 1.0;
    }

    const xMargin = this.xMargin;
    const groupWidth = plotParams.groupWidth;
    const yScale = plotParams.yScale;
    const keyFunc = plotParams.keyFunc;
    plotParams.drawYAxis();
    plotParams.drawXAxis();

    // Functions to compute the X and Y of a data point
    const xPos = function(d, i) { return xMargin + (i + 0.5) * groupWidth; };
    const that = this;
    const yPos = function(d) {
      return yScale(VizUtil.getBarY.call(that, d, s, VizUtil.plotType.AREA_PLOT));
    };

    // Draw and transition an SVG path for the area
    const area = d3.svg.area().x(xPos).y1(yPos).y0(yScale(0));
    const oldDataArray = this.areaContainer.selectAll('.area' + s).data();
    let oldData = [];
    if (oldDataArray.length > 0) {
      oldData = oldDataArray[0];
    }
    let path = this.areaContainer.selectAll('.area' + s)
        .data([data]);
    path.enter().append('path')
      .attr('class', 'area' + s)
      .attr('fill', 'none')
      .attr('stroke', ChartConstants.COLOR_SCALE(s))
      .attr('stroke-width', '2px');
    // Slightly awkward: D3's path transitions only work if the old data and new data have the
    // same length -- otherwise there seems to be no way to set a key function. So in the case
    // where we've resized the graph, let's just delete the old path and add a new one.
    if (oldData.length > 0 && oldData[0].length === data.length && !_.isEqual(oldData, data)) {
      path.transition().attr('d', area);
    } else {
      path.attr('class', 'removed')
        .transition()
        .attr('opacity', 0)
        .remove();
      path = this.areaContainer.selectAll('.area' + s).data([data]);
      path.enter().append('path')
        .attr('class', 'area' + s)
        .attr('fill', ChartConstants.COLOR_SCALE(s))
        .attr('stroke', d3.rgb(ChartConstants.COLOR_SCALE(s)).brighter().toString())
        .attr('stroke-width', '2px')
        .attr('opacity', 0)
        .attr('d', area)
        .transition()
        .attr('opacity', transparency);

      path.on('mouseenter', function() {
        d3.select(this).attr('stroke-width', '4px')
            .attr('opacity', 1.0);
        const pos = d3.mouse(this);
        _this.showTooltip(pos[0], pos[1] - 10, plotParams.valueColumnNames[s]);
      });

      path.on('mouseleave', function() {
        d3.select(this).attr('stroke-width', '2px')
            .attr('opacity', transparency);
        _this.hideTooltip();
      });
    }

    const radiusScale = d3.scale.linear().domain([15, 50]).range([3.5, 1.5]).clamp(true);
    let radius = radiusScale(data.length);
    const strokeScale = d3.scale.linear().domain([15, 50]).range([1.5, 1.0]).clamp(true);
    let strokeWidth = strokeScale(data.length);
    if (data.length > 50) {
      radius = 0;
      strokeWidth = 0;
    }

    // Draw and transition the circles
    const circles = this.foreground.selectAll('.circle' + s)
        .data(data, keyFunc);
    circles.enter().append('circle')
      .attr('class', 'circle' + s)
      .attr('fill', 'white')
      .attr('stroke', ChartConstants.COLOR_SCALE(s))
      .attr('stroke-width', '0px')
      .attr('r', '0px')
      .attr('cx', xPos)
      .attr('cy', yPos)
      .attr('opacity', 0);
    circles.transition()
      .attr('cx', xPos)
      .attr('cy', yPos)
      .attr('r', radius + 'px')
      .attr('stroke-width', strokeWidth + 'px')
      .attr('opacity', 0);
    circles.exit()
      .transition()
      .attr('opacity', 0)
      .remove();

    // Create some higher-radius hover target areas around the circles
    this.hovers.selectAll('.hoverArea' + s).remove();
    const hoverAreas = this.hovers.selectAll('.hoverArea' + s)
        .data(data, keyFunc)
        .enter().append('circle')
        .attr('class', 'hoverArea' + s)
        .attr('fill', 'black')
        .attr('stroke', 'none')
        .attr('opacity', 0)
        .attr('r', '12px')
        .attr('cx', xPos)
        .attr('cy', yPos);

    // Add tooltip on hover
    const format = VizUtil.tooltipNumFormat;
    hoverAreas.on('mouseenter', function(d, i) {
      d3.select(circles[0][i]).attr('fill', ChartConstants.COLOR_SCALE(s));
      const x = xPos(d, i);
      const y = yScale(d[s + 1]) - 6 - radius - strokeWidth - (data.length > 50 ? 1.5 : 0);
      _this.showTooltip(x, y, d[0] + ': ' + format(d[s + 1]));
      path.attr('stroke-width', '4px');
    });
    hoverAreas.on('mouseleave', function(d, i) {
      d3.select(circles[0][i]).attr('fill', 'white');
      path.attr('stroke-width', '2px');
      _this.hideTooltip();
    });
  },

  removeSeries(data, s) {
    this.foreground.selectAll('.area' + s)
      .attr('class', 'removed')
      .transition()
      .attr('opacity', 0)
      .remove();
    this.foreground.selectAll('.circle' + s)
      .attr('class', 'removed')
      .transition()
      .attr('opacity', 0)
      .remove();
    this.hovers.selectAll('.hoverArea' + s)
      .remove();
  },

});

module.exports = AreaChart;
