import _ from 'underscore';
import Backbone from 'backbone';

import Application from '../applications/Application';

const ApplicationList = Backbone.Collection.extend({

  model: Application,

  url: '/applications',

  activeApplications() {
    return this.where({ state: 'Running' });
  },

  autoUpdate() {
    // Throttle limits the call to 1 every 5, so the setInterval will be correctly controlled
    const _this = this;
    setInterval(_.throttle(function fetch() { _this.fetch(); }, 5000), 1000);
  },
});

module.exports = ApplicationList;
