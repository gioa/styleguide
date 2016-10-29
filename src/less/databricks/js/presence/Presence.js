import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';
import d3 from 'd3';

import { BrowserUtils } from '../user_platform/BrowserUtils';

function presenceEnabled() {
  return window.settings && window.settings.enablePresenceUI;
}

const Status = Backbone.Model.extend({
  defaults: {
    locationId: null,
    hasFocus: true,
    commandId: null,
  },

  initAttributes(locationId) {
    this.set({
      landingTimestamp: new Date().getTime(),
      sessionId: BrowserUtils.getBrowserTabId(),
      locationId: locationId,
    });
  },
});

const Presence = Backbone.Model.extend({
  defaults: {
    sessions: [],
    history: [],
    currentStatus: null,
  },

  // Whether we're listening to presence updates for a location (i.e. can call onPresenceUpdate).
  listenerReady: false,

  initialize() {
    this.set('currentStatus', new Status());
    this.listenTo(this.get('currentStatus'), 'change', this.onStatusChange);

    // Update browser focus state every 5 seconds.
    setInterval(
      () => this.hasFocus = document.hasFocus(),
      5000
    );

    setInterval(
      () => this.saveCurrentStatus(),
      1000
    );
  },

  // Returns if a message with the specified date has not yet been seen. Further calls to this
  // function with the same or lesser date will return false.
  checkUnreadAndAck(date) {
    if (date > this.notificationAckTime) {
      this.notificationAckTime = date;
      return true;
    }
    return false;
  },

  notificationAckTime: new Date(),
  rpc: null,
  colorScale: d3.scale.category10(),
  updateMarks: null,

  // receive data from RPC subscription, update sessions data
  onPresenceUpdate(result, rpc) {
    if (!presenceEnabled()) {
      return;
    }
    try {
      this.onPresenceUpdate0(result, rpc);
    } catch (ex) {
      console.error('Error processing presence update', ex);
      window.recordEvent('renderingError', {
        error: 'Error processing presence update',
      }, ex.stack);
    }
  },

  onPresenceUpdate0(result /* , rpc */) {
    this.listenerReady = true;
    const that = this;
    let sessions = _.filter(
      result.sessions,
      (session) => session.sessionId !== BrowserUtils.getBrowserTabId()
    );
    _.each(sessions, (session) => {
      if (session.userName && session.userName.length > 0) {
        session.displayInitial = session.userName[0].toUpperCase();
        session.bgColor = that.colorScale(session.userId);
        if (session.hasFocus) {
          session.opacity = 1.0;
        } else {
          session.opacity = 0.4;
        }
      }
    });
    sessions = _.sortBy(sessions, (session) => session.timestamp);

    this.set('sessions', sessions);
    this.set('history', result.history);

    if (this.updateMarks) {
      this.updateMarks(this.get('sessions'));
    }
  },

  // initialize subscription to receive updates
  setLocation(locationId) {
    if (!presenceEnabled()) {
      return;
    }
    this.notificationAckTime = new Date();
    this.clear();
    this.showPresenceView();
    this.get('currentStatus').initAttributes(locationId);
    this.listenTo(this.get('currentStatus'), 'change', this.update);

    const that = this;
    function send() {
      that.rpc = window.conn.wsClient.sendRPC('presence', {
        data: that.get('currentStatus').toJSON(),
        update: _.bind(that.onPresenceUpdate, that),
        silent: true,
        error(error, rpc) {
          that.listenerReady = false;
          if (!rpc.clientCancelled) {
            console.log('Presence RPC disconnected, retrying...');
            setTimeout(send, 1000);
          }
        },
      });
    }
    send();
  },

  pushHistory(msg, important, locationId) {
    if (!presenceEnabled()) {
      return;
    }
    window.conn.wsClient.sendRPC('presencePushHistory', {
      data: {
        locationId: locationId || this.get('currentStatus').get('locationId'),
        entry: {
          text: msg,
          important: important,
        },
      },
      silent: true,
    });
  },

  updateCurrentCommand(notebookId, commandId) {
    if (!presenceEnabled()) {
      return;
    }
    this.notebookId = notebookId;
    this.commandId = commandId;
  },

  updateCursorPosition(notebookId, commandId, from, to) {
    if (!presenceEnabled()) {
      return;
    }
    this.notebookId = notebookId;
    this.commandId = commandId;
    this.cursorStart = from;
    this.cursorEnd = to;
  },

  saveCurrentStatus() {
    if (!presenceEnabled()) {
      return;
    }
    this.get('currentStatus').set({
      hasFocus: this.hasFocus,
      notebookId: this.notebookId,
      commandId: this.commandId,
      cursorStart: this.cursorStart,
      cursorEnd: this.cursorEnd,
    });
  },

  onStatusChange() {
    if (!presenceEnabled()) {
      return;
    }
    if (this.listenerReady) {
      window.conn.wsClient.sendRPC('presenceUpdate', {
        silent: true,
        data: this.get('currentStatus').toJSON(),
      });
    }
  },

  clear() {
    if (!presenceEnabled()) {
      return;
    }
    this.hidePresenceView();
    this.listenerReady = false;
    if (this.rpc) {
      this.rpc.cancel();
    }
  },

  showPresenceView() {
    $('.tb-status-presence').show();
  },

  hidePresenceView() {
    $('.tb-status-presence').hide();
    $('#history').hide();
  },
});

module.exports = new Presence();
