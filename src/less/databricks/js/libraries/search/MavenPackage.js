/**
 * A Backbone model for a Maven Package
 */

import $ from 'jquery';
import Backbone from 'backbone';

import MavenPackageReleaseList from '../../libraries/search/MavenPackageReleaseList';

const MavenPackage = Backbone.Model.extend({
  defaults: {
    id: '', // for the search service
    mavenGroupId: '',
    mavenArtifactId: '',
    mavenVersion: new MavenPackageReleaseList(),
    mavenContents: [], // Contents of that release: jar, pom, -sources, -javadoc, etc...
  },

  parse(response, isTest) {
    if (response) {
      const g = response.g;
      const a = response.a;
      const versions = new MavenPackageReleaseList();
      if (isTest) {
        versions.set(response.v);
      } else {
        versions.fetch(g, a);
      }
      // According to Maven Packages API
      this.set({
        id: g + ':' + a,
        mavenGroupId: g,
        mavenArtifactId: a,
        mavenVersion: versions,
        mavenContents: response.ec,
      });
    }
    return this;
  },

  fetchReleases() {
    this.set({
      mavenVersion: new MavenPackageReleaseList().fetch(this.get('mavenGroupId'),
                                                        this.get('mavenArtifactId')),
    });
  },

  coordinatePrefix() {
    return this.get('mavenGroupId') + ':' + this.get('mavenArtifactId');
  },

  isValid() {
    return (this.get('mavenGroupId') !== '' &&
            $.inArray('.jar', this.get('mavenContents')) > -1);
  },
});

module.exports = MavenPackage;
