/* eslint react/prefer-es6-class: 0, complexity: 0, func-names: 0 */

import _ from 'underscore';

import React from 'react';
import ReactDOM from 'react-dom';
import ClassNames from 'classnames';

import SearchService from '../search/SearchService';

import IconsForType from '../ui_building_blocks/icons/IconsForType';

// Key codes
const ENTER = 13;
const UP_ARROW = 38;
const DOWN_ARROW = 40;

/** SearchResultItem is the view for a single search result */
const SearchResultItem = React.createClass({
  propTypes: {
    result: React.PropTypes.object.isRequired,
    selected: React.PropTypes.bool.isRequired,
    selectFunc: React.PropTypes.func.isRequired,
  },

  getInitialState() {
    return {};
  },

  onClick(event) {
    const now = (new Date()).getTime();
    const doubleClick = now - (this.lastClickTime || 0) < 1000;
    this.props.selectFunc(event, doubleClick);
    this.lastClickTime = now;
  },

  render() {
    const hrefClasses = ClassNames({ selected: this.props.selected });
    const iconClassStr = 'fa fa-' + this.props.result.icon + ' fa-fw';
    return (
      <li className='result'>
        <a href={this.props.result.url || '#'}
          className={hrefClasses} data-name={this.props.result.displayName}
          title={this.props.result.fullName} onClick={this.onClick}
        >
          <i className={iconClassStr}></i>
          <span>
            {this.props.result.displayName}
          </span>
        </a>
      </li>
    );
  },
});

/**
 * A ReactView mixin for implementing Search Views. The mixin provides methods for showing
 * the input box, a progress spinner, and a list of search results. It supports navigating
 * between search results using arrow keys.
 *
 * An example class that mixes in this mixin:
 *
 * const ExampleSearchView = React.createClass({
 *
 *   // A string the names the search, which is reported in recorded metrics.
 *   // This can also be passed in as a prop to the view. (OPTIONAL)
 *   searchName: "example",
 *
 *   // An array of SearchAdapters that this search view will use for searches. (MANDATORY)
 *   //
 *   // Alternatively, you can instead define an array or pass it in as a prop. e.g.,
 *   //   searchAdapters: [ ... ]
 *   //   propTypes: { searchAdapters: React.PropTypes.array }
 *   //
 *   // Note that in all 3 cases, the adapters will only be obtained once during initialization.
 *   initSearchAdapters: function() {
 *     return [new FileTreeNameSearchAdapter(), new NotebookFullTextSearchAdapter()];
 *   },
 *
 *   // Get a hash of properties about each result category. Only results with a category in
 *   // this hash are shown. Results are ordered and sorted by category. (MANDATORY)
 *   //
 *   // Mandatory category fields:
 *   //  displayName: the label to show for that category
 *   //  order: the order to show the categories.
 *   //
 *   // Optional category fields:
 *   //  noHeader: don't show a header row for this category above its results.
 *   //
 *   // This can also be defined as a hash or passed in as a prop. e.g.,
 *   //   categoryProps: { ... }
 *   //   propTypes: { categoryProps: React.PropTypes.object }
 *   getCategoryProps: function() {
 *     return {
 *       "workspace": {displayName: "Workspace", order: 1},
 *       "table": {displayName: "Tables", order: 2},
 *       "menu": {displayName: "Menu", order: 3}
 *     };
 *   },
 *
 *   // Called when the user clicks Enter and there is a selected search item. (Optional)
 *   onSearchSelectionEnterKey: function(result) {
 *      window.open(result.url);
 *   },
 *
 *   // Called when the search selection is clicked on via the primary mouse key. doubleClick is
 *   // true if the click occurred very close to the previous click (both clicks will call this
 *   // callback). The click event will propagate to to browser default click handler unless
 *   // event.preventDefault() is called. (Optional)
 *   onSearchSelectionClick: function(result, event, doubleClick) {
 *     window.open(result.url);
 *     event.preventDefault();
 *   },
 *
 *   // Called each time the user enters a new key in the search box, including control
 *   // characters. Useful to implement behavior on ESC and other special chars. (Optional)
 *   onSearchInputKeyDown: function(event) {
 *     if (event.which) {
 *       ...
 *     }
 *   },
 *
 *   // Called when the search selection has lingered on the same item for some time (i.e.,
 *   // indicating that user has stopped scrolling and has settled the cursor on the item).
 *   // You can implement search result preview via this callback (or do nothing). (Optional)
 *   onSearchSelectionLinger: function(result) {
 *     alert("You have selected result: " + result.fullName)
 *   },
 *
 *   // React render function (MANDATORY)
 *   render: function() {
 *     return (
 *       <div>
 *         { this.renderSearchInput() }
 *         { this.renderSpinner() }
 *         { this.renderSearchResults() }
 *       </div>
 *     );
 *   }
 * });
 *
 * Example views:
 *   search/SearchPanelView.jsx
 *   help_menu/HelpMenuView.jsx
 *
 * Example styles:
 *   css/searchpanel.css
 *   css/helpmenu.css
 *
 * Note on styling: if you make the <ul> have a fixed or max height, this mixin will
 * automatically scroll to the search selection when navigating between items.
 */
const SearchViewMixin = {

  propTypes: {
    // The unique name of this search (used for recording metrics) (OPTIONAL)
    searchName: React.PropTypes.string,
    // function to record metrics (default is window.recordEvent) (OPTIONAL)
    recordEvent: React.PropTypes.func,
    // This prop is used to override the search service, e.g., for testing (OPTIONAL)
    searchService: React.PropTypes.object,
    // Placeholder text for the input box (OPTIONAL)
    searchPlaceholder: React.PropTypes.string,
  },

  getInitialState() {
    const self = this;

    if (this.props.searchService) {
      this.service = this.props.searchService;
    } else {
      let searchAdapters;
      if (this.props.searchAdapters) {
        searchAdapters = this.props.searchAdapters;
      } else if (this.searchAdapters) {
        searchAdapters = this.searchAdapters;
      } else if (this.initSearchAdapters) {
        searchAdapters = this.initSearchAdapters();
        if (!searchAdapters) {
          console.warn(
            'SearchMixin subclass initSearchAdapters() returned no search adapters!');
        }
      } else {
        console.error(
          'SearchViewMixin requires searchAdapters or initSearchAdapters() to be defined.');
        searchAdapters = [];
      }
      this.service = new SearchService(searchAdapters);
    }

    if (!this.getCategoryProps) {
      this.getCategoryProps = function() {
        if (this.props.categoryProps) {
          return self.props.categoryProps;
        } else if (this.categoryProps) {
          return self.categoryProps;
        }
        console.error(
          'SearchViewMixin requires categoryProps or getCategoryProps() to be defined.');
        return {};
      };
    }

    // internal book-keeping state that should not trigger rendering
    this.lastSearchText = ''; // the previous search text that initiated a search
    this.lastSearchTime = 0; // the time the previous search was started
    this.scrollToSelectedSearchNode = false; // true if we should scroll to the selected node
    this.previewSearchNodeTimer = null; // timer to show the selected search node after a delay

    // force an initial empty search to populate any default search items
    _.defer(function() {
      self._updateSearchResults('', true);
    });

    return {
      orderedResults: [], // sorted search results to render
      selectedSearchNodeId: null, // ID of the node currently selected in search, if any
    };
  },

  /** Filter and sort the search results */
  _organizeResults(results) {
    const categoryProps = this.getCategoryProps();
    const filtered = _.filter(results, function(r) {
      return categoryProps[r.category];
    });
    const groups = _.groupBy(filtered, function(r) {
      return r.category;
    });
    const categories = _.sortBy(_.keys(groups), function(c) {
      return categoryProps[c].order;
    });
    const sorted = [];
    _.each(categories, function(c) {
      _.each(groups[c], function(d) {
        sorted.push(d);
      });
    });
    return sorted;
  },

  /**
   * Update the search panel with results. By default this won't update if the search string
   * is the same as before, but one can pass force = true to force an update.
   *
   * @param input the search query in the search input
   * @param force trigger a search even if the query has not changed
   */
  _updateSearchResults(input, force) {
    const self = this;

    if (!self.isMounted()) {
      return;
    }

    const searchText = input.trim();
    if (searchText !== self.lastSearchText || force) {
      const now = (new Date()).getTime();
      // Apply the query to cached results if all the following is true:
      // 1) An old search was initiated very recently (to prevent flickering as we are typing)
      // 2) The query is more than 1 character (empty or 1 char query indicates a new search)
      const useOldResults = now - self.lastSearchTime < 3000 && searchText.length > 1;
      self.service.search(searchText, function(results, finished) {
        if (!self.isMounted()) {
          return;
        }
        self.setState({ orderedResults: self._organizeResults(results) });
        if (finished) {
          self._recordQueryFinished();
        }
      }, useOldResults);
      self.lastSearchText = searchText;
      self.lastSearchTime = now;

      const selectedId = self.state.selectedSearchNodeId;
      if (_.every(self.state.orderedResults, function(r) {
        return r.id !== selectedId;
      })) {
        self.setState({ selectedSearchNodeId: null });
      }

      self._recordQueryEntered();
    }
  },

  /**
   * Update the selected item in search and possibly trigger the item.
   *
   * @param keyCode keydown keyCode event triggering us (either enter, up-arrow or down-arrow)
   */
  _updateSearchSelection(keyCode) {
    const self = this;
    const results = this.state.orderedResults;
    let result;
    let i;

    let selectedIndex = null;
    for (i = 0; i < results.length; i++) {
      if (results[i].id === this.state.selectedSearchNodeId) {
        selectedIndex = i;
        break;
      }
    }

    if (keyCode === ENTER) {
      if (selectedIndex !== null) {
        result = results[i];
        if (this.onSearchSelectionEnterKey) {
          this.onSearchSelectionEnterKey(result);
          this._recordResultSelected(result, selectedIndex, 'enter');
        }
        return;
      }
    } else if (keyCode === UP_ARROW) {
      if (selectedIndex !== null && selectedIndex > 0) {
        result = results[selectedIndex - 1];
      }
    } else if (keyCode === DOWN_ARROW) {  // DOWN_ARROW
      if (selectedIndex !== null && selectedIndex < results.length) {
        result = results[i + 1];
      } else if (results.length > 0) {
        result = results[0];
      }
    } else {
      return;
    }

    if (result) {
      // after the next render, make sure we we scrolled to a place where this node is visible
      this.scrollToSelectedSearchNode = true;
      // if the user selects a particular search result, preview it after a short delay.
      // the delay is needed so if the user uses the arrow keys to quickly skip over a
      // number of items, we don't try to navigate to all of them (only the one they stop on)
      if (this.state.selectedSearchNodeId !== result.id) {
        // if selection has changed quickly, cancel the previous preview timer
        if (this.previewSearchNodeTimer) {
          clearTimeout(this.previewSearchNodeTimer);
        }
        // set a timer so after a short delay, the router navigates to the selected node
        this.previewSearchNodeTimer = _.delay(function() {
          if (self.isMounted() && self.onSearchSelectionLinger) {
            self.onSearchSelectionLinger(result);
            self._recordResultSelected(result, results.indexOf(result), 'linger');
          }
          self.previewSearchNodeTimer = null;
        }, 200 /* ms */);
        this.setState({ selectedSearchNodeId: result.id });
      }
    }
  },

  _onUpdate(e) {
    this._updateSearchResults(e.target.value);
  },

  _onKeyDown(e) {
    if (e.which === ENTER || e.which === UP_ARROW || e.which === DOWN_ARROW) {
      this._updateSearchSelection(e.which);
      e.preventDefault();
    }
    if (this.onSearchInputKeyDown) {
      this.onSearchInputKeyDown(e);
    }
  },

  /**
   * Render the search input.
   *
   * @param classes {array} an optional list of classses to apply to the <input>
   * @returns {object} the search input, e.g., <input type="text" />
   */
  renderSearchInput(classes) {
    let classList = ['newsearch'];
    if (classes) {
      classList = classList.concat(classes);
    }
    const classString = classList.join(' ');
    return (
      <input ref='searchInput' className={classString} type='text' ref='searchInput'
        placeholder={this.props.searchPlaceholder}
        onChange={this._onUpdate}
        onPaste={this._onUpdate}
        onKeyUp={this._onUpdate}
        onKeyPress={this._onUpdate}
        onKeyDown={this._onKeyDown}
      />
    );
  },

  /**
   * Render a spinner if a search is in progress.
   *
   * @returns an <img> of a spinner if a search is in progress, null otherwise
   */
  renderSpinner() {
    let spinnerCls = 'search-mixin-spinner';
    if (!this.service.isFinished()) {
      spinnerCls += ' visible';
    }
    return (
      <span ref='spinner' className={spinnerCls}>
        <i className={'fa fa-' + IconsForType.inProgress}></i>
      </span>
    );
  },

  /**
   * Render a unordered list of the current search results.
   *
   * @returns An unordered list of search results. e.g.,
   *
   * <ul>
   *   <li>category1</li>
   *   <li>result1...</li>
   *   <li>result2...</li>
   *   <li>category2</li>
   *   <li>result3...</li>
   *   ...
   * </ul>
   */
  renderSearchResults() {
    const self = this;
    const categoryProps = this.getCategoryProps();

    // group results by category
    const groups = _.groupBy(this.state.orderedResults, function(d) {
      return d.category;
    });
    // insert one item for the category heading before each group of results
    const lists = _.map(groups, function(group, key) {
      // first render each search result item
      const items = _.map(group, function(result, i) {
        const selected = result.id === self.state.selectedSearchNodeId;
        const selectFunc = function(event, doubleclick) {
          self.setState({ selectedSearchNodeId: result.id });
          if (self.onSearchSelectionClick) {
            self.onSearchSelectionClick(result, event, doubleclick);
            self._recordResultSelected(result, i, doubleclick ? 'doubleclick' : 'click');
          }
        };
        return (
          <SearchResultItem
            key={result.id}
            result={result}
            selected={selected}
            ref={selected ? 'selected' : null}
            selectFunc={selectFunc}
          />
        );
      });
      // insert one item for the category heading for this list of search results
      if (categoryProps[key].noHeader) {
        return items;
      }
      const categoryItem = (
        <li className='category' key={key}>{categoryProps[key].displayName}</li>
      );
      return [categoryItem].concat(items);
    });

    return (
      <ul ref='searchResults'>
      { _.flatten(lists) }
      </ul>
    );
  },

  /** Get the search <input> rendered via renderSearchInput() */
  getSearchInput() { return this.refs.searchInput; },

  /** Get the <ul> rendered via renderSearchResults() */
  getSearchResults() { return this.refs.searchResults; },

  /** Get the search result that is currently selected */
  getSelectedSearchResult() {
    const results = this.state.orderedResults || [];
    for (let i = 0; i < results.length; i++) {
      if (results[i].id === this.state.selectedSearchNodeId) {
        return results[i];
      }
    }
    return null;
  },

  /** Clear the current search result selection */
  clearSelectedSearchResult() {
    this.setState({ selectedSearchNodeId: null });
  },

  /**
   * If the user navigated to a new search item, scroll the item into view.
   */
  componentDidUpdate() {
    const scrollIntoView = function(el, view) {
      const viewPort = view.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      if (rect.top < viewPort.top) {
        el.scrollIntoView(true);
      } else if (rect.bottom > viewPort.bottom) {
        el.scrollIntoView(false);
      }
    };

    if (this.scrollToSelectedSearchNode) {
      // scroll to the selected node on selection change
      this.scrollToSelectedSearchNode = false;
      const list = ReactDOM.findDOMNode(this.refs.searchResults);
      const item = ReactDOM.findDOMNode(this.refs.selected);
      if (item) {
        scrollIntoView(item, list);
      }
    }
  },

  /**
   * Common recordUsage() tags for this search view. A class implementing this mixin can also
   * implement a getEventTags() method that returns a hash. These tags will be added to the
   * standard tags for all search events. If a view uses this mixin, but doesn't directly use
   * the search functionality, they may specify the searchResultCount directly by
   * this.searchResultCount.
   *
   * @param extraTags {object=} additional tags to add to the dictionary
   */
  tags(extraTags) {
    let name;
    if (this.props.searchName) {
      name = this.props.searchName;
    } else if (this.searchName) {
      name = this.searchName;
    } else {
      name = 'default';
    }
    let common = {
      searchName: name,
      searchQuery: this.lastSearchText,
      searchQueryTime: this.lastSearchTime,
      searchResultCount: (this.searchResultCount ? this.searchResultCount :
        this.state.orderedResults.length),
    };
    if (this.getEventTags) {
      common = _.extend(common, this.getEventTags());
    }
    return _.extend(common, extraTags);
  },

  _recordEvent(event, tags) {
    // set the default of record event here because window.recordEvent isn't initialized when
    // getDefaultProps() is called
    const recordEvent = this.props.recordEvent ? this.props.recordEvent : window.recordEvent;
    recordEvent(event, tags);
  },

  _recordResultSelected(result, rank, trigger) {
    this._recordEvent('searchResultSelected', this.tags({
      searchResultTrigger: trigger,
      searchResultId: result.id,
      searchResultName: result.displayName,
      searchResultUrl: result.url,
      searchResultRank: rank,
    }));
  },

  // debounce so we only record when query is stable (i.e., user stops entering input)
  _recordQueryEntered: _.debounce(function() {
    if (this.lastSearchText !== '') {
      this._recordEvent('searchQueryEntered', this.tags());
    }
  }, 1000),

  // debounce so we only record when the results are stable (i.e., user stops entering input)
  _recordQueryFinished: _.debounce(function() {
    if (this.lastSearchText !== '') {
      this._recordEvent('searchQueryFinished', this.tags());
    }
  }, 1000),
};

module.exports = SearchViewMixin;
