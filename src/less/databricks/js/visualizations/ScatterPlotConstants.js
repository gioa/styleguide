/**
 * Constants needed to generate Scatter Plots
 *
 * DEPENDENCIES: D3
 */

import d3 from 'd3';

const ScatterPlotConstants = {
  // max number of scatter plots we display
  MAX_NUM_PLOTS: 4,
  // easy colors accessible via a 10-step ordinal scale
  COLOR_SCALE: d3.scale.category10(),
  // size of the border around the scatter charts
  BORDER_SIZE: 10,
};

module.exports = ScatterPlotConstants;
