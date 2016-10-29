/* eslint react/prefer-es6-class: 0, react/no-is-mounted: 0 */

/**
 * Do not use this as an example for tables; it needs to be refactored to use
 * ReactTable's Table and Column. For now, see ClusterDetailsLibrariesList and
 * ClusterDetailsLibrariesListView.
 */

import React from 'react';

import MavenPackage from '../../libraries/search/MavenPackage';
import MavenPackageList from '../../libraries/search/MavenPackageList';
import MavenPackageRelease from '../../libraries/search/MavenPackageRelease';

import SortableHeader from '../../ui_building_blocks/tables/SortableTableHeader.jsx';
import { TableView } from '../../ui_building_blocks/tables/Table.jsx';

// TODO(burak): Not deleting this so that it can be re-used once we move the LibraryUI to React.
/*
const LibrarySelectionArea = React.createClass({

  propTypes: {
    parentId: React.PropTypes.string.isRequired
  },

  changeLibrary: function() {
    const source = document.getElementById("lib-selector");
    const src = source.options[ source.selectedIndex ].value;
    if (src === "python") {
      window.router.navigate("create/pythonLibrary/" + this.props.parentId, {trigger: true});
    } else if (src === "scala") {
      window.router.navigate("create/library/" + this.props.parentId, {trigger: true});
    } else if (src === "maven") {
      window.router.navigate("create/mavenLibrary/" + this.props.parentId, {trigger: true});
    }
  },

  render: function() {
    const showMaven = window.settings.enableMavenLibraries ?
      (<option value="maven">Maven Coordinate</option>) : null;

    return (
      <div className="library-import">
        <h2>New Library</h2>
        <div className="multi-input-row">
          <div className="row-fluid">
            <label className="control-label">Source</label>
            <div>
                <select id="lib-selector" className="source" onChange={this.changeLibrary}>
                    <option value="scala">Upload Java/Scala JAR</option>
                    <option value="python">Upload Python Egg or PyPI</option>
                    {showMaven}
                    <option value="packages" selected="true">Spark Packages</option>
                </select>
            </div>
          </div>
        </div>
      </div>
    );
  }
});
*/

function MavenRelease({ model }) {
  const version = model.get('mavenVersion');
  return (
    <option data-version={version}>{version}</option>
  );
}

MavenRelease.propTypes = {
  model: React.PropTypes.instanceOf(MavenPackageRelease).isRequired,
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
    </a>);
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


const MavenPackageRow = React.createClass({

  propTypes: {
    model: React.PropTypes.instanceOf(MavenPackage).isRequired,
    selectRelease: React.PropTypes.func.isRequired,
  },

  _forceUpdate() {
    if (this.isMounted()) {
      this.forceUpdate();
    }
  },

  componentDidMount() {
    const releases = this.props.model.get('mavenVersion');
    releases.on('change add remove reset', this._forceUpdate.bind(this, null), this);
  },

  componentWillUnmount() {
    this.props.model.get('mavenVersion').off(null, null, this);
  },

  _selectRelease() {
    const versionSelector = this.refs.release;
    const opt = versionSelector.options[versionSelector.selectedIndex];
    const version = opt.dataset.version;
    const groupId = this.props.model.get('mavenGroupId');
    const artifactId = this.props.model.get('mavenArtifactId');
    const coordinate = groupId + ':' + artifactId + ':' + version;
    this.props.selectRelease(coordinate, 'maven', false);
  },

  render() {
    const group = this.props.model.get('mavenGroupId');
    const artifact = this.props.model.get('mavenArtifactId');
    const releases = [];
    const packageReleases = this.props.model.get('mavenVersion');
    if (packageReleases) {
      packageReleases.each(function pushMavenRelease(release) {
        releases.push(<MavenRelease key={release.cid} model={release} />);
      });
    }

    const options = (<Options
      selectRelease={this._selectRelease}
      releasesLoaded={releases.length > 0}
    />);

    return (
      <tr>
        <td>{group}</td>
        <td>{artifact}</td>
        <td><select ref='release' className='release-column'>{releases}</select></td>
        <td>{options}</td>
      </tr>
    );
  },
});

/**
 * Main table view to browse Maven Packages. Loaded inside the body of a ReactModal.
 *
 * @param packages List of Maven Packages to display. A search must be made initially.
 * @param searchInput If the page is loaded for the first time, we want to show a different
 *                    message. Empty search query means, prompt the user for a query.
 * @param isFetching Whether a search process is ongoing in order to display a spinner.
 * @param selectRelease Callback to select a package.
 */
const MavenPackageListView = React.createClass({

  propTypes: {
    packages: React.PropTypes.instanceOf(MavenPackageList).isRequired,
    selectRelease: React.PropTypes.func.isRequired,
    isFetching: React.PropTypes.bool.isRequired,
    searchInput: React.PropTypes.string,
  },

  _forceUpdate() {
    if (this.isMounted()) {
      this.forceUpdate();
    }
  },

  componentDidMount() {
    if (this.props.packages) {
      this.props.packages.on('change add remove reset', this._forceUpdate.bind(this, null), this);
    }
  },

  componentWillUnmount() {
    if (this.props.packages) {
      this.props.packages.off(null, null, this);
    }
  },

  getInitialState() {
    return {
      groupDesc: false,
      groupAsc: false,
      artifactDesc: false,
      artifactAsc: false,
    };
  },

  sortColumn(col) {
    let groupDesc = false;
    let groupAsc = false;
    let artifactDesc = false;
    let artifactAsc = false;
    switch (col) {
      case 'group':
        if (!this.state.groupDesc && !this.state.groupAsc) {
          groupAsc = true;
        } else {
          groupDesc = !this.state.groupDesc;
          groupAsc = !this.state.groupAsc;
        }
        break;
      case 'artifact':
        if (!this.state.artifactDesc && !this.state.artifactAsc) {
          artifactAsc = true;
        } else {
          artifactDesc = !this.state.artifactDesc;
          artifactAsc = !this.state.artifactAsc;
        }
        break;
      default:
        // Do nothing
    }
    this.setState({
      groupDesc: groupDesc, groupAsc: groupAsc,
      artifactDesc: artifactDesc, artifactAsc: artifactAsc });
  },

  /** Function to sort packages and search results before rendering them */
  _sortBeforeRender() {
    if (this.state.artifactDesc) {
      this.props.packages.changeSort('artifactDesc');
      this.props.packages.sort();
    } else if (this.state.artifactAsc) {
      this.props.packages.changeSort('artifact');
      this.props.packages.sort();
    } else if (this.state.groupDesc) {
      this.props.packages.changeSort('groupDesc');
      this.props.packages.sort();
    } else if (this.state.groupAsc) {
      this.props.packages.changeSort('group');
      this.props.packages.sort();
    }
  },

  /** Renders the table and the rows, when the packages list is non-empty. */
  _renderWhenPopulated(headers) {
    /**
     * Do not use this as an example for tables; it needs to be refactored to use
     * ReactTable's Table and Column. For now, see ClusterDetailsLibrariesList and
     * ClusterDetailsLibrariesListView.
     */
    this._sortBeforeRender();
    const rows = [];
    const self = this;
    this.props.packages.each(function addMavenPackageRow(elem) {
      rows.push(
        <MavenPackageRow
          key={elem.cid}
          model={elem}
          selectRelease={self.props.selectRelease}
        />);
    });
    const table = (<TableView
      headers={headers}
      content={rows}
      bodyId='packages-table'
    />);

    return (
      <div className='row-fluid'>
        {table}
      </div>
    );
  },

  /** Renders the table header, but writes a prompt message, when the list is empty. */
  _renderWhenEmpty(headers) {
    let message;
    if (!this.props.searchInput || this.props.isFetching) {
      message = (<h4>Start writing a query to get results</h4>);
    } else {
      message = (<h4>Search didn't return any packages</h4>);
    }
    const table = (<TableView
      headers={headers}
      content={[]}
      bodyId='packages-table'
    />);
    return (
      <div className='row-fluid'>
        {table}
        <div className='search-feedback'>
          {message}
        </div>
      </div>
    );
  },

  render() {
    /**
     * Do not use this as an example for tables; it needs to be refactored to use
     * ReactTable's Table and Column. For now, see ClusterDetailsLibrariesList and
     * ClusterDetailsLibrariesListView.
     */
    const sortGroup = this.sortColumn.bind(this, 'group');
    const groupHeader = (
      <SortableHeader
        title='Group Id'
        extraClasses='span3'
        key='-1m'
        sortedDesc={this.state.groupDesc}
        sortedAsc={this.state.groupAsc}
        onClick={sortGroup}
      />);

    const sortArtifact = this.sortColumn.bind(this, 'artifact');
    const artifactHeader = (
      <SortableHeader
        title='Artifact Id'
        extraClasses='span3'
        key='-2m'
        sortedDesc={this.state.artifactDesc}
        sortedAsc={this.state.artifactAsc}
        onClick={sortArtifact}
      />);

    const headers = [
      groupHeader,
      artifactHeader,
      (<th key='-3m' className='span2 release-column'>Releases</th>),
      (<th key='-4m' className='span2'>Options</th>),
    ];

    if (this.props.packages.length > 0) {
      return this._renderWhenPopulated(headers);
    }
    return this._renderWhenEmpty(headers);
  },
});

module.exports = MavenPackageListView;
