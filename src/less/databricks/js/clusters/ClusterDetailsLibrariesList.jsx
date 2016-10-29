import React from 'react';
import _ from 'lodash';

import Cluster from '../clusters/Cluster';
import { ClusterDetailsLibrariesListView } from '../clusters/ClusterDetailsLibrariesListView.jsx';

import { PathNameUtils } from '../filetree/PathNameUtils';

import { CompareTos } from '../ui_building_blocks/tables/ReactTableUtils.jsx';

const NAME_LINK_PREFIX = '#library/';

export class ClusterDetailsLibrariesList extends React.Component {
  constructor(props) {
    super(props);

    this.getLibraries = this.getLibraries.bind(this);
    this.setList = this.setList.bind(this);
    this.getSortFunc = this.getSortFunc.bind(this);

    this.state = {
      list: [],
      prefetchDone: false,
    };
  }

  componentDidMount() {
    this.setList();
    this.props.cluster.on('change', _.throttle(this.setList, 1000), this);
  }

  componentWillUnmount() {
    this.props.cluster.off(null, null, this);
  }

  /**
   * Generates a library table row from a library model
   * @param {LibraryModel} treeStoreLibrary: contains data needed in table row
   * @param {object} clusterAttachLibrary: library info according to the cluster
   * @return {Array} a single table row in form [name, status, notebook info, path]
   */
  getTableRowData(treeStoreLibrary, clusterAttachLibrary) {
    const id = clusterAttachLibrary.id;
    const name = clusterAttachLibrary.libraryName;

    if (treeStoreLibrary) {
      const clusterStatus = clusterAttachLibrary.clusterStatus.status;
      const alarms = clusterAttachLibrary.clusterStatus.alarms;
      const errorMessage = (
        <span>
          Please check the library page of{' '}
          <a href={NAME_LINK_PREFIX + id}>{name}</a>{' '}
          for more details.
        </span>
      );
      return [
        {
          id: id,
          name: name,
          disabled: false,
        },
        {
          clusterStatus: clusterStatus,
          formattedStatus: this.getClusterStatusString(clusterStatus),
          errorMessage: alarms && alarms.length !== 0 ? errorMessage : null,
        },
        PathNameUtils.generatePathNamesFromPathIds(treeStoreLibrary.get('path')),
      ];
    }

    // if library is deleted from tree store
    return [
      {
        id: id,
        name: name,
        disabled: true,
      },
      {
        clusterStatus: 'deleted',
        formattedStatus: 'Marked for deletion. Requires a cluster restart.',
      },
    ];
  }

  getClusterStatusString(clusterStatus) {
    let clusterStatusString = null;
    if (clusterStatus === 'error') {
      clusterStatusString = 'Installation failed';
    } else if (clusterStatus === 'pending') {
      clusterStatusString = 'Pending';
    } else if (clusterStatus === 'loaded') {
      clusterStatusString = 'Loaded';
    } else if (clusterStatus === 'unloading') {
      clusterStatusString = 'Detach pending a cluster restart.';
    }
    return clusterStatusString;
  }

  /**
   * This function gets the list representing the rows of data about the libraries attached to the
   * cluster. Note that if not all of the libraryModels are available yet, the available libraries
   * are returned and setList is registered as a callback to prefetchNodes, so that it can be
   * called again until all of the libraries have been loaded.
   */
  getLibraries(cluster) {
    const libraries = cluster.get('libraries');
    const nodesToFetch = [];
    const list = libraries.map((library) => {
      const libraryModel = window.treeCollection.get(library.id);
      if (libraryModel || this.state.prefetchDone) {
        // We can also come in here if the prefetch is done but the libraryModel doesn't exist.
        // That means the library is deleted from the tree store.
        return this.getTableRowData(
          libraryModel,
          library);
      }
      nodesToFetch.push(parseInt(library.id, 10));
      return null;
    });
    if (nodesToFetch.length > 0) {
      window.conn.prefetchNodes(nodesToFetch, this.setList);
    }
    this.setState({ prefetchDone: true });
    return list.filter((row) => row !== null);
  }

  setList() {
    this.setState({ list: this.getLibraries(this.props.cluster) });
  }

  getSortFunc(valueGetter) {
    return (dir) => this.setState({
      list: this.state.list.sort(CompareTos.getSimpleCompareTo(valueGetter, dir)),
    });
  }

  render() {
    return (
      <div className='row-fluid'>
        <ClusterDetailsLibrariesListView
          rows={this.state.list}
          nameLinkPrefix={NAME_LINK_PREFIX}
          nameSortFunc={this.getSortFunc((row) => row[0].name)}
          statusSortFunc={this.getSortFunc((row) => row[1])}
          pathSortFunc={this.getSortFunc((row) => row[2])}
        />
      </div>
    );
  }
}

ClusterDetailsLibrariesList.propTypes = {
  cluster: React.PropTypes.instanceOf(Cluster).isRequired,
};
