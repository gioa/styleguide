/* @flow weak */

import WorkspaceConstants from '../filetree/WorkspaceConstants';

import IconsForType from '../ui_building_blocks/icons/IconsForType';

export class FileBrowserUtils {
  /**
   * True iff the model is a "system folder" that can not be modified, such as /, /users, /shared.
   */
  static isSystemFolder(model) {
    return model.get('type') === 'folder' && model.get(WorkspaceConstants.NonModifiableAttribute);
  }

  /**
   * True iff users should be allowed to see the "Permissions" option on this item in the dropdown.
   */
  static isPermissionModifiable(model) {
    const nodeType = model.get('type');
    const name = model.get('name');
    const isExample = model.get('isExample');
    const systemFolder = FileBrowserUtils.isSystemFolder(model);
    const specialFolder = isExample ||
                          (systemFolder && name === WorkspaceConstants.SharedFolderName);

    return !specialFolder && (nodeType === 'shell' || nodeType === 'folder');
  }

  /**
   * True iff the model is a home folder for some user.
   */
  static isHomeFolder(model) {
    return model.get('type') === 'folder' &&
           model.get(WorkspaceConstants.UserIdAttribute) !== undefined &&
           model.get(WorkspaceConstants.UserIdAttribute) !== null;
  }

  /**
   * Get the icons for a model in the filebrowser
   * (TreeNodes, NotebookModels, Dashboards, Tables, etc.)
   *
   * @param model The tree or file collection model.
   *   i.e., a backbone model with the 'type' attribute.
   * @returns {{icon: string, openIcon: string}} The font-awesome icon that should be used
   *   with items of this type. Example: <i className={"fa fa-" + icons.icon}/>
   *   openIcon is the icon that is shown when the icon is "open" (e.g., a folder).
   */
  static iconsForModel(model) {
    const type = model.get('type');
    let icon = model.get('icon') || IconsForType[type];
    let openIcon = icon === IconsForType.folder ? IconsForType.openFolder : undefined;

    if (model.get('isExample') && (model.get('parentId') === 0)) {
      icon = IconsForType.example;
      openIcon = undefined;
    }

    const isHomeFolder = FileBrowserUtils.isHomeFolder(model);

    if (model.get(WorkspaceConstants.NonModifiableAttribute) &&
        model.get('name') === WorkspaceConstants.UserFolderName) {
      // this is the /users folder
      icon = IconsForType.users;
      openIcon = undefined;
    } else if (model.get(WorkspaceConstants.NonModifiableAttribute) &&
               model.get('name') === WorkspaceConstants.SharedFolderName) {
      // this is the /shared folder
      icon = IconsForType.shared;
      openIcon = undefined;
    } else if (isHomeFolder) {
      // this is a user home directory
      if (model.get('name') === window.settings.user) {
        icon = IconsForType.home;
        openIcon = undefined;
      } else {
        icon = IconsForType.userFolder;
        openIcon = IconsForType.openUserFolder;
      }
    }

    if (type === 'table' && model.has('hasError') && model.get('hasError') === true) {
      icon = 'exclamation-circle';
    }

    return {
      icon: icon,
      openIcon: openIcon || icon,
    };
  }
}
