/**
 * Constants for use in dashboards
 *
 * DEPENDENCIES: None
 */

const DashboardConstants = {
  GRID_STEP: 10,
  EDIT_MAX_BORDER_WIDTH: 1200,
  EDIT_MAX_BORDER_HEIGHT: 1600,
  EDIT_BORDER_WEIGHT: 4,
  OPTION_BUTTON_HEIGHT: 32,
  OVERFLOW_HEIGHT: 20,
  // Height of dashboard sidebar widgets
  SIDEBAR_WIDGET_HEIGHT: 200,
  // Width of dashboard sidebar widgets
  SIDEBAR_WIDGET_WIDTH: 200,
  // Offset in pixels from the border of sidebar widget container to actual widget
  SIDEBAR_GRID_OFFSET: 8,
  // In presentation mode, some small margins on the bottom and the right to take borders into
  // account.
  PRESENTATION_BOTTOM_RIGHT_MARGIN: 10,

  // Height and width of the resize handle in dashboard
  WIDGET_RESIZE_HANDLE_WIDTH: 5,
  WIDGET_RESIZE_HANDLE_HEIGHT: 5,

  // Minimum height and width of widgets in dashboard
  MIN_WIDGET_WIDTH: 20,
  MIN_WIDGET_HEIGHT: 20,
};

module.exports = DashboardConstants;
