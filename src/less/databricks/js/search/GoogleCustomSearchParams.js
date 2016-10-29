
const IconsForType = require('../ui_building_blocks/icons/IconsForType');

const GoogleCustomSearchParams = {};

// GoogleCustomSearchAdapter parameters for searching spark docs
GoogleCustomSearchParams.sparkDocs = {
  urlPrefix: 'spark.apache.org/docs/latest',
  category: 'spark-docs',
  icon: IconsForType.document,
  getDisplayName(json) {
    let title = json.title;
    // for spark docs with ambiguous titles
    if (json.link.indexOf('/api/scala') !== -1) {
      title = 'Scaladoc: ' + title;
    } else if (json.link.indexOf('/api/java') !== -1) {
      title = 'Javadoc: ' + title;
    } else if (json.link.indexOf('/api/python') !== -1) {
      title = 'Python: ' + title;
    }
    // R doc titles already start with "R: ..."
    return title;
  },
};

// GoogleCustomSearchAdapter params for searching the static databricks guide
GoogleCustomSearchParams.databricksGuide = {
  urlPrefix: 'docs.cloud.databricks.com/docs/latest',
  category: 'help',
  icon: IconsForType.shell,
};

module.exports = GoogleCustomSearchParams;
