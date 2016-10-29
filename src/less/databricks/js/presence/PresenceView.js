/* eslint func-names: 0 */

import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';

import Presence from '../presence/Presence';

import presenceTemplate from '../templates/presence.html';
import historyTemplate from '../templates/history.html';

import { NameUtils } from '../user_info/NameUtils';

import { DateTimeFormats } from '../user_platform/DateTimeFormats';

const PresenceView = Backbone.View.extend({
  initialize() {
    this.listenTo(this.model, 'change:sessions', this.render);
    this.listenTo(this.model, 'change:history', this.renderHistory);
    this.renderHistory();
  },

  events: {
    'click li.presence-history': 'toggleHistory',
    'click li.presence-user': 'focusUser',
  },

  previousHighlightedCommands: [],
  renderPresenceBorders() {
    const that = this;
    _.each(this.previousHighlightedCommands, function(elClassName) {
      $(elClassName).css('border-color', '#fff');
    });
    this.previousHighlightedCommands = [];
    _.each(this.model.get('sessions'), function(session) {
      if (session.commandId) {
        const elClassName = '.cell-' + session.notebookId + '-' + session.commandId;
        $(elClassName).css('border-color', session.bgColor);
        that.previousHighlightedCommands.push(elClassName);
      }
    });
  },

  render() {
    this.$el.html(presenceTemplate({
      NameUtils: NameUtils,
      sessions: _.sortBy(this.model.get('sessions'), function(session) {
        return session.landingTimestamp;
      }),
    }));
    this.$el.find('.presence-user').tooltip({
      container: this.$el,
      placement: 'bottom',
    });

    this.renderPresenceBorders();
  },

  focusUser(e) {
    const sessionId = $(e.target).data('sessionid');
    const found = _.where(this.model.get('sessions'), { sessionId: sessionId });
    if (found.length !== 1) {
      console.error('Could not find target session', sessionId);
      return;
    }
    const targetSession = found[0];
    if (!targetSession.commandId) {
      $('#content').animate({
        scrollTop: 0,
      }, 400);
    } else {
      const elClassName = '.cell-' + targetSession.notebookId + '-' + targetSession.commandId;
      const pos = $(elClassName).position();
      if (pos) {
        $('#content').animate({
          scrollTop: pos.top,
        }, 400);
      }
    }
  },

  toggleHistory() {
    Presence.checkUnreadAndAck(new Date());
    if ($('#history').is(':visible')) {
      this.$el.find('li.presence-history').removeClass('active');
      $('#history').hide();
    } else {
      this.$el.find('li.presence-history').addClass('active').removeClass('new-message');
      $('#history').show();
      $('.message-input-box').focus();
    }
  },

  renderHistory() {
    const history = this.model.get('history');
    let newMessage = false;
    const oldInput = $('#history .message-input-box').remove();
    $('#history').html(historyTemplate({
      user: window.settings.user,
      myColor: Presence.colorScale(window.settings.userId),
      myDisplayInitial: window.settings.user[0].toUpperCase(),
      history: _.map(history, function(record) {
        const date = new Date(record.timestamp);
        record.date = DateTimeFormats.formatDate(date);
        record.bgColor = Presence.colorScale(record.userId);
        record.displayInitial = record.userName[0].toUpperCase();
        if (record.important && date > Presence.notificationAckTime) {
          newMessage = true;
        }
        return record;
      }),
    }));
    if ($('#history').is(':visible')) {
      $('ul li.presence-history').addClass('active');
      $('ul li.presence-history').removeClass('new-message');
    } else {
      $('ul li.presence-history').removeClass('active');
      if (newMessage) {
        $('ul li.presence-history').addClass('new-message');
      }
    }
    // TODO(ekl) this preserves the input after re-render. We should rewrite this in react,
    // and remove this hack.
    if (oldInput.length > 0) {
      $('#history .message-input-box').replaceWith(oldInput);
    }
    $('#history .message-input-box').keyup(function(e) {
      if (e.keyCode === 13 /* Enter */) {
        const text = $(this).val();
        $(this).val('');
        Presence.pushHistory(text, true);
      }
    });
    $('#history .hide-recent-activity').on('click', function(e) {
      e.preventDefault();
      $('#history').hide();
      $('ul li.presence-history').removeClass('active');
    });
  },
});

module.exports = PresenceView;
