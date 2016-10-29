/* eslint complexity: 0 */

import Backbone from 'backbone';

import applicationTemplate from '../templates/applicationTemplate.html';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';

const ApplicationView = Backbone.View.extend({
  initialize() {
    this.listenTo(this.model, 'change', this.render);
  },

  tagName: 'tr',

  events: {
    'click .remove-button': 'onRemoveApplication',
    'click .restart-button': 'onRestartApplication',
  },

  onRemoveApplication() {
    const applicationInstName = this.model.get('applicationInstName');

    const self = this;
    DeprecatedDialogBox.confirm({
      message: ('Are you sure you want to terminate the ' + applicationInstName +
       ' application?'),
      confirm() {
        self.model.attributes.state = 'Terminating';

        self.model.save({ remove: true }, { patch: true });
        self.render();
      },
    });
  },

  onRestartApplication() {
    const applicationInstName = this.model.get('applicationInstName');

    const self = this;
    DeprecatedDialogBox.confirm({
      message: ('Are you sure you want to restart ' + applicationInstName + '?'),
      confirm() {
        self.model.save({ restart: true }, { patch: true });
      },
    });
  },

  render() {
    const applicationInstName = this.model.get('applicationInstName');
    const applicationType = this.model.get('applicationType');
    this.$el.html(
      applicationTemplate({
        applicationInstName: applicationInstName,
        applicationType: applicationType,
        applicationLogo: applicationType + '.png',
        driver: this.model.get('driver'),
        state: this.model.get('state'),
      })
    );

    const state = this.model.get('state').toLowerCase();

    let removeBtnVisible = false;
    let bgColor = null;
    let textColor = null;
    let restartBtnVisible = false;

    switch (state) {
      case 'pending':
        bgColor = '#ddf';
        break;
      case 'terminating':
        bgColor = '#f37752';
        textColor = '#fff';
        break;
      case 'local':
        break;
      case 'running':
        removeBtnVisible = true;
        restartBtnVisible = true;
        break;

      case 'error':
        removeBtnVisible = true;
        restartBtnVisible = true;
        break;

      case 'restarting':
        removeBtnVisible = true;
        break;

      default:
        console.warn('unknown application state: ' + state);
    }

    if (!window.settings.applications) {
      removeBtnVisible = false;
    }

    if (bgColor) {
      this.$el.find('td').css('background-color', bgColor);
    }
    if (textColor) {
      this.$el.find('td').css('color', textColor);
      this.$el.find('a').css('color', '#005580'); // special case for links
    }
    this.$el.find('.remove-button').css('display', removeBtnVisible ? 'initial' : 'none');
    this.$el.find('.restart-button').css('display', restartBtnVisible ? 'initial' : 'none');
    return this;
  },
});

module.exports = ApplicationView;
