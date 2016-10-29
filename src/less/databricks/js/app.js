/* eslint prefer-rest-params: 0, complexity: 0, consistent-return: 0, func-names: 0 */

/**
 * Core entry point for the application
 */

/**
 * This polyfills missing browser functionality for ES6. This includes common functionality like
 * string.startsWith
 */
import 'babel-polyfill';

import $ from 'jquery';
import Backbone from 'backbone';

import _ from 'underscore';
import React from 'react';
import ReactDOM from 'react-dom';

// @NOTE(jengler) 2016-09-03: See usage below for polyfilling.
import { Console } from './js_polyfill/Console.js';

import ApplicationList from './applications/ApplicationList';

import ClusterList from './clusters/ClusterList';

import ReactRouter from './controllers/ReactRouter.jsx';
import Router from './controllers/Router.jsx';

import CollectionDeltaReceiver from './delta_receiver/CollectionDeltaReceiver';

import TreeNodeCollection from './filebrowser/TreeNodeCollection';
import FileBrowserView from './filebrowser/FileBrowserView';

import NavFunc from './filetree/NavFunc.jsx';

import HelpMenuView from './help_menu/HelpMenuView.jsx';

import LocalUserPreference from './local_storage/LocalUserPreference';

import { LoginOrgSelectionView } from './login/LoginOrgSelectionView.jsx';
import { LoginUtils } from './login/LoginUtils.jsx';

import Dashboard from './notebook/dashboards/Dashboard';

import Presence from './presence/Presence';
import PresenceView from './presence/PresenceView';

import { Counter } from './requests/Counter';
import MultiplexConnection from './requests/MultiplexConnection';
import { enableRequestPerfMetrics } from './requests/RequestUtils.jsx';

import Sidebar from './sidebar/Sidebar.jsx';

import Table from './tables/Table';

import DeprecatedDialogBox from './ui_building_blocks/dialogs/DeprecatedDialogBox';
import { StringRenderers } from './ui_building_blocks/text/StringRenderers';

import { IdleIndicator } from './user_activity/IdleIndicator.jsx';
import { initLogDebugFlags } from './user_activity/UsageLogging';

import { UserMenuView } from './user_menu/UserMenuView.jsx';

import { BrowserUtils } from './user_platform/BrowserUtils';
import { MacUtils } from './user_platform/MacUtils';
import { FeedbackUtils } from './user_platform/FeedbackUtils.jsx';

import '../lib/jquery-ui-bundle'; // jquery-ui
import '../lib/jquery.ajaxQueue'; // jquery-ajax-queue
import '../lib/bootstrap';

Console.polyfillWindow(window);

Backbone.$ = $;

const progressIndicatorDelayMillis = 1500;

window.fragmentToView = {};

window.nextViewId = 0;
window.viewIdtoView = {};
window.viewIdToFragment = {};
// Flag to indicate that we are running in test mode with selenium.
// Some capabilities (drag and drop, file upload) do not work well with Selenium and we need to
// access them in degraded mode.
// When the application is started, the webdriver flips this flag to true.
window.testMode = false;

window.numKeystrokes = 0;
$(document).keypress(function() {
  window.numKeystrokes += 1;
});

// PROD-4647: since we are a single page app, accidentally clicking the backspace button when
// unfocused causes the browser to navigate back and is very annoying. Thus, we disable it.
BrowserUtils.disableBackspace();

enableRequestPerfMetrics($(document));

/**
 * Set up the dropdown menu for the "user" topbar icon
 */
function setUpUserMenu() {
  const userMenu = $('#user-menu');
  const userMenuButton = $('#topbar .tb-button-user');

  userMenuButton.click(function() {
    if (userMenu.is(':visible')) {
      userMenu.hide();
      userMenuButton.removeClass('active');
    } else {
      userMenu.show();
      userMenuButton.addClass('active');
    }
  });

  // Hide the dropdown when we click anywhere else in the document
  $(document).click(function(e) {
    if (userMenu.is(':visible') &&
        $(e.target).closest('.tb-button-user').length === 0 &&
        $(e.target).closest('.no-close-user-menu').length === 0) {
      userMenu.hide();
      userMenuButton.removeClass('active');
    }
  });

  const UserMenuViewFactory = React.createFactory(UserMenuView);
  const userMenuView = UserMenuViewFactory({
    user: window.settings.user,
    currentOrg: window.settings.orgId,
    availableWorkspaces: window.settings.availableWorkspaces,
    enableAccounts: window.settings.accounts,
    isAccountOwner: window.settings.accounts, // For now all admins are assumed to be owner
                                             // TODO(hossein) change it to check with central
  });
  // window.userMenu is saved here for debugging in the JS console only
  // do not use it in other parts of the code
  window.userMenu = ReactDOM.render(userMenuView, userMenu[0]);
}

/**
 * Set up the dropdown menu for the file browser context menu icon
 */
function setUpFilebrowserContextMenu() {
  // Hide the dropdown when we click anywhere else in the document
  // Use document instead of "body" here because some parts of the screen might not have
  // a html body element
  $(document).click(function() {
    // Note: table dropdowns are manually shown and hidden, and therefore are excluded here.
    // TODO(?): We should not be hiding dropdowns globally like this.
    _.each($('div.filebrowser-context-menu:not(.table-dropdown)'), function(menu) {
      if ($(menu).is(':visible')) {
        $(menu).hide();
        $('#filebrowser-popup .dropdown.active').removeClass('active');
      }
    });
  });
}

function setUpNewHelpIcon() {
  const helpMenu = $('#help-menu');
  const helpMenuButton = $('#topbar .tb-button-help');

  // to distinguish the style of this help menu from the old one
  helpMenu.addClass('newhelp');

  const ReactFactory = React.createFactory(HelpMenuView);
  const helpMenuViewElem = ReactFactory({
    topLevelFolders: window.fileBrowserView.topLevelFolders,
    hideFunc() {
      helpMenu.hide();
      helpMenuButton.removeClass('active');
    },
    closeFileBrowserFunc() {
      window.fileBrowserView.toggleFileBrowser(false, true, true, false);
    },
    navigateFunc(url) {
      window.router.navigate(url, { trigger: true });
    },
    enableFullTextSearch: window.settings.enableFullTextSearch,
    searchPlaceholder: 'Search guide & forum',
    enableSparkDocsSearch: window.settings.enableSparkDocsSearch,
    sparkDocsSearchGoogleCx: window.settings.sparkDocsSearchGoogleCx,
    useStaticGuide: window.settings.useStaticGuide,
  });
  const helpMenuView = ReactDOM.render(helpMenuViewElem, helpMenu[0]);

  helpMenuButton.click(function() {
    if (helpMenu.is(':visible')) {
      helpMenu.hide();
      helpMenuView.onHide();
      helpMenuButton.removeClass('active');
    } else {
      helpMenu.show();
      helpMenuView.onShow();
      helpMenuButton.addClass('active');
    }
  });

  // Hide the dropdown when we click anywhere else in the document
  $(document).click(function(e) {
    if (helpMenu.is(':visible') &&
      $(e.target).closest('.tb-button-help').length === 0 &&
      $(e.target).closest('#help-menu').length === 0) {
      helpMenu.hide();
      helpMenuView.onHide();
      helpMenuButton.removeClass('active');
    }
  });
}

function setUpSidebar() {
  // Mount the new sidebar
  const SidebarFactory = React.createFactory(Sidebar);
  const sidebarElem = SidebarFactory({
    router: window.router,
    reactRouter: window.reactRouter,
    fileBrowser: window.fileBrowserView,
    fileTree: window.fileBrowserView.fileTree,
    treeCollection: window.treeCollection,
    tables: window.tableList,
    enableThirdPartyApplicationsUI: window.settings.enableThirdPartyApplicationsUI,
    enableElasticSparkUI: window.settings.enableElasticSparkUI,
    recentViewRoutes: window.router.recentViewRoutes,
    enableCssTransitions: window.settings.enableCssTransitions,
  });
  window.sidebar = ReactDOM.render(sidebarElem, document.getElementById('sidebar'));
}

// Initialization code to run on page load
function continueInit() {
  let progressIndicatorTimer = null;
  let outstandingMutations = 0;

  function resetProgressIndicatorTimer() {
    if (progressIndicatorTimer !== null) {
      clearTimeout(progressIndicatorTimer);
      progressIndicatorTimer = null;
    }
  }

  function showProgressIndicator() {
    resetProgressIndicatorTimer();
    progressIndicatorTimer = setTimeout(function() {
      $('.tb-status').addClass('xhr-pending');
      progressIndicatorTimer = null;
    }, progressIndicatorDelayMillis);
  }

  if (window.settings.enableOrgSwitcherUI) {
    window.history.replaceState(null, null, '/?o=' + window.settings.orgId + location.hash);
  }

  if (window.settings.enableSessionIdleDetection) {
    // maybe logout this tab if the session is idle for too long
    const callback = window.settings.sessionIdleTimeout && window.settings.sessionIdleTimeout > 0 ?
      () => { window.location = '/login.html'; } : null;

    IdleIndicator.default.start(callback, window.settings.sessionIdleTimeout);
  }

  // Global per-user flags.
  window.prefs = new LocalUserPreference('global');
  if (window.console) {
    if (window.settings.enableDebugUI || window.prefs.get('consoleDebug')) {
      // Show these hints in dev mode, so that people know how to turn on the messages in prod.
      if (window.prefs.get('consoleDebug') !== false) {
        window.console.info(
          "[DEBUG] To hide log messages, run window.prefs.set('consoleDebug', false);");
      } else {
        window.console.info(
          "[DEBUG] To show log messages, run window.prefs.set('consoleDebug', true);");
        window.console.log = function() {};
        window.console.info = function() {};
        window.console.debug = function() {};
        window.console.warn = function() {};
      }
    } else {
      window.console.log = function() {};
      window.console.info = function() {};
      window.console.debug = function() {};
      window.console.warn = function() {};
    }
  }

  $.ajaxPrefilter(function(opts) {
    opts.beforeSend = function(xhr) {
      xhr.setRequestHeader('X-CSRF-Token', window.settings.csrfToken);
      try {
        const tags = BrowserUtils.getMeasurementTags();
        // Use UTF-8 encoding for tags in case they contain non-ASCII characters
        xhr.setRequestHeader('X-Databricks-Attribution-Tags',
          encodeURIComponent(JSON.stringify(tags)));
        xhr.setRequestHeader('X-Databricks-Org-Id', window.settings.orgId.toString());
      } catch (err) {
        console.error('Could not send tags with xhr', err);
      }
    };
    // When proxying through NGINX, recover the original error reason of the request.
    if (opts.error) {
      const _error = opts.error;
      opts.error = function(jqXHR, textStatus, errorThrown) {
        const originalReason = jqXHR.getResponseHeader('X-Databricks-Reason-Phrase');
        if (jqXHR && originalReason) {
          jqXHR.statusText = originalReason;
        }
        _error(jqXHR, textStatus, originalReason || errorThrown);
      };
    }
  });

  Backbone.ajax = function(settings) {
    Counter.incrementCounter('xhr');
    if (settings.contentType === 'application/json') {
      settings.contentType = 'application/json; charset=UTF-8';
    }
    if (settings.type !== 'GET') {
      // Tracks non-read requests to let the user know when their changes have not yet been
      // saved to the server. Also provides ui feedback that we are waiting on the network.
      const complete_ = settings.complete;
      settings.complete = function() {
        outstandingMutations -= 1;
        if (complete_ !== undefined) {
          complete_.apply(this, arguments);
        }
        resetProgressIndicatorTimer();
        $('.tb-status').removeClass('xhr-pending');
      };
      outstandingMutations += 1;
      showProgressIndicator();
    }

    settings.beforeSend = function(xhr) {
      xhr.setRequestHeader('X-CSRF-Token', window.settings.csrfToken);
    };

    if (settings.type === 'GET' && !settings.skipRequestQueue) {
      return $.ajax(settings);
    }
    // Ensure non-safe requests are serialized, to prevent race conditions.
    // This is also done in BackboneRpcMixin.js
    return $.ajaxQueue(settings);
  };

  MacUtils.disableMacHistoryScroll();

  window.router = new Router();
  window.reactRouter = new ReactRouter();

  // If clean mode is true, we hide the side bar and the nav bar.
  window.publishMode = false;
  window.activeView = null;
  window.activeFragment = null;
  window.shellSessionHash = {};

  window.applicationList = new ApplicationList();
  if (window.settings.enableThirdPartyApplicationsUI) {
    window.applicationList.autoUpdate();
  }

  // A temporary function to handle sidebar items. This should be refactored later.
  window.conn = new MultiplexConnection(function(item) {
    if (item.type === 'dashboard') {
      item = Dashboard.prototype.parse(item);
    }

    const node = window.treeCollection.get(item.id);

    switch (item.deltaEvent) {
      case 'resetSidebar':
        if (!window.settings.enableLazySidebar) {
          // TODO(ekl) would be better to detect the frontend version and not enable the lazy
          // loading protocol if the client isn't up-to-date.
          DeprecatedDialogBox.confirm({
            message: 'New client version required. Reload the page to continue.',
            confirmButton: 'Reload page',
            cancelButton: 'Close',
            confirm() { window.location.reload(true); },
          });
        }
        window.fileBrowserView.invalidateLoadedDirectories();
        break;

      case 'full':
        // Check if the node is already in the collection, if it is update it, otherwise add it
        if (node) {
          node.set(item);
        } else {
          window.treeCollection.add(item);
        }
        break;

      case 'create':
        window.treeCollection.add(item);
        break;

      case 'update':
        if (node === undefined) {
          if (item.wasMoveUpdate) {  // keep in sync with OutOfCoreTreeImpl
            window.treeCollection.add(item);
          } else {
            console.warn('Updating already removed item (probably deleted on client).');
          }
        } else {
          node.set(item);
        }
        break;

      case 'delete':
        window.treeCollection.remove(item);
        break;

      default:
        console.error('Invalid delta event for item', item);
        break;
    }
  });
  window.conn.onConnect(function() { $('.tb-status').removeClass('server-offline'); });
  window.conn.onDisconnect(function() { $('.tb-status').addClass('server-offline'); });
  window.conn.wsClient.onConnect(function() { $('.tb-status').removeClass('ws-disconnected'); });

  window.conn.wsClient.onDisconnect(function() {
    $('.tb-status').addClass('ws-disconnected');
    // if there are multiple webapps, send a HTTP ping when the websocket disconnects
    // because the webappFrontend can't learn about the new webapp we got assigned to until
    // we send a normal HTTP request
    // TODO(PROD-8394): fix this in the webappFrontend rather than using this hack here
    if (window.settings.enableWebappSharding) {
      window.conn.scheduleHealthCheck();
    }
  });

  window.conn.onBannerUpdate(function(banner) {
    if (banner) {
      $('.tb-status').addClass('banner');
      $('.tb-status-msg-banner').html(banner);
    } else {
      $('.tb-status').removeClass('banner');
      $('.tb-status-msg-banner').html('');
    }
  });
  window.recordUsage = _.bind(window.conn.loggerClient.recordUsage, window.conn.loggerClient);
  window.recordEvent = _.bind(window.conn.loggerClient.recordEvent, window.conn.loggerClient);
  window.recordDebugEvent = _.bind(
    window.conn.loggerClient.recordDebugEvent,
    window.conn.loggerClient
  );
  initLogDebugFlags();
  window.onhashchange = function(hashChangeEvent) {
    window.recordEvent('browserHashChange', {
      newUrl: hashChangeEvent.newURL,
      oldUrl: hashChangeEvent.oldURL,
    });
  };
  window.oops = function(trace, postScript, refresh) {
    postScript = postScript || '';
    const sendUsACopy = $("<a href=''>send us a copy</a>");
    sendUsACopy.attr('href', 'mailto:bugreport@databricks.com?subject=error report' +
      '&body=Hi, I found this error:%0D%0A%0D%0A' + encodeURIComponent(trace) +
      ".%0D%0A%0D%0AYou're welcome.");
    const html = ('Oops! Please ' + sendUsACopy[0].outerHTML +
      " of the following trace:<br><br><pre style='max-height: 500px; overflow: hidden'>" +
      StringRenderers.htmlEscape(trace) + '</pre>' + postScript);
    if (refresh) {
      DeprecatedDialogBox.confirm({
        messageHTML: html,
        confirmButton: 'Reload page',
        cancelButton: 'Close',
        confirm() { window.location.reload(true); },
      });
    } else {
      DeprecatedDialogBox.alert(html, true, 'Close');
    }
  };
  window.onerror = function(error) {
    if (!$('.tb-status').hasClass('error')) {
      $('.tb-status').addClass('error');
      const trace = error.stack || JSON.stringify(arguments);
      let postScript = '';
      if (!error.stack) {
        postScript = '<br>See the developer console for more information about this error.';
      }
      const handler = function(e) {
        if (e) {
          e.preventDefault();
        }
        window.oops(trace, postScript, true);
      };
      $('.tb-status-msg-error').html('Internal error: <a href=#>report</a>');
      $('.tb-status-msg-error a').click(handler);
      window.recordEvent('jsException', null, trace);
      handler();
    }
  };
  window.conn.onInternalError(window.onerror);
  window.conn.start();

  window.clusterList = new ClusterList([], {
    deltaPublisherRoot: window.settings.clusterPublisherRootId,
  });
  window.clusterList.autoUpdate();

  // TODO(PROD-6844): refresh zone information when it contains dynamic information
  // we may also want to make it a proper collection; right now it is just an array

  // NOTE: Use window.tablelist in CodeMirrorKeywords to load table names
  window.tableList = new CollectionDeltaReceiver([], {
    deltaPublisherRoot: window.settings.tablesPublisherRootId,
    model: Table,
    comparator: (ab) => ab.get('name'),
  });
  window.tableList.startWatching();

  window.treeCollection = new TreeNodeCollection();
  window.fileBrowserView = new FileBrowserView({
    el: $('#filebrowser-popup .filebrowser'),
    model: window.treeCollection,
    tables: window.tableList,
  });

  // Listen to shells being removed and navigate away from them if they're open. Note that we
  // don't do this for dashboards because we get a "remove" on the Dashboard object itself,
  // but ShellCommandView doesn't currently keep the File object for the shell.
  window.treeCollection.on('remove', function(model) {
    const fragment = model.get('viewRoute') || model.get('type') + '/' + model.get('id');
    if (window.fragmentToView.hasOwnProperty(fragment)) {
      NavFunc.removeView(window.fragmentToView[fragment]);
    }
    delete window.shellSessionHash[model.get('id')];
  });

  // Listen to tables being removed to delete their cached view.
  window.tableList.on('remove', function(model) {
    const fragment = model.get('viewRoute');
    if (window.fragmentToView.hasOwnProperty(fragment)) {
      NavFunc.removeView(window.fragmentToView[fragment]);
    }
  });

  window.alertBox = function(msg) {
    DeprecatedDialogBox.alert(msg, true, 'Close');
  };

  window.onbeforeunload = function() {
    if (outstandingMutations > 0) {
      return 'You have unsaved changes.';
    }
  };

  if (window.settings.enablePresenceUI) {
    const presenceView = new PresenceView({
      model: Presence,
      el: $('span.tb-status-presence'),
    });
    presenceView.render();
  }

  if (window.settings.enableDebugUI) {
    $('#debugHelper').show();
  }

  setUpUserMenu();
  setUpFilebrowserContextMenu();
  setUpNewHelpIcon();
  setUpSidebar();

  setInterval(function() {
    if (window.numKeystrokes > 0) {
      window.recordUsage('browserKeystrokes', window.numKeystrokes);
      window.numKeystrokes = 0;
    }
  }, 10000);

  Backbone.history.start();

  if (window.settings.enableFeedback) {
    FeedbackUtils.setupFeedbackWidget(
      window.settings.useDevTierFeedbackWidget,
      window.settings.feedbackEmail || 'feedback@databricks.com',
      window.settings.dbcForumURL || 'https://forums.databricks.com');
  }
}

// Called if the user has multiple workspaces they can log in to. Once the user chooses a
// workspace this function calls the passed callback to finish login.
function workspaceSelectionScreen(workspaces) {
  const elem = $('<div/>').appendTo($('body'));
  const LoginOrgSelectionViewFactory = React.createFactory(LoginOrgSelectionView);
  const viewElem = LoginOrgSelectionViewFactory({
    // the workspaces available to be selected
    availableWorkspaces: workspaces,
    // callback that is called when a workspace is selected
    // called with the orgId selected, a callback for when loading complete, and the click/key event
    selectFunc(orgId, doneCallback) {
      // function to unmount the login page
      const unmount = function() {
        ReactDOM.unmountComponentAtNode(elem[0]);
        elem.remove();
        // TODO(PROD-9182): figure out how to get window.history.pushState to store the correct
        // state so that the back button correctly navigates back to this page
      };

      if (window.settings.orgId === orgId) {
        // if the user selected the org we already loaded, just continue with the login process
        doneCallback();
        unmount();
        continueInit();
      } else {
        // refetch the config for the selected org and continue the login process
        BrowserUtils.getSettings(orgId, function() {
          doneCallback();
          unmount();
          continueInit();
        });
      }
    },
  });

  ReactDOM.render(viewElem, elem[0]);
}

$(function() {
  // This signals other tabs that a login has occurred, so they should refresh
  // If localStorage isn't available this feature does not work.
  if (window.localStorage) {
    try {
      window.localStorage.setItem('login', Date().toString());
    } catch (err) {
      console.error('Error storing to local storage');
    }
  }
  const params = LoginUtils.getParams();
  let chosenWorkspaceId = null;
  if (params.o) {
    chosenWorkspaceId = params.o;
  }

  // Grab the configuration for the webapp
  BrowserUtils.getSettings(chosenWorkspaceId, function() {
    const confirmedWorkspaces = window.settings.availableWorkspaces.filter(function(workspace) {
      return !workspace.needsConfirmation;
    });
    if (chosenWorkspaceId === null && confirmedWorkspaces.length > 1) {
      workspaceSelectionScreen(confirmedWorkspaces);
    } else {
      continueInit();
    }
  });
});

// Our server understands HTTP PUT, DELETE and application/json
Backbone.emulateHTTP = false;
Backbone.emulateJSON = false;
