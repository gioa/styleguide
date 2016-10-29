
import Backbone from 'backbone';

const Application = Backbone.Model.extend({
  defaults: {
    applicationInstName: '',
    applicationType: '',
    driver: '',
  },

  parse(response) {
    if (response) {
      return {
        applicationInstName: response.applicationInstName,
        applicationType: response.applicationType.value,
        id: response.id,
        driver: '#setting/appui/' + response.id,
        state: response.state.state.value,
      };
    }
    return {};
  },

  urlRoot: '/applications',

  isValid() {
    return (this.get('applicationInstName') !== '');
  },
});

module.exports = Application;
