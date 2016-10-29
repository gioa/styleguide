/* eslint callback-return: 0, global-require: 0, consistent-return: 0, func-names: 0 */

/**
 * Collection of navigation utility functions
 */

import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';
import React from 'react';

import WorkspaceAcl from '../acl/WorkspaceAcl';

import ImportDialog from '../filebrowser/ImportDialog.jsx';

import WorkspaceConstants from '../filetree/WorkspaceConstants';

import LocalUserPreference from '../local_storage/LocalUserPreference';

import { AddNotebookView } from '../notebook/AddNotebookView.jsx';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';
import ReactModalUtils from '../ui_building_blocks/dialogs/ReactModalUtils';

import { NodeNameValidators } from '../validators/NodeNameValidators.js';

const NavFunc = {};

const ROOT_FOLDER_ID = 0;
// Keys into localPreference
const LAST_NOTEBOOK_LANGUAGE = 'lastNotebookLanguage';
NavFunc.LAST_NOTEBOOK_LANGUAGE = LAST_NOTEBOOK_LANGUAGE;


/**
 * Get a LocalUserPreference for NavFunc settings; this is initialized lazily because it requires
 * a user to be set through loading the config.
 */
NavFunc.localPreference = function() {
  if (!NavFunc.localPreference._result) {
    NavFunc.localPreference._result = new LocalUserPreference('NavFunc');
  }
  return NavFunc.localPreference._result;
};

NavFunc.addFolder = function(parentId) {
  DeprecatedDialogBox.prompt({
    message: 'New Folder Name',
    confirmButton: 'Create Folder',
    validate: NodeNameValidators.isValidName,
    confirm(name) {
      window.fileBrowserView.createNode({
        name: name,
        type: 'folder',
        parentId: parentId,
      });
    },
  });
};

NavFunc.importItem = function(parentId) {
  ImportDialog.createDialog(parentId);
};

/**
 * Returns param string that binds externally opened links to the current session.
 */
NavFunc.sessionParams = function(append) {
  const csrf = window.settings ? window.settings.csrfToken : '';
  const orgId = window.settings ? window.settings.orgId : '';
  const params = `csrf=${csrf}&o=${orgId}`;
  if (append) {
    return `&${params}`;
  }
  return `?${params}`;
};

NavFunc.exportItem = function(id) {
  window.open('/serialize/' + id + NavFunc.sessionParams());
};

NavFunc.exportSource = function(id) {
  window.open('/serialize/source/' + id + NavFunc.sessionParams());
};

NavFunc.exportHTML = function(id) {
  window.open('/serialize/html/' + id + NavFunc.sessionParams());
};

NavFunc.exportIPython = function(id) {
  window.open('/serialize/ipython/' + id + NavFunc.sessionParams());
};

NavFunc.publishItem = function(id) {
  window.open('/serialize/publish' + id + NavFunc.sessionParams());
};

/** Get the full path of a node given the nodeId. Unknown nodes will be replaced with ??? */
NavFunc.getFullPath = function(nodeId) {
  if (nodeId === ROOT_FOLDER_ID) {
    return '/';
  }

  const node = window.treeCollection.get(nodeId);
  if (node) {
    const pathIds = node.get('path').split('/').slice(1);
    const pathNames = pathIds.map(function(pId) {
      const pNode = window.treeCollection.get(pId);
      return pNode ? pNode.get('name') : '???';
    });
    return '/' + pathNames.join('/');
  }
  return '???';
};

NavFunc.isExampleNode = function(id) {
  const node = window.treeCollection.get(id);
  if (node) {
    const topLevelId = parseInt(node.get('path').split('/').slice(1)[0], 10);
    const topLevel = node.id === topLevelId ? node : window.treeCollection.get(topLevelId);
    return topLevel && topLevel.get('isExample');
  }
  return false;
};

/**
 * @TODO(jengler) 2016-07-06: We need to clean up how the file tree is accessed. For example,
 * getHomeFolderNode and getRootFolderNode return two different types of objects. This is because
 * the homefolder is
 * @return {[type]} [description]
 */
NavFunc.getRootFolderNode = function() {
  return window.fileBrowserView.getModel(ROOT_FOLDER_ID);
};

/** Get the TreeNode that is the current user's home directory or undefined if not found */
NavFunc.getHomeFolderNode = function() {
  const homeAttrs = {
    type: 'folder',
    name: window.settings.user,
  };
  homeAttrs[WorkspaceConstants.UserIdAttribute] = window.settings.userId;

  return window.treeCollection.findWhere(homeAttrs);
};

NavFunc.getDefaultFolderId = function() {
  const homeFolder = NavFunc.getHomeFolderNode();
  return homeFolder ? homeFolder.id : ROOT_FOLDER_ID;
};

/** Return true if the TreeNode is the given user's home directory or false if not */
NavFunc.isHomeFolderForUser = function(node, userId) {
  return node &&
    node.get && // for instance profiles, the model is mocked so node.get doesn't exist
                // returning false is ok, home folder has no meaning for instance profiles
    node.get('type') === 'folder' &&
    node.get(WorkspaceConstants.NonModifiableAttribute) &&
    node.get(WorkspaceConstants.UserIdAttribute) === userId;
};

NavFunc.addReactNotebook = function(parentId) {
  const createNotebook = function(name, language, clusterId) {
    const node = {
      parentId: parentId,
      name: name,
      language: language,
      clusterId: clusterId || '',
    };

    NavFunc.localPreference().set(LAST_NOTEBOOK_LANGUAGE, language);

    // TODO(jeffpang): we should use the handler to create notebooks here, for import,
    // for clone, and for REST API (e.g., the sbt plugin)
    window.fileBrowserView.createNotebook(node, function(model) {
      window.router.navigate('notebook/' + model.id, { trigger: true });
    });
  };

  ReactModalUtils.createModal(
    <AddNotebookView
      clusters={window.clusterList}
      createNotebookFunc={createNotebook}
      lastLanguage={NavFunc.localPreference().get(LAST_NOTEBOOK_LANGUAGE)}
    />);
};

NavFunc.getFSPath = function(id) {
  // Apparently we can't call get() when id = 0
  if (id === ROOT_FOLDER_ID) { return '/'; }

  const model = window.treeCollection.get(id);
  if (!model) {
    return null;
  }

  const nodePath = model.get('path').split('/').map(function(idStr) {
    const nodeId = parseInt(idStr, 10);
    if (nodeId > ROOT_FOLDER_ID) {
      return window.treeCollection.get(nodeId).get('name');
    }
    return '';
  }).join('/');

  return nodePath;
};

NavFunc.cloneNode = function(id, onConfirm, onSuccess, onFailure, testing) {
  NavFunc.cloneNodeOrUrl({
    id: id,
    onConfirm: onConfirm,
    onSuccess: onSuccess,
    onFailure: onFailure,
    testing: testing,
  });
};

/**
 * Clone an existing tree node or import a notebook from a URL. Either id or url is provided,
 * not both.
 *
 * TODO(jeffpang): refactor this dialog as a react dialog when we have time.
 *
 * @param options a hash containing:
 *   {
 *     id: number - nodeId of the node to clone in the treeCollection. Takes precendence over url
 *     url: string - url of the static notebook to clone (only used if id is not defined)
 *     name: string - the name of the URL being cloned (only used if url is provided)
 *     onConfirm: func - callback called when the user clicks confirm
 *     onSuccess: func - callback called when the clone is successful, called with the new nodeId
 *     onFailure: func - callback called when the clone fails
 *     testing: bool - used in unit tests to skip file the filetree rendering
 *     testingName: string - pretend to select this name in the clone dialog for unit testing
 *       default is to not change the given newName. (assumes testing is true)
 *     testingFolderId: number - pretend to select this folder node in the clone dialog for unit
 *       testing. default is the current folder id. (assumes testing is true)
 *   }
 */
NavFunc.cloneNodeOrUrl = (options) => {
  const testing = options.testing;
  const model = options.id ? window.treeCollection.get(options.id) : null;
  // the starting folder we clone to is either the current node's parent or the default folder
  const currentFolderId = model ? model.get('parentId') : NavFunc.getDefaultFolderId();
  const nodeName = model ? model.get('name') : options.name;
  const newName = NavFunc.nonConflictingName(nodeName, currentFolderId);

  const cloneDialog = DeprecatedDialogBox.custom({
    title: "Cloning: '" + nodeName + "'",
    confirmButton: 'Clone',
    class: 'copy-file-dialog',
    controls: [
      {
        controlType: 'filetreePath',
        pathlabel: 'Cloning to folder: ',
      },
      {
        controlType: 'input',
        id: 'cloneFileName',
        type: 'text',
        label: 'New Name: ',
        confirmOnEnter: true,
        value: newName,
        focus: true,
      },
      testing ? null : {
        controlType: 'filetree',
        id: 'cloneFolderPicker',
        nodeType: 'folder',
        hideExamples: true,
      },
    ],
    confirm(dialog) {
      let selectedName;
      let folderId;
      if (testing) {
        // fake the name and folder selection in unit tests
        selectedName = options.testingName !== undefined ? options.testingName : newName;
        folderId = options.testingFolderId ? options.testingFolderId : currentFolderId;
      } else {
        selectedName = dialog.find('#cloneFileName')[0].value;
        folderId = dialog.find('#cloneFolderPicker')[0].fileTree.selectedFolder().id;
      }

      const folderPath = NavFunc.getFSPath(folderId);
      const newPath = folderPath + '/' + selectedName;
      if (options.onConfirm) {
        options.onConfirm();
      }

      let target;
      let data;
      if (options.id !== null && options.id !== undefined) {
        target = '/serialize/clone/' + options.id;
        data = { path: newPath };
      } else if (options.url) {
        target = '/serialize/url/' + folderId;
        data = { url: options.url, nameOverride: selectedName };
      } else {
        throw new Error('neither id or url given to cloneNodeOrUrl');
      }

      const recordEvent = (success, error) => {
        if (window.recordEvent) {
          window.recordEvent('notebookCloned', {
            notebookUrl: options.url,
            notebookName: nodeName,
            path: newPath,
            status: success ? 'success' : 'failure',
            error: error,
          });
        }
      };

      $.ajax(target, {
        contentType: 'application/json; charset=UTF-8',
        type: 'POST',
        data: JSON.stringify(data),
        success(successData) {
          if (options.onSuccess) {
            options.onSuccess(successData.newId);
          }
          recordEvent(true);
        },
        error(jqXHR, textStatus, errorThrown) {
          if (options.onFailure) {
            options.onFailure(errorThrown);
          }
          if (!testing) {
            DeprecatedDialogBox.alert(errorThrown, false, 'OK');
          }
          recordEvent(false, errorThrown);
        },
      });
    },
    cancel() {},
  });

  if (!testing) {
    const filetree = cloneDialog.find('#cloneFolderPicker')[0].fileTree;
    const openToFolder = function(folder) {
      // set default clone path to given folder
      // otherwise make the default path to user's default folder(home folder if ACLs is enabled)
      if (!folder) {
        const folderId = NavFunc.getDefaultFolderId();
        folder = folderId ? window.treeCollection.get(folderId) : NavFunc.getRootFolderNode();
      }
      const targetFileTreeNode = window.fileBrowserView.toTreeNode(folder);
      filetree.openToNode(targetFileTreeNode);
    };

    // fileBrowserView.getModel is used instead of treeCollection.get because the treeCollection
    // doesn't have a model for the root node (nodeId 0)
    // TODO(jeffpang): we should fix this hack
    const currentFolder = window.fileBrowserView.getModel(currentFolderId);
    if (currentFolder && !currentFolder.get('isExample')) {
      currentFolder.fetchPermissionLevel(function() {
        if (this.canManage()) {
          openToFolder(currentFolder);
        } else {
          openToFolder();
        }
      });
    } else {
      openToFolder();
    }
  }
};

/**
 * Given an originalName, find a name that doesn't conflict with any other items inside the
 * folder node with ID parentId. If the originalName is taken, then "originalName (1)" is tried,
 * then "originalName (2)", etc.
 */
NavFunc.nonConflictingName = function(originalName, parentId) {
  const children = window.treeCollection.where({ parentId: parentId });
  if (children.length === 0) {
    return originalName;
  }
  let idx = 0;
  let proposedName;
  const equalsProposedName = (node) => node.get('name') === proposedName;
  do {
    proposedName = idx === 0 ? originalName : originalName + ' (' + idx + ')';
    idx++;
  } while (_.find(children, equalsProposedName));
  return proposedName;
};

NavFunc.addLibrary = function(parentId) {
  window.router.navigate('#create/library/' + parentId, { trigger: true });
};

NavFunc.addTable = function() {
  window.router.navigate('#create/table', { trigger: true });
};

NavFunc.addCluster = function() {
  window.router.navigate('#create/cluster', { trigger: true });
};

/**
 * Remove a view from the DOM and from all our data structures
 *
 * @param view  The view to remove
 * @param navigateAwayIfNeeded  Whether to navigate to "#" if this view was currently active.
 *     Default: true.
 */
NavFunc.removeView = function(view, navigateAwayIfNeeded) {
  navigateAwayIfNeeded = (navigateAwayIfNeeded !== undefined ? navigateAwayIfNeeded : true);
  console.log('Removing view', view.name, navigateAwayIfNeeded);
  const viewId = view.$el.attr('id');
  const fragment = window.viewIdToFragment[viewId];
  // If it's a script remove the cached shellSessionHash for freshness (that was used for
  // blowing out set of commands for "run" scripts
  if (view.className && (view.className === 'shellSessionView' ||
    view.className === 'scriptView')) {
    delete window.shellSessionHash[view.model.shellId];
  }
  window.router.recentViewRoutes = _.without(window.router.recentViewRoutes, view);
  view.remove();
  delete window.viewIdtoView[viewId];
  delete window.viewIdToFragment[viewId];
  delete window.fragmentToView[fragment];
  if (navigateAwayIfNeeded && Backbone.history.fragment === fragment) {
    window.router.navigate('', { trigger: true });
  }
};

/**
 * Rename a node. This shows a prompt dialog asking users for the new name.
 * TODO(someone): Handle renaming tables properly and show the UI for renaming.
 */

NavFunc.renameNode = function(id, model) {
  const oldName = model.get('name');
  DeprecatedDialogBox.prompt({
    message: 'Enter a new name for ' + oldName + ':',
    confirmButton: 'Rename',
    defaultValue: oldName,
    validate: NodeNameValidators.isValidName,
    confirm(newName) {
      // TODO(jeffpang): PROD-5129 implement rename for react notebooks in NotebookHandler
      const changes = { name: newName };
      model.set(changes);
      model.save(changes, {
        patch: true,
        success() {
          const curView = window.activeView;
          let curViewId;
          if (curView.id) {
            curViewId = curView.id;
          } else if (curView.props.notebook) {
            curViewId = curView.props.notebook.id;
          }
          if (curView !== null && curViewId === id) {
            // If opened view is the just renamed notebook or dashboard update it.
            if (curView.name) {
              curView.name = newName;
            } else {
              curView.props.notebook.attributes.name = newName;
            }
            if (curView.type && curView.type.displayName === 'ReactNotebookView' &&
              curView.props.notebook.id === id) {
              // Update the top bar title in the React component
              $('span.tb-title').text(newName).data('data-name', newName);
            } else {
              window.router.show(curView, false); // To update the top bar title
            }
          } else {
            _.values(window.fragmentToView).forEach(function(view) {
              if (view.id === id) {
                view.name = newName;
                // If current view is a dashboard, call its render() so it updates its title.
                if (view.className !== 'shellSessionView') {
                  view.render();
                }
              }
            });
          }
        },
        error(modelWithErr, response) {
          const revert = { name: oldName };
          modelWithErr.set(revert);
          DeprecatedDialogBox.alert('Renaming the element failed: ' + response.statusText);
        },
      });
    },
  });
};

/**
 * Delete a node. This shows a dialog asking users to confirm before deleting.
 */
NavFunc.deleteNode = function(id, model, numDescendants, callback) {
  let msg = 'Are you sure you want to delete ' + model.get('name');
  if (model.get('type') === 'folder') {
    if (numDescendants === 1) {
      msg += ' and the item in it';
    } else if (numDescendants > 1) {
      msg += ' and the ' + numDescendants + ' items in it';
    }
  }
  msg += '? This cannot be undone.';

  DeprecatedDialogBox.confirm({
    message: msg,
    confirmButton: 'Confirm and Delete',
    confirm() {
      const nodeType = model.get('type');
      switch (nodeType) {
        case 'table':
          if (callback) { callback(); }
          break;

        case 'library':
          if (callback) { callback(); }
          break;

        default:
          // Navigate Home and Destroy model
          window.router.navigate('', { trigger: true });
          model.destroy({
            // TODO(jeffpang): Deal with deletes failures in the frontend in a way that doesn't
            // require refreshing the page
            error(modelWithErr, resp) {
              DeprecatedDialogBox.alert('Could not delete ' + modelWithErr.get('name') + ': ' +
                resp.statusText + '. Please refresh the page.');
            },
          });
      }
    },
  });
};

NavFunc.moveNodes = function(nodesToMove, destNode) {
  const destPath = NavFunc.getFullPath(destNode);
  let finishCount = 0;
  const errors = [];

  const checkFinished = function() {
    if (finishCount === nodesToMove.length && errors.length > 0) {
      // TODO(jeffpang): move this to use ReactDialogBox when we change FileBrowser to jsx
      if (errors.length === 1) {
        DeprecatedDialogBox.alert('Could not move ' + errors[0].srcPath + ' to ' + destPath + ': ' +
          errors[0].error);
      } else {
        const items = _.map(errors, function(error) {
          return '<li>' + error.srcPath + ': ' + error.error + '</li>';
        });
        DeprecatedDialogBox.alert(errors.length + ' files could not be moved to ' + destPath +
          ':<br/><br/><ul>' + items.join('') + '</ul>', true);
      }
    }
  };

  _.each(nodesToMove, function(srcNode) {
    const srcPath = NavFunc.getFullPath(srcNode);
    const dstAncestors = NavFunc.getAncestors(destNode.id);

    if (destNode.id === srcNode.get('parentId')) {
      // moving node into its parent is a noop
      finishCount += 1;
    } else if (_.contains(dstAncestors, srcNode.id)) {
      // moving node into one of its children (or grand*-children) is impossible
      errors.push({ srcPath: srcPath, error: 'Cannot move folder into itself' });
      finishCount += 1;
    } else {
      const change = { parentId: destNode.id };
      srcNode.save(change, {
        patch: true,
        wait: true,
        success() {
          finishCount += 1;
          checkFinished();
        },
        error(model, response) {
          errors.push({ srcPath: srcPath, error: response.statusText });
          finishCount += 1;
          checkFinished();
        },
      });
    }
  });

  checkFinished();
};

/**
 * Return the IDs of all ancestors of a given node, including itself
 */
NavFunc.getAncestors = function(id) {
  const ancestors = [0];
  let model = window.treeCollection.get(id);
  while (model) {
    ancestors.push(model.id);
    model = window.treeCollection.get(model.get('parentId'));
  }
  return ancestors;
};

/**
 * preview new permissions after node moved to target directory
 */
NavFunc.checkAndPreviewPermission = function(nodeModel, targetNodeId, moveNode) {
  // requiring MovePermissionPreview here because of circular dependency with NavFunc
  const MovePermissionPreview = require('../acl/MovePermissionPreview.jsx');

  const workspaceAcl = new WorkspaceAcl({
    id: nodeModel.id,
    name: nodeModel.get('name'),
    model: nodeModel,
  });

  const previewWorkspaceAcl = new WorkspaceAcl({
    id: nodeModel.id,
    name: nodeModel.get('name'),
    moveTargetId: targetNodeId,
    model: nodeModel,
  });

  $.when(workspaceAcl.fetch(), previewWorkspaceAcl.fetch())
    .then(
      // both fetch requests are successful
      function() {
        if (workspaceAcl.isEqual(previewWorkspaceAcl, { ignoreCurrentUser: true })) {
          // no permission change after move
          return moveNode();
        }
        const movePermissionPreview = React.createElement(MovePermissionPreview, {
          workspaceAcl: workspaceAcl,
          previewWorkspaceAcl: previewWorkspaceAcl,
          onConfirm: moveNode,
        });
        ReactModalUtils.createModal(movePermissionPreview);
      },
      // either one fetch failed means don't have manage permission on the node being dropped
      // or the target node, moveNode will throw an permission warning dialog
      moveNode
    );
};

module.exports = NavFunc;
