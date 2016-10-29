
import $ from 'jquery';
import Backbone from 'backbone';

import appUITemplate from '../templates/appUITemplate.html';

const AppUIView = Backbone.View.extend({

  // get rid of the scrollbar
  setIframeHeight() {
    const iframe = $('#content .app-iframe:first');
    const extra = 1 + iframe.outerHeight(true) - iframe.height() +
      $('#content .app-iframe-auth:first').outerHeight(true);
    iframe.height($('#content').height() - extra);
  },

  initialize() {
    this.model.fetch();
    this.name = 'App UI';
    const self = this;
    this.listenTo(this.model, 'change', this.render);
    $(window).resize(function setIframeHeight() { self.setIframeHeight(); });

    // communicate with iframes to set cookie and load app ui when ready
    $(window).on('message', function messageHandler(e) {
      const data = e.originalEvent.data;
      const session = self.model.get('session');
      const applicationInstName = self.model.get('applicationInstName');
      const domain = applicationInstName + '-appproxy-' + window.location.hostname;
      const portSuffix = window.location.port ? ':' + window.location.port : '';
      const appFullDomain = window.location.protocol + '//' + domain + portSuffix;
      if (e.originalEvent.origin !== appFullDomain) {
        return;
      }
      if (data === 'loaded') {
        e.originalEvent.source.postMessage(session + '|' + domain, appFullDomain);
      } else if (data === 'session_ready') {
        $('#content .app-iframe:first').attr('src', appFullDomain);
      }
    });
  },

  render() {
    const applicationInstName = this.model.get('applicationInstName');
    if (applicationInstName === '') {
      return;
    }
    const logo = this.model.get('logo');
    $('#topbar .tb-title').text(logo);

    // the cookie setter iframe is on app proxy domain
    const appUrl = window.location.protocol + '//' + applicationInstName + '-appproxy-' +
     window.location.host;
    const dbcSetCookieUrl = appUrl + '/lib/dbc_set_cookie.html';
    this.$el.html(appUITemplate({ cookieUrl: dbcSetCookieUrl }));
    this.setIframeHeight();
  },
});

module.exports = AppUIView;
