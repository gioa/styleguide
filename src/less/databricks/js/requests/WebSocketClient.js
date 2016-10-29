/* eslint func-names: 0 */

/**
 * Implements a simple request/response protocol over a WebSocket.
 *
 * Example usage:
 * const client = new WebSocketClient("/websocket");
 * const rpc = client.sendRPC('my_method', {
 *   silent: false,  // Reduces debug log verbosity if set.
 *   data: {...},
 *   success: function(result, rpc) {...},
 *   update: function(streamingResult, rpc) {...},
 *   error: function(error, rpc) {...}
 * });
 * cancelButton.onClick(function(e) { rpc.cancel(); });
 *
 * Various properties of the rpc, including the original arguments and start time,
 * will be available to callbacks via the 'rpc' argument. If a rpc is cancelled via cancel(),
 * rpc.clientCancelled will be set to true. Once an rpc completes, rpc.completed will be set.
 */

import _ from 'underscore';
import Pako from 'pako';

import { Counter } from '../requests/Counter';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';

import { BrowserUtils } from '../user_platform/BrowserUtils';

const supportedArguments = [
  'silent',
  'success',
  'error',
  'update',
  'data',
];

const healthCheckIntervalMillis = 10000;

function WebSocketClient(path) {
  this._path = path;
  this._socket = this._getConnection();

  // RPC id to assign to the next RPC sent.
  this._nextRPCId = 1000;

  // The set of RPCs queued to be sent when the socket is next connected.
  this._queuedRPCs = [];

  // The set of outstanding RPCs, keyed by their rpc id.
  this._outstandingRPCs = {};

  // A list of callback functions on each successful server ping.
  this._onConnectCallbacks = [];

  // A list of callback functions on each failed server ping.
  this._onDisconnectCallbacks = [];

  // This serves two purposes: checking connection health, and keeping it from timing out.
  this._healthCheckRPC = null;
  setInterval(_.bind(this._sendHealthCheck, this), healthCheckIntervalMillis);

  // The server offset in milliseconds from the client clock, computed during health checks.
  // i.e. server.currentTimeMillis == Date.now() + this._serverClockDelta;
  this._serverClockDelta = 0;

  // Set to true to log all send and received messages to the debug console.
  this._debugVerbose = false;
}

/**
 * Register a callback to be executed upon any successful contact with the server.
 */
WebSocketClient.prototype.onConnect = function onConnect(callback) {
  this._onConnectCallbacks.push(callback);
};

/**
 * Register a callback to be executed upon any failed contact with the server.
 */
WebSocketClient.prototype.onDisconnect = function onDisconnect(callback) {
  this._onDisconnectCallbacks.push(callback);
};

/**
 * Calls specified method on server over a WebSocket connection. This supports a subset of
 * $.ajax() functionality - see supportedArguments for the set of allowed args. If called
 * before a connection has been established, the RPC will be delayed until the socket connects.
 */
WebSocketClient.prototype.sendRPC = function sendRPC(rpcMethod, args) {
  const rpcId = this._nextRPCId;
  ++this._nextRPCId;
  const rpc = {
    clientCancelled: false,
    completed: false,
    startTime: Date.now(),
    rpcId: rpcId,
    tags: BrowserUtils.getMeasurementTags(),
    type: 'rpc_request',
    method: rpcMethod,
  };
  if (args) {
    supportedArguments.forEach(function(key) {
      if (key in args) {
        rpc[key] = args[key];
      }
    });
  }
  if (this._socket.readyState === 1) {
    this._send(rpc);
  } else {
    this._queuedRPCs.push(rpc);
    rpc.cancel = _.bind(function() {
      this._queuedRPCs = _.reject(this._queuedRPCs, function(queuedRpc) {
        return queuedRpc.rpcId === rpcId;
      });
      rpc.clientCancelled = true;
      if (rpc.error) {
        rpc.error('cancelled', rpc);
      }
    }, this);
  }
  return rpc;
};

/**
 * Returns the estimated timestamp as seen by the server. Use this instead of Date.now() when
 * computing deltas from timestamps given by the server. Note that this clock is NOT monotonic!
 */
WebSocketClient.prototype.serverTime = function serverTime() {
  return Date.now() + this._serverClockDelta;
};

WebSocketClient.prototype._getConnection = function _getConnection() {
  // @WARNING(jengler) 2016-08-01: Must have "//" for protocols for IE: PROD-9855
  const protocol = (location.protocol === 'https:' ? 'wss://' : 'ws://');
  const socket = new WebSocket(protocol + location.host + this._path);

  socket.binaryType = 'arraybuffer';

  socket.onopen = _.bind(function() {
    console.info('WebSocket opened', socket);
    this._sendInternal(JSON.stringify({
      'csrfToken': window.settings ? window.settings.csrfToken : null,
    }));
    this._connected();
    this._flushPendingRPCs();
    this._healthCheckRPC = null;
    this._sendHealthCheck();
  }, this);

  socket.onmessage = _.bind(function(e) {
    Counter.incrementCounter('ws');
    this._connected();
    let resp = e.data;
    let size = -1;
    try {
      if (resp instanceof ArrayBuffer) {
        const start = Date.now();
        resp = Pako.inflate(new Uint8Array(resp), { to: 'string' });
        const delta = Date.now() - start;
        if (delta > 100) {
          console.debug('Decompressed', resp.length, 'bytes in', delta, 'ms.');
        }
      }
      size = resp.length;
      resp = JSON.parse(resp);
    } catch (err) {
      console.error('Error parsing server response', err, e);
      return;
    }
    if (this._debugVerbose) {
      console.debug('received message', resp);
    }
    Counter.incrementCounter('bytes', size);
    if (resp.type === 'rpc_response') {
      this._handleRPCResponse(resp, size);
    } else if (resp.type === 'rpc_update') {
      this._handleRPCUpdate(resp, size);
    } else {
      console.error('Unknown response type', resp.type);
    }
  }, this);

  socket.onclose = _.bind(function(e) {
    console.error('WebSocket closed', e);
    if (e.code === 1008 /* policy violation */) {
      DeprecatedDialogBox.alert(
        'Your session has expired or you have too many windows logged into Databricks. ' +
        'Please reload the page to continue.',
        false,
        'Reload page',
        function() {
          location.reload();
        });
    } else {
      console.log('Scheduling websocket reconnect in 3000ms');
      setTimeout(_.bind(function() {
        this._socket = this._getConnection();
      }, this), 3000);
    }
    this._disconnected();
    this._abortAll();
  }, this);

  socket.onerror = _.bind(function(e) {
    this._disconnected();
    console.error('WebSocket error', e);
  }, this);

  return socket;
};

WebSocketClient.prototype._handleRPCResponse = function _handleRPCResponse(resp, size) {
  const rpc = this._outstandingRPCs[resp.rpcId];
  delete this._outstandingRPCs[resp.rpcId];
  if (!rpc) {
    console.error('Could not find rpc', resp.rpcId);
    return;
  }
  rpc.completed = true;
  if (resp.error) {
    if (rpc.clientCancelled) {
      console.debug(
        'Cancelled method=' + rpc.method,
        'id=' + resp.rpcId,
        'msg=' + resp.error);
    } else {
      console.error(
        'Failed method=' + rpc.method,
        'id=' + resp.rpcId,
        'latency=' + (Date.now() - rpc.startTime) + 'ms',
        'error=' + resp.error);
    }
  } else if (!rpc.silent) {
    console.debug(
      'RPC method=' + rpc.method,
      'id=' + resp.rpcId,
      'bytes=' + size,
      'latency=' + (Date.now() - rpc.startTime) + 'ms');
  }
  if (resp.error) {
    if (rpc.error) {
      rpc.error(resp.error, rpc);
    }
  } else if (rpc.success) {
    rpc.success(resp.data, rpc);
  }
};

WebSocketClient.prototype._handleRPCUpdate = function _handleRPCUpdate(resp, size) {
  const rpc = this._outstandingRPCs[resp.rpcId];
  if (!rpc) {
    console.error('Could not find rpc', resp.rpcId);
    return;
  }
  if (!rpc.silent) {
    console.debug('Update method=' + rpc.method, 'bytes=' + size, 'id=' + resp.rpcId);
  }
  if (rpc.update) {
    rpc.update(resp.data, rpc);
  }
};

WebSocketClient.prototype._abortAll = function _abortAll() {
  for (const id in this._outstandingRPCs) {
    if (!this._outstandingRPCs.hasOwnProperty(id)) {
      continue;
    }
    const rpc = this._outstandingRPCs[id];
    try {
      if (rpc.error) {
        rpc.error('socket closed', rpc);
      }
    } catch (err) {
      console.error(err);
    }
  }
  this._outstandingRPCs = {};
  this._healthCheckRPC = null;
};

WebSocketClient.prototype._flushPendingRPCs = function _flushPendingRPCs() {
  for (const i in this._queuedRPCs) {
    if (this._queuedRPCs.hasOwnProperty(i)) {
      this._send(this._queuedRPCs[i]);
    }
  }
  this._queuedRPCs = [];
};

WebSocketClient.prototype._send = function _send(rpc) {
  Counter.incrementCounter('ws');
  if (this._debugVerbose) {
    console.debug('sent message', rpc);
  }
  this._outstandingRPCs[rpc.rpcId] = rpc;
  this._sendInternal(JSON.stringify(rpc));
  rpc.cancel = _.bind(function() {
    Counter.incrementCounter('ws');
    this._sendInternal(JSON.stringify({ 'type': 'rpc_cancel', 'rpcId': rpc.rpcId }));
    rpc.clientCancelled = true;
  }, this);
};

WebSocketClient.prototype._sendInternal = function _sendInternal(msg) {
  Counter.incrementCounter('bytes', msg.length);
  this._socket.send(msg);
};

WebSocketClient.prototype._sendHealthCheck = function _sendHealthCheck() {
  if (this._socket.readyState !== 1) {  // Health checks shouldn't queue up.
    this._disconnected();
    this._healthCheckRPC = null;
  } else if (this._healthCheckRPC !== null) {  // Waiting for a previous health check.
    this._disconnected();
  } else {
    this._healthCheckRPC = this.sendRPC('healthCheck', {
      silent: true,
      success: _.bind(function(data, rpc) {
        const localTime = Date.now();
        const rpcLatency = localTime - rpc.startTime;
        if (rpcLatency > 10000) {
          console.warn('Server latency too large, not syncing clock.');
        } else {
          const serverTime = data.time + (rpcLatency / 2);
          this._serverClockDelta = serverTime - localTime;
        }
        this._healthCheckRPC = null;
        this._connected();
      }, this),
      error: _.bind(function() {
        this._healthCheckRPC = null;
        this._disconnected();
      }, this),
    });
  }
};

WebSocketClient.prototype._disconnected = function _disconnected() {
  this._onDisconnectCallbacks.forEach(function(cb) { cb(); });
};

WebSocketClient.prototype._connected = function _connected() {
  this._onConnectCallbacks.forEach(function(cb) { cb(); });
};

// Util function for testing.
WebSocketClient.prototype.cancelAll = function cancelAll() {
  for (const id in this._outstandingRPCs) {
    if (this._outstandingRPCs.hasOwnProperty(id)) {
      const rpc = this._outstandingRPCs[id];
      rpc.cancel();
    }
  }
};

module.exports = WebSocketClient;
