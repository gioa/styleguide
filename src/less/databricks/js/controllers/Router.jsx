/* eslint no-case-declarations: 0, max-depth: 0, consistent-return: 0, max-lines: 0,
func-names: 0 */

/**
 * Core controller for navigation
 */
import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';
import d3 from 'd3';
import React from 'react';
import ReactDOM from 'react-dom';

import { timedRoute } from './RouterUtils.jsx';

import ApplicationListView from '../applications/ApplicationListView';
import AppUI from '../applications/AppUI';
import AppUIView from '../applications/AppUIView';

import NavFunc from '../filetree/NavFunc.jsx';

import FullElasticJobStatus from '../jobs/FullElasticJobStatus';
import FullElasticRunStatus from '../jobs/FullElasticRunStatus';
import JobRunViewReact from '../jobs/JobRunView.jsx';
import LatestJobRunViewReact from '../jobs/LatestJobRunView.jsx';

import LibraryCreateView from '../libraries/LibraryCreateView';
import MavenLibraryCreateView from '../libraries/MavenLibraryCreateView';
import PythonLibraryCreateView from '../libraries/PythonLibraryCreateView';

import Presence from '../presence/Presence';

import DashboardEditView from '../notebook/dashboards/DashboardEditView.jsx';
import DashboardPresentView from '../notebook/dashboards/DashboardPresentView.jsx';
import DashboardView from '../notebook/commands/DashboardView';
import { FetchErrorPanel } from '../notebook/FetchErrorPanel.jsx';
import { LanguageNames } from '../notebook/LanguageNames';
import ReactNotebookView from '../notebook/ReactNotebookView.jsx';

import ReactTableView from '../tables/ReactTableView.jsx';
import TableCreateView from '../tables/TableCreateView.jsx';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';

import { DbGuideUrls } from '../urls/DbGuideUrls';

import { BrowserUtils } from '../user_platform/BrowserUtils';

const Router = Backbone.Router.extend({

  unmountOldComponents() {
    $('#content').removeClass();
    window.router.removeActiveView();
    if (window.sidebar && window.sidebar.isHidden()) {
      window.sidebar.show();
    }
    window.activeView = null;
    $('#topbar').show();
    $('#overallView').removeClass();
    if ($('#overallView')[0] && ReactDOM.unmountComponentAtNode($('#overallView')[0])) {
      $('#overallView').append($('<div id="context-bar">')).append($('<div id="content">'));
    } else {
      if ($('#content')[0]) {
        ReactDOM.unmountComponentAtNode($('#content')[0]);
      }
      if ($('#context-bar')[0]) {
        ReactDOM.unmountComponentAtNode($('#context-bar')[0]);
      }
    }
  },

  routes: {
    '': 'empty',
    'redirect': 'redirect',
    'workspace/*path': 'workspacePath',
    'folder/:id': 'folder',
    'shell/:id': 'shell',
    'notebook/:id': 'notebook',
    'notebook/:id/command/:commandId': 'notebook',
    'notebook/:id/resultsOnly': 'notebookResultsOnly',

    // new dashboard routes
    'notebook/:nbid/dashboard/:dashboardId': 'dashboardView',
    'notebook/:nbid/dashboard/:dashboardId/:mode': 'dashboardView',

    'create/table': 'createTable',
    'table/:name': 'table',
    'dashboard/:id': 'dashboard',
    'dashboard/:id/:mode': 'dashboard',
    'job/:jobId/run/latestSuccess': 'jobRunLatestSuccess',
    'job/:jobId/run/latestSuccess/:displayMode': 'jobRunLatestSuccess',
    'job/:jobId/run/latestSuccess/:displayMode/:dashboardNUID': 'jobRunLatestSuccess',
    'job/:jobId/run/:runId': 'jobRun',
    'job/:jobId/run/:runId/:displayMode': 'jobRun',
    'job/:jobId/run/:runId/:displayMode/:dashboardNUID': 'jobRun',
    'library/:name': 'library',
    'create/library': 'createLibrary',
    'create/library/:parentId': 'createLibrary',
    'create/mavenLibrary': 'createMavenLibrary',
    'create/mavenLibrary/:parentId': 'createMavenLibrary',
    'create/pythonLibrary': 'createPythonLibrary',
    'create/pythonLibrary/:parentId': 'createPythonLibrary',
    'setting/appui/*name?*query': 'appuiWithQuery',
    'setting/appui/*name': 'appui',
    'setting/:name': 'setting',
    'setting/:name/:tab': 'setting',
    'experimental/*subroute': 'experimental',
    '.*:any': 'empty',
  },

  RECENT_VIEWS_TO_KEEP: 30,

  initialize() {
    // LocalStorage property for our list of recent views; will store an array of viewRoutes.
    // We append the user name to this to make it per-user.
    this.RECENT_VIEWS_KEY = ('com.databricks.workspace.recentViewRoutes.' +
      window.settings.orgId + '.' + window.settings.user);
    // An array of viewRoute strings that will form a LRU queue.
    this.recentViewRoutes = [];

    if (window.localStorage) {
      try {
        const data = window.localStorage[this.RECENT_VIEWS_KEY];
        if (data) {
          const viewRoutes = JSON.parse(data);  // Expect an array of strings
          for (let i = 0; i < Math.min(viewRoutes.length, this.RECENT_VIEWS_TO_KEEP); i++) {
            this.recentViewRoutes[i] = viewRoutes[i];
          }
        }
      } catch (err) {
        console.error('Error parsing data in local storage', err);
      }
    }

    // Prefetch the recent view route nodes so that they show up immediately. This is required
    // if using lazy sidebar loading.
    const nodesToFetch = [];
    this.recentViewRoutes.forEach(function(path) {
      if (path.indexOf('notebook/') === 0) {
        const id = parseInt(path.split('/')[1], 10);
        if (id) {
          nodesToFetch.push(id);
        }
      }
    });
    if (nodesToFetch.length > 0) {
      // Fetch once the treestore connection is ready.
      setTimeout(function() {
        window.conn.prefetchNodes(nodesToFetch);
      }, 10);
    }
  },

  /**
   * Time how long it takes (in milliseconds) for a route to return
   * @override
   */
  route(route, name, callback) {
    const boundRoute = timedRoute.bind(this);
    return boundRoute(route, name, callback, Backbone.Router.prototype.route);
  },

  getHash() {
    return window.location.hash.substring(1);
  },

  isTableRoute() {
    const hash = this.getHash();
    return (/^table.*/.test(hash) || hash === 'create/table');
  },

  isWorkspaceRoute() {
    const hash = this.getHash();
    return (/^(shell\/|dashboard\/|notebook\/).*/.test(hash));
  },

  isClusterRoute() {
    const hash = this.getHash();
    return (hash === 'create/cluster' || hash === 'setting/clusters' ||
      (/^(setting\/clusters\/).*/).test(hash) || (/^(setting\/sparkui).*/).test(hash));
  },

  isJobsRoute() {
    const hash = this.getHash();
    return ((/^(joblist).*/).test(hash) || (/^(job\/).*/).test(hash));
  },

  isApplicationsRoute() {
    const hash = this.getHash();
    return hash === 'setting/applications';
  },

  isHomeRoute() {
    const hash = this.getHash();
    return hash === '';
  },

  /**
   * Save our list of recent views to the browser's LocalStorage
   */
  saveRecentViews() {
    if (window.localStorage) {
      try {
        window.localStorage[this.RECENT_VIEWS_KEY] = JSON.stringify(this.recentViewRoutes);
      } catch (err) {
        console.error('Error saving to local storage', err);
      }
    }
  },

  empty() {
    $('#content').scrollTop(0);
    $('#content').scrollLeft(0);
    window.reactRouter.homeView();
  },

  /**
   * Dummy entry that indicates this history state resulted in a redirect. So that the user's
   * back button still works as expected we go back one more state if we land here.
   */
  redirect() {
    if (history.state && history.state.path) {
      // Rewrite this entry back to the original, so that the forward button works.
      window.history.replaceState(null, null, '#workspace/' + history.state.path);
    }
    history.go(-1);
  },

  /**
   * Searches the file tree to find the node ID of given path. It navigates to the ID or
   * shows an error if none could be found.
   */
  workspacePath(path) {
    if (!path) {
      return;
    }
    if (window.settings.useStaticGuide && path.indexOf('databricks_guide/') === 0) {
      // Rewrite this entry so the back button doesn't break.
      window.history.replaceState({ path: path }, null, '#redirect');
      window.location = DbGuideUrls.getDbGuideUrl('#workspace/' + path);
      return;
    }
    $.ajax('/tree/path', {
      data: { path: '/' + path },
      success(node) {
        if (!(node && node.id && node.type)) {
          DeprecatedDialogBox.alert('Cannot open path: ' + path);
          return;
        }
        const options = { trigger: true, replace: true };
        if (node.type === 'notebook') {
          window.router.navigate('notebook/' + node.id, options);
        } else if (node.type === 'shell') {
          // This is for backwards compatibility with the #shell paths
          window.router.navigate('notebook/' + node.id, options);
        } else if (node.type === 'dashboard') {
          window.router.navigate('dashboard/' + node.id, options);
        } else if (node.type === 'library') {
          window.router.navigate('library/' + node.id, options);
        } else if (node.type === 'folder') {
          window.router.navigate('folder/' + node.id, options);
        } else {
          DeprecatedDialogBox.alert('Cannot open path: ' + path);
        }
      },
      error() {
        DeprecatedDialogBox.alert('Cannot open path: ' + path);
      },
    });
  },

  experimental(subroute) {
    console.log('invoking reactRouter');
    window.reactRouter.showView(subroute);
  },

  folder(id) {
    id = parseInt(id, 10);
    // if no active view, show the home screen
    if (!window.activeView) {
      this.empty();
    }
    const openFolder = function() {
      window.sidebar.openWorkspace(id);
    };

    // if the node isn't in the treeCollection yet, wait for it before opening the filetree
    if (window.treeCollection && window.treeCollection.get(id)) {
      openFolder();
    } else {
      window.conn.prefetchNode(id, openFolder);
    }
  },

  appuiWithQuery(name, query) {
    this.appui(name + '?' + query);
  },

  appui(name) {
    const appuiModel = new AppUI({ id: name });
    const view = new AppUIView({ model: appuiModel });
    const fragment = 'setting/appui/' + name.toLowerCase();
    name = '';
    this.registerView(view, fragment);
    view.render();
    this.show(view);
  },

  jobRunLatestSuccess(jobId, displayMode, dashboardNUID) {
    const job = new FullElasticJobStatus({ jobId: jobId });
    const router = this;
    job.fetch({
      success() {
        router.unmountOldComponents();
        router.setupPresenceView(false);
        ReactDOM.render(
          <LatestJobRunViewReact
            job={job}
            displayMode={displayMode}
            dashboardNUID={dashboardNUID}
          />, $('#overallView')[0]);
        router.removeContextBar();
        window.sidebar.hide();
        $('#topbar').hide();
        $('#overallView').removeClass().addClass('job-latest-run');
      },
      error() {
        DeprecatedDialogBox.alert('Job not found: ' + jobId, false, 'Jobs Page', function() {
          location.hash = '#joblist';
        });
      },
    });
  },

  jobRun(jobId, runId, displayMode, dashboardNUID) {
    const run = new FullElasticRunStatus({ jobId: jobId, runId: runId });
    run.deltaUpdate = true;
    const router = this;
    run.fetch({
      success: _.bind(function() {
        router.unmountOldComponents();
        router.setupPresenceView(false);
        ReactDOM.render(<JobRunViewReact
          model={run}
          displayMode={displayMode}
          dashboardNUID={dashboardNUID}
        />, $('#overallView')[0]);
        router.removeContextBar();
      }, this),
      error(model, response) {
        if (response.status === 403) {
          const errorView = <FetchErrorPanel error={response} />;
          ReactDOM.render(errorView, $('#overallView')[0]);
          router.removeContextBar();
        } else {
          DeprecatedDialogBox.alert('Run not found: ' + runId, false, 'Jobs Page', function() {
            location.hash = '#joblist';
          });
        }
      },
    });
  },

  setting(name, defaultTab) {
    $('#content').scrollTop(0);
    $('#content').scrollLeft(0);

    switch (name.toLowerCase()) {
      case 'account':
        window.reactRouter.accountSettings(defaultTab);
        break;
      case 'applications':
        const view = new ApplicationListView();
        name = 'Applications';
        const fragment = 'setting/' + name.toLowerCase();
        this.registerView(view, fragment);
        view.render();
        this.show(view);
        break;
      default:
        // Do nothing
    }
  },

  /**
   * Registers mouseenter and mouseleave events to display path of the view for notebook
   * and dashboard views.
   */
  displayReactViewPath(notebook, titleDiv) {
    const tooltip = $('#tooltip');
    titleDiv.mouseenter(function() {
      const pathIds = notebook.get('path').split('/').slice(1);
      const pathNames = pathIds.map(function(pId) {
        return window.treeCollection.get(pId).get('name');
      });
      // Showing full notebook path with the tooltip
      const titlep = $('<p>');
      titlep.text('Workspace/' + pathNames.join('/'));
      tooltip.empty();
      tooltip.append(titlep);
      tooltip.css({
        'top': titleDiv.offset().top + titleDiv.height() + 5,
        'left': titleDiv.offset().left,
      });
      tooltip.show();
    });
    titleDiv.mouseleave(function() {
      tooltip.hide();
    });
  },

  /**
   * Sets up the title for JSX notebook.
   * @param notebook
   */
  setupTitle(notebook) {
    $('#topbar').show();
    const titleDiv = $('#topbar .tb-title');
    const title = notebook.get('name');

    titleDiv.text(title);
    titleDiv.attr({ 'data-name': title });

    const titleLang = $('.tb-title-lang');
    const nbLang = notebook.get('language');

    if (nbLang) {
      titleLang.text('(' + LanguageNames[nbLang] + ')');
      titleLang.attr({ 'data-lang': nbLang });
    } else {
      titleLang.text('');
      titleLang.attr({ 'data-lang': 'none' });
    }

    BrowserUtils.setDocumentTitle(title);

    this.displayReactViewPath(notebook, titleDiv, titleLang);
  },

  setupTableTitle(tableName) {
    $('#topbar').show();
    const titleDiv = $('#topbar .tb-title');
    titleDiv.text('Table: ' + tableName);
    titleDiv.attr({ 'data-name': tableName });
    const titleLang = $('.tb-title-lang');
    titleLang.text('');
    titleLang.attr({ 'data-lang': 'none' });
    BrowserUtils.setDocumentTitle(tableName);
  },

  /**
   * Legacy shell router, redirect to the notebook route so that the links has the new route
   */
  shell(id) {
    window.router.navigate('notebook/' + id, { trigger: true, replace: true });
  },

  /**
   * Renders a notebook, or the edit dashboard view of a notebook.
   * @param initialMode the initial presentation mode of the dashboard
   * @param id the id of the notebook
   */
  notebook(id, initialMode) {
    const self = this;
    id = parseInt(id, 10);
    const router = this;
    if (!initialMode || !isNaN(initialMode)) {
      initialMode = 'notebook';
    }

    // set the filebrowser to open to this dashboard the next time it opens
    window.fileBrowserView.openToNodeId(id);

    const showView = function(notebook) {
      router.unmountOldComponents();

      notebook.fetchPermissionLevel(function() {
        router.setupPresenceView(notebook.canView());
      });

      notebook.setPresenceCallback();
      const commandCollection = notebook.commandCollection();
      // Sets up the context bar container and mounts the react component inside it
      const ReactNotebookViewFactory = React.createFactory(ReactNotebookView);
      const view = ReactNotebookViewFactory({
        notebook: notebook,
        clusters: window.clusterList,
        initialDisplayMode: initialMode,
      });
      window.activeView = view;

      // TODO(jeffpang): window.notebookView is for testing only! It will be deleted eventually!
      window.notebookView = ReactDOM.render(view, $('#overallView')[0]);

      $('#overallView').removeClass().addClass('new-notebook');
      $('#context-bar').show();

      self.setupTitle(notebook);

      // Add route of the current notebook to the list of recent items.
      // Backbone.history.fragment is the current route.
      if (Backbone.History.started) {
        // check that history is started, which might not be the case for unit-tests
        router.pushRecentViewRoute(Backbone.history.fragment);
      }
      window.shellSessionHash[notebook.id] = commandCollection;
      window.recordEvent('openNotebook', notebook.tags());
      window.fileBrowserView.updateRecentItems();
    };

    this._ensureNotebookLoaded(id, showView);
  },

  notebookResultsOnly(id) {
    this.notebook(id, 'resultsOnly');
  },

  dashboardView(notebookId, dashboardId, mode) {
    if (mode === 'present') { // present dashboard view in full screen mode
      this._showDashboardPresentView(notebookId, dashboardId);
    } else { // default, dashboard edit view
      this._showDashboardEditView(notebookId, dashboardId);
    }
  },

  _isNodeLoaded(notebookId) {
    if (!window.treeCollection) { return false; }
    if (!window.treeCollection.get(notebookId)) { return false; }
    return true;
  },

  _ensureNotebookLoaded(nbId, showView, errorMsg) {
    // Only show the view once we've also fetched the browsers collection and found its name.
    if (this._isNodeLoaded(nbId)) {
      // For ReactNotebookView, notebook must be an instance of NotebookModel
      // not a generic treeNode model
      showView(window.treeCollection.getNotebookModel(nbId));
    } else {
      window.conn.prefetchNode(nbId, function() {
        if (this._isNodeLoaded(nbId)) {
          showView(window.treeCollection.getNotebookModel(nbId));
        } else {
          DeprecatedDialogBox.alert(errorMsg || 'Notebook not found',
                          false,
                          'Ok',
                          function() {
                            window.router.navigate('#', {
                              trigger: true, replace: true,
                            });
                          }
          );
        }
      }.bind(this));
    }
  },

  _showDashboardEditView(notebookId, dashboardId) {
    const nbId = parseInt(notebookId, 10);
    const dashId = parseInt(dashboardId, 10);

    const showView = function(notebook) {
      this.unmountOldComponents();

      // Sets up the context bar container and mounts the react component inside it
      const DashboardEditViewFactory = React.createFactory(DashboardEditView);
      const view = DashboardEditViewFactory({
        clusters: window.clusterList,
        notebook: notebook,
        dashboardId: dashId,
      });
      window.activeView = view;

      // TODO(Chaoyu): remove, window.dashboardView is for testing only, never use it in code
      window.dashboardView = ReactDOM.render(view, $('#overallView')[0]);
      window.notebook = notebook;

      $('#overallView').removeClass().addClass('dashboard-view');
      $('#context-bar').show();

      // TODO(Chaoyu): should also update dashboard view's title to topbar
      // pending on the new top bar PR
      this.setupTitle(notebook);

      // TODO(Chaoyu): support dashboard view in recent list
    }.bind(this);

    this._ensureNotebookLoaded(nbId, showView, 'Dashboard not found');
  },

  _showDashboardPresentView(notebookId, dashboardId) {
    const nbId = parseInt(notebookId, 10);
    const dashId = parseInt(dashboardId, 10);

    const showView = function(notebook) {
      this.unmountOldComponents();

      // Sets up container and mounts the react component inside it
      const view = (
        <DashboardPresentView
          clusters={window.clusterList}
          notebook={notebook}
          dashboardId={dashId}
        />);
      window.activeView = view;

      // TODO(Chaoyu): remove, testing only
      window.dashboardView = ReactDOM.render(view, $('#overallView')[0]);
      window.notebook = notebook;

      window.sidebar.hide();
      $('#topbar').hide();
      $('#overallView').removeClass().addClass('dashboard-present-view');
    }.bind(this);

    this._ensureNotebookLoaded(nbId, showView, 'Dashboard not found');
  },

  table(name) {
    this.unmountOldComponents();
    $('#content').scrollTop(0);
    $('#content').scrollLeft(0);
    this.removeContextBar();

    const ReactTableViewFactory = React.createFactory(ReactTableView);
    const view = ReactTableViewFactory({
      tableName: name,
      clusters: window.clusterList,
    });
    window.activeView = view;
    window.tableView = ReactDOM.render(view, $('#content')[0]);
    this.setupTableTitle(name);
    if (Backbone.History.started) {
      this.pushRecentViewRoute(Backbone.history.fragment);
    }
  },

  createTable() {
    $('#content').scrollTop(0);
    $('#content').scrollLeft(0);

    const fragment = 'create/table';
    const view = new TableCreateView({});
    this.registerView(view, fragment);
    view.render();
    this.show(view);
  },

  createLibrary(parentId) {
    // If not provided, the parent id will be the root.
    parentId = parentId || 0;
    $('#content').scrollTop(0);
    $('#content').scrollLeft(0);

    const fragment = 'create/library/' + parentId;
    const view = new LibraryCreateView({ parentId: parentId });
    this.registerView(view, fragment);
    view.render();
    this.show(view);
  },

  createMavenLibrary(parentId) {
    // TODO(burak): remove this when the maven libraries are graduated
    if (window.settings.enableMavenLibraries) {
      // If not provided, the parent id will be the root.
      parentId = parentId || 0;
      $('#content').scrollTop(0);
      $('#content').scrollLeft(0);

      const fragment = 'create/mavenLibrary/' + parentId;
      const view = new MavenLibraryCreateView({ parentId: parentId });
      this.registerView(view, fragment);
      view.render();
      this.show(view);
    } else {
      return this.empty();
    }
  },

  createPythonLibrary(parentId) {
    // If not provided, the parent id will be the root.
    parentId = parentId || 0;
    $('#content').scrollTop(0);
    $('#content').scrollLeft(0);

    const fragment = 'create/pythonLibrary/' + parentId;
    const view = new PythonLibraryCreateView({ parentId: parentId });
    this.registerView(view, fragment);
    view.render();
    this.show(view);
  },

  dashboard(id, mode) {
    // Strip the "edit" from the URL -- we don't want people copying this URL out of their browser
    // to have it go to an edit page
    if (mode === 'edit') {
      window.router.navigate('dashboard/' + id, { replace: true });
    }

    id = parseInt(id, 10);

    // set the filebrowser to open to this dashboard the next time it opens
    window.fileBrowserView.openToNodeId(id);

    $('#content').scrollTop(0);
    $('#content').scrollLeft(0);

    const fragment = 'dashboard/' + id;
    const oldView = window.fragmentToView[fragment];
    if (oldView) {
      oldView.changeEditMode(mode === 'edit');
      this.show(oldView, mode === 'publish');
      oldView.render();   // In case widgets got changed, etc
      return;
    }

    // Since we might not have loaded the dashboard yet, we'll potentially do that on a fetch
    // this.removeActiveView();
    const model = window.treeCollection.get(id);
    const _this = this;
    function showModel(modelToShow) {
      const view = new DashboardView({
        model: modelToShow,
        editable: true,
        autoSubmit: true,
        publishMode: mode === 'publish',
        editMode: mode === 'edit',
      });
      if (mode !== 'publish') {
        _this.registerView(view, fragment);
      }
      view.render();
      _this.show(view, mode === 'publish');
    }
    if (model) {
      showModel(model);
    } else {
      window.conn.prefetchNode(id, function() {
        const currentModel = window.treeCollection.get(id);
        if (currentModel) {
          showModel(currentModel);
        } else {
          _this.empty();
          DeprecatedDialogBox.alert('Dashboard not found: ' + id);
        }
      });
    }
  },

  library(id) {
    // set the filebrowser to open to this dashboard the next time it opens
    window.fileBrowserView.openToNodeId(id);
    window.reactRouter.library(id);
  },

  registerView(view, fragment) {
    const viewId = window.nextViewId++;
    window.viewIdtoView[viewId] = view;
    window.viewIdToFragment[viewId] = fragment;
    view.$el.attr('id', viewId);
  },

  /**
   * Remove the active view from the content part of the DOM, and possibly keep it hidden and
   * in the recentViewRoutes list if it's a type of view we want to keep in history.
   * Note that although recentViewRoutes only contains the viewRoute, the actual view object is in
   * window.fragmentToView.
   */
  removeActiveView() {
    const active = window.activeView;
    if (active !== null && $.contains(document.documentElement, active.el)) {
      // Remember the view in recentViewRoutes unless it's a create table or library view; in that
      // case we don't want to remember the previously filled values.
      if (this.shouldKeepInRecentViews(active)) {
        active.$el.appendTo($('#hidden'));
        this.pushRecentViewRoute(active.viewRoute);
      } else {
        active.remove();
      }
    }
  },

  /**
   * Should we keep a specific view in recentViewRoutes? True for everything except "create"
   * views and the "setting" views (clusters / accounts).
   */
  shouldKeepInRecentViews(view) {
    const route = view.viewRoute;
    // @TODO(jengler) 2015-11-12: Added joblist as it is currently in a hybrid state between a
    // react view and a backbone view. Caching of the backbone view causes the react views to
    // not be cleaned up, resulting in a memory leak. That being said, we should not be caching
    // routes.
    return route && route.indexOf('create/') !== 0 && route.indexOf('setting/') !== 0 &&
           route.indexOf('job/') !== 0 && route.indexOf('joblist') !== 0;
  },

  /**
   * Push a route to the beginning of the recentViewRoutes array.
   */
  pushRecentViewRoute(route) {
    this.recentViewRoutes = _.without(this.recentViewRoutes, route);
    this.recentViewRoutes = [route].concat(this.recentViewRoutes);
    // Pop an old view if we've added too many
    if (this.recentViewRoutes.length > this.RECENT_VIEWS_TO_KEEP) {
      const poppedView = window.fragmentToView[this.recentViewRoutes.pop()];
      if (poppedView) {
        NavFunc.removeView(poppedView, false);
      }
    }
    // Save to LocalStorage
    this.saveRecentViews();
  },

  /**
   * Registers mouseenter and mouseleave events to display path of the view for notebook
   * and dashboard views.
   * TODO(hossein, grier): This does not seem to be used any more. Why not removing?
   */
  displayViewPath(view, titleDiv) {
    if (view.id) {
      const tooltip = $('#tooltip');
      titleDiv.mouseenter(function() {
        const node = window.treeCollection.get(view.id);
        const pathIds = node ? node.get('path').split('/').slice(1) : [];
        const pathNames = pathIds.map(function(pId) {
          return window.treeCollection.get(pId).get('name');
        });
        // Showing full notebook path with the tooltip
        tooltip.html('<p>Workspace/' + pathNames.join('/') + '</p>');
        tooltip.css({
          'top': titleDiv.offset().top + titleDiv.height() + 5,
          'left': titleDiv.offset().left,
        });
        tooltip.show();
      });
      titleDiv.mouseleave(function() {
        // Hiding the tooltip
        tooltip.hide();
      });
    } else {
      titleDiv.unbind('mouseenter mouseleave');
    }
  },

  removeContextBar() {
    $('#context-bar').hide();
    $('#content').css('top', '0');
  },

  setupPresenceView(isPresenceSupported) {
    if (isPresenceSupported && window.settings.enablePresenceUI) {
      Presence.setLocation(Backbone.history.fragment);
    } else {
      Presence.clear();
    }
  },

  /**
   * Show a new view, removing and possibly caching the currently active one.
   */
  show(view, publishMode) {
    this.unmountOldComponents();
    $('#content').scrollTop(0);

    publishMode = publishMode || false;
    window.activeView = view;
    view.viewRoute = Backbone.history.fragment;
    this.setupPresenceView(view.presenceSupported);

    if (this.shouldKeepInRecentViews(view)) {
      window.fragmentToView[Backbone.history.fragment] = view;
    }

    if (publishMode) {
      // publish dashboard;
      $('body').addClass('publishMode');
      $('#content').append(view.el);
    } else {
      $('#topbar').show();
      this.removeContextBar();
      view.$el.show();
      $('#content').append(view.el);
      const titleDiv = $('#topbar .tb-title');

      const topBarTitleMenu = $('#title-menu');
      const titleDropdown = $('#topbar .tb-title-button');
      const d3Menu = d3.select('#title-menu');

      const name = view.name || view.model.get('name');

      const title = name;
      titleDiv.text(title);
      titleDiv.attr({ 'data-name': name });

      const titleLang = $('.tb-title-lang');
      if (view.language) {
        titleLang.text(' (' + LanguageNames[view.language] + ')');
        titleLang.attr({ 'data-lang': view.language });
      } else {
        titleLang.text('');
        titleLang.attr({ 'data-lang': 'none' });
      }

      // Trigger an onShow handler when showing a view
      if (view.onShow) {
        view.onShow();
      }

      this.displayViewPath(view, titleDiv, titleLang);

      if (view.hasTitleMenu) {
        titleDropdown.toggle(true);
        titleDropdown.bind('submenu', function() {
          // Place the menu near the arrow
          const pos = titleDropdown.position();
          d3Menu.style('top', pos.top + 40 + 'px');
          d3Menu.style('left', pos.left + 140 + 'px');

          // Clear the current title bar menu
          topBarTitleMenu.empty();
        });
      } else {
        titleDropdown.toggle(false);
        titleDropdown.unbind('submenu');
      }

      BrowserUtils.setDocumentTitle(title);

      // Add this view to recentViewRoutes as well
      if (this.shouldKeepInRecentViews(view)) {
        this.pushRecentViewRoute(view.viewRoute);
      }

      window.fileBrowserView.updateRecentItems();
    }
  },
});

module.exports = Router;
