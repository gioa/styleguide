/* eslint callback-return: 0, complexity: 0, consistent-return: 0, max-lines: 0, func-names: 0 */

import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';
import d3 from 'd3';
import React from 'react';
import ReactDOM from 'react-dom';

import { PermissionEditView } from '../acl/PermissionEditView.jsx';

import TreeNode from '../filebrowser/TreeNode';
import { FileBrowserUtils } from '../filebrowser/FileBrowserUtils';

import { DeleteNodeCallbacks } from '../filetree/DeleteNodeCallbacks';
import FileTree from '../filetree/FileTree';
import NavFunc from '../filetree/NavFunc.jsx';
import { RoutingConstants } from '../filetree/RoutingConstants';
import WorkspaceConstants from '../filetree/WorkspaceConstants';

import { TimingUtils } from '../js_polyfill/TimingUtils';

import LocalUserPreference from '../local_storage/LocalUserPreference';

import SearchPanelView from '../search/SearchPanelView.jsx';

import { StaticNotebookUrls } from '../static/StaticNotebookUrls';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';
import ReactModalUtils from '../ui_building_blocks/dialogs/ReactModalUtils';
import IconsForType from '../ui_building_blocks/icons/IconsForType';

import { BrowserUtils } from '../user_platform/BrowserUtils';

// Special IDs for top-level folders must be less than or equal to zero
const WORKSPACE_ID = 0;

const SIDEBAR_WIDTH = 70; // + "px"

// Base ID of links shown in the workspace, the link at index i is given the ID (baseID - i)
// Must be less than zero so they don't conflict with real tree node IDs
let FEATURE_LINK_NEXT_ID = -1000;

// Return a unique ID for links in the workspace
function getNextFeatureLinkId() {
  FEATURE_LINK_NEXT_ID -= 1;
  return FEATURE_LINK_NEXT_ID;
}

// Returns the effective id in the node map of a model, e.g. 'table-foo', 1234, or 'name'.
function getNodeMapKey(model) {
  if (model.nodeMapKey) {
    return model.nodeMapKey();
  } else if (model.has('id')) {
    return model.get('id');
  }
  return model.get('name');
}

function isNodeMoveable(model) {
  const moveableTypes = ['shell', 'folder', 'library', 'dashboard'];
  return _.contains(moveableTypes, model.get('type')) &&
    model.id > 0 && // all side-bar node IDs not in actual the TreeStore have negative IDs
    !model.get('isExample') &&
    !model.get(WorkspaceConstants.NonModifiableAttribute);
}

/**
 * The tree-like file browser view for the sidebar. Initialize the view by giving it a
 * TreeNodeCollection for the workspace.
 *
 * This class is more complicated than I (rxin) desired because it has to handle both
 * the sidebar (workspace containing shells, libraries, folders, and dashboards) and tables.
 */
const FileBrowserView = Backbone.View.extend({

  initialize(options) {
    const self = this;
    this.tables = options.tables;
    this.rootEl = $('<ul/>').addClass('sidebar-nav')[0];
    this.contextMenu = $('<div/>').addClass('filebrowser-context-menu dropdown-menu');
    this.fileBrowserDiv = $('div.filebrowser.filetree');
    $('body').append(this.contextMenu);

    // A mapping from a node's id to the node itself. Note that the value is not the TreeNode
    // model, but rather an object that has a model field pointing to the model.
    // Each node object contains the following attributes:
    //  - id
    //  - parentId
    //  - children: an array of child nodes
    //  - model: link to the Backbone model for the node (currently either TreeNode or Dashboard)
    //  - nonRemovable: whether a node can be removed; used to show the Remove menu
    //  - expanded: whether a folder is expanded or not (only applies to folders)
    //  - menu: an optional array of menus; if not set, menus from contextMenu will be used.
    this.nodeMap = {};

    // The set of directory nodes that have been fully loaded. This only has an affect when
    // lazy sidebar loading is enabled.
    this.loadedDirectories = new Map();

    this.$el.append(this.rootEl);

    this.registerEventHandlers(WORKSPACE_ID, this.model);

    const workspaceChildren = [];

    // show some links in the workspace if configured
    if (window.settings.showWorkspaceFeaturedLinks &&
        window.settings.workspaceFeaturedLinks &&
        window.settings.workspaceFeaturedLinks.length > 0) {
      window.settings.workspaceFeaturedLinks.forEach((elem) => {
        const id = getNextFeatureLinkId();
        const url = window.settings.useFramedStaticNotebooks ?
          StaticNotebookUrls.getFramedStaticNotebookUrl(elem.linkURI) : elem.linkURI;
        const node = {
          id: id,
          name: elem.displayName,
          model: new TreeNode({
            id: id,
            parentId: WORKSPACE_ID,
            name: elem.displayName,
            type: 'link',
            icon: elem.icon ? elem.icon : IconsForType.link,
          }),
          url: url,
          hasChildren: false,
          hasMenu: false,
          nonRemovable: true,
          // this makes these items sorted on top
          isExample: true,
        };
        this.nodeMap[id] = node;
        workspaceChildren.push(node);
      });
    }

    this.nodeMap[WORKSPACE_ID] = {
      id: WORKSPACE_ID,
      model: new TreeNode(
          { id: WORKSPACE_ID, parentId: WORKSPACE_ID, name: 'Workspace', type: 'folder' }),
      children: workspaceChildren,
      expanded: true,
      nonRemovable: true,
      droppable: true,
    };

    const rootNode = this.toTreeNode(this.nodeMap[WORKSPACE_ID]);

    // A special item for dropdown within the workspace
    const workspaceTopItem = {
      id: WORKSPACE_ID,
      name: 'Workspace',
      display: 'top-link',
      hasChildren: false,
      hasMenu: true,
    };

    this.topLevelFolders = [
      this.nodeMap[WORKSPACE_ID],
    ];

    // A tree provider for our FileTree control that looks at models in our tree
    this.treeProvider = {
      getRootNode() {
        return rootNode;
      },

      getChildren(node, callback) {
        const isVisible = function(entry) {
          return !entry.hidden || window.settings.showHidden;
        };
        if (node.id in self.nodeMap) {
          // Sort children alphabetically
          const treeNode = self.nodeMap[node.id];
          self._withDirectoryLoaded(treeNode, function() {
            let shown = treeNode.children.map(self.toTreeNode.bind(self))
              .filter(isVisible)
              .sort(self._nodeSortFunc.bind(self));
            if (node.id === WORKSPACE_ID) {
              shown = [workspaceTopItem].concat(shown);
            } else {
              const topItem = {
                id: node.id,
                name: node.name,
                display: 'top-link',
                hasChildren: false,
                hasMenu: true,
              };
              shown = [topItem].concat(shown);
            }
            callback(shown);
          });
        } else {
          callback([]);
        }
      },

      getParent(node, callback) {
        if (node.id in self.nodeMap) {
          const parentId = self.getModel(node.id).get('parentId');
          if (parentId !== undefined && parentId === WORKSPACE_ID) {
            callback(this.getRootNode());
          } else if (parentId !== undefined && parentId in self.nodeMap) {
            callback(self.toTreeNode(self.nodeMap[parentId]));
          } else {
            callback(undefined);
          }
        } else {
          callback(undefined);
        }
      },

      // A node was clicked
      nodeClicked(node) {
        if (node.url) {
          window.recordEvent('fileBrowserNodeClicked', {
            httpTarget: node.url,
          });
          if (node.url.indexOf('http') === 0) {
            // this is an external link, open it in a new tab
            window.open(node.url, '_blank');
          } else {
            window.router.navigate(node.url, { trigger: true });
          }
          if (!self.fileTree.isPinned()) {
            self.toggleFileBrowser(false);
          }
        }
      },

      // Dropdown menu arrow was clicked
      dropdownClicked(node, opts) {
        let position;
        opts = opts || {};
        if (!opts.left) {
          const $dropdown = $(d3.event.target).closest('.dropdown');

          if ($dropdown.hasClass('active')) {
            self.hideContextMenu();
            return;
          }

          position = $dropdown.find('i').offset() || {};
          // adjust context menu position for clicking on caret arrow
          position.left -= 15;
          position.top += 18;
        } else {
          // adjust context menu position for right click
          position = {
            left: opts.left - 14,
            top: opts.top + 8,
          };

          // This is to address compatibility issue in Firefox, which magically hide the context
          // menu on mouseup event
          if (typeof InstallTrigger !== 'undefined') { // is Firefox
            $(document).one('mouseup', function() {
              setTimeout(function() {
                if (self.contextMenu.hasClass('active')) {
                  self.contextMenu.show();
                }
              }, 0);
            });
          }
        }

        const entry = self.nodeMap[node.id];

        self.resetContextMenu(self.contextMenu);

        self.renderMenu(
          self.contextMenu[0], entry, position.left, position.top, opts.isPanelContext);

        self.ensureRenderedInVisibleArea(
          self.contextMenu,
          window.innerHeight,
          window.innerWidth,
          position,
          entry,
          opts.isPanelContext);

        self.contextMenu.addClass('active');
      },

      nodeDropped(droppedNode, targetNode) {
        self.nodeDropped(droppedNode, targetNode);
      },

      dragStarted() {
        self.hideContextMenu();
      },
    };

    this.fileTree = new FileTree(this.$el, this.treeProvider,
      { bigFirstLevel: true, dragAndDrop: true, scrollElement: $('body'), pinnable: true });

    // Show and hide the menu using the button in the topbar
    this.fileBrowserOpen = false;

    this.fileBrowserDiv = $('#filebrowser-popup .filebrowser');
    this.fileBrowserDiv.attr({ 'data-state': 'invisible' });  // Attributes for Selenium to see
    this.fileBrowserDiv.attr({ 'data-history-size': window.router.RECENT_VIEWS_TO_KEEP });

    this.searchPanelOpen = false;
    this.searchPanelInTransit = false;
    this.searchPanelDiv = $('#searchpanel-popup .searchpanel');
    this.searchPanelDiv.attr({ 'data-state': 'invisible' });  // For Seleniun tests

    const SearchPanelViewFactory = React.createFactory(SearchPanelView);
    const searchPanelElem = SearchPanelViewFactory({
      topLevelFolders: this.topLevelFolders,
      toggleSearchPanelFunc() { self.toggleSearchPanel(false); },
      closeFileBrowserFunc() { self.toggleFileBrowser(false, true, true, false); },
      navigateFunc(url) {
        if (url.indexOf('http') === 0) {
          // open external links in a new tab
          window.open(url, '_blank');
        } else {
          window.router.navigate(url.substring(1), { trigger: true });
        }
      },
      enableFullTextSearch: window.settings.enableFullTextSearch,
      searchPlaceholder: 'Search Workspace',
    });
    this.searchPanelView = ReactDOM.render(searchPanelElem, this.searchPanelDiv[0]);

    // Whether or not we've queued a FileTree refresh; we use this to avoid re-rendering the
    // FileTree multiple times when multiple items change in one JavaScript event handler
    // (e.g. a folder is deleted or the table list is refreshed)
    this.refreshQueued = false;

    // Make sure content has a left of only the fixed sidebar width set in its
    // element.style so that it doesn't jump the first time we animate it
    d3.selectAll(WorkspaceConstants.RIGHT_PANE_SELECTOR).style('left', SIDEBAR_WIDTH + 'px');

    // local stored preferences
    this.localPref = new LocalUserPreference('fileBrowserView');

    // TODO: unregister search panel event handlers when view is removed
    this.render();
  },

  /**
   * Loads this directory from the backend, if it is not already fully loaded. If lazy sidebar
   * loading is not enabled, assumes all directories are loaded.
   */
  _withDirectoryLoaded(treeNode, callback) {
    if (!this.loadedDirectories.get(treeNode.id) && window.settings.enableLazySidebar) {
      const childIdsToValidate = treeNode.children.map((child) => child.id);
      window.conn.loadDirectory(treeNode.id, childIdsToValidate, callback);
      this.loadedDirectories.set(treeNode.id, true);
    } else {
      callback();
    }
  },

  /**
   * Invalidates all currently loaded directories, which forces a re-fetch when the user clicks
   * into them again. This should be called whenever we lose fall behind the change delta stream
   * for the sidebar and cannot recover.
   */
  invalidateLoadedDirectories() {
    console.debug('Marking all loaded directories as invalid', this.loadedDirectories);
    this.loadedDirectories.clear();
    this.fileTree.refreshAllNodes();
  },

  /**
   * Registers listener events on the given collection.
   * @param defaultParentId The default parent id to use if a model doesn't contain a parentId
   *                        attribute.
   * @param collection The Backbone collection to listen on.
   */
  registerEventHandlers(defaultParentId, collection, overrideParentId) {
    const self = this;

    this.listenTo(collection, 'add', function(model) {
      window.nodeMap = self.nodeMap;
      // For a new node, first add it to nodeMap, and then update its parent's children list.
      const id = getNodeMapKey(model);
      const parentId = (!overrideParentId && model.get('parentId')) || defaultParentId;

      // Check if a child has already added me to the nodeMap, if so use the "child" array it set
      const children = id in self.nodeMap ? self.nodeMap[id].children : [];

      self.nodeMap[id] = {
        id: id,
        model: model,
        expanded: true,
        children: children,
      };

      // If your parent is not yet in the node map, create it with a "child" array containing
      // your own id
      if (!(parentId in self.nodeMap)) {
        self.nodeMap[parentId] = {
          children: [],
        };
      }

      self.nodeMap[parentId].children.push(self.nodeMap[id]);

      if (self.fileTree && (self.fileBrowserOpen || self.searchPanelOpen)) {
        self.queueFileTreeRefresh();
      }
    });

    this.listenTo(collection, 'change', function(model) {
      // Moving a node in a FileTree updates the parentId
      const changedAttributes = model.changedAttributes();
      if (changedAttributes && changedAttributes.hasOwnProperty('parentId')) {
        const id = getNodeMapKey(model);
        const oldParentId = model.previousAttributes().parentId;
        const newParentId = model.get('parentId');

        // If your new parent is not yet in the node map, create it
        // When it is actually added in the "add" listener, it will acquire this child correctly
        if (!(newParentId in self.nodeMap)) {
          self.nodeMap[newParentId] = {
            children: [],
          };
        }

        const node = self.nodeMap[id];
        const oldParentNode = self.nodeMap[oldParentId];
        const newParentNode = self.nodeMap[newParentId];

        // Remove the node from its old parent
        if (oldParentNode !== undefined && oldParentNode.children !== undefined) {
          oldParentNode.children = _.without(oldParentNode.children, node);
        }

        // Append the moved node to its new parent
        newParentNode.children.push(node);
      }

      if (self.fileTree && (self.fileBrowserOpen || self.searchPanelOpen)) {
        self.queueFileTreeRefresh();
      }
    });

    this.listenTo(collection, 'remove', function(model) {
      // For a new node,  remove it from nodeMap and from its parent's children list.
      const id = getNodeMapKey(model);
      const node = self.nodeMap[id];
      const parentNode = self.nodeMap[
        (!overrideParentId && model.get('parentId')) || defaultParentId];

      // If the parent node is already gone, no need to remove it from the parent's children list.
      // This can happen in a recursive delete, where we are deleting the parent first and then
      // deleting all its children.
      if (parentNode !== undefined && parentNode.children !== undefined) {
        parentNode.children = _.without(parentNode.children, node);
      }
      delete self.nodeMap[id];

      if (!node) {
        // logging to help debug PROD-6734
        console.warn('FileBrowserView got remove event for unknown node', id, model);
      }

      // Recursively remove all child nodes.
      if (node && node.children && node.children.length > 0) {
        for (let i = 0; i < node.children.length; i++) {
          self.getModelFromEntry(node.children[i]).destroy();
        }
      }

      if (self.fileTree && (self.fileBrowserOpen || self.searchPanelOpen)) {
        self.queueFileTreeRefresh();
      }
    });
  },

  /**
   * Remove under scores from examples folders and uppercase first letter of each word
   */
  _renameExample(name) {
    let newName = name.replace(/_/g, ' ');
    newName = newName.replace(/\b\w/g, function(w) {
      return w.toUpperCase();
    });
    return newName;
  },

  /**
   * A helper function used to convert a tree entry object from our model to one that is
   * renderable by FileTree or the search browser. Resolves the name, icon, etc of the entry.
   */
  toTreeNode(entry) {
    const model = this.getModel(entry.id);
    const type = model.get('type');
    const id = getNodeMapKey(model);
    const hasChildren = (entry.id >= 0 && type === 'folder') || entry.id === WORKSPACE_ID;
    const icons = FileBrowserUtils.iconsForModel(model);
    let name = model.get('name');

    if (model.get('isExample') && (model.get('parentId') === 0)) {
      name = this._renameExample(name);
    }

    const isSystemFolder = FileBrowserUtils.isSystemFolder(model);
    const isHomeFolder = FileBrowserUtils.isHomeFolder(model);

    let domAttr = {};
    if (type === 'shell') {
      if (model.get('clusterReady')) {
        domAttr = { 'data-cluster-ready': true };
      } else {
        domAttr = { 'data-cluster-ready': false };
      }
    }

    // Pass a URL for anything except folders, because you can't currently browse to one.
    let url;
    if (entry.url) {
      url = entry.url;
    } else if (model.has('viewRoute')) {
      url = '#' + model.get('viewRoute');
    } else if (model.get('type') === 'shell') {
      url = '#notebook/' + entry.id;
    } else if (model.get('type') !== 'folder') {
      url = '#' + type + '/' + entry.id;
    }

    // Create an annotation for the percent cached if this is a table
    let annotation = '';
    if (type === 'table') {
      domAttr = { 'data-cache-state': 'uncached' };
      if (model.has('fractionCached')) {
        const percent = Math.round(model.get('fractionCached') * 100);
        if (percent === 100) {
          annotation = String.fromCharCode(0x2713);
          domAttr = { 'data-cache-state': 'cached' };
        } else if (percent > 0 || model.get('progress') === true) {
          annotation = percent + '%';
          domAttr = { 'data-cache-state': 'in-progress' };
        }
      }
      if (model.has('hasError') && model.get('hasError') === true) {
        console.error('Table ', model.get('name'), ' has error:', model.get('comments'));
      }
    }

    const hidden = model.get('hidden') === true;
    const draggable = isNodeMoveable(model);
    const droppable = hasChildren && !model.get('isExample');
    const isExample = entry.isExample || NavFunc.isExampleNode(id);
    const sortIndex = model.get('sortIndex');

    return {
      id: id,
      name: name,
      icon: icons.icon,
      openIcon: icons.openIcon,
      url: url,
      hasChildren: hasChildren,
      draggable: draggable,
      droppable: droppable,
      hidden: hidden,
      hasMenu: entry.hasMenu !== false,
      isExample: isExample,
      isSystemFolder: isSystemFolder,
      isHomeFolder: isHomeFolder,
      domAttributes: domAttr,
      annotationText: annotation,
      display: entry.display || model.get('display'),
      sortIndex: sortIndex,
    };
  },

  /**
   * The position of the left edge of the FileBrowserView, including the seachpanel and the
   * filebrowser views (which ever has the margin farthest to the left).
   */
  leftMargin() {
    const fileBrowserLeftMargin = this.fileBrowserOpen ?
        this.fileBrowserDiv.outerWidth() + SIDEBAR_WIDTH : SIDEBAR_WIDTH;
    const searchPanelLeftMargin = this.searchPanelOpen ?
        this.searchPanelDiv.outerWidth() + SIDEBAR_WIDTH : SIDEBAR_WIDTH;
    return Math.max(fileBrowserLeftMargin, searchPanelLeftMargin);
  },

  showFileBrowser() {
    if (!this.fileBrowserOpen) {
      this.toggleFileBrowser();
    }
  },

  hideFileBrowser() {
    if (this.fileBrowserOpen) {
      this.toggleFileBrowser();
    }
  },

  /**
   * Toggle showing the file browser menu.
   *
   * NOTE: this uses D3 to animate the position of the menu and #overallView div because FileTree
   * uses that internally, and we want the animations to sync up and cancel each other correctly
   * (see PROD-774).
   *
   * @param shouldShow only toggle if shouldShow != isCurrentlyOpen. Defaults to !isCurrentlyOpen
   * @param moveContent shift the content view to align with the right edge of the filebrowser
   *   as it opens/closes. If false, the content view will not move.
   * @param forceUpdate force the filebrowser to update, even if it is already opened/closed.
   * @param closeSearch close the search panel (which always is above the first filebrowser
   *   pane if it is visible). Defaults to true.
   * @param ignoreInTransit still perform the transition even if the filebrowser is in transit. We
   *                        want to allow the user to expand and collapse the sidebar even if it
   *                        hasn't finished the previous transition.
   */
  toggleFileBrowser(shouldShow, moveContent, forceUpdate, closeSearch, ignoreInTransit) {
    if (!ignoreInTransit && this.fileBrowserDiv.hasClass('in-transit')) {
      console.log('Ignored toggleFileBrowser call because the file browser is in transit.');
      return;
    }

    window.recordEvent('toggleFileBrowser');
    // don't consider the filebrowser open if the search panel is open
    // because search overlays the filebrowser and "uses" it to preview folders
    // TODO (jeffpang) PROD-3419: refactor the filebrowser out of FileBrowserView so the
    // SearchPanelView can have a separate copy to manipulate and we don't have to overlay them
    this.fileBrowserOpen = this.fileBrowserOpen && !this.searchPanelOpen;
    shouldShow = (shouldShow !== undefined ? shouldShow : !this.fileBrowserOpen);

    // This is a cludge that only exists when we have two components responsible for showing and
    // hiding the fileBrowser (the fileBrowser itself and the sidebar). In the future, the sidebar
    // should be fully responsible, and this will not be necessary.
    window.sidebar.ensureStateInSyncWithFileBrowser(shouldShow);

    moveContent = (moveContent !== undefined ? moveContent : true);
    closeSearch = (closeSearch !== undefined ? closeSearch : true);
    const _this = this;
    if (shouldShow !== this.fileBrowserOpen || forceUpdate) {
      this.fileBrowserDiv.toggleClass('in-transit', true);
      const browserDiv = this.fileBrowserDiv;
      let browserWidth;
      if (shouldShow) {
        this.fileTree.refreshAllNodes();
        this.refreshQueued = false;
        if (closeSearch) {
          this.toggleSearchPanel(false, false);
        }
        browserDiv.show();
        browserWidth = browserDiv.outerWidth();
        d3.select(browserDiv[0]).style('left', -browserWidth + 'px');
        d3.select(browserDiv[0]).transition().style('left', '0px').each('end', function() {
          browserDiv.attr({ 'data-state': 'visible' });
          _this.fileBrowserDiv.toggleClass('in-transit', false);
        });
        this.fileBrowserOpen = true;
        if (moveContent) {
          d3.selectAll(WorkspaceConstants.RIGHT_PANE_SELECTOR).transition().style(
            'left', this.leftMargin() + 'px');
        }
        this.fileTree.setPushElement(WorkspaceConstants.RIGHT_PANE_SELECTOR);

        // PROD-1659, PROD-1577: navigate the workspace to the last notebook opened
        // We delay opening the fileTree to the node here rather than immediately when the
        // notebook is clicked because our default behavior currently is to hide the
        // file browser upon clicking any link. We don't want the file browser expansion
        // and hiding animations to occur at the same time.
        if (this.nodeIdToOpenOnShowFileBrowser in this.nodeMap) {
          const node = this.toTreeNode(this.nodeMap[this.nodeIdToOpenOnShowFileBrowser]);
          this.fileTree.openToNode(node);
          this.nodeIdToOpenOnShowFileBrowser = undefined;
        }
      } else {
        browserWidth = browserDiv.outerWidth();
        d3.select(browserDiv[0]).transition().style('left', -browserWidth + 'px')
          .each('end', function() {
            browserDiv.hide();
            browserDiv.attr({ 'data-state': 'invisible' });
            _this.fileBrowserDiv.toggleClass('in-transit', false);
          });
        this.fileBrowserOpen = false;
        if (moveContent) {
          d3.selectAll(WorkspaceConstants.RIGHT_PANE_SELECTOR).transition().style(
            'left', this.leftMargin() + 'px');
        }
        this.fileTree.setPushElement(null);
      }
    }
  },

  /**
   * Toggle showing the search panel.
   *
   * NOTE: this uses D3 to animate the position of the menu and #overallView div because FileTree
   * uses that internally, and we want the animations to sync up and cancel each other correctly
   * (see PROD-774).
   */
  toggleSearchPanel(shouldShow, moveContent, ignoreInTransit) {
    if (!ignoreInTransit && this.searchPanelInTransit) {
      console.log('Ignored toggleSearchPanel call because the search panel is in transit.');
      return;
    }
    shouldShow = (shouldShow !== undefined ? shouldShow : !this.searchPanelOpen);

    // This is a cludge that only exists when we have two components responsible for showing and
    // hiding the fileBrowser (the fileBrowser itself and the sidebar). In the future, the sidebar
    // should be fully responsible, and this will not be necessary.
    window.sidebar.ensureStateInSyncWithSearchPanel(shouldShow);

    moveContent = (moveContent !== undefined ? moveContent : true);
    const _this = this;
    if (shouldShow !== this.searchPanelOpen) {
      this.searchPanelInTransit = true;
      const panelDiv = this.searchPanelDiv;
      let panelWidth;
      if (!this.searchPanelOpen) {
        this.fileTree.refreshAllNodes();
        this.refreshQueued = false;
        this.toggleFileBrowser(false, false);
        panelDiv.show();
        panelWidth = panelDiv.outerWidth();
        d3.select(panelDiv[0]).style('left', -panelWidth + 'px');
        d3.select(panelDiv[0]).transition().style('left', '0px').each('end', function() {
          panelDiv.attr({ 'data-state': 'visible' });
          _this.searchPanelInTransit = false;
        });
        this.searchPanelView.onShowPanel();
        this.searchPanelOpen = true;
        if (moveContent) {
          d3.selectAll(WorkspaceConstants.RIGHT_PANE_SELECTOR).transition().style(
            'left', this.leftMargin() + 'px');
        }
      } else {
        panelWidth = panelDiv.outerWidth();
        d3.select(panelDiv[0]).transition().style('left', -panelWidth + 'px')
          .each('end', function() {
            panelDiv.hide();
            panelDiv.attr({ 'data-state': 'invisible' });
            _this.searchPanelInTransit = false;
          });
        this.searchPanelView.onHidePanel();
        this.searchPanelOpen = false;
        if (moveContent) {
          d3.selectAll(WorkspaceConstants.RIGHT_PANE_SELECTOR).transition().style(
            'left', this.leftMargin() + 'px');
        }
      }
    }
  },

  /**
   * Return the model for the node given its id.
   * This also works for special TreeNode models that can not be found in window.treeCollection
   * including the Workspace root folder
   */
  getModel(id) {
    if (id === WORKSPACE_ID) {
      return new TreeNode({ id: WORKSPACE_ID, name: 'Workspace', type: 'folder' });
    }
    return this.getModelFromEntry(this.nodeMap[id]);
  },

  /**
   * Return the model from an entry node (e.g. an entry inside of this.nodeMap)
   */
  getModelFromEntry(entry) {
    // TODO(jeffpang): We can remove this hacky check once we switch over to react notebooks
    // and we insert the NotebookModel in the treeCollection initially rather than when
    // getNotebookModel is called for the first time (which causes the copy in the nodeMap
    // to become stale
    const model = window.treeCollection.get(entry.id);
    if (model) {
      return model;
    }
    return entry.model;
  },

  /**
   * Return the path of a given node based on its id.
   */
  getFullPath(id) {
    const model = this.getModel(id);
    // Skip parentId == 0 to not show the top level "Workspace".
    if (!model.has('parentId') || model.get('parentId') === 0) {
      return model.get('name');
    }
    return this.getFullPath(model.get('parentId')) + '/' + model.get('name');
  },

  /**
   * Return the id for a node given it's path (and optionally nodetype).
   * If multiple instances exist return the first one
   */
  getIDFromFullPath(specifiedPath, nodeType) {
    const self = this;
    const parsedPath = specifiedPath.split('/');
    let parentId = 0;
    let scanSet = this.nodeMap[0].children;

    function filterFunction(i, targetParentId, targetParsedPath, targetNodeType) {
      return function(node) {
        const model = self.getModelFromEntry(node);
        return model.get('name') === targetParsedPath[i] &&
          model.get('parentId') === targetParentId &&
          model.get('type') === (i === targetParsedPath.length - 1 ? targetNodeType : 'folder');
      };
    }

    for (let i = 0; i < parsedPath.length; i++) {
      const results = scanSet.filter(filterFunction(i, parentId, parsedPath, nodeType));
      if (results.length === 0) {
        return null;
      } else if (i === parsedPath.length - 1) {
        return results[0].id;
      }
      parentId = results[0].id;
      scanSet = results[0].children;
    }
  },

  /**
   * Return the number of nodes in the subtree of the given node.
   */
  getNumDescendants(id) {
    const children = this.nodeMap[id].children;
    if (children === undefined) {
      return 0;
    }
    let numDescendants = children.length;
    for (let i = 0; i < children.length; i++) {
      numDescendants += this.getNumDescendants(children[i].id);
    }
    return numDescendants;
  },

  createNode(attributes, successCallback) {
    const self = this;
    if (attributes.parentId === undefined) {
      attributes.parentId = 0;
    }
    self.model.create(attributes, {
      wait: true,
      success(model) {
        if (attributes.type !== 'folder' && !self.fileTree.isPinned()) {
          self.toggleFileBrowser(false);
        }
        if (successCallback !== undefined) {
          successCallback(model);
        }
      },
      error(model, response) {
        DeprecatedDialogBox.alert(
          'Creating the element failed: ' + response.statusText);
      },
    });
  },

  // This is only used for new React notebook view, and only for creating new notebooks
  // TODO (Chaoyu): we should use notebook handler for notebook import/clone/deletion
  createNotebook(attributes, successCallback) {
    const self = this;

    if (attributes.parentId === undefined) {
      attributes.parentId = 0;
    }

    $.ajax({
      context: this,
      type: 'POST',
      url: '/notebook',
      data: JSON.stringify(attributes),
      contentType: 'application/json; charset=utf-8',
      dataType: 'json',
      success(model) {
        TimingUtils.retryUntil({
          condition() {
            // We recieve a model back from this request, however, we must wait until it's
            // available in the treeCollection before proceeding.
            if (window.treeCollection.get(model.id)) {
              return true;
            }
            return false;
          },
          success() {
            if (!self.fileTree.isPinned()) {
              self.toggleFileBrowser(false);
            }
            if (successCallback) {
              const realModel = window.treeCollection.get(model.id);
              successCallback(realModel);
            }
          },
          error() {
            console.error('Notebook with id ' + model.id + ' did not appear in tree collection');
          },
          interval: 50,
          maxAttempts: 20,
        });
      },
      error(jqXHR, textStatus, errorThrown) {
        DeprecatedDialogBox.alert('Creating notebook failed: ' + errorThrown);
      },
    });
  },

  getDeleteNodeCallback(model) {
    if (model.get('type') === 'table') {
      return DeleteNodeCallbacks.getTableCallback(model);
    } else if (model.get('type') === 'library') {
      return DeleteNodeCallbacks.getLibraryCallback(model);
    }
  },

  /**
   * Delete a node. This shows a dialog asking users to confirm before deleting.
   * Code located in NavFunc in order to be used outside the FileBrowserView.
   */
  deleteNode(id) {
    const model = this.getModel(id);
    const numDescendants = this.getNumDescendants(id);
    const callback = this.getDeleteNodeCallback(model);
    NavFunc.deleteNode(id, model, numDescendants, callback);
  },

  /**
   * Rename a node. Code located in NavFunc in order to be used outside
   * the FileBrowserView.
   */
  renameNode(id) {
    const model = this.getModel(id);
    NavFunc.renameNode(id, model);
  },

  _moveNodes(nodesToMove, destNode) {
    const filetree = this;

    NavFunc.moveNodes(nodesToMove, destNode, filetree);

    this.fileTree.openToNode(destNode);
  },

  moveNode(id) {
    const self = this;

    const srcNode = this.getModel(id);

    if (!srcNode) {
      return;
    }

    const controls = [
      {
        controlType: 'filetreePath',
        pathlabel: 'Moving to folder: ',
      },
      {
        controlType: 'filetree',
        id: 'picker',
        nodeType: 'folder',
        hideExamples: true,
      },
    ];

    if (srcNode.get('type') === 'folder') {
      controls.push({
        label: "Move all items in '" + srcNode.get('name') + "' rather than the folder itself." +
          (window.settings.enableWorkspaceAclsConfig ?
           ' Permissions may change for these items.' : ''),
        labelLeft: true,
        controlType: 'input',
        type: 'checkbox',
        id: 'moveContentsOnly',
      });
    }

    const moveDialog = DeprecatedDialogBox.custom({
      title: "Moving '" + srcNode.get('name') + "'",
      confirmButton: 'Select',
      class: 'move-file-dialog',
      controls: controls,
      confirm(dialog) {
        const destNode = dialog.find('#picker')[0].fileTree.selectedFolder().node;
        const moveContentsElem = dialog.find('#moveContentsOnly')[0];
        const moveContentsOnly = moveContentsElem && moveContentsElem.checked;

        if (!moveContentsOnly) {
          // Show ACL permission change dialog for individual items if ACLs are on
          const moveNode = self._moveNodes.bind(self, [srcNode], destNode);
          if (window.settings.enableWorkspaceAclsConfig) {
            self.checkAndPreviewPermission(srcNode, destNode.id, moveNode);
          } else {
            moveNode();
          }
        } else {
          const nodesToMove =
            moveContentsOnly ? window.treeCollection.where({ parentId: id }) : [srcNode];
          self._moveNodes(nodesToMove, destNode);
        }
      },
    });

    if (srcNode) {
      const parentFolder = this.getModel(srcNode.get('parentId'));
      const parentTreeNode = this.toTreeNode(parentFolder);
      moveDialog.find('#picker')[0].fileTree.openToNode(parentTreeNode);
    }
  },

  _nodeSortGroup(node) {
    if (node.sortIndex !== undefined) {
      return 0;
    } else if (node.isExample) {
      return 1;
    } else if (node.isSystemFolder) {
      return 2;
    }
    return 3;
  },

  // Function for sorting entries in a tree panel. Uses default alphabetic sort, but puts
  // examples and system folders ahead of everything else.
  _nodeSortFunc(a, b) {
    const aGroup = this._nodeSortGroup(a);
    const bGroup = this._nodeSortGroup(b);

    if (aGroup !== bGroup) {
      return aGroup - bGroup;
    } else if (aGroup === 0 && a.sortIndex !== b.sortIndex) {
      // Use sort index for sorting elements with a specified sort index
      return a.sortIndex - b.sortIndex;
    }
    // Use default sorting if we are not dealing with specials, or if both are specials
    return a.name.localeCompare(b.name);
  },

  /**
   * Sets the sort index for node with id nodeId.
   * @param nodeId the id of the node to be modified
   * @param index the new index of the node
   */
  setSortIndexForNode(nodeId, index) {
    const model = this.getModel(nodeId);
    if (nodeId > 0) {
      model.set({ sortIndex: index });
      model.save({ sortIndex: index }, { patch: true });
    }
    this.queueFileTreeRefresh();
  },

  /**
   * Returns the sort index for node with id nodeId.
   * @param nodeId the id of the node to be queried
   * @returns {*} the index of that node in its containing folder
   */
  sortIndexForNode(nodeId) {
    const model = this.getModel(nodeId);
    return model.get('sortIndex');
  },

  //////////////////////////////////////////////////////////////////////////////////////////////
  // Private functions
  //////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Renders the context menu for nodes. This is somewhat complicated to accommodate for
   * all the constraints we have.
   *
   * Returns true if there is a context menu to be shown.
   */
  renderMenu(domElement, node, x, y, isPanelContext) {
    const self = this;
    if (node.menu && node.menu.length === 0 && node.nonRemovable) {
      return false;
    }

    const workspaceAclsEnabled = window.settings && window.settings.enableWorkspaceAclsConfig;

    const model = this.getModel(node.id);
    const isExample = model.get('isExample');
    const nodeType = model.get('type');
    const isTopLevelNode = model.id <= 0; // Top-level node IDs are less or equal to zero
    const allowsCreation = nodeType === 'folder' &&
        !model.get(WorkspaceConstants.NoChildrenAttribute) && !isExample;
    const isExportable = nodeType === 'shell' || nodeType === 'dashboard' || nodeType === 'folder';
    const isSourceExportable = nodeType === 'shell';
    const isHtmlExportable = (nodeType === 'shell' ||
      (nodeType === 'folder' && window.settings.enableFolderHtmlExport));
    const isIPythonExportable = nodeType === 'shell' && model.get('language') === 'python';
    const isCloneable = (nodeType === 'shell' || nodeType === 'dashboard' ||
      nodeType === 'folder') && !isTopLevelNode;
    const isPermissionModifiable = (!isTopLevelNode || model.id === WORKSPACE_ID) &&
      FileBrowserUtils.isPermissionModifiable(model);
    const isRemovable =
      !node.nonRemovable &&
      !isExample &&
      !model.get(WorkspaceConstants.NonModifiableAttribute);
    const isRenameable = isRemovable && nodeType !== 'table' && nodeType !== 'library';
    const isMoveable = isNodeMoveable(model);

    // Remove the old active widget
    this.$('div.dropdown.active').removeClass('active');

    const menuElement = d3.select(domElement);
    menuElement.on('contextmenu', function() {
      // don't show system context menu when right click on dropdown menu
      d3.event.preventDefault();
    });
    menuElement.attr('data-id', node.id);
    menuElement.style('display', 'block')
        .attr('role', 'menu')
        .classed('dropdown-menu', true)
        .style('left', x + 'px')
        .style('top', y + 'px')
        .html('');

    // Helper function used in various event handlers
    const addMenuItem = function(parentElement, name, action) {
      const newItem = parentElement.append('li').append('a')
        .attr('href', '#').attr('data-name', name).text(name);
      newItem.on('click', function() {
        window.recordEvent('menuItemClicked', {
          parentMenuName: model.get('name'),
          menuName: name,
        });
        action();
        $(domElement).hide();
        self.$('div.dropdown.active').removeClass('active');
        d3.event.preventDefault();
      });
      return newItem;
    };

    if (node.menu) {
      menuElement.selectAll('li').data(node.menu)
        .enter().append('li').append('a')
        .attr('href', '#')
        .attr('data-name', function(d) { return d.name; })  // For Selenium testing
        .text(function(d) { return d.name; })
        .on('click', function(d) {
          d.action(node);
          $(domElement).hide();
          self.$('div.dropdown.active').removeClass('active');
          d3.event.preventDefault();
        });
    }

    // Add the Create submenu
    let createAnchor;
    let createSubMenuAnchor;
    if (allowsCreation) {
      createSubMenuAnchor = menuElement.append('li').classed('dropdown-submenu', true);
      createAnchor = createSubMenuAnchor.append('a')
        .attr('href', '#').attr('data-name', 'Create').text('Create')
        .on('click', function() { d3.event.preventDefault(); });
      const createSubMenu = createSubMenuAnchor.append('ul').classed('dropdown-menu', true);
      addMenuItem(createSubMenu, 'Notebook', function() {
        NavFunc.addReactNotebook(node.id);
      });
      addMenuItem(createSubMenu, 'Library', function() {
        NavFunc.addLibrary(node.id);
        self.toggleFileBrowser(false);
      });
      addMenuItem(createSubMenu, 'Folder', function() {
        NavFunc.addFolder(node.id);
      });
    }

    let cloneAnchor;
    if (isCloneable && !isPanelContext) {
      cloneAnchor = addMenuItem(menuElement, 'Clone', function() {
        NavFunc.cloneNode(node.id);
        d3.event.preventDefault();
      });
    }

    let renameAnchor;
    if (isRenameable && !isPanelContext) {
      renameAnchor = addMenuItem(menuElement, 'Rename', function() {
        self.renameNode(node.id);
        d3.event.preventDefault();
      });
    }

    let moveAnchor;
    if (isMoveable && !isPanelContext) {
      moveAnchor = addMenuItem(menuElement, 'Move', function() {
        self.moveNode(node.id);
        d3.event.preventDefault();
      });
    }

    let removeAnchor;
    if (isRemovable && !isPanelContext) {
      removeAnchor = addMenuItem(menuElement, 'Delete', function() {
        self.deleteNode(node.id);
        d3.event.preventDefault();
      });
    }

    // Add the Import menu item
    let importAnchor;
    if (allowsCreation) {
      importAnchor = addMenuItem(menuElement, 'Import', function() {
        NavFunc.importItem(node.id);
      });
    }

    let exportAnchor;
    let exportSubmenuAnchor;
    if (isExportable && !isPanelContext) {
      exportSubmenuAnchor = menuElement.append('li').classed('dropdown-submenu', true);
      exportAnchor = exportSubmenuAnchor.append('a')
        .attr('href', '#').attr('data-name', 'Export').text('Export')
        .on('click', function() { d3.event.preventDefault(); });
      const exportSubMenu = exportSubmenuAnchor.append('ul').classed('dropdown-menu', true);
      addMenuItem(exportSubMenu, 'DBC Archive', function() {
        NavFunc.exportItem(node.id);
        d3.event.preventDefault();
      });
      if (isSourceExportable) {
        addMenuItem(exportSubMenu, 'Source File', function() {
          NavFunc.exportSource(node.id);
          d3.event.preventDefault();
        });
      }
      if (isHtmlExportable && (window.settings.enableStaticNotebooks || window.testMode)) {
        addMenuItem(exportSubMenu, 'HTML', function() {
          NavFunc.exportHTML(node.id);
        });
      }
      if (isIPythonExportable && window.settings.enableIPythonImportExport) {
        addMenuItem(exportSubMenu, 'IPython Notebook', function() {
          NavFunc.exportIPython(node.id);
          d3.event.preventDefault();
        });
      }
    }

    let editPermission;
    if (isPermissionModifiable) {
      editPermission = addMenuItem(menuElement, 'Permissions', function() {
        d3.event.preventDefault();

        window.recordEvent('notebookActionsClicked', BrowserUtils.getMeasurementTags({
          actionSelected: 'openPermissions',
        }));

        model.fetchWorkspaceAcl(function() {
          const editPermissionView = React.createElement(PermissionEditView, {
            workspaceAcl: model.get('workspaceAcl'),
          });
          ReactModalUtils.createModal(editPermissionView);
        });
      });
      if (!workspaceAclsEnabled) {
        editPermission.attr('disabled', true);
      }
    }

    if (workspaceAclsEnabled && (nodeType === 'shell' || nodeType === 'folder') && node.id >= 0) {
      // disable remove link and edit permission link
      if (removeAnchor) {
        removeAnchor.attr('disabled', true);
      }
      if (moveAnchor) {
        moveAnchor.attr('disabled', true);
      }
      if (editPermission) {
        editPermission.attr('disabled', true);
      }
      if (createAnchor || createSubMenuAnchor) {
        createSubMenuAnchor.classed('dropdown-disabled', true);
        createAnchor.attr('disabled', true);
      }
      if (cloneAnchor) {
        cloneAnchor.attr('disabled', true);
      }
      if (renameAnchor) {
        renameAnchor.attr('disabled', true);
      }
      if (importAnchor) {
        importAnchor.attr('disabled', true);
      }
      if (exportAnchor || exportSubmenuAnchor) {
        exportSubmenuAnchor.classed('dropdown-disabled', true);
        exportAnchor.attr('disabled', true);
      }

      // fetch node permissionlevel
      model.fetchPermissionLevel(function() {
        // TODO(Jeff,Chaoyu) disable click on item if user don't have read permission
        if (this.canManage()) {
          if (removeAnchor) {
            removeAnchor.attr('disabled', null);
          }
          if (renameAnchor) {
            renameAnchor.attr('disabled', null);
          }
          if (moveAnchor) {
            moveAnchor.attr('disabled', null);
          }
          if (editPermission) {
            editPermission.attr('disabled', null);
          }
          if (createAnchor || createSubMenuAnchor) {
            createSubMenuAnchor.classed('dropdown-disabled', false);
            createAnchor.attr('disabled', null);
          }
          if (importAnchor) {
            importAnchor.attr('disabled', null);
          }
        }
        if (this.canView()) {
          if (cloneAnchor) {
            cloneAnchor.attr('disabled', null);
          }
          if (exportAnchor || exportSubmenuAnchor) {
            exportSubmenuAnchor.classed('dropdown-disabled', false);
            exportAnchor.attr('disabled', null);
          }
        }
      });
    }

    if (menuElement[0][0].childNodes.length === 0) {
      self.hideContextMenu();
    }

    return true;
  },

  /**
   * Update the recent items menu when we navigate to a new page. Called by Router.
   */
  updateRecentItems() {
    // For now we refresh the whole file tree since it doesn't support incremental updates
    this.fileTree.refreshAllNodes();
    this.refreshQueued = false;
  },

  /**
   * Return the IDs of all ancestors of a given node, including itself
   */
  getAncestors(id) {
    NavFunc.getAncestors(id);
  },

  /**
   * A node was dropped onto a potentially new parent
   */
  nodeDropped(droppedNode, targetNode) {
    const srcNode = this.getModel(droppedNode.id);
    const targetNodeId = targetNode.id;
    const moveNode = this._moveNodes.bind(this, [srcNode], targetNode);
    const nodeType = srcNode.get('type');

    if ((nodeType === 'shell' || nodeType === 'folder') &&
        window.settings && window.settings.enableWorkspaceAclsConfig) {
      this.checkAndPreviewPermission(srcNode, targetNodeId, moveNode);
    } else {
      moveNode();
    }
  },

  ensureRenderedInVisibleArea(
    contextMenu, innerHeight, innerWidth, position, entry, isPanelContext) {
    // check to make sure we rendered it in the visible area
    const contextMenuElement = contextMenu[0];
    const renderedPosition = contextMenuElement.getBoundingClientRect();
    const renderedPastWindowBottom = renderedPosition.bottom > innerHeight;
    const renderedPastWindowRight = renderedPosition.right > innerWidth;

    if (renderedPastWindowBottom || renderedPastWindowRight) {
      if (renderedPastWindowBottom) {
        // @NOTE(jengler) 2015-10-13: 27 is to account for the height of the context
        // views arrow.
        position.top = position.top - renderedPosition.height - 27;
        // moving up requires less offset than down to align with arrow
        contextMenu.addClass('above');
      }
      if (renderedPastWindowRight) {
        // @NOTE(jengler) 2015-10-13: 37 is to account for the left offset of the
        // the context menus arrow.
        position.left = position.left - renderedPosition.width + 37;
        contextMenu.addClass('left');
      }

      this.renderMenu(contextMenuElement, entry, position.left, position.top, isPanelContext);
    }
  },

  /**
   * Get the tree store model entry for a given page from its viewRoute, or null if it
   * doesn't have one.
   */
  entryFromViewRoute(viewRoute) {
    if (/^(shell\/|dashboard\/|notebook\/).*/.test(viewRoute)) {
      const id = viewRoute.substr(viewRoute.lastIndexOf('/') + 1);
      return this.toRecentNode(this.nodeMap[id]);
    } else if (/^table.*/.test(viewRoute)) {
      // The id for a table is "table-tableName", while the view route is "table/tableName".
      const tableName = viewRoute.substr(viewRoute.lastIndexOf('/') + 1);
      const table = this.tables.find(function(e) {
        return e.get('viewRoute') === viewRoute;
      });
      if (table) {
        return {
          id: '-table-' + tableName,
          uniqueId: tableName,
          type: RoutingConstants.TABLE_TYPE,
          name: tableName,
          icon: 'table',
          url: '#' + viewRoute,
        };
      }
      return null;
    } else if (viewRoute === 'setting/clusters') {
      return {
        id: '-recent-clusters',
        name: 'Clusters',
        icon: 'sitemap',
        url: '#setting/clusters',
      };
    } else if (viewRoute === 'setting/applications') {
      return {
        id: '-recent-applications',
        name: 'Applications',
        icon: 'th',
        url: '#setting/applications',
      };
    } else if (viewRoute === 'setting/accounts') {
      return {
        id: '-recent-accounts',
        name: 'Settings',
        icon: 'gear',
        url: '#setting/accounts',
      };
    } else if (viewRoute === 'joblist') {
      return {
        id: '-recent-jobs',
        name: 'Jobs',
        icon: 'calendar',
        url: '#joblist',
      };
    } else if (viewRoute === '') {
      return {
        id: '-recent-home',
        name: 'Home',
        icon: 'home',
        url: '',
      };
    }
    return null;
  },

  toRecentNode(entry) {
    if (entry) {
      const node = this.toTreeNode(entry);
      node.uniqueId = node.id;
      node.id = '-recent-' + node.id;
      node.type = RoutingConstants.NODE_TYPE;
      node.display = undefined;
      node.hasMenu = false;
      node.selectable = false;
      node.draggable = false;
      node.menu = [];
      return node;
    }
    return null;
  },

  resetContextMenu(contextMenu) {
    contextMenu.removeClass('above');
    contextMenu.removeClass('left');
  },

  /**
   * preview new permissions after node moved to target directory
   */
  checkAndPreviewPermission(nodeModel, targetNodeId, moveNode) {
    NavFunc.checkAndPreviewPermission(nodeModel, targetNodeId, moveNode);
  },

  /**
   * Mark a node id that the fileTree will open to the next time the file browser is opened.
   *
   * @param id the ID of the TreeNode to open the filebrowser to.
   * @param delay delay opening the filebrowser to this node until the next call to
   *   toggleFileBrowser() that opens the filebrowser. Defaults to true. We may want to delay
   *   opening to a node since the filebrowser may be closing or closed when this is called.
   */
  openToNodeId(id, delay) {
    delay = delay !== undefined ? delay : true;
    this.nodeIdToOpenOnShowFileBrowser = id;
    if (!delay) {
      this.toggleFileBrowser(true, true, true, false);
    }
  },

  hideContextMenu() {
    if (this.contextMenu.is(':visible')) {
      this.$('div.dropdown.active').removeClass('active');
      this.contextMenu.removeClass('active');
      this.contextMenu.hide();
    }
  },

  /**
   * Create a read-only TreeProvider used to select elements in the workspace.
   *
   * @param nodeType: (optional) restrict selection to certain types of nodes, e.g. notebooks
   *                             can be a libraryType (java-jar, python-pypi, etc.)
   *                             can be an array of nodeTypes
   */
  getReadOnlyTreeProvider(nodeType, hideExamples) {
    const self = this;
    const rootId = WORKSPACE_ID;
    const rootNode = new FileTree.Node(rootId, 'Workspace', null, true);

    const checkNodeType = function(itemType, targetNodeType) {
      return itemType === targetNodeType ||
                (targetNodeType instanceof Array && targetNodeType.includes(itemType));
    };

    const isRightType = function(entry) {
      const node = self.getModel(entry.id);
      const t = node.get('type');
      let lt;
      if (t === 'library') {
        lt = node.get('libraryType');
      }
      if (hideExamples && node.get('isExample')) {
        return false;
      }
      // Checks for the node type. Returns true if it's a folder, the specified node type, or
      // the specified library type.
      return (t === 'folder' || checkNodeType(t, nodeType) || checkNodeType(lt, nodeType) ||
              nodeType === undefined);
    };

    return {
      getRootNode() {
        return rootNode;
      },

      getChildren(node, callback) {
        if (node.id in self.nodeMap) {
          const treeNode = self.nodeMap[node.id];
          // Sort children alphabetically
          self._withDirectoryLoaded(treeNode, function() {
            const nodes = treeNode.children.filter(isRightType);
            const isVisible = function(entry) {
              return !entry.hidden || window.settings.showHidden;
            };
            callback(nodes.map(self.toTreeNode.bind(self)).filter(isVisible)
              .sort(self._nodeSortFunc.bind(self)));
          });
        } else {
          callback([]);
        }
      },

      getParent(node, callback) {
        if (node.id in self.nodeMap) {
          const parentId = self.getModel(node.id).get('parentId');
          if (parentId !== undefined && parentId === rootId) {
            callback(this.getRootNode());
          } else if (parentId !== undefined && parentId in self.nodeMap) {
            callback(self.toTreeNode(self.nodeMap[parentId]));
          } else {
            callback(undefined);
          }
        } else {
          callback(undefined);
        }
      },
    };
  },

  /**
   * Queue a refresh of the FileTree control. We call this every time anything in the table or
   * file collection changes and set the refresh to happen only once in case multiple files or
   * tables were updated at once (e.g. when a folder is deleted). Without this, we would have
   * repeated rendering that could slow down the browser (PROD-2870).
   */
  queueFileTreeRefresh() {
    const self = this;
    if (!self.refreshQueued) {
      window.setTimeout(function() {
        if (self.refreshQueued) {  // May have been canceled if user opened the file tree
          self.fileTree.refreshAllNodes();
          self.refreshQueued = false;
        }
      }, 0);
      self.refreshQueued = true;
    }
  },
}); // end of FileBrowserView

module.exports = FileBrowserView;
