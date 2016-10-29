/**
 * A Backbone model for a Spark Package
 */

import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';

import SparkPackageRelease from '../../libraries/search/SparkPackageRelease';
import SparkPackageReleaseList from '../../libraries/search/SparkPackageReleaseList';

const SparkPackage = Backbone.Model.extend({
  defaults: {
    id: null,
    packageName: '',
    packageOrg: '',
    packageOwner: '',
    packageShortDescription: '',
    packageDescription: '',
    packageHomepage: '',
    packageRating: -1,
    packageTags: [],
    packageReleases: new SparkPackageReleaseList(),
  },

  parse(response) {
    if (response) {
      // jshint ignore:start
      // jscs:disable
      const name = response.name;
      const orgName = response.org_name;
      let releases;
      if (!response.releases) {
        releases = new SparkPackageReleaseList();
        releases.fetch(orgName + '/' + name);
      } else {
        releases = this.parseReleases(response.releases);
      }
      this.set({
        id: name + '/' + orgName,
        // According to Spark Packages API
        packageName: name,
        packageOrg: orgName,
        packageOwner: response.owner,
        packageShortDescription: response.short_description,
        packageDescription: response.description,
        packageHomepage: response.homepage,
        packageRating: response.rating,
        packageReleases: releases,
        packageTags: response.tags,
      });
      // jshint ignore:end
      // jscs:enable
    }
    return this;
  },

  fullName() {
    return this.get('packageOrg') + '/' + this.get('packageName');
  },

  parseReleases(releases) {
    const list = _.map(releases, function pushParsedPackageRelease(r) {
      const release = new SparkPackageRelease();
      return release.parse(r);
    });
    const relList = new SparkPackageReleaseList();
    relList.set(list);
    return relList;
  },

  isValid() {
    return (this.get('packageName') !== '');
  },

  fetchTags(name) {
    // The package may not be fully parsed before this is called. Safer
    // to provide the name if possible.
    const packageName = name || this.fullName();
    const baseUrl = 'http://spark-packages.org/api/v1/packages/' +
        packageName + '/tags?num_tags=-1';
    const url = '/proxy/' + encodeURIComponent(baseUrl);
    const self = this;
    $.ajax(url, {
      contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
      type: 'GET',
      success(response) {
        if (response.tags) {
          self.set('packageTags', response.tags);
        }
      },
    });
  },

  fetchReleases(name) {
    // The package may not be fully parsed before this is called. Safer
    // to provide the name if possible.
    const packageName = name || this.fullName();
    const baseUrl = 'http://spark-packages.org/api/v1/packages/' +
        packageName + '/releases?num_releases=-1&published_releases_only=true&with_url=false';
    const url = '/proxy/' + encodeURIComponent(baseUrl);
    const self = this;
    $.ajax(url, {
      contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
      type: 'GET',
      success(response) {
        console.log(response);
        if (response.releases) {
          self.packageReleases = self.parseReleases(response.releases);
        }
      },
    });
  },

  // Combines several searchable fields of this model for the ListSearchAdapter to run through.
  searchText() {
    return this.get('packageName') + ' ' +
      this.get('packageOrg') + ' ' +
      this.get('packageOwner') + ' ' +
      this.get('packageShortDescription') + ' ' +
      this.get('packageDescription');
  },

  fetch(packName) {
    const baseUrl = 'http://spark-packages.org/api/v1/packages/' + packName;
    const url = '/proxy/' + encodeURIComponent(baseUrl +
      '?num_releases=-1&published_releases_only=true&num_tags=-1&with_rating=true');
    const self = this;
    $.ajax(url, {
      contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
      type: 'GET',
      success(response) {
        if (response.packages) {
          self.set(self.parse(response.packages[0]));
        }
      },
    });
  },
});

module.exports = SparkPackage;
