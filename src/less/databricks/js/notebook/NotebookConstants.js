/**
 * Attributes for Notebooks
 */
const NotebookConstants = {
  state: {
    'NO_CLUSTER_ATTACHED': 'NO_CLUSTER_ATTACHED',
    'ALREADY_RUNNING': 'ALREADY_RUNNING',
    'COMMAND_EMPTY': 'COMMAND_EMPTY',
    'READY': 'READY',
    'SELECTED_COMMAND_RUNNING': 'SELECTED_COMMAND_RUNNING',
    'COMMAND_LIST_EMPTY': 'COMMAND_LIST_EMPTY',
  },

  message: {
    'RUN_ERROR': 'RUN_ERROR',
  },

  // limit on number of characters for command title text
  MAX_COMMAND_TITLE_LENGTH: 400,

  AUTO_RUN_ACCESSED_COMMAND: 'auto-run-selected-command',
  AUTO_RUN_ALL: 'auto-run-all',
  AUTO_RUN_NO_OP: 'no-auto-run',

  // display height of top bar, including topbar and context bar in notebook
  TOPBAR_HEIGHT: 76,
  // display height of the input button in input panel
  INPUT_BTN_HEIGHT: 25,
  // display width of side bar
  SIDE_NAV_WIDTH: 76,
};

NotebookConstants.AUTO_RUN_ALL_OPTIONS = [
  NotebookConstants.AUTO_RUN_ACCESSED_COMMAND,
  NotebookConstants.AUTO_RUN_ALL,
  NotebookConstants.AUTO_RUN_NO_OP,
];

module.exports = NotebookConstants;
