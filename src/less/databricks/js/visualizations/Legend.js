/* eslint no-mixed-operators: 0, func-names: 0  */

/**
 * Legend for graph/chart outputs
 */
import LegendConstants from '../visualizations/LegendConstants';
import ChartConstants from '../visualizations/ChartConstants';

const Legend = {};

// Get width in pixels of largest string in labelSeries.
Legend.getMaxLabelWidth = function(svg, labelSeries, fontSize) {
  // create labels just to compute the maximum label width in pixels

  let texts = svg.selectAll('text.computeMaxWidth');
  texts.attr('class', '').remove();

  texts = svg.selectAll('text.computeMaxWidth').data(labelSeries);
  texts.enter().append('text')
    .attr('class', 'computeMaxWidth')
    .text(String)
    .attr('x', 0)
    .attr('y', 0)
    .attr('font-size', fontSize + 'px')
    .attr('fill', '#333')
    .attr('opacity', 0); // hide it

  // now compute the maximum width (in pixels)
  let maxLabelWidth = 0;
  texts.each(function(d) {
    // TODO: at the beginning the svg is not initialized before this function
    // is called so getComputedTextLength()) returns 0;
    // just guard against this case, by using a heuristic
    // that computes the width as the number of characters in the word
    // multiplied by 0.6 the font size
    // console.log("=== d === ", d);
    let w = this.getComputedTextLength();
    if (w === 0) {
      w = d.length * fontSize / 2;
    }

    maxLabelWidth = Math.max(maxLabelWidth, w);
  });

  // remove text elements for computing max width
  texts.exit().remove();

  return maxLabelWidth;
};


Legend.removeLegend = function(svg, sIdx) {
  svg.selectAll('rect.series' + sIdx).remove();
  svg.selectAll('text.series' + sIdx).remove();
  svg.selectAll('text.legend-title').remove();
};

// Plot a legend with horizontal layout using labels in "labelSeries"
// starting at (xPosition, yPosition) with font size "fontSize".
// "sIdx" represents the index of the column in the data table
// that corresponds to the legend being shown.
// "direction" specifies whether the legend is shown top down, or
// bottom up
// Note: A vertical legend shows all labels in a single column
// (may extend to multiple columns in the future).
Legend.plotVerticalLegend = function(
  svg, labelSeries, sIdx, xPosition, yPosition, fontSize, colorScale, topdown, title) {
  // create a <g> of class "legend"
  const container = svg.selectAll('.legend').data([1]);
  container.enter().append('g').attr('class', 'legend');

  const labelFontSize = ChartConstants.LABEL_FONT_SIZE;
  const labelFontWeight = ChartConstants.LABEL_FONT_WEIGHT;
  container.selectAll('text.legend-title').remove();
  const titleText = container.selectAll('.legend-title').data([title]).enter().append('text')
      .attr('class', 'legend-title')
      .text(title)
      .attr('text-anchor', 'left');

  titleText.transition()
    .attr('x', xPosition)
    .attr('y', function(d, i) {
      if (topdown) {
        return yPosition + i * labelFontSize * LegendConstants.LINE_SPACING -
          labelFontSize / 2 - 5;
      }
      return yPosition +
        (labelSeries.length - i - 1) * labelFontSize * LegendConstants.LINE_SPACING;
    })
    .attr('font-size', labelFontSize + 'px')
    .attr('fill', '#333')
    .style('font-weight', labelFontWeight);

  // first, create the color labels, and then...
  const rects = container.selectAll('rect.series' + sIdx).data(labelSeries);
  rects.enter().append('rect')
    .attr('class', 'series' + sIdx)
    .attr('x', xPosition)
    .attr('y', function(d, i) {
      if (topdown) {
        return yPosition + i * fontSize * LegendConstants.LINE_SPACING;
      }
      return yPosition +
        (labelSeries.length - i - 1) * fontSize * LegendConstants.LINE_SPACING;
    })
    .attr('width', fontSize)
    .attr('height', fontSize)
    .attr('fill', function(d, i) {
      return colorScale(i);
    })
    .attr('stroke', 'white')
    .attr('opacity', 1);
  rects.transition()
    .attr('x', xPosition)
    .attr('y', function(d, i) {
      if (topdown) {
        return yPosition + i * fontSize * LegendConstants.LINE_SPACING;
      }
      return yPosition +
        (labelSeries.length - i - 1) * fontSize * LegendConstants.LINE_SPACING;
    })
    .attr('width', fontSize)
    .attr('height', fontSize)
    .attr('fill', function(d, i) {
      return colorScale(i);
    });
  rects.exit()
    .transition()
    .attr('height', 0)
    .remove();

  // ... the text labels
  const texts = container.selectAll('text.series' + sIdx).data(labelSeries);
  texts.enter().append('text')
    .attr('class', 'series' + sIdx)
    .text(function(d) {
      return d;
    })
    .attr('text-anchor', 'start')
    .attr('x', xPosition + Math.ceil(1.6 * fontSize))
    .attr('y', function(d, i) {
      if (topdown) {
        return yPosition + i * fontSize * LegendConstants.LINE_SPACING +
          fontSize * LegendConstants.LINE_SPACING / 2 + 2;
      }
      return yPosition +
        (labelSeries.length - i - 1) * fontSize * LegendConstants.LINE_SPACING +
        fontSize * LegendConstants.LINE_SPACING / 2 + 2;
    })
    .attr('font-size', fontSize + 'px')
    .attr('fill', '#333');
  texts.transition()
    .text(function(d) {
      return d;
    })
    .attr('x', xPosition + Math.ceil(1.6 * fontSize))
    .attr('y', function(d, i) {
      if (topdown) {
        return yPosition + i * fontSize * LegendConstants.LINE_SPACING +
          fontSize * LegendConstants.LINE_SPACING / 2 + 2;
      }
      return yPosition +
        (labelSeries.length - i - 1) * fontSize * LegendConstants.LINE_SPACING +
        fontSize * LegendConstants.LINE_SPACING / 2 + 2;
    })
    .attr('font-size', fontSize + 'px');
  texts.exit()
    .remove();
};

// Plot a legend with vertical layout using labels in "labelSeries"
// starting at (xPosition, yPosition) with font size "fontSize".
// The width in pixels of a legend label is "labelWidth", and
// the width of the legend is "width".
// "sIdx" represents the index of the column in the data table
// that corresponds to the legend being shown.
Legend.plotHorizontalLegend = function(
  svg, labelSeries, sIdx, xPosition, yPosition, labelWidth, width, fontSize, colorScale) {
  // create a <g> of class "legend"
  const container = svg.selectAll('.legend').data([1]);
  container.enter().append('g').attr('class', 'legend');
  let numCols = Math.floor(width / labelWidth);
  if (numCols < 1) {
    numCols = 1;
  }

  // first, create the color labels, and then...
  const rects = container.selectAll('rect.series' + sIdx).data(labelSeries);
  rects.enter().append('rect')
    .attr('class', 'series' + sIdx)
    .attr('x', function(d, i) {
      return xPosition + (i % numCols) * labelWidth;
    })
    .attr('y', function(d, i) {
      return yPosition + Math.floor(i / numCols) * fontSize * LegendConstants.LINE_SPACING +
        fontSize * (LegendConstants.LINE_SPACING - 1);
    })
    .attr('width', fontSize)
    .attr('height', 0)
    .attr('fill', function(d, i) {
      return colorScale(i);
    })
    .attr('opacity', 1);
  rects.transition()
    .attr('x', function(d, i) {
      return xPosition + (i % numCols) * labelWidth;
    })
    .attr('y', function(d, i) {
      return yPosition + Math.floor(i / numCols) * fontSize * LegendConstants.LINE_SPACING +
        fontSize * (LegendConstants.LINE_SPACING - 1);
    })
    .attr('width', fontSize)
    .attr('height', fontSize)
    .attr('fill', function(d, i) {
      return colorScale(i);
    });
  rects.exit()
    .transition()
    .attr('height', 0)
    .remove();


  // ... the text labels
  const texts = container.selectAll('text.series' + sIdx).data(labelSeries);
  texts.enter().append('text')
    .attr('class', 'series' + sIdx)
    .text(function(d) {
      return d;
    })
    .attr('text-anchor', 'start')
    .attr('x', function(d, i) {
      return xPosition + (i % numCols) * labelWidth + Math.ceil(1.6 * fontSize);
    })
    .attr('y', function(d, i) {
      return yPosition + Math.floor(i / numCols) * fontSize * LegendConstants.LINE_SPACING +
        fontSize * (3 * LegendConstants.LINE_SPACING / 2 - 1);
    })
    .attr('font-size', fontSize + 'px')
    .attr('fill', '#333');
  texts.transition()
    .text(function(d) {
      return d;
    })
    .attr('x', function(d, i) {
      return xPosition + (i % numCols) * labelWidth + Math.ceil(1.6 * fontSize);
    })
    .attr('y', function(d, i) {
      return yPosition + Math.floor(i / numCols) * fontSize * LegendConstants.LINE_SPACING +
        fontSize * (3 * LegendConstants.LINE_SPACING / 2 - 1);
    })
    .attr('font-size', fontSize + 'px');
  texts.exit()
    .remove();
};

module.exports = Legend;
