/* eslint react/prefer-es6-class: 0, react/no-is-mounted: 0, func-names: 0 */

import _ from 'underscore';
import React from 'react';

import ListSearchAdapter from '../../search/ListSearchAdapter';
import MavenCentralSearchAdapter from '../../search/MavenCentralSearchAdapter';
import SearchService from '../../search/SearchService';
import SearchViewMixin from '../../search/SearchViewMixin.jsx';
import SearchUtils from '../../search/SearchUtils';

import MavenPackageList from '../../libraries/search/MavenPackageList';
import MavenPackageListView from '../../libraries/search/MavenPackageListView.jsx';
import SparkPackage from '../../libraries/search/SparkPackage';
import SparkPackageDetailView from '../../libraries/search/SparkPackageDetailView.jsx';
import SparkPackageList from '../../libraries/search/SparkPackageList';
import SparkPackageListView from '../../libraries/search/SparkPackageListView.jsx';

import ReactModal from '../../ui_building_blocks/dialogs/ReactModal.jsx';
import ReactModalUtils from '../../ui_building_blocks/dialogs/ReactModalUtils';
import IconsForType from '../../ui_building_blocks/icons/IconsForType';

// key codes
const ENTER = 13;

const PackageBrowserHeader = React.createClass({

  propTypes: {
    isFetching: React.PropTypes.bool.isRequired,
    parentChangeSource: React.PropTypes.func.isRequired,
    isSparkPackages: React.PropTypes.bool.isRequired,
    parentSearchPackages: React.PropTypes.func.isRequired,
  },

  changeSource() {
    const selector = this.refs.browseSelect;
    const opt = selector.options[selector.selectedIndex];
    this.refs.searchInput.value = '';
    this.props.parentChangeSource(opt.value);
    this.refs.searchInput.focus();
  },

  _searchPackages(force) {
    const query = this.refs.searchInput.value;
    this.props.parentSearchPackages(query, force);
  },

  // Wait for the user to stop typing
  searchPackagesOnInput: _.debounce(function() {
    this._searchPackages();
  }, 1000),

  handleSearchKeyDown(e) {
    if (e.keyCode === ENTER) {
      e.preventDefault();
      this._searchPackages(true);
    }
  },

  componentDidMount() {
    this.refs.searchInput.focus();
  },

  render() {
    const selected = this.props.isSparkPackages ? 'sp' : 'maven';
    const spinnerClass = 'package-search-spinner';
    const spClasses = this.props.isFetching ? spinnerClass + ' show-spinner' : spinnerClass;
    const spinner = (<span className={spClasses}>
      &nbsp;&nbsp;<i className={'fa fa-' + IconsForType.inProgress}></i> Searching</span>);

    return (
      <div className='modal-header-search'>
        <h3>Search Packages</h3>
        <div className='multi-input-row package-search-header'>
          <input className='package-search-input' type='text' ref='searchInput' id='searchInput'
            onKeyDown={this.handleSearchKeyDown}
            onInput={this.searchPackagesOnInput}
          />
          <a className='pointer' onClick={this._searchPackages}>
            <i className='fa fa-fw fa-search package-search-icon'></i>
          </a>
          {spinner}
          <select ref='browseSelect' value={selected} id='browseSelect'
            className='package-search-selector' onChange={this.changeSource}
          >
            <option value='sp'>Spark Packages</option>
            <option value='maven'>Maven Central</option>
          </select>
        </div>
      </div>
    );
  },
});

function PackageBrowserBody({
  isFetching,
  isSparkPackages,
  sparkPackages,
  mavenPackages,
  searchInput,
  selectRelease,
  showDetailPage,
}) {
  let table;
  if (isSparkPackages) {
    table = (
      <SparkPackageListView
        packages={sparkPackages}
        selectRelease={selectRelease}
        searchInput={searchInput}
        isFetching={isFetching}
        showDetailPage={showDetailPage}
      />);
  } else {
    table = (
      <MavenPackageListView
        packages={mavenPackages}
        selectRelease={selectRelease}
        searchInput={searchInput}
        isFetching={isFetching}
      />);
  }
  return (
    <div className='modal-body-table'>{table}</div>
  );
}

PackageBrowserBody.propTypes = {
  isFetching: React.PropTypes.bool.isRequired,
  isSparkPackages: React.PropTypes.bool.isRequired,
  sparkPackages: React.PropTypes.instanceOf(SparkPackageList),
  mavenPackages: React.PropTypes.instanceOf(MavenPackageList),
  searchInput: React.PropTypes.string.isRequired,
  selectRelease: React.PropTypes.func.isRequired,
  showDetailPage: React.PropTypes.func.isRequired,
};

function PackageBrowserFooter() {
  return (
    <div>
      <a data-dismiss='modal' className='btn btn-primary confirm-button' tabIndex='1'>Close</a>
    </div>
  );
}

function PackageDetailHeader({ closeDetailPage }) {
  return (
    <div>
      <a className='context-bar-item pointer' onClick={closeDetailPage}>
        <i className='fa fa-fw fa-chevron-left'></i> Back
      </a>
    </div>
  );
}

PackageDetailHeader.propTypes = {
  closeDetailPage: React.PropTypes.func.isRequired,
};

const PackageDetailBody = React.createClass({

  propTypes: {
    model: React.PropTypes.instanceOf(SparkPackage).isRequired,
    selectRelease: React.PropTypes.func.isRequired,
  },

  componentWillMount() {
    this.props.model.fetchTags();
  },

  render() {
    return (
      <SparkPackageDetailView
        package={this.props.model}
        selectRelease={this.props.selectRelease}
      />
    );
  },

});

const PackageBrowserModalView = React.createClass({

  propTypes: {
    coordinateInput: React.PropTypes.object.isRequired,
    sparkPackages: React.PropTypes.instanceOf(SparkPackageList),
    mavenPackages: React.PropTypes.instanceOf(MavenPackageList),
    callback: React.PropTypes.func.isRequired,
  },

  getInitialState() {
    // Initialize search services for Spark Packages and Maven.
    this.mavenSearchService = new SearchService([new MavenCentralSearchAdapter()]);
    this._initializeSpSearchService();
    this.sparkPackages = this.props.sparkPackages;
    this.mavenPackages = this.props.mavenPackages;

    return {
      isSparkPackages: true,
      searchInput: '',
      isFetching: false,
      isDetailPage: false,
    };
  },

  mixins: [SearchViewMixin],

  searchAdapters: [],

  categoryProps: {},

  searchName: 'package-search',

  // Since we initialize the list adapter with the package list, in some cases, the list may not
  // be fully fetched yet. In that case, we may need to re-initialize the service.
  _initializeSpSearchService() {
    this.spSearchService = new SearchService(
      [new ListSearchAdapter(window.sparkPackageList.models, SearchUtils.sparkPackageMatches)]);
  },

  _forceUpdate() {
    if (this.isMounted()) {
      this.forceUpdate();
    }
  },

  componentDidMount() {
    this.sparkPackages.on('change add remove reset', this._forceUpdate.bind(this, null), this);
    this.mavenPackages.on('change add remove reset', this._forceUpdate.bind(this, null), this);
  },

  componentWillUnmount() {
    this.sparkPackages.off(null, null, this);
    this.mavenPackages.off(null, null, this);
  },

  changeSource(value) {
    const isSparkPackages = value === 'sp';
    this.setState({
      isSparkPackages: isSparkPackages,
      isFetching: false,
    });
  },

  searchPackages(query, force) {
    const self = this;
    const searchText = query.trim();
    // the search service initially returns an empty list which causes a flicker in
    // the view, because the rows are emptied. This is a hack to intercept the first empty list
    let initialZeroReceived = false;
    if (searchText !== self.lastSearchText || force) {
      if (this.state.isSparkPackages) {
        if (this.spSearchService.searchAdapters[0].list.length === 0) {
          this._initializeSpSearchService();
        }
        this.spSearchService.search(searchText, function(result, finished) {
          if (finished && initialZeroReceived) {
            self.sparkPackages = new SparkPackageList(result);
            self.searchResultCount = result.length;
            self.fetchFinished();
          }
          initialZeroReceived = true;
        }, !force);
      } else {
        this.mavenSearchService.search(searchText, function(result, finished) {
          if (finished && initialZeroReceived) {
            self.mavenPackages = new MavenPackageList(result);
            self.searchResultCount = result.length;
            self.fetchFinished();
          }
          initialZeroReceived = true;
        }, !force);
      }
      self.lastSearchText = searchText;
      self.lastSearchTime = (new Date()).getTime();
      self._recordQueryEntered();
      this.setState({
        searchInput: searchText,
        isFetching: true,
      });
    }
  },

  fetchFinished() {
    if (!this.isMounted()) {
      return;
    }
    this._recordQueryFinished();
    this.setState({
      isFetching: false,
    });
  },

  /** Main method used by both Maven and Spark Packages to fill the input box with the
   corresponding package. */
  selectRelease(coordinate, type, fromDetailPage) {
    // record event
    this._recordResultClicked('packageBrowserClick', {
      packageBrowserClickType: 'select',
      packageType: type,
      packageName: coordinate,
      packageClickFromDetailPage: fromDetailPage,
    });
    this.props.coordinateInput.val(coordinate);
    this.props.callback();
    ReactModalUtils.destroyModal();
  },

  /** Opens the detail page for a Spark Package */
  showDetailPage(sparkPackage) {
    this._recordResultClicked('packageBrowserClick', {
      packageBrowserClickType: 'detail',
      packageType: 'spark',
      packageName: sparkPackage.fullName(),
    });
    this.setState({
      isDetailPage: true,
      showDetailsFor: sparkPackage,
    });
  },

  closeDetailPage() {
    this.setState({
      isDetailPage: false,
      showDetailsFor: null,
    });
  },

  _recordResultClicked(eventName, extraTags) {
    this._recordEvent(eventName, this.tags(extraTags));
  },

  _renderHeaderAndBody() {
    let header;
    let body;
    if (this.state.isDetailPage && this.state.showDetailsFor) {
      header = (<PackageDetailHeader closeDetailPage={this.closeDetailPage} />);
      body = (<PackageDetailBody
        model={this.state.showDetailsFor}
        selectRelease={this.selectRelease}
      />);
    } else {
      header = (<PackageBrowserHeader
        isFetching={this.state.isFetching}
        parentChangeSource={this.changeSource}
        isSparkPackages={this.state.isSparkPackages}
        parentSearchPackages={this.searchPackages}
      />);

      body = (<PackageBrowserBody
        isFetching={this.state.isFetching}
        isSparkPackages={this.state.isSparkPackages}
        sparkPackages={this.sparkPackages}
        mavenPackages={this.mavenPackages}
        searchInput={this.state.searchInput}
        selectRelease={this.selectRelease}
        showDetailPage={this.showDetailPage}
      />);
    }

    return { h: header, b: body };
  },

  render() {
    const contents = this._renderHeaderAndBody();
    const modalName = this.state.isDetailPage ? 'package-details' : 'package-search';
    const footer = <PackageBrowserFooter />;

    return (
      <ReactModal
        modalName={modalName}
        header={contents.h}
        body={contents.b}
        footer={footer}
      />
    );
  },
});

module.exports = PackageBrowserModalView;
