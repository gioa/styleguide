
/**
 * Attributes for folder nodes in the workspace. Keep this in sync with Workspace.scala
 */
const WorkspaceConstants = {
  UserFolderName: 'Users',
  SharedFolderName: 'Shared',
  NonModifiableAttribute: '_db_no_modify',
  NoChildrenAttribute: '_db_no_children',
  FullNameAttribute: 'fullname',
  UserIdAttribute: 'userId',

  // Jquery selector for elements that must slide right with the workspace tree
  RIGHT_PANE_SELECTOR: '#overallView, .tb-title-wrapper-central',
};

module.exports = WorkspaceConstants;
