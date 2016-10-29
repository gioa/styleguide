/* eslint no-mixed-operators: 0, no-lonely-if: 0, complexity: 0, max-lines: 0, func-names: 0 */

/**
 * PieChart creation
 *
 * DEPENDENCIES: PieChartConstants, LegendConstants, D3
 */
import $ from 'jquery';
import d3 from 'd3';

import Chart from '../visualizations/Chart';
import ChartConstants from '../visualizations/ChartConstants';
import Legend from '../visualizations/Legend';
import LegendConstants from '../visualizations/LegendConstants';
import PieChartConstants from '../visualizations/PieChartConstants';
import PlotLayout from '../visualizations/PlotLayout';
import VizUtil from '../visualizations/VizUtil';

const PieChart = Chart.extend({

  constructor(parentElement) {
    Chart.call(this, parentElement);
    this.setDefaultOptions([{
      inputType: 'checkbox',
      label: 'Donut', // donut chart (pie with a hole in it)
      key: 'donut',
      value: true,
    }]);
  },

  // Get height of legend in pixels, assuming there are "numLabels",
  // the font size of the label text is "fontSize",
  // the pixel width of each label in the legend is "legendEntryWidth",
  // and the width of entire area is "width".
  getHorizLegendSize(numLabels, fontSize, legendEntryWidth, width) {
    const numCols = Math.max(Math.floor(width / legendEntryWidth), 1);
    const numRows = Math.max(Math.ceil(numLabels / numCols), 1);

    return {
      height: (fontSize + LegendConstants.LINE_SPACING) * numRows,
      width: legendEntryWidth * Math.min(numCols, numLabels),
    };
  },


  // Get the layout of a pie chart and a legend with
  // labels in "labelSeries" to be displayed in an area
  // with dimensions "width" and "height".
  getLayout(labelSeries, width, height) {
    // create labels just to compute the maximum label width in pixels

    // horizontal legends use a simple column to place their labels;
    // compute its width
    const maxLabelWidth = Legend.getMaxLabelWidth(
      this.svg, labelSeries, LegendConstants.DEF_FONT_SIZE);
    // account for colored square for each category in the legend
    const vLegendWidth = maxLabelWidth + 2 * LegendConstants.DEF_FONT_SIZE;

    // horizontal legends can use multiple lines for labels; compute its height;
    const hLegendHeight = this.getHorizLegendSize(labelSeries.length,
                                                LegendConstants.DEF_FONT_SIZE,
                                                vLegendWidth, width).height;

    if (height - hLegendHeight > width - vLegendWidth) {
      // pick horizontal layout
      return this.getHorizontalLayout(labelSeries.length, vLegendWidth,
                                      LegendConstants.DEF_FONT_SIZE, width, height);
    }
    return this.getVerticalLayout(labelSeries.length, vLegendWidth,
                                  LegendConstants.DEF_FONT_SIZE, width, height);
  },

  // Get the layout of a pie chart and its legend with
  // labels in "labelSeries" to be displayed in an area
  // of a give "width" and "height", assuming the legend is
  // shown vertically.
  // Returns and object with the following properties:
  //  vertical: true - flag specifying the legend is vertically
  //  pieRadius - pie chart radius
  //  xPieCenter - x coordinate of pie chart
  //  yPieCenter - y coordinate of pie chart
  //  xLegend - x coordinate of legend
  //  yLegend - y coordinate of legend
  //  fontSize - font size of text in legend
  //  labelWidth - pixel width of longest label assuming "fontSize"
  getVerticalLayout(numLabels, legendWidth, fontSize, width, height) {
    let newFontSize;
    // check whether the height of the legend fits in
    if (height < numLabels * fontSize * LegendConstants.LINE_SPACING) {
      newFontSize = Math.max(LegendConstants.MIN_FONT_SIZE,
                             Math.floor(height / (numLabels * LegendConstants.LINE_SPACING)));
      legendWidth *= newFontSize / fontSize;
      fontSize = newFontSize;
    }

    let sideSpace;
    let pieRadius;

    // Check whether we have enough room for the legend assuming
    // pie chart's diameter is height and there is "height/4" space
    // between the pie chart and the legend.
    if (legendWidth < width - height - height / 4) {
      sideSpace = (width - height - height / 4 - legendWidth) / 2;
      pieRadius = height / 2;
    } else {
      // no room for the legend; reduce the font size and try again
      newFontSize = Math.floor(Math.min(fontSize,
                                        (fontSize + LegendConstants.MIN_FONT_SIZE) / 2));
      legendWidth *= newFontSize / fontSize;
      fontSize = newFontSize;

      if (legendWidth < width - height - height / 4) {
        sideSpace = (width - height - height / 4 - legendWidth) / 2;
        pieRadius = height / 2;
      } else {
        // still no room -- reduce the pie chart size by 25%
        pieRadius = 3 * height / 8;
        if (legendWidth < width - 5 * pieRadius / 2) {
          sideSpace = (width - 5 * pieRadius / 2 - legendWidth) / 2;
        } else {
          // still no room! use the minimum font size, and compute
          // pie chart size
          legendWidth *= LegendConstants.MIN_FONT_SIZE / fontSize;
          fontSize = LegendConstants.MIN_FONT_SIZE;
          // space the pie chart from the legend at 1/4-th of radius
          pieRadius = (width - legendWidth) * 2 / 5;
          sideSpace = 0;
        }
      }
    }

    return {
      vertical: true,
      pieRadius: pieRadius,
      xPieCenter: Math.floor(sideSpace + pieRadius),
      yPieCenter: Math.floor(height / 2),
      xLegend: Math.floor(sideSpace + 2 * pieRadius + pieRadius / 2),
      yLegend: Math.floor(
        ((height - fontSize * numLabels * LegendConstants.LINE_SPACING) >> 1)),
      fontSize: fontSize,
      labelWidth: legendWidth,
    };
  },

  // Get the layout of a pie chart and its legend with
  // labels in "labelSeries" to be displayed in an area
  // of a give "width" and "height", assuming the legend is
  // shown horizontally.
  // Returns and object with the following properties:
  //  vertical: false - flag specifying the legend is shown horizontally
  //  pieRadius - pie chart radius
  //  xPieCenter - x coordinate of pie chart
  //  yPieCenter - y coordinate of pie chart
  //  xLegend - x coordinate of legend
  //  yLegend - y coordinate of legend
  //  fontSize - font size of text in legend
  //  labelWidth - pixel width of longest label assuming "fontSize"
  getHorizontalLayout(numLabels, labelWidth, fontSize, width, height) {
    let legendHeight = this.getHorizLegendSize(numLabels, fontSize, labelWidth, width).height;

    // check whether we have enough room for the legend assuming
    // pie chart's diameter is width
    if (width > height - legendHeight) {
      // no room -- reduce the font size
      const newFontSize = Math.floor(Math.min(fontSize,
                                            (fontSize + LegendConstants.MIN_FONT_SIZE) / 2));
      labelWidth *= newFontSize / fontSize;
      fontSize = newFontSize;
      legendHeight = this.getHorizLegendSize(numLabels, fontSize, labelWidth, width).height;
    }

    // check again if we have enough room...
    if (width > height - legendHeight) {
      // still no room, assuming the pie chart's diameter is equal to width;
      // reduce pie chart diameter by 25%
      if (3 * width / 4 > height - legendHeight) {
        // still no room! use the minimum font size and compute legend's height
        labelWidth *= LegendConstants.MIN_FONT_SIZE / fontSize;
        legendHeight = this.getHorizLegendSize(numLabels, fontSize, labelWidth, width).height;
      }
    }

    // compute pie chart's radius
    const pieRadius = Math.floor(Math.min(width, height - legendHeight) / 2);
    // compute the space at the top of the chart so that we center the pie chart vertically
    // (we may want to change this to align the legend to top)
    const topSpace = (height - legendHeight - 2 * pieRadius) / 2;

    return {
      vertical: false,
      pieRadius: pieRadius,
      xPieCenter: Math.floor(width / 2),
      yPieCenter: Math.floor(topSpace + pieRadius),
      xLegend: 0,
      yLegend: Math.floor(height - legendHeight),
      fontSize: fontSize,
      labelWidth: labelWidth,
    };
  },


  // Return a series of numbers corresponding to idx-th column of data.
  // If there are more than PieChartConstants.MAX_NUM_PIE_PIECES, compute the sum of the
  // last [PieChartConstants.MAX_NUM_PIE_PIECES - 1:data.length] entries and insert it in
  // the last position.
  getSeries(data, idx) {
    const nSeries = [];
    const lSeries = [];
    let i;

    for (i = 0; i < Math.min(data.length, PieChartConstants.MAX_NUM_PIE_PIECES); i++) {
      nSeries[i] = data[i][idx];
      lSeries[i] = data[i][0];
    }

    if (data.length > PieChartConstants.MAX_NUM_PIE_PIECES) {
      let sumOthers = 0;
      for (i = PieChartConstants.MAX_NUM_PIE_PIECES; i < data.length; i++) {
        sumOthers += data[i][idx];
      }
      nSeries[PieChartConstants.MAX_NUM_PIE_PIECES] = sumOthers;
      lSeries[PieChartConstants.MAX_NUM_PIE_PIECES] = 'Others';
    }

    return { labels: lSeries, numbers: nSeries };
  },


  // Plot a pie chart showing the number series in numberSeries
  // with the center at (xPosition, yPosition), radius "pieRadius"
  // and assuming "fontSize" for the corresponding legend of this
  // pie chart; "fontSize" is used to determine the font size of
  // the percentages associated with each pie piece; these percentages
  // which are shown around the pie chart.
  // "sIdx" represents the index of the column in the data table
  // being plotted.
  drawPieChart(numberSeries, sIdx, labels,
                         xPieCenter, yPieCenter, pieRadius, fontSize) {
    // compute to fon size to show the labels
    fontSize = Math.min(fontSize, 11);

    const donut = this.getOption('donut');
    const pieSize = pieRadius - fontSize;
    const donutHoleSize = donut * pieSize / 2.0;

    const arc = d3.svg.arc()
        .innerRadius(donutHoleSize)
        .outerRadius(pieSize);

    // compute the sum of all values to in the pie chart to determine
    // the percentages for each piece of pie
    let sum = 0;
    for (let i = 0; i < numberSeries.length; i++) {
      sum += numberSeries[i];
    }
    const pie = d3.layout.pie();

    const arcs = this.svg.selectAll('g.arc' + sIdx).data(pie(numberSeries));
    arcs.enter().append('g')
      .attr('class', 'arc' + sIdx)
      .attr('opacity', 1)
      .attr('transform', 'translate(' + xPieCenter + ',' + yPieCenter + ')')
      .append('path')
      .attr('fill', function(d, i) { return PieChartConstants.COLOR_SCALE(i); })
      .attr('stroke', 'white')
      .attr('d', arc)
      .on('mousemove', function(d, i) {
        const curColor = d3.rgb(PieChartConstants.COLOR_SCALE(i));
        d3.select(this).attr('fill', curColor.darker(1));
        // Update the tooltip position and value
        const format = VizUtil.tooltipNumFormat;
        const tooltipText = labels[i] + ': ' + format(d.value);
        let tooltipFontSize = $('#tooltip p').css('font-size');
        tooltipFontSize = parseFloat(tooltipFontSize.slice(0, tooltipFontSize.length - 2));
        d3.select('#tooltip')
          .style('left', (d3.event.pageX - (tooltipFontSize * tooltipText.length / 3)) + 'px')
          .style('top', (d3.event.pageY - 2 * tooltipFontSize) + 'px')
          .select('#value')
          .text(tooltipText);

        // Show the tooltip
        d3.select('#tooltip').classed('hidden', false);
      })
      .on('mouseout', function(d, i) {
        d3.select(this).attr('fill', PieChartConstants.COLOR_SCALE(i));
        // Hide the tooltip
        d3.select('#tooltip').classed('hidden', true);
      });
    arcs.exit()
      .remove();

    arcs.append('text')
      .attr('transform', function(d) {
        const c = arc.centroid(d),
          x = c[0],
          y = c[1],
            // pythagorean theorem for hypotenuse
          h = Math.sqrt(x * x + y * y);
        if (((d.endAngle + d.startAngle) / 2 > 11 * Math.PI / 6) ||
            ((d.endAngle + d.startAngle) / 2 < Math.PI / 6)) {
          return 'translate(' + (x * (pieRadius - fontSize / 2) / h) + ',' +
            (y * (pieRadius - fontSize / 2) / h) + ')';
        }
        return 'translate(' + (x * (pieRadius - 3 * fontSize / 4) / h) + ',' +
          (y * (pieRadius - 3 * fontSize / 4) / h) + ')';
      })
      .attr('dy', '.35em')
      .attr('text-anchor', function(d) {
        // are we past the center?
        return (d.endAngle + d.startAngle) / 2 > Math.PI ? 'end' : 'start';
      })
      .text(function(d) {
        return Math.round(d.value * 100 / sum) + '%';
      })
      .attr('font-size', fontSize + 'px');
  },

  removePlot() {
    for (let i = 1; i <= PieChartConstants.MAX_NUM_PIES; i++) {
      this.removePieChart(i);
      Legend.removeLegend(this.svg, i);
    }
  },

  removePieChart(sIdx) {
    // Set up groups
    const arcs = this.svg.selectAll('g.arc' + sIdx);
    arcs.attr('opacity', 0)
      .remove();
  },

  // Divide the area into numPieCharts+1 cells, and compute the coordinates for each cell
  // (x, y, width, height). The last cell will hold the legend; this function is called
  // only when numPieCharts > 1. When numPieCharts === 1 we use getAreaLayout()
  getAreaLayoutWithSharedLegend(numPieCharts, labelSeries,
                                          width, height) {
    const bSize = PieChartConstants.BORDER_SIZE; // shorter variable to make the code more readable

    const pieCells = [];
    let fontSize = LegendConstants.DEF_FONT_SIZE;
    let newFontSize;

    // variables used to compute the maximum diameter of a pie chart assuming
    // either vertical or horizontal legend placement;
    // the height of a pie chart area cell includes the title (we reserve bSize for the title)
    let maxDiamV;
    let maxDiamH;
    let sepX; // x coordinate where the first pie chart starts
    let sepY; // y coordinate where the first pie chart starst (including its title)
    let pieD; // pie chart diameter

    // horizontal legends use a simple column to place their labels;
    // compute its width
    const maxLabelWidth = Legend.getMaxLabelWidth(this.svg, labelSeries, fontSize);
    // account for colored square for each category in the legend
    let vLegendWidth = maxLabelWidth + 2 * fontSize;
    // horizontal legends can use multiple lines for labels; compute its height;
    // add fontSize between the pie chart and the legend and leaves 2*BOARDER_SIZE
    // on each side
    const s = this.getHorizLegendSize(
      labelSeries.length, fontSize, vLegendWidth, width - 4 * bSize);
    let hLegendHeight = s.height;
    let hLegendWidth = s.width;

    if (numPieCharts <= 3) {
      // all pie charts are in a single row
      // - leave bSize around borders
      // - leave bSize between two consecutive pie charts and between a pie chart and legends
      // - leave bSize at the top of each pie chart area for title
      maxDiamV = Math.min((width - vLegendWidth - (numPieCharts + 2) * bSize) / numPieCharts,
                          height - 3 * bSize);
      // get max size of the pie chart assuming a horizontal legend
      maxDiamH = Math.min((width - (numPieCharts + 1) * bSize) / numPieCharts,
                          height - hLegendHeight - 4 * bSize);

      newFontSize = fontSize;
      // check whether the size of a pie chart is constrained on the axis
      // that doesn't have the legend; if yes, reduce the legend font size to make more room
      if (((maxDiamV > maxDiamH) && (maxDiamV <= height - 3 * bSize)) ||
          ((maxDiamV < maxDiamH) &&
           (maxDiamH <= (width - (numPieCharts + 1) * bSize) / numPieCharts))) {
        // reduce font size, by averaging the current with the min font size
        newFontSize = Math.floor(fontSize + LegendConstants.MIN_FONT_SIZE) / 2;
      }

      // recompute max pie chart size assuming vertical and horizontal legends;
      // first scale down the legend sizes proportionally to the font size
      vLegendWidth = vLegendWidth * newFontSize / fontSize;
      hLegendHeight = hLegendHeight * newFontSize / fontSize;
      hLegendWidth = hLegendWidth * newFontSize / fontSize;
      fontSize = newFontSize;
      maxDiamV = Math.min((width - vLegendWidth - (numPieCharts + 2) * bSize) / numPieCharts,
                          height - 3 * bSize);
      maxDiamH = Math.min((width - (numPieCharts + 1) * bSize) / numPieCharts,
                          height - hLegendHeight - 4 * bSize);

      if (maxDiamV > maxDiamH) { // use vertical legend
        // compute the distance to translate the pie charts to show them at the center of
        // the area
        sepX = (width - vLegendWidth - numPieCharts * (bSize + maxDiamV)) / 2;
        sepY = (height - maxDiamV - bSize) / 2;
        pieD = maxDiamV;
      } else {
        pieD = maxDiamH;
        sepX = (width - numPieCharts * pieD - (numPieCharts - 1) * bSize) / 2;
        sepY = (height - pieD - hLegendHeight - 2 * bSize) / 2;
        pieD = maxDiamH;
      }

      // compute the coordinates of the first pie chart
      pieCells[0] = { x: sepX, y: sepY, height: pieD + bSize, width: pieD };

      // compute coordinates of the other pie charts
      for (let i = 1; i < numPieCharts; i++) {
        pieCells[i] = {
          x: pieCells[i - 1].x + pieD + bSize,
          y: sepY,
          height: pieD + bSize,
          width: pieD,
        };
      }
    }

    if (numPieCharts === 4) {
      // all pie charts are in a 2x2 grid
      // - leave bSize around borders
      // - leave bSize between any two nearby pie charts both on horizontal and vertical
      // - leave bSize at the top of each pie chart area for title
      // maxDiamV/maxDiamH represents a 2x2 grid of pie charts ignoring the title areas, i.e,
      // they are equal with two times the pie chart diameter
      maxDiamV = Math.min(width - vLegendWidth - 4 * bSize, height - 5 * bSize);
      // get max size of the pie chart assuming a horizontal legend
      maxDiamH = Math.min(width - 3 * bSize, height - hLegendHeight - 6 * bSize);

      newFontSize = fontSize;
      // check whether the size of a pie chart is constrained on the axis
      // that doesn't have the legend; if yes, reduce the legend font size to make more room
      if (((maxDiamV > maxDiamH) && (maxDiamV <= height - 5 * bSize)) ||
          ((maxDiamV < maxDiamH) && (maxDiamH <= width - 3 * bSize))) {
        // reduce font size, by averaging the current with the min font size
        newFontSize = Math.floor(fontSize + LegendConstants.MIN_FONT_SIZE) / 2;
      }

      // recompute max pie chart size assuming vertical and horizontal legends;
      // first scale down the legend sizes proportionally to the font size
      vLegendWidth = vLegendWidth * newFontSize / fontSize;
      hLegendHeight = hLegendHeight * newFontSize / fontSize;
      hLegendWidth = hLegendWidth * newFontSize / fontSize;
      fontSize = newFontSize;
      maxDiamV = Math.min(width - vLegendWidth - 4 * bSize, height - 5 * bSize) / 2;
      maxDiamH = Math.min(width - 3 * bSize, height - hLegendHeight - 6 * bSize) / 2;

      if (maxDiamV > maxDiamH) { // use vertical legend
        pieD = maxDiamV;
        sepX = (width - vLegendWidth - 2 * pieD - 2 * bSize) / 2;
        sepY = (height - 2 * pieD - 3 * bSize) / 2;
      } else { // use horizontal legend
        pieD = maxDiamH;
        sepX = (width - 2 * pieD - bSize) / 2;
        sepY = (height - 2 * pieD - hLegendHeight - 4 * bSize) / 2;
      }

      pieCells[0] = { x: sepX, y: sepY, width: pieD, height: pieD + bSize };
      pieCells[1] = { x: sepX + pieD + bSize, y: sepY, width: pieD, height: pieD + bSize };
      pieCells[2] = { x: sepX, y: sepY + pieD + 2 * bSize, width: pieD, height: pieD + bSize };
      pieCells[3] = {
        x: sepX + pieD + bSize,
        y: sepY + pieD + 2 * bSize,
        width: pieD,
        height: pieD + bSize,
      };
    }

    // compute the coordinates for the legend
    if (maxDiamH > maxDiamV) {
      pieCells[numPieCharts] = {
        x: (width - hLegendWidth) / 2,
        y: height - sepY - hLegendHeight,
        height: hLegendHeight,
        width: hLegendWidth,
      };
    } else { // vertical legend
      pieCells[numPieCharts] = {
        x: width - sepX - vLegendWidth,
        y: (height - labelSeries.length * fontSize * LegendConstants.LINE_SPACING) / 2,
        height: labelSeries.length * fontSize * LegendConstants.LINE_SPACING,
        width: vLegendWidth,
      };
    }

    return {
      pieCells: pieCells,
      fontSize: fontSize,
      labelWidth: vLegendWidth,
      vertical: (maxDiamV > maxDiamH),
    };
  },


  // Plot up to four pie charts, each of them with its own legend.
  plotPieChartsWithLegends(data, valueColumnNames, key) {
    const width = this.width; // Pull these into local consts since they're used below in closures
    const height = this.height;
    let i;
    let idx;

    // plot no more than four pie charts
    const nSeries = Math.min(data[0].length, PieChartConstants.MAX_NUM_PIES + 1) - 1;

    // get area layout
    let pieCells = [];

    pieCells = PlotLayout.getLayout(nSeries, width, height, 1.4, 0, 0,
                                    PieChartConstants.BORDER_SIZE, PieChartConstants.BORDER_SIZE);

    // TODO: very ugly, need to come back to fix it
    for (i = 1; i <= PieChartConstants.MAX_NUM_PIES; i++) {
      this.removePieChart(i);
      Legend.removeLegend(this.svg, i);
    }

    const sortFunc = function(index, a, b) { return b[index] - a[index]; };
    for (idx = 1; idx <= nSeries; idx++) {
      if (data.length > PieChartConstants.MAX_NUM_PIE_PIECES) {
        // sort data with respect to the first numerical column,
        // in descending order
        data.sort(sortFunc.bind(this, idx));
      }

      const dataSeries = this.getSeries(data, idx);
      const numberSeries = dataSeries.numbers;
      const labelSeries = dataSeries.labels;

      const layout = this.getLayout(labelSeries, pieCells[idx - 1].width,
                                   pieCells[idx - 1].height);

      // draw the pie chart
      this.drawPieChart(numberSeries, idx, labelSeries,
                        layout.xPieCenter + pieCells[idx - 1].x,
                        layout.yPieCenter + pieCells[idx - 1].y,
                        layout.pieRadius,
                        layout.fontSize);


      // draw the legend
      if (!layout.vertical) {
        Legend.plotHorizontalLegend(this.svg,
                                    labelSeries, idx,
                                    layout.xLegend + pieCells[idx - 1].x,
                                    layout.yLegend + pieCells[idx - 1].y,
                                    layout.labelWidth,
                                    pieCells[idx - 1].width,
                                    layout.fontSize,
                                    PieChartConstants.COLOR_SCALE);
      } else {
        Legend.plotVerticalLegend(this.svg,
                                  labelSeries, idx,
                                  layout.xLegend + pieCells[idx - 1].x,
                                  layout.yLegend + pieCells[idx - 1].y,
                                  layout.fontSize,
                                  PieChartConstants.COLOR_SCALE,
                                  true,
                                  key
                                 );
      }
    }

    // add titles to pie charts, if more than one
    let titleSeries = [];
    for (i = 0; i < nSeries; i++) {
      titleSeries[i] = i;
    }
    if (nSeries === 1) { titleSeries = []; } // no need for labels
    const titles = this.svg.selectAll('text.titles').data(titleSeries);
    titles.enter().append('text')
      .attr('class', 'titles')
      .text(function(d) {
        return valueColumnNames[d];
      })
      .attr('text-anchor', 'middle')
      .attr('x', function(d) {
        return pieCells[d].x + pieCells[d].width / 2;
      })
      .attr('y', function(d) {
        return (pieCells[d].y - 0.5 * PieChartConstants.BORDER_SIZE);
      })
      .attr('font-size', ChartConstants.LABEL_FONT_SIZE + 'px')
      .style('font-weight', ChartConstants.LABEL_FONT_WEIGHT);
    titles
      .text(function(d) {
        return valueColumnNames[d];
      })
      .attr('x', function(d) {
        return pieCells[d].x + pieCells[d].width / 2;
      })
      .attr('y', function(d) {
        return (pieCells[d].y - 0.5 * PieChartConstants.BORDER_SIZE);
      });
    titles.exit().remove();
  },

  // give layout for up to four pie charts, all of them sharing the same legend.
  getLayoutWithSharedLegend(nSeries, labelSeries, width, height) {
    const border = PieChartConstants.BORDER_SIZE;
    let fontSize = LegendConstants.DEF_FONT_SIZE;
    const minFontSize = LegendConstants.MIN_FONT_SIZE;
    const lineSpacing = LegendConstants.LINE_SPACING;
    const desiredPlotToLegendRatio = 4;

    // chose whether to use vertical or horizontal legend, and the legend font size
    // horizontal legends use a simple column to place their labels;
    // compute its width
    let maxLabelWidth = Legend.getMaxLabelWidth(this.svg, labelSeries, fontSize);
    // account for colored square for each category in the legend
    let vLegendWidth = maxLabelWidth + 2 * fontSize;
    // horizontal legends can use multiple lines for labels; compute its height;
    let res = this.getHorizLegendSize(labelSeries.length, fontSize, vLegendWidth, width);
    let hLegendHeight = res.height;
    let hLegendWidth = res.width;

    // leave room for label if more than one plot
    const yMargin = (nSeries > 1 ? ChartConstants.LABEL_FONT_SIZE : 0);
    // try layout with vertical legend
    let vPieCells = PlotLayout.getLayout(
      nSeries, width - vLegendWidth, height, 1, 0, yMargin, border, border);
    // try layout with horizontal legend
    let hPieCells = PlotLayout.getLayout(
      nSeries, width, height - hLegendHeight, 1, 0, yMargin, border, border);
    const vertical = (vPieCells[0].width > hPieCells[0].width);

    // check whether font isn't too big
    if (vertical) {
      if (fontSize * lineSpacing > height) {
        fontSize = Math.floor(Math.max(minFontSize, height / (fontSize * lineSpacing)));
      }
      if (width / vLegendWidth < desiredPlotToLegendRatio) {
        fontSize = Math.floor(
          Math.max(minFontSize, fontSize * width / (desiredPlotToLegendRatio * vLegendWidth)));
      }
    } else {
      if (height / hLegendHeight < desiredPlotToLegendRatio) {
        fontSize = Math.floor(
          Math.max(minFontSize,
                   fontSize * height / (desiredPlotToLegendRatio * hLegendHeight)));
      }
    }

    if (fontSize !== LegendConstants.DEF_FONT_SIZE) {
      maxLabelWidth = Legend.getMaxLabelWidth(this.svg, labelSeries, fontSize);
      vLegendWidth = maxLabelWidth + 2 * fontSize;
      res = this.getHorizLegendSize(labelSeries.length, fontSize, vLegendWidth, width);
      hLegendHeight = res.height;
      hLegendWidth = res.width;
      vPieCells = PlotLayout.getLayout(
        nSeries, width - vLegendWidth, height, 1, 0, yMargin, border, border);
      // try layout with horizontal legend
      hPieCells = PlotLayout.getLayout(
        nSeries, width, height - hLegendHeight, 1, 0, yMargin, border, border);
    }

    let legend;
    let i;

    if (vPieCells[0].width > hPieCells[0].width) {
      let x = 0;
      for (i = 0; i < nSeries; i++) {
        if (x < vPieCells[i].x + vPieCells[i].width) {
          x = vPieCells[i].x + vPieCells[i].width;
        }
      }
      legend = {
        x: x + PieChartConstants.BORDER_SIZE,
        y: (height - labelSeries.length * fontSize * lineSpacing) / 2,
        labelWidth: vLegendWidth,
        width: vLegendWidth,
      };
      return {
        pieCells: vPieCells,
        fontSize: fontSize,
        yMargin: yMargin,
        legend: legend,
        vertical: true,
      };
    }
    let y = 0;
    for (i = 0; i < nSeries; i++) {
      if (y < hPieCells[i].y + hPieCells[i].height) {
        y = hPieCells[i].y + hPieCells[i].height;
      }
    }
    legend = {
      x: (width - hLegendWidth) / 2,
      y: y,
      labelWidth: vLegendWidth,
      width: hLegendWidth,
    };
    return {
      pieCells: hPieCells,
      fontSize: fontSize,
      yMargin: yMargin,
      legend: legend,
      wLegend: 0,
      vertical: false,
    };
  },

  // Plot up to four pie charts, all of them sharing the same legend.
  plotPieChartsWithSharedLegend(data, valueColumnNames, key) {
    const width = this.width; // Pull these into local consts since they're used below in closures
    const height = this.height;

    // data[0].length should be smaller than PieChartConstants.MAX_NUM_PIES,
    // but just to be on the safe side
    const nSeries = Math.min(data[0].length, PieChartConstants.MAX_NUM_PIES + 1) - 1;
    let dataSeries = this.getSeries(data, 0);
    const labelSeries = dataSeries.labels;

    const res = this.getLayoutWithSharedLegend(nSeries, labelSeries, width, height);

    const pieCells = res.pieCells;
    const fontSize = res.fontSize;
    const vertical = res.vertical;
    const yMargin = res.yMargin;
    const legend = res.legend;

    let i;

    // TODO: ugly, need to come back to fix it
    for (i = 1; i <= PieChartConstants.MAX_NUM_PIES; i++) {
      this.removePieChart(i);
      Legend.removeLegend(this.svg, i);
    }

    for (i = 1; i <= nSeries; i++) {
      dataSeries = this.getSeries(data, i);
      const numberSeries = dataSeries.numbers;
      const radius = pieCells[i - 1].width / 2;

      // draw the pie chart
      this.drawPieChart(numberSeries, i, labelSeries,
                        pieCells[i - 1].x + radius,
                        pieCells[i - 1].y + yMargin + radius,
                        radius,
                        fontSize);
    }

    // draw the legend
    if (!vertical) {
      Legend.plotHorizontalLegend(this.svg,
                                  labelSeries, 1,
                                  legend.x,
                                  legend.y,
                                  legend.labelWidth,
                                  legend.width,
                                  fontSize,
                                  PieChartConstants.COLOR_SCALE);
    } else {
      Legend.plotVerticalLegend(this.svg,
                                labelSeries, 1,
                                legend.x,
                                legend.y,
                                fontSize,
                                PieChartConstants.COLOR_SCALE,
                                true,
                                key
                               );
    }

    // add titles to pie charts, if more than one
    let titleSeries = [];
    for (i = 0; i < nSeries; i++) {
      titleSeries[i] = i;
    }
    if (nSeries === 1) { titleSeries = []; } // no need for labels
    const titles = this.svg.selectAll('text.titles').data(titleSeries);
    titles.enter().append('text')
      .attr('class', 'titles')
      .text(function(d) {
        return valueColumnNames[d];
      })
      .attr('text-anchor', 'middle')
      .attr('x', function(d) {
        return pieCells[d].x + pieCells[d].width / 2;
      })
      .attr('y', function(d) {
        return (pieCells[d].y + 0.5 * yMargin);
      })
      .attr('font-size', ChartConstants.LABEL_FONT_SIZE + 'px')
      .style('font-weight', ChartConstants.LABEL_FONT_WEIGHT);
    titles
      .text(function(d) {
        return valueColumnNames[d];
        // return "Series " + (d + 1);
      })
      .attr('x', function(d) {
        return pieCells[d].x + pieCells[d].width / 2;
      })
      .attr('y', function(d) {
        return (pieCells[d].y + 0.5 * yMargin);
      });
    titles.exit()
      .remove();
  },

  inferColumns(schema) {
    const inferred = VizUtil.findColumns(1, 2, schema);
    if (inferred.xColumns.length === 0) {
      inferred.xColumns.push('<id>');
    }
    return inferred;
  },

  plot(data, key, valueColumnNames, width, height) {
    Chart.prototype.plot.call(this, data, key, valueColumnNames, width, height);


    if (!isNaN(width) && width > 0 && !isNaN(height) && height > 0) {
      this.width = width;
      this.height = height;
      this.svg.attr({
        width: this.width,
        height: this.height,
      });
    }

    if (data.length === 0) {
      $(this.svg.node()).empty();
      return;
    }


    if (data.length > PieChartConstants.MAX_NUM_PIE_PIECES) {
      this.plotPieChartsWithLegends(data, valueColumnNames, key);
    } else {
      this.plotPieChartsWithSharedLegend(data, valueColumnNames, key);
    }

    if (data[0].length > PieChartConstants.MAX_NUM_PIES + 1) {
      this.showText('More than ' + PieChartConstants.MAX_NUM_PIES +
        ' pie charts. We will show only the first ' + PieChartConstants.MAX_NUM_PIES + '.');
    }
  },
});

module.exports = PieChart;
