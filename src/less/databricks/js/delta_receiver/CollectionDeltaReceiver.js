/* eslint complexity: 0, max-depth: 0 */

/**
 * Collection representing a set of items synchronized via the TreeStore. While the collection
 * is specified by a subtree, the view presented of the tree nodes is flat (i.e. no tree structure).
 *
 * See webapp/CollectionDeltaPublisher.scala and delta_receiver/CollectionDeltaReceiverView.js
 * for usage.
 */
import _ from 'underscore';
import Backbone from 'backbone';

const CollectionDeltaReceiver = Backbone.Collection.extend({
  startedWatching: false,

  /**
   * Sets the root node to watch for updates, and the type of model in the collection.
   */
  initialize(models, options) {
    if (options) {
      this.deltaPublisherRoot = options.deltaPublisherRoot;
      this.parent = options.parent;
    }
  },

  url() {
    return '/tree/' + this.deltaPublisherRoot + '/immediate_children';
  },

  startWatching() {
    if (!this.deltaPublisherRoot) {
      console.error('Delta publisher root not set: ' + this.deltaPublisherRoot);
      return;
    }
    if (!this.startedWatching) {
      this.fetchAndUpdate();
      window.conn.setDataHandler(
        '/' + this.deltaPublisherRoot + '/',
        _.bind(function updpateGivenItem(item) {
          this.updateItem(item);
        }, this)
      );
      this.startedWatching = true;
    }
  },

  stopWatching() {
    if (this.startedWatching) {
      this.startedWatching = false;
      window.conn.removeDataHandler('/' + this.deltaPublisherRoot + '/');
    }
  },

  fetchAndUpdate(opts) {
    const self = this;
    this.fetchAndUpdateXHR = Backbone.sync('read', this, {
      success(resp) {
        self.updateCollection(self, resp);
        if (opts && opts.success) {
          opts.success();
        }
      },
      error(resp) {
        console.error(resp);
        if (opts && opts.failure) {
          opts.failure();
        }
      },
    });
  },

  updateCollection(collection, response) {
    _.each(response, function setEachModelParent(model) {
      this.setModelParent(model);
    }, this);
    collection.reset(response);
  },

  setModelParent(model) {
    if (this.parent) {
      model.parent = this.parent;
    }
  },

  addItem(model) {
    this.setModelParent(model);
    return this.add(model);
  },

  updateItem(delta) {
    let model;
    let models = null;
    switch (delta.deltaEvent) {
      case 'create':
        // There are 3 cases here...
        // 1. The model exists with a newer version: ignore that and throw a warning.
        // 2. The model exists with an older version: update the model.
        // 3. The model doesn't exist: add the model.
        // The model does not yet exist. Then just add it.
        if (delta.guid !== undefined) {
          // Client-generated model ids are present - using them since backbone requires them.
          models = this.where({ guid: delta.guid });
        } else {
          // Otherwise fall back to treestore id.
          models = this.where({ id: delta.id });
        }
        if (models.length > 1) {
          console.error('DELTA: Serious! seeing multiple items with the same id', models);
        } else if (models.length === 1) {
          model = models[0];
          if (model.get('deltaVersion') > delta.deltaVersion) {
            if (window.prefs.get('debugDeltas')) {
              console.warn('DELTA: Asked to add an existent item', delta, model);
            }
          } else {
            models[0].set(delta, { deltaEvent: 'create' });
          }
        } else {
          this.addItem(delta);
        }
        break;

      case 'delete':
        model = this.get(delta.id);
        if (model === undefined) {
          if (window.prefs.get('debugDeltas')) {
            console.warn('DELTA: Asked to delete a non-existent item', delta);
          }
          return;
        } else if (model.get('deltaVersion') >= delta.deltaVersion) {
          console.error('DELTA: Asked to delete a newer version', delta, model);
          return;
        }
        this.remove(delta);
        break;

      case 'update':
        model = this.get(delta.id);
        if (model === undefined) {
          if (window.prefs.get('debugDeltas')) {
            console.warn("Delta update asked to update an item that doesn't exist", delta);
          }
          return;
        } else if (model.get('deltaVersion') >= delta.deltaVersion) {
          console.error('DELTA: Asked to update a newer version', delta, model);
          return;
        }
        model.set(delta, { deltaEvent: 'update' });
        break;

      case 'full':
        // PROD-4251: Some notebooks from ages ago appear to have guid set to the empty string
        // so we check whether guid is truthy rather than defined so that old notebooks still work
        if (delta.guid) {
          // Client-generated model ids are present - using them since backbone requires them.
          models = this.where({ guid: delta.guid });
        } else {
          // Otherwise fall back to treestore id.
          models = this.where({ id: delta.id });
        }
        if (models.length > 1) {
          console.error('DELTA: Serious! seeing multiple items with the same id', models);
        } else if (models.length === 1) {
          model = models[0];
          if (model.get('deltaVersion') > delta.deltaVersion) {
            if (window.prefs.get('debugDeltas')) {
              console.warn('DELTA: Asked to add an existent item', delta, model);
            }
          } else if (delta.guid && delta.guid !== model.get('guid')) {
            // If the delta has a GUID, check that it is equal to the model's GUID
            console.error('Delta GUID does not match Model GUID!', delta, model);
          } else if (model.id && delta.id !== model.id) {
            // If the model has an ID, check that it is equal to the delta's ID
            console.error('Delta ID does not match Model ID!', delta, model);
          } else {
            model.set(delta, { deltaEvent: 'full' });
          }
        } else {
          this.addItem(delta);
        }
        break;

      default:
        // Do nothing
    }
  },
});

module.exports = CollectionDeltaReceiver;
