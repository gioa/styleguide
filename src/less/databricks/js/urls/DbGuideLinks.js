/**
 * Links to the Databricks guide notebooks on different parts of the product. These can be safely
 * provided to tooltips and such by calling webapp/web/js/urls/DbGuideUrls.getDbGuideUrl, which will
 * automatically convert them to the appropriate CDN links for shards in which we don't actually
 * store the DB Guide as a set of notebooks.
 */

const productOverviewStr = '#workspace/databricks_guide/01 Databricks Overview/';

const DbGuideLinks = {
  ACCESSING_DATA_URL: '#workspace/databricks_guide/03 Data Sources/0 Accessing Data',
  ACL_CLUSTERS_URL: '#workspace/databricks_guide/01 Databricks Overview/12 Access Controls/' +
    '02 Cluster ACLs',
  ACL_WORKSPACE_URL: '#workspace/databricks_guide/01 Databricks Overview/12 Access Controls/' +
    '01 Workspace ACLs',
  CLUSTER_AUTOSCALING_URL: `${productOverviewStr}02 Cluster Autoscaling`,
  CLUSTERS_URL: '#workspace/databricks_guide/01 Databricks Overview/01 Clusters',
  VISUALIZATIONS_URL: '#workspace/databricks_guide/01 Databricks Overview/' +
    '15 Visualizations/0 Visualizations Overview',
  DBFS_PYTHON_URL: '#workspace/databricks_guide/01 Databricks Overview/' +
    '09 Databricks File System - DBFS',
  IAM_ROLES_URL: `${productOverviewStr}12 Access Controls/IAM Roles`,
  JAR_JOBS_URL: '#workspace/databricks_guide/01 Databricks Overview/06 Jobs',
  JOBS_URL: '#workspace/databricks_guide/01 Databricks Overview/06 Jobs',
  NOTEBOOKS_OVERVIEW_URL: '#workspace/databricks_guide/01 Databricks Overview/03 Notebooks',
  PYTHON_INTRO_URL: '#workspace/databricks_guide/02 Tutorials/01 Intro to Python',
  R_INTRO_URL: '#workspace/databricks_guide/02 Tutorials/01 Intro to R',
  RELEASE_NOTES_URL: 'http://docs.databricks.com/release-notes/product/latest.html',
  SCALA_INTRO_URL: '#workspace/databricks_guide/02 Tutorials/01 Intro to Scala',
  SQL_INTRO_URL: '#workspace/databricks_guide/02 Tutorials/01 Intro to SQL',
  SQL_ENDPOINTS_URL: '#workspace/databricks_guide/01 Databricks Overview/' +
    '14 Third Party Integrations/01 Setup JDBC or ODBC',
  SSH_URL: `${productOverviewStr}13 Advanced Features/05 SSH Access`,
  SSO_PING_IDENTITY_URL:
    `${productOverviewStr}09 Single Sign-On/04 Setup Instructions: Ping Identity`,
  SSO_OKTA_URL: `${productOverviewStr}09 Single Sign-On/02 Setup Instructions: Okta`,
  SSO_ONE_LOGIN_URL: `${productOverviewStr}09 Single Sign-On/03 Setup Instructions: OneLogin`,
  SSO_OVERVIEW_URL: `${productOverviewStr}09 Single Sign-On/01 Overview`,
  WELCOME_GUIDE_URL: '#workspace/databricks_guide/00 Welcome to Databricks',
  INDEX_URL: 'http://docs.databricks.com',
};

module.exports = DbGuideLinks;
