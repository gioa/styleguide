/* eslint react/prefer-es6-class: 0 */

import React from 'react';

import SearchViewMixin from '../search/SearchViewMixin.jsx';
import FileTreeNameSearchAdapter from '../search/FileTreeNameSearchAdapter';
import NotebookFullTextSearchAdapter from '../search/NotebookFullTextSearchAdapter';

/** SearchPanelView contains the search input box and a list of SearchResultItems */
const SearchPanelView = React.createClass({

  propTypes: {
    topLevelFolders: React.PropTypes.array.isRequired,
    toggleSearchPanelFunc: React.PropTypes.func.isRequired,
    closeFileBrowserFunc: React.PropTypes.func.isRequired,
    navigateFunc: React.PropTypes.func.isRequired,
    enableFullTextSearch: React.PropTypes.bool.isRequired,
  },

  mixins: [SearchViewMixin],

  searchName: 'panel',

  initSearchAdapters() {
    const adapters = [new FileTreeNameSearchAdapter(this.props.topLevelFolders, null, true)];
    if (this.props.enableFullTextSearch) {
      adapters.push(new NotebookFullTextSearchAdapter(window.conn.wsClient));
    }
    return adapters;
  },

  categoryProps: {
    'workspace': { displayName: 'Workspace', order: 1 },
    'table': { displayName: 'Tables', order: 2 },
    'menu': { displayName: 'Menu', order: 3 },
    'help': { displayName: 'Databricks Guide', order: 4 },
  },

  /** Should call when the panel is opened */
  onShowPanel() {
    this.getSearchInput().select();
    this.getSearchInput().focus();
    this.forceUpdate();
  },

  /** Should call when the panel is closed */
  onHidePanel() {
    // TODO (jeffpang) PROD-3420: do nothing for now; implement un-highlighting here
  },

  onSearchSelectionEnterKey(result) {
    this.props.navigateFunc(result.url);

    if (result.itemType === 'shell') {
      this.props.toggleSearchPanelFunc();
    }
  },

  onSearchSelectionClick(result, event, doubleClick) {
    this._prepareToShowSearchResult(result);
    if (doubleClick) {
      // double-click means close the search bar
      this.props.toggleSearchPanelFunc();
      // the first click will navigate us there, so we don't need to do anything
      event.preventDefault();
    } else {
      // otherwise, keep the focus in the search bar
      this.getSearchInput().focus();
    }
    // the href click event is propagated so we'll navigate using the browser default behavior
  },

  onSearchSelectionLinger(result) {
    this._prepareToShowSearchResult(result);
    if (result.itemType === 'shell') {
      this.props.navigateFunc(result.url);
    }
    // maintain focus in the search box
    this.getSearchInput().focus();
  },

  _prepareToShowSearchResult(result) {
    if (result.url.indexOf('#folder') !== 0) {
      // close the filebrowser unless the target is a folder, which is shown in the filebrowser
      this.props.closeFileBrowserFunc();
    }
  },

  render() {
    // add "searchbox" class to be compatible with old search selenium driver
    const input = this.renderSearchInput(['searchbox']);
    const spinner = this.renderSpinner();
    const results = this.renderSearchResults();

    return (
      <div>
        <div className='newsearch'>
          { input }
          { spinner }
        </div>
        { results }
      </div>
    );
  },
});

module.exports = SearchPanelView;
