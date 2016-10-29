/* eslint func-names: 0 */

import $ from 'jquery';
import Backbone from 'backbone';

import React from 'react';
import ReactDOM from 'react-dom';

import { timedRoute } from './RouterUtils.jsx';

import { ClusterUtil } from '../clusters/Common.jsx';
import { ClusterCreatePage } from '../clusters/ClusterCreatePage.jsx';
import ClusterDetailsContextBar from '../clusters/ClusterDetailsContextBar.jsx';
import ClusterDetailsView from '../clusters/ClusterDetailsView.jsx';
import DriverLogsViewReact from '../clusters/DriverLogsViewReact.jsx';
import { ReactClusterListView } from '../clusters/ReactClusterListView.jsx';
import Terminal from '../clusters/ReactTerminalView.jsx';

import NavFunc from '../filetree/NavFunc.jsx';

import { HomeView } from '../home/HomeView.jsx';

import FullElasticJobStatus from '../jobs/FullElasticJobStatus';
import { JobListView } from '../jobs/JobListView.jsx';
import { JobViewWrapper } from '../jobs/JobView.jsx';

import { LibraryView } from '../libraries/LibraryView.jsx';

import LocalUserPreference from '../local_storage/LocalUserPreference';

import PasswordUtils from '../login/PasswordUtils';

import { LanguageNames } from '../notebook/LanguageNames';

import Presence from '../presence/Presence';

import SparkUI from '../spark_ui/ReactSparkUIView.jsx';
import SparkUIContextBar from '../spark_ui/ReactSparkUIContextBar.jsx';

import { FramedStaticNotebookView } from '../static/FramedStaticNotebookView.jsx';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';

import AccountList from '../user_menu/AccountList';
import { AccountSettingsView } from '../user_menu/AccountSettingsView.jsx';
import SettingsView from '../user_menu/SettingsView.jsx';
import { NewIamRoleView } from '../user_menu/iam_roles/NewIamRoleView.jsx';
import { IamRoleDetails } from '../user_menu/iam_roles/IamRoleDetails.jsx';
import { IamRolesUtils, IamRoleBreadcrumbsTitle } from '../user_menu/iam_roles/IamRolesUtils.jsx';

import { BrowserUtils } from '../user_platform/BrowserUtils';

export const RouteConstants = {
  IAM_ROLE_ROUTE_ROOT: 'setting/accounts/iamRoles',
};

const ReactRouter = Backbone.Router.extend({

  routes: {
    'create/cluster': 'createCluster',
    'experimental/setting/clusters': 'clusters',
    'experimental/setting/accounts': 'accounts',
    'job/:jobId/new': 'newjob',
    'job/:jobId/editJar': 'jobViewEditJar',
    'job/:jobId/:page': 'jobPaginate',
    'job/:jobId': 'job',
    'joblist': 'joblist',
    'joblist/*any': 'joblist',
    'setting/sparkui/:clusterId/driver-logs': 'driverLogs',
    'setting/sparkui/*name?*query': 'sparkuiWithQuery',
    'setting/sparkui/*name': 'sparkui',
    'setting/clusters/:clusterId/:tab': 'clusterDetails',
    'setting/clusters/:clusterId/:tab/:workerNode': 'clusterDetails',
    'setting/accounts/iamRoles/new': 'newIamRole',
    'setting/accounts/iamRoles/:arn': 'iamRoleDetails',
    'setting/accounts/iamRoles/:arn/:workerEnvId': 'iamRoleDetails',
    'terminal/:clusterId/:host': 'terminal',
  },

  // Common CSS selectors used in a bunch of places
  selectors: {
    topbar: '#topbar',
    titleDiv: '#topbar .tb-title',
    content: '#content',
  },

  initialize() {
    window.router.route('setting/clusters', 'clusters', this.clusters.bind(this));
    window.router.route('setting/accounts/users', 'users', this.settings.bind(this, 'users'));
    window.router.route(RouteConstants.IAM_ROLE_ROUTE_ROOT, 'iamRoles',
      this.settings.bind(this, 'iamRoles'));
    window.router.route('setting/accounts/accessControl', 'accessControl',
      this.settings.bind(this, 'accessControl'));
    window.router.route('setting/accounts/singleSignOnSettings', 'singleSignOnSettings',
      this.settings.bind(this, 'singleSignOnSettings'));
    window.router.route('setting/accounts', 'accounts', this.accounts.bind(this));
    window.router.route('externalnotebook/:url', 'externalNotebook',
      this.externalNotebook.bind(this));
  },

  /**
   * Time how long it takes (in milliseconds) for a route to return
   * @override
   */
  route(route, name, callback) {
    const boundRoute = timedRoute.bind(this);
    return boundRoute(route, name, callback, Backbone.Router.prototype.route);
  },

  setupLegacyTopbar(title, language) {
    BrowserUtils.setDocumentTitle(title);
    const titleDiv = $(this.selectors.titleDiv);

    titleDiv.text(title);
    titleDiv.attr({ 'data-name': title });

    const titleLang = $('.tb-title-lang');
    if (language) {
      titleLang.text(' (' + LanguageNames[language] + ')');
      titleLang.attr({ 'data-lang': language });
    } else {
      titleLang.text('');
      titleLang.attr({ 'data-lang': 'none' });
    }

    // Unbind mouse events for the title. This is setup by shells and notebooks
    titleDiv.unbind('mouseenter mouseleave');

    // Another hack solution while we have experimental router
    const tbTitleIcons = $('#topbar .tb-title-icons');
    tbTitleIcons.html('');
  },

  showView(subroute) {
    console.log('showing experimental view for ' + subroute);
    switch (subroute.toLowerCase()) {
      case 'setting/clusters':
        this.clusters();
        break;
      case 'setting/accounts':
        this.accounts();
        break;
      default:
        // Do nothing
    }
  },

  setupPresenceView(isPresenceSupported) {
    if (isPresenceSupported && window.settings.enablePresenceUI) {
      Presence.setLocation(Backbone.history.fragment);
    } else {
      Presence.clear();
    }
  },

  showPrimaryReactView(
    elem,
    name,
    language,
    showContextBar,
    isExperimentalFeature,
    isPresenceSupported,
    wrapperCssClass,
    // if true, render into #overallView, otherwise render into #content
    renderIntoOverallView,
    turnOffLegacyTopbar,
    rerenderSameView) {
    // If this flag is not explicitly set to the false value, assume that it is turned on. This
    // deals with method calls that do not give a value to this argument.
    if (isExperimentalFeature !== false) {
      isExperimentalFeature = true;
    }

    // This is for routed tabs with state.
    // For example, in ClusterDetailsView there are multiple tabs with state to keep
    // but we still want routes. This way, we don't unmount the whole component but we still
    // allow for routing.
    if (!rerenderSameView) {
      this.hidePrimaryView();
    }
    window.activeView = elem;

    // These lines are duplicated all over!
    const content = $(this.selectors.content);
    content.scrollTop(0);
    content.scrollLeft(0);

    this.setupPresenceView(isPresenceSupported);

    if (renderIntoOverallView) {
      ReactDOM.render(elem, $('#overallView')[0]);
    } else {
      ReactDOM.render(elem, content[0]);
    }

    // When is the topbar not shown?
    if (!turnOffLegacyTopbar) {
      this.setupLegacyTopbar(name, language, isExperimentalFeature);
    }
    if (showContextBar) {
      $('#context-bar').show();
      $('#content').css('top', '26px');
    } else {
      $('#context-bar').hide();
      $('#content').css('top', '0');
    }
    $('#content').addClass(wrapperCssClass);
    $(this.selectors.topbar).show();
  },

  hidePrimaryView() {
    // TODO (jeffpang): clean this up when we finish moving everything to react. This is ugly.
    // We need to hide the old view whether it is react or backbone
    window.router.unmountOldComponents();
    window.setSparkUiContextBar = null;
    window.sparkUiPermalinkRedirect = null;
  },

  showTitle(titleView) {
    ReactDOM.render(titleView, $(this.selectors.titleDiv)[0]);
  },

  clusterDetails(clusterId, tab, workerNode) {
    let rerenderSameView = false;

    if (document.getElementById('cluster-details')) {
      rerenderSameView = true;
    }

    this.showTitle(
      <ClusterDetailsContextBar
        clusterId={clusterId}
        clusters={window.clusterList}
      />);

    this.showPrimaryReactView(
      <ClusterDetailsView
        clusterId={clusterId}
        clusters={window.clusterList}
        restrictedClusterCreation={window.settings.enableRestrictedClusterCreation}
        nodeTypes={window.settings.nodeInfo.node_types}
        enableAutoScale={window.settings.enableClusterAutoScaling}
        activeTab={tab.toLowerCase()}
        windowHash={window.location.hash}
        currentWorkerNode={workerNode}
      />,
      'Cluster Details', null, false, false, true, false, null, true, rerenderSameView);

    window.setSparkUiContextBar = function(hostUrl) {
      $('#spark-ui-hostname').text('Hostname: ' + hostUrl);
      $('#spark-ui-context').removeClass('hidden');
    };
  },

  clusters() {
    this.showPrimaryReactView(
      <ReactClusterListView
        clusters={window.clusterList}
        nodeTypes={window.settings.nodeInfo.node_types}
      />,
      'Clusters', null, false, false, true);
  },

  _getCreateClusterNavigationCallback() {
    if (window.settings.enableRestrictedClusterCreation) {
      return () => window.history.back();
    }
    return () => window.router.navigate('/setting/clusters', { trigger: true });
  },

  createCluster() {
    // For dev-tier users/users who cannot configure clusters, we navigate back to the previous
    // page, which is probably the front page or a notebook. Otherwise, we always navigate to
    // the cluster page. I'm using the enableRestrictedClusterCreation flag as an indication of
    // whether the user is such a user.
    const navigationCallback = this._getCreateClusterNavigationCallback();
    const renderSsh = !window.settings.enableRestrictedClusterCreation &&
      window.settings.enableSshKeyUI;
    const renderTags = !window.settings.enableRestrictedClusterCreation &&
      window.settings.enableClusterTagsUI;
    this.showPrimaryReactView(
      <ClusterCreatePage
        clusters={window.clusterList}
        defaultCoresPerContainer={window.settings.defaultCoresPerContainer}
        defaultNodeTypeId={window.settings.nodeInfo.default_node_type_id}
        defaultNumWorkers={window.settings.defaultNumWorkers}
        defaultSparkVersion={window.settings.defaultSparkVersion}
        defaultZoneId={ClusterUtil.getInitialZoneId()}
        enableAutoScale={window.settings.enableClusterAutoScaling}
        enableCustomSparkVersions={window.prefs.get('enableCustomSparkVersions')}
        enableHybridClusterType={window.settings.enableHybridClusterType}
        enableSparkVersionsUI={window.settings.enableSparkVersionsUI}
        hideMissingSparkPackageWarning={window.settings.hideMissingSparkPackageWarning}
        onSubmitNavigationCallback={navigationCallback}
        nodeTypes={window.settings.nodeInfo.node_types}
        restrictedClusterCreation={window.settings.enableRestrictedClusterCreation}
        showHiddenSparkVersions={window.settings.showHiddenSparkVersions}
        sparkVersions={window.settings.sparkVersions}
        zoneInfos={window.settings.zoneInfos}
        renderSsh={renderSsh}
        renderTags={renderTags}
      />, 'Create Cluster', null, false, false, false);
  },

  accounts() {
    // PROD-12742 non admins should not have access to admin console
    if (!window.settings.isAdmin) {
      window.router.navigate('/', { trigger: true, replace: true });
      return;
    }
    this.showPrimaryReactView(
        <SettingsView accounts={new AccountList()} />, 'Settings', null, false, false, true);
  },

  settings(activeTab) {
    // PROD-12742 non admins should not have access to admin console
    if (!window.settings.isAdmin) {
      window.router.navigate('/', { trigger: true, replace: true });
      return;
    }
    this.showPrimaryReactView(
        <SettingsView accounts={new AccountList()} activeTab={activeTab} />,
          'Settings', null, false, false, true);
  },

  accountSettings(defaultTab) {
    this.showPrimaryReactView(
      <AccountSettingsView
        disablePasswordTab={PasswordUtils.shouldDisablePasswordReset()}
        disablePasswordTooltip={PasswordUtils.disablePasswordTooltip()}
        defaultTab={defaultTab}
      />, 'Account Settings', null, false, false, false);
  },

  homeView() {
    this.showPrimaryReactView(
      <HomeView
        gitHash={window.settings.gitHash}
        branch={window.settings.branch}
        fbView={window.fileBrowserView}
        fbCollection={window.treeCollection}
        recentRoutes={window.router.recentViewRoutes}
        clusterList={window.clusterList}
        localpref={new LocalUserPreference('homeView')}
        devTierName={window.settings.devTierName}
        isDevTier={window.settings.useDevTierHomePage}
        showFeaturedLinks={window.settings.showHomepageFeaturedLinks}
        featuredLinks={window.settings.homepageFeaturedLinks}
      />, '', null, false, false, false, 'homeview-content');
  },

  library(id) {
    const self = this;
    const showView = function(model) {
      // Only show the view once we have fetched the model.
      const libraryViewElem = <LibraryView model={model} clusters={window.clusterList} />;
      self.showPrimaryReactView(libraryViewElem, model.get('name'), null, false, false);
    };

    window.conn.prefetchNode(id, function() {
      const model = window.treeCollection && window.treeCollection.get(id);
      if (model) {
        showView(model);
      } else {
        DeprecatedDialogBox.alert('Library not found');
      }
    });
  },

  sparkuiWithQuery(name, query) {
    this.sparkui(name + '?' + query);
  },

  sparkui(name) {
    const sparkUiUrl = '/sparkui/' + name + NavFunc.sessionParams(name.indexOf('?') >= 0);

    const reactElem = <SparkUI sparkUiUrl={sparkUiUrl} />;

    this.showPrimaryReactView(
      reactElem, // Element we are displaying
      'Spark UI', // View Name, displayed in title bar
      null, // language
      true, // showContextBar
      false, // show paws
      false, // isPresenceSupported
      'sparkui-wrapper' // wrapper css class
    );

    // Will be triggered INSIDE the SparkUI IFrame
    // Please forgive me
    window.setSparkUiContextBar = function(hostUrl) {
      const contextBarElem = <SparkUIContextBar hostUrl={hostUrl} />;
      ReactDOM.render(contextBarElem, $('#context-bar')[0]);
    };

    // This is triggered from inside of the SparkUI IFrame in order to redirect non-permalink
    // driver UI links to permalinks which incorporate driver's SparkContextIds.
    window.sparkUiPermalinkRedirect = function(redirectTarget) {
      // The `trigger` causes the page to be loaded, while `replace` prevents the non-permalink
      // from ending up in the Backbone history and causing an infinite redirect loop when the
      // user hits the browser's back button
      window.router.navigate('setting/sparkui/' + redirectTarget, { trigger: true, replace: true });
      return;
    };
  },

  driverLogs(clusterId) {
    const reactElem = (
      <DriverLogsViewReact
        clusterId={clusterId}
        shouldFetchLogs // @TODO(austin) refactor driver logs view to not require this prop
                        // split component and view as well
      />);

    this.showPrimaryReactView(
      reactElem, // Element we are displaying
      'Spark Driver Logs', // View Name, displayed in title bar
      null, // language
      false, // showContextBar
      false, // show paws
      false // isPresenceSupported
    );
  },

  externalNotebook(url) {
    this.showPrimaryReactView(<FramedStaticNotebookView url={url} prefs={window.prefs} />,
      '', null, true, false, false, '', true);
  },

  newjob(jobId) {
    // replace url without triggering router
    window.router.navigate('#job/' + jobId, { replace: true });
    this.job(jobId, true);
  },

  jobViewEditJar(jobId) {
    // replace url without triggering router
    window.router.navigate('#job/' + jobId, { replace: true });
    this.job(jobId, false, true);
  },

  jobPaginate(jobId, page) {
    this.job(jobId, false, false, page);
  },

  job(jobId, isNewJob, editJar, page) {
    const jobFromId = new FullElasticJobStatus({ jobId: jobId });
    jobFromId.fetch({
      success: function(job) {
        const jobView = (
          <JobViewWrapper
            job={job}
            isNewJob={isNewJob}
            page={page ? parseInt(page, 10) : 0}
            openEditJar={editJar}
          />
        );
        this.showPrimaryReactView(
          jobView, // Element we are displaying
          job.attributes.basicInfo.jobName, // View Name, displayed in title bar
          null, // language
          false, // showContextBar
          false, // show paws
          false // isPresenceSupported
        );
      }.bind(this),
      error() {
        DeprecatedDialogBox.alert('Job not found: ' + jobId, false, 'Jobs Page', function() {
          location.hash = '#joblist';
        });
      },
    });
  },

  joblist() {
    const jobListView = (
        <JobListView
          clusters={window.clusterList}
          disabled={!window.settings.enableElasticSparkUI}
        />
    );
    this.showPrimaryReactView(
        jobListView, // Element we are displaying
        'Jobs', // View Name, displayed in title bar
        null, // language
        false, // showContextBar
        false, // show paws
        true // isPresenceSupported
    );
  },

  terminal(cluster, host) {
    const uri = '/terminal/' + cluster + '/' + host;

    const reactElem = <Terminal uri={uri} />;

    this.showPrimaryReactView(
       reactElem, // Element we are displaying
       'Terminal (' + host + ')', // View Name, displayed in title bar
       null, // language
       false, // showContextBar
       false, // show paws
       false // isPresenceSupported
     );
  },

  newIamRole() {
    this.showTitle(<IamRoleBreadcrumbsTitle text='Add IAM Role'/>);

    this.showPrimaryReactView(
      <NewIamRoleView />,
      'New IAM Role', // View Name, displayed in title bar
      null, // language
      false, // showContextBar
      false, // show paws
      false, // isPresenceSupported
      null, // wrapperCssClass
      false, // renderIntoOverallView
      true, // turnOffLegacyTopbar
      false // rerenderSameView
    );
  },

  iamRoleDetails(encodedArn, workerEnvId) {
    const arn = decodeURIComponent(encodedArn);
    this.showTitle(<IamRoleBreadcrumbsTitle text={IamRolesUtils.parseIamRoleName(arn)} />);

    this.showPrimaryReactView(
      <IamRoleDetails arn={arn} workerEnvId={workerEnvId} />,
      'New IAM Role', // View Name, displayed in title bar
      null, // language
      false, // showContextBar
      false, // show paws
      false, // isPresenceSupported
      null, // wrapperCssClass
      false, // renderIntoOverallView
      true, // turnOffLegacyTopbar
      false // rerenderSameView
    );
  },
});

export default ReactRouter;
