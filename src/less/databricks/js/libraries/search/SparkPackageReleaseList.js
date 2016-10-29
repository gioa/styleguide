import $ from 'jquery';
import Backbone from 'backbone';

import SparkPackageRelease from '../../libraries/search/SparkPackageRelease';

// Collection of Spark Package Releases fetched from spark-packages.org for a specific package.
const SparkPackageReleaseList = Backbone.Collection.extend({

  model: SparkPackageRelease,

  fetch(packageName, count) {
    const numReleases = count || -1;
    const baseUrl = 'http://spark-packages.org/api/v1/packages/' + packageName + '/releases';
    const url = '/proxy/' + encodeURIComponent(baseUrl +
      '?num_releases=' + numReleases + '&published_releases_only=true&with_url=false');
    const self = this;
    $.ajax(url, {
      contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
      type: 'GET',
      success(response) {
        if (response.releases) {
          const list = [];
          $.each(response.releases, function pushNewRelease(idx, p) {
            const newRelease = new SparkPackageRelease();
            list.push(newRelease.parse(p));
          });
          self.set(list);
        }
      },
    });
  },
});

module.exports = SparkPackageReleaseList;
