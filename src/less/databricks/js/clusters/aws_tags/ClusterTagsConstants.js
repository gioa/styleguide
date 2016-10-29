// These are fallbacks in the case that the backend doesn't provide them
export const ClusterTagsFallbackConstants = {
  maxCustomTags: 45,
  minClusterTagKeyLength: 1,
  maxClusterTagKeyLength: 127,
  minClusterTagValueLength: 0,
  maxClusterTagValueLength: 255,
};

// These are hardcoded constants
// These should be kept in sync with the values in ClusterTagsHelper.scala
export const ClusterTagsConstants = {
  // reserved default/internal tag keys used for key duplication checking
  // default tags are reserved tags that are user visible
  defaultTagIds: ['Vendor', 'Creator', 'ClusterName', 'ClusterId'],
  // internal tags are reserved tags that are not user-facing
  internalTagIds: ['Name'],

  // hardcoded values for default tags (i.e., Vendor, ClusterName, ClusterId)
  defaultTags: [
    {
      key: 'Vendor',
      value: 'Databricks',
    },
    {
      key: 'Creator',
      // value intentionally left empty for fill in later (i.e. from window.settings)
    },
    {
      key: 'ClusterName',
      value: '<Generated after creation>',
    },
    {
      key: 'ClusterId',
      value: '<Generated after creation>',
    },
  ],

  // reserved aws prefix
  awsPrefix: 'aws:',

  // allowed characters regex
  allowedCharactersRegex: /^[a-zA-Z0-9 +-=._:/@]*$/,
};
