
import $ from 'jquery';
import _ from 'underscore';

require('../../lib/jquery.ajaxQueue'); // ajax-queue

/**
 * All RPCs which use this mixin share a queue. For now this is the easiest to reason about,
 * TODO(ahirreddy): In the future we might want to allow unrelated RPCs to have different queues
 * or some other opt-out mechanism.
 */
const rpcQueue = [];

/*
 * Mixin for Backbone Models to make RPC calls
 *
 * Useage - define your backbone model:
 * const myModel = Backbone.Model.extend({
 *   urlRoot: "/myModel"
 * });
 * _.extend(myModel.prototype, BackboneRpcMixin);
 *
 * You can define the urlRoot for your RPC calls, which will be used as default RPC url
 */
const BackboneRpcMixin = {
  /**
   * @param {string} method the rpc method name
   * @param {object} attrs data sent with the rpc call
   * @param {object} options rpc options
   *
   * Supported options include:
   *  httpMethod - default is POST
   *  optimisticChanges - apply changes to local model before it returns from server
   *  url - optionaly specify the url for RPC call
   *  success - callback function that handles RPC call results
   *  error - callback function that handles RPC call failure
   *  sendCondition - an optional function that will be called to determine if can be sent
   *  (returns true) or must queued (false). The primary use is for RPC calls on optomistic models
   *  for which we do not yet have a model ID. The condition on queued RPCs will be retried every
   *  100ms. All subsequent RPCs will be placed into the queue as well as to preserve the ordering
   *  of RPC calls.
   */
  rpc(method, attrs, options) {
    // If there is anything in the queue, don't execute
    // This also means we have a _drainQueue method in flight that will periodically try to drain
    // the queue
    if (rpcQueue.length > 0) {
      rpcQueue.push([this, [method, attrs, options]]);
    } else {
      // Try to send the message, if it didn't work, queue it and setup the _drainQueue method
      const success = this._rpc(method, attrs, options);
      if (!success) {
        rpcQueue.push([this, [method, attrs, options]]);
        _.delay(this._drainQueue.bind(this), 100);
      }
    }
  },

  _drainQueue() {
    while (rpcQueue.length > 0) {
      const rpcData = rpcQueue.shift();
      const ctx = rpcData[0];
      const rpcArgs = rpcData[1];

      const success = this._rpc.apply(ctx, rpcArgs);
      if (!success) {
        // If we didn't send the rpc, place it at the head of the queue
        rpcQueue.unshift(rpcData);
        _.delay(this._drainQueue.bind(this), 100);
        break;
      }
    }
  },

  _rpc(method, attrs, options) {
    options = options || {};
    attrs = attrs || {};

    if (options.sendCondition && !options.sendCondition()) {
      // Indicate that we did not meet the send condition
      return false;
    }

    const httpMethod = options.httpMethod || 'POST';
    const url = options.url || this.url();

    if (options.optimisticChanges) {
      this.set(options.optimisticChanges, { validate: true });
    }

    attrs['@method'] = method;

    // Ensure non-safe requests are serialized, to prevent race conditions.
    // This is also done in app.js
    const ajax = (httpMethod === 'GET') ? $.ajax : $.ajaxQueue;

    ajax({
      context: this,
      type: httpMethod,
      url: url,
      // The key needs to match your method's input parameter (case-sensitive).
      data: JSON.stringify(attrs),
      contentType: 'application/json; charset=utf-8',
      dataType: 'json',
      success: options.success,
      error(xhr, status, error) {
        if (options.error) {
          options.error(xhr, status, error);
        }
        console.error('RPC call failed', httpMethod, url, method, attrs, options);
      },
    });

    return true;
  },
};

module.exports = BackboneRpcMixin;
