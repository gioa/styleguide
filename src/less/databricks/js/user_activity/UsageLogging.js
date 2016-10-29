/**
 * Javascript interface for usage logging. See UsageLogging.scala for more information.
 */

import React from 'react';

import ReactDialogBox from '../ui_building_blocks/dialogs/ReactDialogBox.jsx';

import { BrowserUtils } from '../user_platform/BrowserUtils';

function UsageLogger(webSocketClient) {
  this.wsClient = webSocketClient;
}

let errorShown = false;  // Only show an error dialog at most once per session.

UsageLogger.errorHandler = function errorHandler(err) {
  if (err === 'socket closed') {
    return;
  }
  if (!errorShown) {
    errorShown = true;
    if (window.settings.deploymentMode === 'development') {
      ReactDialogBox.alert(err);
    }
  }
};

UsageLogger.prototype.recordUsage = function recordUsage(metric, quantity, additionalTags) {
  this.wsClient.sendRPC('recordUsage', {
    silent: true,
    data: {
      metric: metric,
      quantity: quantity,
      tags: additionalTags || {},
    },
    error: UsageLogger.errorHandler,
  });
};

UsageLogger.prototype.recordEvent = function recordEvent(eventName, additionalTags, eventData) {
  this.wsClient.sendRPC('recordEvent', {
    silent: true,
    data: {
      eventName: eventName,
      eventData: eventData || null,  // avoid undefined
      tags: additionalTags || {},
    },
    error: UsageLogger.errorHandler,
  });
};

UsageLogger.prototype.recordDebugEvent = function recordDebugEvent(
  eventName,
  additionalTags,
  eventData
) {
  if (window.settings.logDebugEventsToBackend) {
    this.recordEvent(eventName, additionalTags, eventData);
  }
  if (window.settings.logDebugEventsToConsole) {
    console.log(eventName, additionalTags, eventData);
  }
};

const RecordEventMixin = {

  propTypes: {
    recordEvent: React.PropTypes.func,
    recordUsage: React.PropTypes.func,
  },

  recordEvent(eventName, additionalTags, eventData) {
    // set the default of recordEvent here because window.recordEvent isn't initialized when
    // getDefaultProps() is called
    const recordEvent = this.props.recordEvent ? this.props.recordEvent : window.recordEvent;
    if (recordEvent) {
      recordEvent(eventName, BrowserUtils.getMeasurementTags(additionalTags), eventData);
    } else {
      console.error('recordEvent for ' + eventName + ' failed, no usage reporting available.');
    }
  },

  recordUsage(metric, quantity, additionalTags) {
    // set the default of recordUsage here because window.recordEvent isn't initialized when
    // getDefaultProps() is called
    const recordUsage = this.props.recordUsage ? this.props.recordUsage : window.recordUsage;
    if (recordUsage) {
      recordUsage(metric, quantity, additionalTags);
    } else {
      console.error('recordUsage for ' + metric + '  failed, no usage reporting available.');
    }
  },

};

function initLogDebugFlags() {
  window.settings.logDebugEventsToBackend = false;
  window.settings.logDebugEventsToConsole = false;
}

module.exports.RecordEventMixin = RecordEventMixin;
module.exports.UsageLogger = UsageLogger;
module.exports.initLogDebugFlags = initLogDebugFlags;
