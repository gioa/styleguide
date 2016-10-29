/**
 * Wraps CollectionDeltaReceiverView to provide an auto-updating view of a single model.
 */

import CollectionDeltaReceiverView from '../delta_receiver/CollectionDeltaReceiverView';

const ItemDeltaReceiverView = CollectionDeltaReceiverView.extend({
  // Replaced automatically in response to updates. No events will be fired on change - you
  // must either override render() below or use onChange() below to receive notifications.
  model: null,
  // Optional, you can always override render() instead.
  // TODO(ekl) refactor so we can subscribe to the backbone model object instead.
  onChangeCallback: null,

  onModelAdd() {
    this._updateFromCollection();
  },

  onModelRemove() {
    this._updateFromCollection();
  },

  onModelReset() {
    this._updateFromCollection();
  },

  onChange(callback) {
    this.onChangeCallback = callback;
  },

  render() {
    if (this.onChangeCallback !== null) {
      this.onChangeCallback();
    }
  },

  _updateFromCollection() {
    if (this.collection.models.length === 1) {
      this.model = this.collection.models[0];
      if (this.onChangeCallback !== null) {
        this.onChangeCallback();
      }
    } else if (this.collection.models.length === 0) {
      this.model = null;
      if (this.onChangeCallback !== null) {
        this.onChangeCallback();
      }
    } else {
      console.error('Unexpected collection length', this.collection.models);
      throw new Error('unexpected collection length ' + this.collection.models.length);
    }
  },
});

module.exports = ItemDeltaReceiverView;
