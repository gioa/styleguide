import Backbone from 'backbone';

import MavenPackage from '../../libraries/search/MavenPackage';

/** Collection of Maven Packages fetched from Maven Central. */
const MavenPackageList = Backbone.Collection.extend({

  model: MavenPackage,

  strategies: {
    group(pack) { return pack.get('mavenGroupId').toLowerCase(); },
    groupDesc(a, b) {
      if (a.get('mavenGroupId') > b.get('mavenGroupId')) { return -1; }
      if (a.get('mavenGroupId') < b.get('mavenGroupId')) { return 1; }
      return 0; // equal
    },
    artifact(pack) { return pack.get('mavenArtifactId').toLowerCase(); },
    artifactDesc(a, b) {
      if (a.get('mavenArtifactId') > b.get('mavenArtifactId')) { return -1; }
      if (a.get('mavenArtifactId') < b.get('mavenArtifactId')) { return 1; }
      return 0; // equal
    },
  },

  changeSort(sortProperty) {
    this.comparator = this.strategies[sortProperty];
  },
});

module.exports = MavenPackageList;
