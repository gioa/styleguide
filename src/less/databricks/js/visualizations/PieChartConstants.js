/**
 * Constants for PieChart creation
 *
 * DEPENDENCIES: D3
 */

import d3 from 'd3';

const PieChartConstants = {
  // max number of pie charts we display
  MAX_NUM_PIES: 4,
  // easy colors accessible via a 10-step ordinal scale
  CAT_10_SCALE: d3.scale.category10(),
  // For pie chart colors, use a neutral gray for the "others" category
  COLOR_SCALE(i) {
    if (i === PieChartConstants.MAX_NUM_PIE_PIECES) {
      return '#aaa';   // This is the series for "others"
    }
    return PieChartConstants.CAT_10_SCALE(i);
  },
  // maximum number of pieces in the pie chart
  // (this cannot be larger than the number of colors,
  // i.e., 10 in our case)
  MAX_NUM_PIE_PIECES: 9,
  // size of the border around the pie charts
  BORDER_SIZE: 20,
};

module.exports = PieChartConstants;
