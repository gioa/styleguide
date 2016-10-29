/* eslint callback-return: 0, max-depth: 0, func-names: 0 */

/**
 * Helper functions for multiplexing connections.
 */

import $ from 'jquery';
import _ from 'underscore';

import WebSocketClient from '../requests/WebSocketClient';

import { UsageLogger } from '../user_activity/UsageLogging';

import { BrowserUtils } from '../user_platform/BrowserUtils';

let buildId = '__BUILD_ID_HERE__';  // Replaced with actual id value by build.sh
const stringToSearch = 'BUILD_ID_HERE';  // Not replaced since it does not have underscores

if (buildId.indexOf(stringToSearch) !== -1) {
  console.warn('Client build id not set (expected in local mode).');
} else {
  console.info('Client build id: ' + buildId);
}

const healthCheckTimeoutMillis = 10000;
const healthCheckIntervalMillis = 15000;

/**
 * Given a path, return the subtree's root id, which is the last id in the path.
 *
 * For example, /1/2/3/ would return 3.
 */
function findSubtreeRootId(path) {
  // The last character in path must be "/".
  const segments = path.split('/');
  const subtreeNodeId = segments[segments.length - 2];
  return subtreeNodeId;
}

function MultiplexConnection(sidebarHandler) {
  // Associative array to track the deltas to request, indexed by path.
  this.dataHandlers = {};
  this.sidebarHandler = sidebarHandler;

  this.clientVersion = -1;

  this.pollRequest = null;  // XHR object for long-polling /m
  this.pollTimeout = null;  // Timeout object for next poll
  this.healthCheckRequest = null;  // XHR object for health check requests
  this.healthCheckCount = 0;

  this.wsClient = new WebSocketClient('/websocket?o=' + window.settings.orgId);
  this.loggerClient = new UsageLogger(this.wsClient);

  // Queue for async handling of delta updates.
  this.updateQueue = [];
  this.updateQueueTask = null;

  // A list of callback functions on the next successful sync with the server.
  this.onNextSuccessCallbacks = [];

  // A list of callback functions on each successful server ping.
  this.onConnectCallbacks = [];

  // A list of callback functions on each failed server ping.
  this.onDisconnectCallbacks = [];

  // A list of callback functions on each webapp maintenance banner update.
  this.onBannerUpdateCallbacks = [];

  // A list of callback functions on each internal error.
  this.onInternalErrorCallbacks = [];
}

MultiplexConnection.prototype.start = function() {
  if (!this.pollTimeout) {
    this.sendPollRequest();
  }
  this.scheduleHealthCheck();
  setInterval(_.bind(this.scheduleHealthCheck, this), healthCheckIntervalMillis);
};

/**
 * DEPRECATED: Register a callback to be executed upon the next successful sync with the server.
 * This callback only gets executed once. An example use is using this function to
 * show the shell page only after the sidebar items have been fetched.
 *
 * Note that this function is deprecated. You probably want prefetchNode(id, callback) instead.
 */
MultiplexConnection.prototype.onNextSuccess = function(callback) {
  this.onNextSuccessCallbacks.push(callback);
};

/**
 * Register a callback to be executed upon any successful contact with the server.
 */
MultiplexConnection.prototype.onConnect = function(callback) {
  this.onConnectCallbacks.push(callback);
};

/**
 * Register a callback to be executed upon any failed contact with the server.
 */
MultiplexConnection.prototype.onDisconnect = function(callback) {
  this.onDisconnectCallbacks.push(callback);
};

/**
 * Register a callback to be executed upon any maintenance banner update.
 * The callback will receive a single argument: the html string of the banner.
 */
MultiplexConnection.prototype.onBannerUpdate = function(callback) {
  this.onBannerUpdateCallbacks.push(callback);
};

/**
 * Register a callback to be executed upon any internal error.
 * The callback will receive a single argument: the error caught.
 */
MultiplexConnection.prototype.onInternalError = function(callback) {
  this.onInternalErrorCallbacks.push(callback);
};

/**
 * Set a callback for a path. Path should be in the following format: /1/2/3/
 * There should be only one handler for each path.
 */
MultiplexConnection.prototype.setDataHandler = function(path, callback) {
  if (path.indexOf('/', path.length - 1) === -1) {
    path += '/';
  }
  this.dataHandlers[path] = callback;
  this.sendPollRequest();
};

MultiplexConnection.prototype.removeDataHandler = function(path) {
  delete this.dataHandlers[path];
  this.sendPollRequest();
};

/**
 * Prefetches just the portion of the tree-store needed to render the specified node. This lets
 * page loading proceed without blocking on the (potentially very slow) sidebar initialization.
 *
 * @param id Id of the node to load.
 * @param callback Optional callback to fire on successful load.
 */
MultiplexConnection.prototype.prefetchNode = function(id, callback) {
  this.prefetchNodes([id], callback);
};

/**
 * Efficiently prefetches a number of nodes in batch.
 *
 * @param ids Ids of the node to load.
 * @param callback Optional callback to fire on successful load.
 */
MultiplexConnection.prototype.prefetchNodes = function(ids, callback) {
  console.debug('prefetching nodes: ' + ids);
  const self = this;
  this.wsClient.sendRPC('deltas', {
    data: {
      prefetchNodes: ids,
    },
    success(result) {
      console.debug('node prefetch success', result);
      _.each(result, function(element) {
        self.sidebarHandler(element);
      });
      self.onNextSuccessCallbacks.forEach(function(cb) { cb(); });
      self.onNextSuccessCallbacks.length = 0;
      if (callback) {
        callback();
      }
    },
    error(error) {
      window.oops('Failed to load item: ' + error);
    },
  });
};

/**
 * Fetches contents of a directory in the tree-store. This is used when lazy sidebar
 * loading is enabled.
 *
 * @param id Id of the directory to load.
 * @param childIdsToValidate Ids of known children. These are used to send invalidations for
 *                      children that should not be present in this directory any more.
 * @param callback Optional callback to fire on successful load.
 */
MultiplexConnection.prototype.loadDirectory = function(id, childIdsToValidate, callback) {
  console.debug(
    'loading directory: ' + id + ', existing children ' + JSON.stringify(childIdsToValidate));
  const self = this;
  self.wsClient.sendRPC('deltas', {
    data: {
      loadDirectory: id,
      childIdsToValidate: childIdsToValidate,
    },
    success(result) {
      console.debug('loaded directory', result);
      _.each(result, function(element) {
        self.sidebarHandler(element);
      });
      self.onNextSuccessCallbacks.forEach(function(cb) { cb(); });
      self.onNextSuccessCallbacks.length = 0;
      if (callback) {
        setTimeout(callback, 10);  // PROD-12194 wait for other processing first
      }
    },
    error(error) {
      window.oops('Failed to load directory: ' + error);
    },
  });
};

/**
 * Send a poll request to the server. If the request is successful, onResult will be
 * invoked to execute all registered callbacks. If failed, onError will be invoked.
 */
MultiplexConnection.prototype.sendPollRequest = function() {
  const self = this;
  // Construct the query param: extract the tree node ids from the paths.
  const ids = _.map(this.dataHandlers, function(v, path) { return findSubtreeRootId(path); });
  const data = {
    sidebar: true,
    subtrees: ids.join(','),
    clientVersion: this.clientVersion,
  };
  if (this.pollTimeout) {
    clearTimeout(this.pollTimeout);
  }
  // Delay a bit to give other components a chance to prefetch before this fires. This avoids
  // head-of-line blocking behind the large sidebar poll, and also gives us a chance to coalesce
  // duplicated poll requests.
  this.pollTimeout = setTimeout(function() {
    if (self.updateQueueTask !== null) {
      return;
    }
    data.clientVersion = self.clientVersion;
    self._sendPollRequestWebSocket(data);
  }, 10);
};

// Implements sendPollRequest over websockets.
MultiplexConnection.prototype._sendPollRequestWebSocket = function(data) {
  if (this.pollRequest && !this.pollRequest.completed) {
    this.pollRequest.cancel();
  }

  this.pollRequest = this.wsClient.sendRPC('deltas', {
    data: data,
    success: _.bind(this.onWebSocketResult, this),
    error: _.bind(this.onWebSocketError, this),
  });
};

/**
 * Sends a health check request if one is not already in progress. Called periodically to
 * detect when the server becomes unreachable.
 */
MultiplexConnection.prototype.scheduleHealthCheck = function() {
  if (this.healthCheckRequest === null) {
    this.healthCheckCount += 1;
    this.healthCheckRequest = $.ajax('/health', {
      type: 'GET',
      success: _.bind(this.onHealthCheckSuccess, this),
      error: _.bind(this.onHealthCheckFailed, this),
      timeout: healthCheckTimeoutMillis,
    });
    this.loggerClient.recordUsage('browserActivity', healthCheckIntervalMillis, {
      browserHealthCheckCount: this.healthCheckCount,
    });
  }
};

MultiplexConnection.prototype.onHealthCheckSuccess = function(result, status, xhr) {
  if (xhr.status === 200 && result && result.health === 'ok') {
    const route = xhr.getResponseHeader('X-Databricks-Server-Name');
    if (route) {
      $('#debugRoute').text(route);
    }
    window.buildId = result.buildId;
    if (result.tablesError !== window.tablesError) {
      window.tablesError = result.tablesError;
      window.sidebar.forceUpdateTables();
      window.fileBrowserView.queueFileTreeRefresh();
    }
    this.onConnectCallbacks.forEach(function(cb) { cb(); });
    this.onBannerUpdateCallbacks.forEach(function(cb) { cb(result.banner); });
    if (document.hasFocus() && buildId.indexOf(stringToSearch) === -1) {
      if (!result.buildId) {
        console.warn('Server sent empty build id.');
      } else if (buildId !== result.buildId) {
        window.recordEvent('buildIdMismatch', {
          serverBuildId: result.buildId,
          clientBuildId: buildId,
        });
        console.warn('Server has different build id', result.buildId);
        buildId = result.buildId;  // Suppress further alerts.
      }
    }
    this.healthCheckRequest = null;
  } else {
    this.redirectIfCaptivePortal(result);
    this.onHealthCheckFailed(xhr, status);
  }
};

MultiplexConnection.prototype.onHealthCheckFailed = function(xhr) {
  if (xhr.status === 403) {
    console.error('CSRF token rejected, attempting to fetch new token.');
    BrowserUtils.getSettings(window.settings.orgId);
  }
  this.onDisconnectCallbacks.forEach(function(cb) { cb(); });
  this.healthCheckRequest = null;
};

// Implements result handler for polls over websocket.
MultiplexConnection.prototype.onWebSocketResult = function(result, rpc) {
  if (rpc.clientCancelled) {
    return;
  }
  try {
    this.onResultInternal(result);
  } catch (error) {
    this.handleInternalError(error);
    this.sendDelayedPollRequest();
  }
};

MultiplexConnection.prototype.onResultInternal = function(result) {
  if (result.version === undefined) {
    this.redirectIfCaptivePortal(result);
    // If it's not json and it's not HTML what else would it be??
    // No idea. Log it and bail out.
    console.error('Strange result from server polling: ' + result);
    return;
  } else if (result.version >= this.clientVersion) {
    this.clientVersion = result.version;
  } else {
    // Something had gone wrong. We are not supposed to get an older version from the server.
    console.error('Server version ' + result.version +
        ' older than client version ' + this.clientVersion);
  }

  const self = this;
  _.each(result.updates, function(element) {
    // Update client version.
    if (self.clientVersion < element.deltaVersion) {
      self.clientVersion = element.deltaVersion;
    }
    self.updateQueue.push(element);
  });
  self.processUpdateQueue();

  this.onConnectCallbacks.forEach(function(cb) { cb(); });
};

/**
 * Processes queue delta updates in small batches. This prevents very large sidebar updates from
 * hanging the browser when the page is first loaded.
 */
MultiplexConnection.prototype.processUpdateQueue = function() {
  if (this.updateQueueTask !== null) {
    return;  // a task is already scheduled
  }

  if (this.updateQueue.length === 0) {
    // Execute the success callbacks and reset them.
    this.onNextSuccessCallbacks.forEach(function(cb) { cb(); });
    this.onNextSuccessCallbacks.length = 0;
    this.sendPollRequest();
    return;
  }

  console.debug('processing delta updates: ' + this.updateQueue.length + ' items left');
  const self = this;
  const work = function() {
    self.updateQueueTask = null;
    let i = 0;
    while (self.updateQueue.length > 0 && i < window.settings.deltaProcessingBatchSize) {
      i += 1;
      const element = self.updateQueue.shift();

      // Find a callback matching this path and invoke that.
      for (const path in self.dataHandlers) {
        if (!self.dataHandlers.hasOwnProperty(path)) {
          continue;
        }
        try {
          if (element.path.lastIndexOf(path, 0) === 0) {
            self.dataHandlers[path](element);
            break;
          }
        } catch (error) {
          self.handleInternalError(error);
        }
      }

      // If reached here, no callbacks matched this path. This gotta be a sidebar item.
      if (self.sidebarHandler !== undefined) {
        try {
          self.sidebarHandler(element);
        } catch (error) {
          self.handleInternalError(error);
        }
      }
    }

    // Process the remainder of the queue later.
    self.processUpdateQueue();
  };

  if (window.settings.deltaProcessingAsyncEnabled) {
    this.updateQueueTask = setTimeout(work, 10);
  } else {
    work();
  }
};

// Implementation of error handler for websocket results.
MultiplexConnection.prototype.onWebSocketError = function(error, rpc) {
  try {
    this.onWebSocketErrorInternal(error, rpc);
  } catch (err) {
    this.handleInternalError(err);
    this.sendDelayedPollRequest();
  }
};

MultiplexConnection.prototype.onWebSocketErrorInternal = function(error, rpc) {
  if (rpc.clientCancelled) {
    // We voluntarily aborted the poll
    return;
  }
  // Wait a bit in case the server's having problems
  console.error('Polling server failed:', error, rpc);
  this.sendDelayedPollRequest();
  this.onDisconnectCallbacks.forEach(function(cb) { cb(); });
};

MultiplexConnection.prototype.redirectIfCaptivePortal = function(result) {
  if (result.indexOf('<!DOCTYPE') === 0) {
    // It's html.  This is probably (definitely?) because the server is delivering
    // the login page instead of json, probably due to a server restart.
    // In the interest of expediency, we are fixing this here instead of fixing
    // it server-side by simply making it return a 401.

    // This is a terrible solution.  I hate myself.
    window.location = '/login.html/?' + location.search + location.hash;
  }
};

MultiplexConnection.prototype.sendDelayedPollRequest = function() {
  console.log('Scheduling new poll in 3000 ms');
  if (this.pollTimeout) {
    clearTimeout(this.pollTimeout);
  }
  this.pollRequest = null;
  this.pollTimeout = setTimeout(_.bind(this.sendPollRequest, this), 3000);
};

MultiplexConnection.prototype.handleInternalError = function(error) {
  console.error('Internal error', error);
  try {
    this.onInternalErrorCallbacks.forEach(function(cb) { cb(error); });
  } catch (err) {
    console.error('Error handling internal error', err);
  }
};

module.exports = MultiplexConnection;
