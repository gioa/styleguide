/* eslint react/prefer-es6-class: 0, consistent-return: 0, func-names: 0 */

import $ from 'jquery';
import _ from 'underscore';
import React from 'react';
import ReactDOM from 'react-dom';

import KeyboardShortcutsView from '../notebook/KeyboardShortcutsView.jsx';

import SearchViewMixin from '../search/SearchViewMixin.jsx';
import ListSearchAdapter from '../search/ListSearchAdapter';
import FileTreeNameSearchAdapter from '../search/FileTreeNameSearchAdapter';
import NotebookFullTextSearchAdapter from '../search/NotebookFullTextSearchAdapter';
import DatabricksForumSearchAdapter from '../search/DatabricksForumSearchAdapter';
import GoogleCustomSearchAdapter from '../search/GoogleCustomSearchAdapter';
import GoogleCustomSearchParams from '../search/GoogleCustomSearchParams';

import ReactModalUtils from '../ui_building_blocks/dialogs/ReactModalUtils';

import { DbGuideUrls } from '../urls/DbGuideUrls';

// Key codes
const ESC = 27;

const SHORTCUT_URL = 'SHORTCUT_URL';

const menuItem = function(id, name, icon, url) {
  return {
    id: id,
    category: 'help-menu',
    itemType: 'help-menu',
    icon: icon,
    displayName: name,
    fullName: name,
    url: url,
  };
};

// default menu items to show when the search input is empty
const getMenuItemResults = function() {
  const dbGuideUrl = DbGuideUrls.getDbGuideUrl(window.settings.dbcGuideURL);
  const restApiDocURL =
    (window.settings.docsDomain + window.settings.restApiDocPath) || '/doc/api';
  const feedbackStr = window.settings.allowFeedbackForumAccess ? 'Feedback' : 'Contact Us';
  const results = [
    menuItem('guide-button', 'Databricks Guide', 'book', dbGuideUrl),
    menuItem('api-docs-button', 'REST API Docs', 'book', restApiDocURL),
    menuItem('forum-button', 'Community Forum', 'question', window.settings.dbcForumURL),
    menuItem('feedback-button', feedbackStr, 'envelope', window.settings.dbcFeedbackURL),
    menuItem('shortcut-button', 'Shortcuts', 'keyboard-o', SHORTCUT_URL),
  ];
  if (window.settings.dbcSupportURL) {
    results.push(menuItem('support-button', 'Support', 'phone', window.settings.dbcSupportURL));
  }
  return results;
};

const menuItemMatchFunc = function(query) {
  // only show menu items when the search is empty
  return query === '';
};

const HelpMenuView = React.createClass({

  propTypes: {
    topLevelFolders: React.PropTypes.array.isRequired,
    hideFunc: React.PropTypes.func.isRequired,
    closeFileBrowserFunc: React.PropTypes.func.isRequired,
    navigateFunc: React.PropTypes.func.isRequired,
    enableFullTextSearch: React.PropTypes.bool.isRequired,
    enableSparkDocsSearch: React.PropTypes.bool.isRequired,
    sparkDocsSearchGoogleCx: React.PropTypes.string,
    useStaticGuide: React.PropTypes.bool,
  },

  mixins: [SearchViewMixin],

  searchName: 'help',

  categoryProps: {
    'help-menu': { displayName: '', order: 0, noHeader: true },
    'help': { displayName: 'Databricks Guide', order: 1 },
    'spark-docs': { displayName: 'Apache Spark Documentation', order: 2 },
    'forum': { displayName: 'Forum', order: 3 },
  },

  initSearchAdapters() {
    const adapters = [
      // The ListSearch is used to display the default menu items when there is no search
      new ListSearchAdapter(getMenuItemResults(), menuItemMatchFunc),
      new DatabricksForumSearchAdapter(),
    ];

    if (!this.props.useStaticGuide) {
      adapters.push(new FileTreeNameSearchAdapter(this.props.topLevelFolders));
      if (this.props.enableFullTextSearch) {
        // TODO(jeffpang): filter for help category results on the server side
        adapters.push(new NotebookFullTextSearchAdapter(window.conn.wsClient));
      }
    }

    if (this.props.enableSparkDocsSearch || this.props.useStaticGuide) {
      // google custom search that searches http://spark.apache.org/docs/latest/
      const categoryParams = [];
      if (this.props.enableSparkDocsSearch) {
        categoryParams.push(GoogleCustomSearchParams.sparkDocs);
      }
      // google custom search that searches http://docs.databricks.com/latest/databricks_guide/
      if (this.props.useStaticGuide) {
        categoryParams.push(GoogleCustomSearchParams.databricksGuide);
      }

      adapters.push(new GoogleCustomSearchAdapter(
        this.props.sparkDocsSearchGoogleCx,
        categoryParams
      ));
    }
    return adapters;
  },

  componentDidMount() {
    const self = this;
    $(window).resize(function() { self.forceUpdate(); });
  },

  openShortcutModal() {
    ReactModalUtils.createModal(
      <KeyboardShortcutsView
        style={{ left: 0 }}
        defaultCloseIcon
        defaultOpenState
      />
    );
  },

  onShow() {
    const result = this.getSelectedSearchResult();
    if (result && result.category === 'help-menu') {
      this.clearSelectedSearchResult();
    }
    ReactDOM.findDOMNode(this.getSearchInput()).select();
    ReactDOM.findDOMNode(this.getSearchInput()).focus();
    this.forceUpdate();
  },

  onHide() {},

  onSearchSelectionEnterKey(result) {
    window.open(result.url, '_blank');
    this.props.hideFunc();
  },

  onSearchSelectionClick(result, event) {
    if (result.url === SHORTCUT_URL) {
      event.stopPropagation();
      event.preventDefault();
      this.openShortcutModal();
      this._recordEvent('shortcutsViewed', {
        clickOrigin: 'helpMenuShortcutsLink',
      });
      return false;
    }
    window.open(result.url, '_blank');
    event.preventDefault();
    this.props.hideFunc();
    // the click event is propagated so we'll navigate to # links using browser default behavior
  },

  onSearchInputKeyDown(event) {
    if (event.which === ESC) {
      this.props.hideFunc();
      event.preventDefault();
    }
  },

  render() {
    const input = this.renderSearchInput();
    const spinner = this.renderSpinner();
    const results = this.renderSearchResults();

    return (
      <div>
        <div className='input'>
          <i className='fa fa-search fa-fw'></i>
          { input }
          { spinner }
        </div>
        { results }
      </div>
    );
  },

  componentDidUpdate() {
    // set the max height of the help menu so it doesn't overflow the view
    if (this.refs.searchResults) {
      const contextBar = $('#context-bar')[0];
      const content = $('#content')[0];
      if ((!contextBar) || (!content)) {
        return;
      }
      const contentRect = content.getBoundingClientRect();
      let viewHeight = contentRect.bottom - contentRect.top;
      if (contextBar) {
        const contextBarRect = contextBar.getBoundingClientRect();
        viewHeight = viewHeight + contextBarRect.bottom - contextBarRect.top;
      }
      $(ReactDOM.findDOMNode(this.refs.searchResults)).css('max-height', (viewHeight - 65) + 'px');
    }
  },

  getEventTags() {
    // PROD-4147: record forum result count
    const forumResultCount = _.filter(this.state.orderedResults, function(result) {
      return result.category === 'forum';
    }).length;
    return {
      searchForumResultCount: forumResultCount,
    };
  },
});

module.exports = HelpMenuView;
