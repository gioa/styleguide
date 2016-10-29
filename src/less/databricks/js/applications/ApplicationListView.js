import Backbone from 'backbone';

import Application from '../applications/Application';
import ApplicationView from '../applications/ApplicationView';

import applicationsView from '../templates/applicationsView.html';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';

const ApplicationListView = Backbone.View.extend({
  tagName: 'div',
  className: 'applications-list',
  markPageAsBeta: true,

  events: {
    'click #application-add-button': 'onApplicationAdd',
  },

  initialize() {
    this.name = 'Applications';
    this.collection = window.applicationList;
    this.listenTo(this.collection, 'add', this.render);
    this.listenTo(this.collection, 'reset', this.render);
    this.listenTo(this.collection, 'remove', this.render);
    this.render();
  },

  onApplicationAdd() {
    const self = this;

    DeprecatedDialogBox.custom({
      title: 'New Application',
      controls: [
        {
          controlType: 'text',
          message: '',
          id: 'newApplicationFeedback',
        },
        {
          controlType: 'input',
          id: 'newApplicationName',
          type: 'text',
          label: 'Name',
          placeholder: 'My Application',
          required: true,
          validate(value) {
            return value !== '';
          },
        },
        {
          controlType: 'select',
          id: 'newApplicationType',
          label: 'Type',
          class: 'type',
          options: ['Zoomdata', 'PanTera'],
        },
      ],
      confirm(dialog) {
        const applicationTypeInput = dialog.find('#newApplicationType');
        const applicationInstNameInput = dialog.find('#newApplicationName');
        const applicationFeedback = dialog.find('#newApplicationFeedback');

        const formData = {
          applicationInstName: applicationInstNameInput.val(),
          applicationType: applicationTypeInput.val(),
        };

        applicationFeedback.text('Your application is being created...');

        const newApplication = new Application(formData);

        newApplication.save({}, {
          error(model, response) {
            const msg = "Impossible to create a application called '" +
              formData.applicationInstName +
              "' : " +
              response.statusText;
            applicationFeedback.text(msg);
          },
          success() {
            dialog.remove();
            // Fade in this warning, because the fetch doesn't happen instantly.
            // We dont have to worry about removing it, because when the collection
            // updates, it rerenders the div.
            self.$el.find('#application-view-new-indicator').fadeIn('fast');
          },
        });

        // Fetch up the new models RIGHT MEOW so we
        // see the new one quickly
        self.collection.fetch();
      },
      cancel() {},
    }, null, true);
  },

  render() {
    this.$el.html(applicationsView({}));
    const table = this.$('#applications-table');
    this.collection.each(function addAppViewToTable(application) {
      const applicationView = new ApplicationView({ model: application });
      table.append(applicationView.render().el);
    }, this);
  },
});

module.exports = ApplicationListView;
