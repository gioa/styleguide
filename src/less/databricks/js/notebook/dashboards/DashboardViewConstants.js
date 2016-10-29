import NotebookConstants from '../../notebook/NotebookConstants';

const constants = {};

constants.DEFAULT_WIDTH = 1024;
constants.NUMBER_OF_COLUMNS = 24;
// Cell height unit = CELL_HEIGHT_RATIO * current dashboard width
constants.CELL_HEIGHT_RATIO = 1 / constants.NUMBER_OF_COLUMNS;
constants.CELL_VERTICAL_MARGIN = 6;
constants.DEFAULT_ELEMENT_OPTIONS = {
  titleAlign: 'center',
  autoScaleImg: false,
  scale: 0,
};
constants.WIDTH_OPTIONS = [
  800, 1024, 1440, 1600, 1920, 2048, 2560, 4000,
];
constants.MAX_DASHBOARD_TITLE_LENGTH = 40;

constants.DEFAULT_PAGE_RATIO = 16 / 9;

constants.SCALAR_BASE = 1.1;

// line height: 30px, margin-top/margin-bottom: 10px
constants.ELEMENT_TITLE_HEIGHT = 50;

constants.DEFAULT_ELEMENT_WIDTH = Math.floor(constants.NUMBER_OF_COLUMNS / 2);
constants.DEFAULT_ELEMENT_HEIGHT = 6;

constants.INPUT_WIDGET_HEIGHT = 38;

constants.MAX_ELEMENT_TITLE_LENGTH = NotebookConstants.MAX_COMMAND_TITLE_LENGTH;

module.exports = constants;
