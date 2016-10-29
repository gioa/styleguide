import Backbone from 'backbone';

import TreeNode from '../filebrowser/TreeNode';

import NotebookModel from '../notebook/NotebookModel';

import Dashboard from '../notebook/dashboards/Dashboard';

/**
 * A vanilla Backbone collection used to store a list of TreeNode's, i.e. this collection is
 * flat, and doesn't have a tree-like nested structure.
 *
 * The FileBrowserView is created to use this collection and present the nodes in a tree
 * structure.
 */
const TreeNodeCollection = Backbone.Collection.extend({
  model(attrs, options) {
    if (attrs.type === 'dashboard') {
      return new Dashboard(attrs, options);
    }
    // TODO(Chaoyu): use NotebookModel here after moving to React
    return new TreeNode(attrs, options);
  },

  // TODO(Chaoyu): remove this after moving notebooks to React (see TODO above)
  getNotebookModel(id) {
    let model = this.get(id);
    if (model && !(model instanceof NotebookModel)) {
      // replace our current model with a notebook version of this model
      model = new NotebookModel(model.attributes, { conn: window.conn });
      this.remove(id, { silent: true });
      this.add(model, { silent: true });
    }
    return model;
  },

  url: '/tree',
});

module.exports = TreeNodeCollection;
