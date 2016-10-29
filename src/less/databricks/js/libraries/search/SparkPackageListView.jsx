/* eslint react/prefer-es6-class: 0, react/no-is-mounted: 0 */

/**
 * Do not use this as an example for tables; it needs to be refactored to use
 * ReactTable's Table and Column. For now, see ClusterDetailsLibrariesList and
 * ClusterDetailsLibrariesListView.
 */

import React from 'react';

import SparkPackage from '../../libraries/search/SparkPackage';
import SparkPackageList from '../../libraries/search/SparkPackageList';
import SparkPackageRelease from '../../libraries/search/SparkPackageRelease';

import IconsForType from '../../ui_building_blocks/icons/IconsForType';
import SortableHeader from '../../ui_building_blocks/tables/SortableTableHeader.jsx';
import { TableView } from '../../ui_building_blocks/tables/Table.jsx';

function SPRelease({ model }) {
  const version = model.get('releaseVersion');
  const coordinate = model.artifactCoordinate();
  return (
    <option data-coordinate={coordinate} data-version={version}>{version}</option>
  );
}

SPRelease.propTypes = {
  model: React.PropTypes.instanceOf(SparkPackageRelease).isRequired,
};

/** Buttons for each row. Uninstall is not supported for now. */
function Options({ selectRelease, releasesLoaded }) {
  const addButton = (
    <a
      onClick={selectRelease}
      enabled={releasesLoaded}
      className='install-button with-icon pointer'
    >
      <i className='fa fa-plus fa-fw'></i>Select
    </a>
  );
  return (
    <div>
      <div>{addButton}</div>
    </div>
  );
}

Options.propTypes = {
  selectRelease: React.PropTypes.func.isRequired,
  releasesLoaded: React.PropTypes.bool.isRequired,
};

const SparkPackageRow = React.createClass({

  propTypes: {
    model: React.PropTypes.instanceOf(SparkPackage).isRequired,
    showDetailPage: React.PropTypes.func.isRequired,
    selectRelease: React.PropTypes.func.isRequired,
  },

  getInitialState() {
    return { installedRelease: false };
  },

  _forceUpdate() {
    if (this.isMounted()) {
      this.forceUpdate();
    }
  },

  componentDidMount() {
    const releases = this.props.model.get('packageReleases');
    if (releases) {
      releases.on('change add remove reset', this._forceUpdate.bind(this, null), this);
    }
  },

  componentWillUnmount() {
    const releases = this.props.model.get('packageReleases');
    if (releases) {
      releases.off(null, null, this);
    }
  },

  onSelectClicked() {
    const versionSelector = this.refs.release;
    const opt = versionSelector.options[versionSelector.selectedIndex];
    const coordinate = opt.dataset.coordinate;
    this.props.selectRelease(coordinate, 'spark', false);
  },

  packageDetails() {
    this.props.showDetailPage(this.props.model);
  },

  render() {
    const name = this.props.model.get('packageName');
    const organization = this.props.model.get('packageOrg');
    const description = this.props.model.get('packageShortDescription');
    const rating = this.props.model.get('packageRating');
    const releases = [];
    const packageReleases = this.props.model.get('packageReleases');
    if (packageReleases) {
      packageReleases.each((release) =>
        releases.push(<SPRelease key={release.cid} model={release} />));
    }

    const options = (<Options
      selectRelease={this.onSelectClicked}
      releasesLoaded={releases.length > 0}
    />);

    return (
      <tr>
        <td><a className='pointer' onClick={this.packageDetails}>{name}</a></td>
        <td>{organization}</td>
        <td>{description}</td>
        <td>{rating} / 5</td>
        <td><select ref='release' className='release-column'>{releases}</select></td>
        <td>{options}</td>
      </tr>
    );
  },
});

/**
 * Main table view to browse Spark Packages. Loaded inside the body of a ReactModal.
 *
 * @param packages List of Spark Packages to display. Packages are fetched once the app launches.
 * @param isFetching Whether a search process is ongoing in order to display a spinner.
 * @param searchInput What the last search input was. Helps in displaying the correct message.
 * @param showDetailPage Callback to show the detail page for a Spark Package.
 * @param selectRelease Callback to select a package.
 */
const SparkPackageListView = React.createClass({

  propTypes: {
    packages: React.PropTypes.instanceOf(SparkPackageList).isRequired,
    isFetching: React.PropTypes.bool.isRequired,
    searchInput: React.PropTypes.string,
    showDetailPage: React.PropTypes.func.isRequired,
    selectRelease: React.PropTypes.func.isRequired,
  },

  _forceUpdate() {
    if (this.isMounted()) {
      this.forceUpdate();
    }
  },

  componentDidMount() {
    this.props.packages.on('change add remove reset', this._forceUpdate.bind(this, null), this);
  },

  componentWillUnmount() {
    this.props.packages.off(null, null, this);
  },

  getInitialState() {
    return {
      ratingDesc: true,
      ratingAsc: false,
      nameDesc: false,
      nameAsc: false,
      orgDesc: false,
      orgAsc: false,
    };
  },

  sortColumn(col) {
    let ratingDesc = false;
    let ratingAsc = false;
    let nameDesc = false;
    let nameAsc = false;
    let orgDesc = false;
    let orgAsc = false;
    switch (col) {
      case 'name':
        if (!this.state.nameDesc && !this.state.nameAsc) {
          nameAsc = true;
        } else {
          nameDesc = !this.state.nameDesc;
          nameAsc = !this.state.nameAsc;
        }
        break;
      case 'org':
        if (!this.state.orgDesc && !this.state.orgAsc) {
          orgAsc = true;
        } else {
          orgDesc = !this.state.orgDesc;
          orgAsc = !this.state.orgAsc;
        }
        break;
      case 'rating':
        if (!this.state.ratingDesc && !this.state.ratingAsc) {
          ratingDesc = true;
        } else {
          ratingDesc = !this.state.ratingDesc;
          ratingAsc = !this.state.ratingAsc;
        }
        break;
      default:
        // do nothing
    }
    this.setState({
      ratingDesc: ratingDesc, ratingAsc: ratingAsc,
      nameDesc: nameDesc, nameAsc: nameAsc,
      orgDesc: orgDesc, orgAsc: orgAsc });
  },

  /** Function to sort packages and search results before rendering them */
  _sortBeforeRender() {
    if (this.state.ratingDesc) {
      this.props.packages.changeSort('ratingDesc');
    } else if (this.state.ratingAsc) {
      this.props.packages.changeSort('rating');
    } else if (this.state.nameDesc) {
      this.props.packages.changeSort('nameDesc');
    } else if (this.state.nameAsc) {
      this.props.packages.changeSort('name');
    } else if (this.state.orgDesc) {
      this.props.packages.changeSort('orgDesc');
    } else if (this.state.orgAsc) {
      this.props.packages.changeSort('org');
    }
    this.props.packages.sort();
  },

  sortNameColumn() {
    this.sortColumn('name');
  },

  sortOrgColumn() {
    this.sortColumn('org');
  },

  sortRatingColumn() {
    this.sortColumn('rating');
  },

  render() {
    /**
     * Do not use this as an example for tables; it needs to be refactored to use
     * ReactTable's Table and Column. For now, see ClusterDetailsLibrariesList and
     * ClusterDetailsLibrariesListView.
     */
    const self = this;
    const nameHeader = (
      <SortableHeader
        title='Name'
        extraClasses='span4'
        key='-1'
        sortedDesc={this.state.nameDesc}
        sortedAsc={this.state.nameAsc}
        onClick={this.sortNameColumn}
      />);

    const orgHeader = (
      <SortableHeader
        title='Organization'
        extraClasses='span3'
        key='-2'
        sortedDesc={this.state.orgDesc}
        sortedAsc={this.state.orgAsc}
        onClick={this.sortOrgColumn}
      />);

    const ratingHeader = (
      <SortableHeader
        title='Rating'
        extraClasses='span2'
        key='-4'
        sortedDesc={this.state.ratingDesc}
        sortedAsc={this.state.ratingAsc}
        onClick={this.sortRatingColumn}
      />);

    const rows = [];
    this._sortBeforeRender();
    this.props.packages.each(function pushSparkPackageRow(elem) {
      rows.push(
        <SparkPackageRow
          key={elem.fullName()}
          model={elem}
          showDetailPage={self.props.showDetailPage}
          selectRelease={self.props.selectRelease}
        />);
    });
    const headers = [
      nameHeader,
      orgHeader,
      (<th key='-3' className='span6'>Description</th>),
      ratingHeader,
      (<th key='-5' className='span2 release-column'>Releases</th>),
      (<th key='-6' className='span2'>Options</th>),
    ];

    const table = (<TableView
      headers={headers}
      content={rows}
      bodyId='packages-table'
    />);

    if (this.props.packages.length > 0) {
      return (
        <div className='row-fluid'>
          {table}
        </div>
      );
    }
    let message;
    // Note that we fetch Spark Packages from the website differently.
    if (this.props.packages.isFetching) {
      message = (
        <h4><i className={'fa fa-' + IconsForType.inProgress}></i> Loading Spark Packages</h4>
      );
    } else if (!this.props.searchInput) {
      message = (<h4>Error while connecting to Spark Packages. Please refresh your page.</h4>);
    } else {
      message = (<h4>Search didn't return any packages</h4>);
    }

    return (
      <div className='row-fluid'>
          {table}
          <div className='search-feedback'>
              {message}
          </div>
      </div>
    );
  },

});

module.exports = SparkPackageListView;
