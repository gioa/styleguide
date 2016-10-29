/**
 * A Backbone model for a Maven Package Release
 *
 * DEPENDENCIES: Backbone, JQuery
 */

import $ from 'jquery';

import Backbone from 'backbone';

const MavenPackageRelease = Backbone.Model.extend({
  defaults: {
    mavenVersion: '',
    mavenTime: '',
    mavenContents: [],
  },

  parse(response) {
    if (response) {
      this.set({
        // According to Maven Central's API
        mavenVersion: response.v,
        mavenTime: response.timestamp,
        mavenContents: response.ec,
      });
    }
    return this;
  },

  isValid() {
    return (this.get('mavenVersion') !== '' &&
            $.inArray('.jar', this.get('mavenContents')) > -1);
  },
});

module.exports = MavenPackageRelease;
