import $ from 'jquery';
import Backbone from 'backbone';

import MavenPackageRelease from '../../libraries/search/MavenPackageRelease';

// Collection of Maven Package Releases fetched from Maven Central. They are fetched separately
// from the package itself (that's how the search api works), and having this as separate
// makes the rendering simpler (release selectors are rendered after the rows are added).
const MavenPackageReleaseList = Backbone.Collection.extend({

  model: MavenPackageRelease,

  fetch(groupId, artifactId) {
    const baseUrl = 'http://search.maven.org/solrsearch/select?q=';
    const url = '/proxy/' + encodeURIComponent(baseUrl +
      'g:' + groupId + '+AND+a:' + artifactId + '&wt=json&rows=5&core=gav');
    const self = this;
    $.ajax(url, {
      contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
      type: 'GET',
      success(searchResult) {
        const list = [];
        if (searchResult.response.docs) {
          $.each(searchResult.response.docs, function parseNewRelease(idx, p) {
            const newRelease = new MavenPackageRelease();
            const parsedRelease = newRelease.parse(p);
            if (parsedRelease.isValid()) {
              list.push(parsedRelease);
            }
          });
        }
        self.set(list);
      },
    });
  },
});

module.exports = MavenPackageReleaseList;
