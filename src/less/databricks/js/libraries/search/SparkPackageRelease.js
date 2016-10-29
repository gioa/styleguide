/**
 * A Backbone model for a Spark Package Release
 *
 * DEPENDENCIES: Backbone
 */

import Backbone from 'backbone';

const SparkPackageRelease = Backbone.Model.extend({
  defaults: {
    releaseVersion: '',
    releaseLicense: '',
    releaseLicenseUrl: '',
    releaseMavenCoordinate: null,
    releaseSPCoordinate: '',
    releaseCompatibility: [],
    releaseScalaVersion: '',
    releaseCreateTime: '',
  },

  parse(response) {
    if (response) {
      this.set({
        // According to Spark Packages API
        // jshint ignore:start
        // jscs:disable
        releaseVersion: response.version,
        releaseLicense: response.license,
        releaseLicenseUrl: response.license_url,
        releaseMavenCoordinate: response.maven_coordinate,
        releaseSPCoordinate: response.sp_coordinate,
        releaseCompatibility: response.compatibility,
        releaseScalaVersion: response.scala_version,
        releaseCreateTime: response.create_time,
        // jshint ignore:end
        // jscs:enable
      });
    }
    return this;
  },

  isValid() {
    return (this.get('releaseVersion') !== '');
  },

  artifactCoordinate() {
    const maven = this.get('releaseMavenCoordinate');
    return maven || this.get('releaseSPCoordinate');
  },
});

module.exports = SparkPackageRelease;
