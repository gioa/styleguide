/**
 * Abstract class for views backed by a CollectionDeltaReceiver. Delta synchronization must be
 * activated by calling the startWatching() function.
 */

import Backbone from 'backbone';

import CollectionDeltaReceiver from '../delta_receiver/CollectionDeltaReceiver';

const CollectionDeltaReceiverView = Backbone.View.extend({
  collection: null,

  /**
   * Begins watching the collection rooted at the specified id for changes.
   *
   * @param rootId The tree node id to watch (must be a direct descendent of the root node).
   * @param model The class of the models in this collection (e.g. Job, Command).
   */
  startWatching(rootId, model) {
    this.collection = new CollectionDeltaReceiver([], { deltaPublisherRoot: rootId, model: model });
    this.listenTo(this.collection, 'add', this.onModelAdd);
    this.listenTo(this.collection, 'remove', this.onModelRemove);
    this.listenTo(this.collection, 'reset', this.onModelReset);
    this.listenTo(this.collection, 'add remove reset change', this.render);
    this.collection.startWatching();
  },

  remove() {
    Backbone.View.prototype.remove.call(this);
    this.collection.stopWatching();
  },

  onModelAdd() {},
  onModelRemove() {},
  onModelReset() {},
  render() {},
});

module.exports = CollectionDeltaReceiverView;
