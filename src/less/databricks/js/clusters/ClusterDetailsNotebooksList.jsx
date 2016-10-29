/* eslint func-names: 0 */

import React from 'react';
import _ from 'lodash';

import Cluster from '../clusters/Cluster';
import { ClusterDetailsNotebooksListView } from '../clusters/ClusterDetailsNotebooksListView.jsx';

import { PathNameUtils } from '../filetree/PathNameUtils';

import NotebookUtilities from '../notebook/NotebookUtilities';

import { CompareTos } from '../ui_building_blocks/tables/ReactTableUtils.jsx';

const UNSORTED = -1;

export class ClusterDetailsNotebooksList extends React.Component {
  constructor(props) {
    super(props);

    this.fetchAndUpdateNotebooks = this.fetchAndUpdateNotebooks.bind(this);
    this.updateSortState = this.updateSortState.bind(this);
    this.onHeaderCheckboxClick = this.onHeaderCheckboxClick.bind(this);
    this.onCheckboxClick = this.onCheckboxClick.bind(this);
    this.detachNotebooks = this.detachNotebooks.bind(this);
    this.updateAttachedNotebooks = this.updateAttachedNotebooks.bind(this);
    this.clearError = this.clearError.bind(this);
    // each element in the valueGetters list is used for sorting the column with the same index
    this.valueGetters = [
      null,
      (row) => row[1].name,
      (row) => row[2],
      (row) => (row[3].time === null ? -1 : row[3].time),
      (row) => row[4],
    ];

    this.state = {
      headerChecked: false,
      attachedNotebooks: {},
      sortedCol: UNSORTED,
      sortDir: null,
      detaching: false,
    };
  }

  componentDidMount() {
    this.fetchAndUpdateNotebooks();
    this.props.cluster.on('change', _.throttle(this.fetchAndUpdateNotebooks, 1000), this);
  }

  componentWillUnmount() {
    this.props.cluster.off(null, null, this);
    Object.keys(this.state.attachedNotebooks).forEach((notebookId) => {
      this.state.attachedNotebooks[notebookId].stopListening();
    });
  }

  onHeaderCheckboxClick() {
    const allChecked = !this.state.headerChecked;
    _.each(this.state.attachedNotebooks, function(notebookData) {
      if (notebookData.checkboxEnabled) {
        notebookData.checkboxChecked = allChecked;
      }
    });
    this.setState({ headerChecked: allChecked });
  }

  onCheckboxClick(selectedRow) {
    const selectedNotebook = this.state.attachedNotebooks[selectedRow[1].id];
    selectedNotebook.checkboxChecked = !selectedNotebook.checkboxChecked;
    // Force the component to render again so that the checkbox actually shows up as checked
    this.setState({});
  }

  detachNotebooks() {
    const notebooksToDetach = [];
    _.each(this.state.attachedNotebooks, function(notebookData, notebookId) {
      if (notebookData.checkboxChecked) {
        notebooksToDetach.push(notebookId);
      }
    });
    this.setState({ detaching: true });
    NotebookUtilities.detachNotebooks(notebooksToDetach, null,
      this.refs.notebooksListView.showDetachErrorDialog);
  }

  clearError() {
    this.setState({ detaching: false });
  }

  /**
   * Helper function that returns whether there are currently any notebooks in the process of
   * detaching.
   */
  isDetachingNotebooks() {
    let detaching = false;
    // detaching only gets set to true when detachNotebooks() is called
    if (!this.state.detaching) {
      return detaching;
    }
    // if there were previously notebooks that were detaching and there are still checked
    // boxes, then not all of the notebooks are finished detaching yet (because the checkboxes
    // are disabled while notebooks are detaching)
    _.each(this.state.attachedNotebooks, function(notebookData) {
      if (notebookData.checkboxChecked) {
        detaching = true;
      }
    });
    return detaching;
  }

  /**
   * Fetches permission, starts listening to, and adds each new notebook to the
   * stored attachedNotebooks object. Stops listening to notebooks that are no
   * longer attached and deletes them from the attachedNotebooks object.
   * @param {Map} notebooksInfo: map from notebook ID to its corresponding NotebookLastCommandInfo
   * object storing the information about the notebook's most recently run command
   * @param {Array} newNotebookModels: the newly attached NotebookModels
   */
  updateAttachedNotebooks(notebooksInfo, newNotebookModels) {
    const newAttachedNotebooks = {};
    newNotebookModels.forEach((notebookModel) => {
      // fetchPermissionLevel is asynchronous, so we start listening to the notebook model and call
      // fetchAndUpdateNotebooks again after the permission level has been obtained
      notebookModel.fetchPermissionLevel();
      notebookModel.on('change', this.fetchAndUpdateNotebooks, this);
      newAttachedNotebooks[notebookModel.get('id')] = {
        checkboxEnabled: notebookModel.canRun(),
        checkboxChecked: false,
        stopListening: () => notebookModel.off(null, null, this),
      };
    });
    Object.keys(this.state.attachedNotebooks).forEach((notebookId) => {
      if (!(notebookId in notebooksInfo)) {
        this.state.attachedNotebooks[notebookId].stopListening();
        delete this.state.attachedNotebooks[notebookId];
      }
    });
    this.setState({ attachedNotebooks: _.extend(this.state.attachedNotebooks,
      newAttachedNotebooks), detaching: this.isDetachingNotebooks() });
  }

  /**
   * Handles fetching notebooks and updating the attachedNotebooks object, which stores
   * the checkbox enabled/checked states as well as the "off" function for each notebook.
   * If not all of the notebook models are available yet, it calls prefetchNodes with
   * itself as a callback to retry fetching the unavailable notebook models.
   */
  fetchAndUpdateNotebooks() {
    const cluster = this.props.cluster;
    const notebooksInfo = cluster.get('notebooksInfo');
    const nodesToFetch = [];
    const newNotebookModels = [];
    Object.keys(notebooksInfo).forEach((notebook) => {
      const notebookModel = window.treeCollection.get(notebook);
      if (!notebookModel) {
        // add the notebook to the list of notebooks to try to fetch again
        nodesToFetch.push(parseInt(notebook, 10));
      } else if (!(notebook in this.state.attachedNotebooks)) {
        // if this notebook is newly attached, add it to newNotebookModels so that it can
        // be handled in updateAttachedNotebooks
        newNotebookModels.push(notebookModel);
      } else {
        // if this notebook is not newly attached, we might still need to update its
        // permissions
        notebookModel.fetchPermissionLevel();
        this.state.attachedNotebooks[notebook].checkboxEnabled = notebookModel.canRun();
      }
    });
    this.updateAttachedNotebooks(notebooksInfo, newNotebookModels);
    if (nodesToFetch.length > 0) {
      window.conn.prefetchNodes(nodesToFetch, this.fetchAndUpdateNotebooks);
    }
  }

  updateSortState(dir, colIdx) {
    this.setState({ sortedCol: colIdx, sortDir: dir });
  }

  /**
   * Generates a notebook table row from a notebook model
   * @param {NotebookModel} model: contains data needed in table row
   * @param {NotebookLastCommandInfo} notebookInfo: map from notebook ID to information about the
   * last command run
   * @param {string} status: current state of the node
   * @return {Array} a single table row in form [name, status, notebook info, path]
   */
  getTableRowData(model, notebookInfo, status) {
    return [
      {
        checkboxEnabled: this.state.attachedNotebooks[model.get('id')].checkboxEnabled,
        checkboxChecked: this.state.attachedNotebooks[model.get('id')].checkboxChecked,
      },
      {
        id: model.get('id'),
        name: model.get('name'),
      },
      status,
      notebookInfo,
      PathNameUtils.generatePathNamesFromPathIds(model.get('path')),
    ];
  }

  sortList(list) {
    if (this.state.sortedCol !== UNSORTED) {
      list.sort(CompareTos.getSimpleCompareTo(
        this.valueGetters[this.state.sortedCol], this.state.sortDir));
    }
    return list;
  }

  /**
   * This function returns the 2d array of information to be passed in as a prop to
   * ClusterDetailsNotebooksListView.
   */
  getNotebookRows(cluster) {
    const notebooksInfo = cluster.get('notebooksInfo');
    const list = Object.keys(notebooksInfo).map((notebook) => {
      const notebookModel = window.treeCollection.get(notebook);
      if (notebook in this.state.attachedNotebooks) {
        const runStatus = notebookModel.get('runStatus');
        return this.getTableRowData(
          notebookModel,
          notebooksInfo[notebook],
          (runStatus === 'running' || runStatus === 'runningFromRunAll') ? 'Running' : 'Idle');
      }
      return null;
    });
    return this.sortList(list.filter((row) => row !== null));
  }

  render() {
    return (
      <div className='row-fluid'>
        <ClusterDetailsNotebooksListView
          ref='notebooksListView'
          rows={this.getNotebookRows(this.props.cluster)}
          nameLinkPrefix={'#notebook/'}
          sortFunc={this.updateSortState}
          onHeaderCheckboxClick={this.onHeaderCheckboxClick}
          onCheckboxClick={this.onCheckboxClick}
          detachNotebooks={this.detachNotebooks}
          detaching={this.state.detaching}
          clearError={this.clearError}
        />
      </div>
    );
  }
}

ClusterDetailsNotebooksList.propTypes = {
  cluster: React.PropTypes.instanceOf(Cluster).isRequired,
};
