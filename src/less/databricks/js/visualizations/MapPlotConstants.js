/**
 * Constants for creating Map plots
 *
 * DEPENDENCIES: None
 */

const MapPlotConstants = {
  TYPE_US: 1,
  TYPE_WORLD: 2,
  // initial scale factors for the world map, i.e. the ratio between
  // scale() argument used in d3.geo.* projection and map height/width in pixels
  SCALE_HEIGHT_WORLD_MERCATOR: 0.24,
  SCALE_WIDTH_WORLD_MERCATOR: 0.155,
  SCALE_HEIGHT_US_ALBERSUSA: 2.08,
  SCALE_WIDTH_US_ALBERSUSA: 1.25,
  // size of the border around the scatter charts
  MAX_TICKS: 8,
  // default colors for choropleth maps
  /**
   * @return {string}
   */
  FILL_COLOR_SCALE(i) {
    switch (i) {
      case 0:
        return '#ccc';
      case 1:
        return '#B6DBEF';
      case 2:
        return '#9ECAE1';
      case 3:
        return '#6BAED6';
      case 4:
        return '#4292C6';
      case 5:
        return '#3181B5';
      case 6:
        return '#2171B5';
      case 7:
        return '#14519C';
      case 8:
        return '#10519C';
      default:
        return '#ccc';
    }
  },
  /**
   * @return {string}
   */
  TEXT_COLOR_SCALE(i) {
    switch (i) {
      case 0:
        return '#666';
      case 1:
        return '#666';
      case 2:
        return '#666';
      case 3:
        return '#666';
      case 4:
        return '#eee';
      case 5:
        return '#eee';
      case 6:
        return '#eee';
      case 7:
        return '#eee';
      default:
        return '#666';
    }
  },
  // border around legend
  LEGEND_BORDER: 8,
  // label font size
  LABEL_FONT_SIZE: 13,
};

module.exports = MapPlotConstants;
