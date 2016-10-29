/* eslint no-mixed-operators: 0, func-names: 0 */

/**
 * Utilities used by visualizations.
 */
import d3 from 'd3';

import NotebookUtilities from '../notebook/NotebookUtilities';

const VizUtils = {};

VizUtils.plotType = {
  BAR_PLOT: 1,
  AREA_PLOT: 2,
};

// Used in BarChart and AreaChart to figure out Y-position for grouped/stacked/100%-stacked
// The "this" pointer will be bound to the Bar/Area chart object
VizUtils.getBarY = function getBarY(serieData, serieIdx, plotType) {
  let idxStart;
  let idxStop;
  if (this.getOption('stacked') || this.getOption('100_stacked')) {
    idxStart = 1; // add all previous bar heights in group
  } else {
    idxStart = serieIdx + 1; // only use current bar height in group
  }

  if (plotType === VizUtils.plotType.AREA_PLOT || Math.sign(serieData[serieIdx + 1]) === 1) {
    idxStop = serieIdx + 1;
  } else {
    idxStop = serieIdx; // bars below y=0 shouldn't add their height (stackY=0 for non stacked)
  }

  let stackY = 0;
  for (let w = idxStart; w <= idxStop; w++) {
    // only stack bars that are of same sign as the current bar (serieIdx)
    if (Math.sign(serieData[w]) === Math.sign(serieData[serieIdx + 1])) {
      stackY += serieData[w];
    }
  }

  if (this.getOption('100_stacked')) {
    let total = 0.0;
    for (let i = 1; i < serieData.length; i++) {
      total += Math.abs(serieData[i]);
    }
    total = total === 0.0 ? 1.0 : total;
    stackY = 100.0 * stackY / total;
  }
  return stackY;
};

/**
 * Finds given number of numeric and factor columns in the schema.
 * @param numerics Number of numeric columns to find or -1 for all
 * @param factors Number of factor (non-numeric) columns to find, or -1 for all
 * @param schema The schema object
 */
VizUtils.findColumns = function findColumns(numerics, factors, schema) {
  if (schema.length === 0) {
    return { xColumns: ['<id>'], yColumns: [] };
  }

  const yColumns = [];
  const xColumns = [];

  for (let pos = schema.length - 1; pos >= 0; pos--) {
    if (NotebookUtilities.isNumeric(schema[pos].type)) {
      if (yColumns.length < numerics || numerics < 0) {
        yColumns.push(schema[pos].name);
      }
    } else if (xColumns.length < factors || factors < 0) {
      xColumns.push(schema[pos].name);
    }
  }
  return { xColumns: xColumns, yColumns: yColumns };
};

/**
 * Projects given columns (in both xColumns and yColumns).
 */
VizUtils.projectColumns = function projectColumns(rawData, schema, xColumns, yColumns) {
  const invertedSchema = {}; // Helper dictionary to give index of a given column name.
  for (let i = 0; i < schema.length; i++) {
    invertedSchema[schema[i].name] = i;
  }

  const xIndex = xColumns.map(function(x) { return invertedSchema[x]; });
  const yIndex = yColumns.map(function(x) { return invertedSchema[x]; });

  const resData = rawData.map(function(r) {
    const key = xIndex.map(function(i) {
      return r[i];
    });
    const val = yIndex.map(function(i) {
      return r[i];
    });
    return key.concat(val);
  });

  return { data: resData, columns: yColumns, key: xColumns.join(', ') };
};

/**
 * Returns coordinates of the line segment that files inside the given bounding box.
 * @param slope of the line
 * @param intercept of the line
 * @param x1 X of lower left corner of the box
 * @param y1 Y of lower left corner of the box
 * @param x2 X of upper right corner of the box
 * @param y2 Y of upper right corner of the box
 * @returns {{x1: *, y1: *, x2: *, y2: *}}
 */
VizUtils.boxBoundedLine = function boxBoundedLine(slope, intercept, x1, y1, x2, y2) {
  const getX = function(y) {
    return (y - intercept) / slope;
  };
  const getY = function(x) {
    return x * slope + intercept;
  };
  const isInside = function(d, v1, v2) {
    return d >= v1 && d <= v2;
  };

  // Line segment coordinates
  let X1;
  let X2;
  let Y1;
  let Y2;
  if (isInside(getX(y2), x1, x2)) {
    X2 = getX(y2);
    Y2 = y2;
    if (isInside(getY(x1), y1, y2)) {
      X1 = x1;
      Y1 = getY(x1);
    } else {
      X1 = getX(y1);
      Y1 = y1;
    }
  } else {
    X2 = x2;
    Y2 = getY(x2);
    if (isInside(getY(x1), y1, y2)) {
      X1 = x1;
      Y1 = getY(x1);
    } else {
      X1 = getX(y1);
      Y1 = y1;
    }
  }

  return { x1: X1, y1: Y1, x2: X2, y2: Y2 };
};

VizUtils.tooltipNumFormat = d3.format('000,.2f');

module.exports = VizUtils;
