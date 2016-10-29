// external dependencies defined in the HTML file that includes this JS file
/* global __DATABRICKS_NOTEBOOK_MODEL */
/* global startPage */
/* global tableOfContentsCell */

import $ from 'jquery';

import React from 'react';
import ReactDOM from 'react-dom';

import ImportUtilities from './ImportUtilities';
import StaticNotebookView from './StaticNotebookView.jsx';

import NProgress from '../../lib/nprogress';

NProgress.configure({ minimum: 0.75, showSpinner: false, parent: '#overallView' });

function framed() {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}

// __DATABRICKS_NOTEBOOK_MODEL is an external dependency from HtmlExporter.scala.
if (typeof __DATABRICKS_NOTEBOOK_MODEL !== 'undefined') {
  window.recordEvent = () => {};
  window.recordUsage = () => {};
  window.settings.isStaticNotebook = true;

  const internalJson = ImportUtilities.importNotebookV1(__DATABRICKS_NOTEBOOK_MODEL);
  const notebookModelJson = internalJson.notebook;
  let notebookModelCommandCollection = internalJson.commands;
  notebookModelCommandCollection = notebookModelCommandCollection.concat(internalJson.dashboards);

  const showTopBar = !framed() && (window.location.search.indexOf('hideTopBar') === -1);
  const showImportButton = window.settings.enableStaticHtmlImport;

  $(document).ready(() => {
    if (framed()) {
      $(window).unload(() => {
        window.parent.postMessage({
          type: 'unload',
        }, '*');
      });
      window.parent.postMessage({
        type: 'setLocation',
        title: notebookModelJson.name,
        language: notebookModelJson.language,
        path: location.pathname,
      }, '*');
    } else if (typeof tableOfContentsCell !== 'undefined') {
      let position = -1;
      if (notebookModelCommandCollection) {
        position = notebookModelCommandCollection.length > 0 ?
          notebookModelCommandCollection[0].position - 1 : 0;
      }
      tableOfContentsCell.type = 'command';
      tableOfContentsCell.position = position;
      notebookModelCommandCollection.push(tableOfContentsCell);
    }
    let tableOfContentsStartPage = null;
    if (typeof startPage !== 'undefined') {
      tableOfContentsStartPage = startPage;
    }
    window.view = ReactDOM.render(
      <StaticNotebookView
        notebookModelObject={notebookModelJson}
        notebookModelCommandCollection={notebookModelCommandCollection}
        tableOfContentsStartPage={tableOfContentsStartPage}
        showTopBar={showTopBar}
        showImportButton={showImportButton}
        signupUrl={window.settings.signupUrl}
        showDashboardId={window.settings.staticNotebookDashboardId}
        isDevelopmentVersion={window.settings.deploymentMode === 'development'}
      />, document.body);
    // Rewrite links. Must be done immediately after rendering, to avoid race conditions.
    if (typeof startPage !== 'undefined') {
      NProgress.start();
      $('a').not("[target='_blank']").attr('target', 'rightpane').on('click', (e) => {
        if (e.ctrlKey || e.shiftKey || e.metaKey || (e.button && e.button === 1)) {
          return;
        }
        if ($(e.target).attr('href')) {
          NProgress.start();
        }
      });
    }
    window.addEventListener('message', function messageListener(msg) {
      if (msg.data.type === 'setLocation') {
        $('.tb-title').text(msg.data.title);
        NProgress.done();
        const pathHash = '#' + msg.data.path.substring(location.pathname.lastIndexOf('/') + 1);
        history.replaceState(null, null, pathHash);
        // propagate the event if we are framed ourselves
        if (framed()) {
          window.parent.postMessage({
            type: 'setLocation',
            title: msg.data.title,
            language: msg.data.language,
            path: location.pathname + pathHash,
          }, '*');
        }
      } else if (msg.data.type === 'unload') {
        $('.tb-title').text('');
        NProgress.start();
        // propagate the event if we are framed ourselves
        if (framed()) {
          window.parent.postMessage({
            type: 'unload',
          }, '*');
        }
      }
    });
    if (framed()) {
      // Overflow scrolling is handled by the iframe's parent.
      $('#content').css('overflow-x', 'hidden');
      // Make external links open outside the frame.
      $('a').each((i, e) => {
        const href = $(e).attr('href');
        if (href && href.indexOf('http') === 0) {
          $(e).attr('target', '_blank');
        }
      });
    }
  });
}
