import $ from 'jquery';
import Backbone from 'backbone';

import SparkPackage from '../../libraries/search/SparkPackage';

/** Collection of Spark Packages fetched from spark-packages.org. */
const SparkPackageList = Backbone.Collection.extend({

  model: SparkPackage,

  initialize() {
    this.isFetching = false;
  },

  strategies: {
    name(pack) { return pack.get('packageName').toLowerCase(); },
    nameDesc(a, b) {
      if (a.get('packageName') > b.get('packageName')) { return -1; }
      if (a.get('packageName') < b.get('packageName')) { return 1; }
      return 0; // equal
    },
    org(pack) { return pack.get('packageOrg').toLowerCase(); },
    orgDesc(a, b) {
      if (a.get('packageOrg') > b.get('packageOrg')) { return -1; }
      if (a.get('packageOrg') < b.get('packageOrg')) { return 1; }
      return 0; // equal
    },
    rating(pack) { return pack.get('packageRating'); },
    ratingDesc(pack) { return -pack.get('packageRating'); },
  },

  changeSort(sortProperty) {
    this.comparator = this.strategies[sortProperty];
  },

  sortByRating(a, b) {
    return b.get('packageRating') - a.get('packageRating');
  },

  fetch(name) {
    let baseUrl = 'http://spark-packages.org/api/v1/packages';
    if (name) {
      baseUrl += 'q=' + encodeURIComponent(name) + '&';
    }
    const url = '/proxy/' + encodeURIComponent(baseUrl +
      '?num_releases=-1&published_packages_only=true&with_rating=true');
    const self = this;
    this.isFetching = true;
    $.ajax(url, {
      contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
      type: 'GET',
      success(response) {
        const list = [];
        $.each(response.packages, function pushParsedPackage(idx, p) {
          const newPackage = new SparkPackage();
          list.push(newPackage.parse(p));
        });
        list.sort(self.sortByRating);
        self.set(list);
      },
      complete() {
        self.isFetching = false;
      },
    });
  },
});

module.exports = SparkPackageList;
