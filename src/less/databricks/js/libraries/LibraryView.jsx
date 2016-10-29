/**
 * Do not use this as an example for tables; it needs to be refactored to use
 * ReactTable's Table and Column. For now, see ClusterDetailsLibrariesList and
 * ClusterDetailsLibrariesListView.
 */

import $ from 'jquery';
import _ from 'underscore';
import React from 'react';

import { AclUtils } from '../acl/AclUtils.jsx';

import Cluster from '../clusters/Cluster';
import ClusterList from '../clusters/ClusterList';

import NavFunc from '../filetree/NavFunc.jsx';
import { DeleteNodeCallbacks } from '../filetree/DeleteNodeCallbacks';

import { LibraryClusterRow } from '../libraries/LibraryClusterRow.jsx';
import { LibraryFiles } from '../libraries/LibraryFiles.jsx';

import { DeleteButton } from '../ui_building_blocks/buttons/DeleteButton.jsx';
import ReactDialogBox from '../ui_building_blocks/dialogs/ReactDialogBox.jsx';
import { SuccessMessage } from '../ui_building_blocks/text/AlertMessages.jsx';
import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

const autoAttachClusterId = '__ALL_CLUSTERS'; // Special cluster.

export class LibraryView extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      canAutoAttach: true,
      deleted: false,
    };
  }

  componentDidMount() {
    // Get the initial set of permissions for this user on clusters.
    this.getPermissions();
    this.props.model.on('add change remove reset', this.forceUpdate.bind(this, null), this);
    this.props.clusters.on('add change remove reset', this.forceUpdate.bind(this, null), this);
  }

  componentWillUnmount() {
    this.props.clusters.off(null, null, this);
    this.props.model.off(null, null, this);
  }

  getPermissions() {
    if (!AclUtils.clusterAclsEnabled()) {
      return;
    }

    // fetch permissions for each cluster
    this.props.clusters.forEach((cluster) => {
      cluster.fetchPermissions(() => {
        console.debug('success fetching individual cluster permissions');
      });
    });

    // fetch permissions for the /clusters object
    Cluster.ROOT.fetchPermissions(() => {
      this.setState({ canAutoAttach: Cluster.ROOT.canManage() });
    });
  }

  getAutoAttachState() {
    return this.getClusterAttachState(autoAttachClusterId, true);
  }

  /**
   * Makes the AJAX request to change the state of the library.
   */
  sendClusterAttachState(libraryId, clusterId, attach) {
    const data = attach ?
    { attach: [clusterId], detach: [] } :
    { attach: [], detach: [clusterId] };
    const url = '/libraries/' + libraryId;
    $.ajax(url, {
      type: 'POST',
      contentType: 'application/json; charset=UTF-8',
      data: JSON.stringify(data),
    });
  }

  handleAutoAttachClick() {
    if (this.getAutoAttachState()) {
      ReactDialogBox.confirm({
        message: 'Are you sure you want to detach this library from all clusters and stop it ' +
          'from being automatically attached to new clusters?',
        confirm: () => {
          this.handleClusterAttachChange(autoAttachClusterId);
        },
      });
    } else {
      ReactDialogBox.confirm({
        message: 'Are you sure you want to automatically attach this library to all running and ' +
          'future clusters?',
        confirm: () => {
          this.handleClusterAttachChange(autoAttachClusterId);
        },
      });
    }
  }

  getClusterAttachState(clusterId, defaultValue) {
    defaultValue = defaultValue === undefined ? false : defaultValue;
    const item = this.props.model.attributes;
    if (!item.clusterAttachAction) {
      // TODO(thunterdb): jeffpang: is this ever possible? I left it here for safety
      this.props.model.set({ clusterAttachAction: {} });
    }
    return item.clusterAttachAction[clusterId] !== undefined ?
      item.clusterAttachAction[clusterId] : defaultValue;
  }

  setClusterAttachState(clusterId, attach) {
    const item = this.props.model.attributes;
    const oldState = item.clusterAttachAction ? item.clusterAttachAction : {};
    const newState = _.extend({}, oldState);
    newState[clusterId] = attach;
    // trigger an optimistic change in the local model but don't save on the server
    this.props.model.set({ clusterAttachAction: newState });
  }

  handleClusterAttachChange(clusterId) {
    // Flip the state.
    const item = this.props.model.attributes;
    const newState = !item.clusterAttachAction[clusterId];
    const libraryId = item.id;
    this.sendClusterAttachState(libraryId, clusterId, newState);
    // optimistically set the auto attach state on our model
    this.setClusterAttachState(clusterId, newState);
  }

  /**
   * If this library is deleted, return a success message for the deletion. Otherwise,
   * show a delete button.
   */
  getDeletionComponent() {
    if (this.state.deleted) {
      return <SuccessMessage message='This library has been successfully deleted.' />;
    }
    const model = this.props.model;
    const deletionSuccess = () => this.setState({ deleted: true });
    const callback = DeleteNodeCallbacks.getLibraryCallback(model, deletionSuccess);
    const deleteFunc = () => NavFunc.deleteNode(model.get('id'), model, 0, callback);
    return (
      <span>
        <span className='header-separator'>
          {'|'}
        </span>
        <DeleteButton onClick={deleteFunc} />
      </span>
    );
  }

  renderHeader() {
    return (
      <h2 className='library-header'>
        <span className={this.state.deleted ? 'width-ignored' : ''}>
          {this.props.model.attributes.name}
        </span>
        {this.getDeletionComponent()}
      </h2>
    );
  }

  render() {
    const libAttr = this.props.model.attributes;
    const autoAttach = this.getAutoAttachState();
    const canAutoAttach = this.state.canAutoAttach;
    const checkboxRef = (ref) => this.autoAttachCheckbox = ref;
    const tooltipRef = (ref) => this.autoAttachTooltip = ref;
    const handleClick = () => this.handleAutoAttachClick();
    let autoAttachInput = (
      <input
        ref={checkboxRef}
        type='checkbox'
        disabled={!canAutoAttach}
        className='auto-attach'
        checked={autoAttach}
        onClick={handleClick}
      />
    );
    if (!canAutoAttach) {
      const tooltipText = 'You do not have auto attach permissions on clusters.';
      autoAttachInput = (
        <Tooltip
          ref={tooltipRef}
          text={tooltipText}
          customPosition={{ contentLeft: '-3px' }}
        >
          {autoAttachInput}
        </Tooltip>
      );
    }

    return (
      <div className='library-view'>
        {this.renderHeader()}
        <LibraryFiles libraryType={libAttr.libraryType} files={libAttr.files} />
        <h3>Clusters</h3>
        <div className='auto-attach-container'>
          {autoAttachInput}
          <span className={canAutoAttach ? null : 'no-auto-attach'}>
            Attach automatically to all clusters.
          </span>
        </div>
        {this.renderClusterListStatus(libAttr)}
      </div>
    );
  }

  renderClusterRow(clusterModel, libraryId) {
    const clusterId = clusterModel.get('clusterId');
    const clusterLibInfo = _.find(clusterModel.get('libraries'), (citem) => citem.id === libraryId);
    const status = clusterLibInfo ? clusterLibInfo.clusterStatus : null;
    const handleAttach = function handleAttach() {
      this.handleClusterAttachChange(clusterId);
    }.bind(this);

    return (<LibraryClusterRow
      ref={`row-${clusterId}`}
      key={clusterId}
      clusterId={clusterId}
      libraryId={libraryId}
      clusterName={clusterModel.get('clusterName')}
      sparkContextId={clusterModel.get('sparkContextId')}
      shouldAttach={this.getClusterAttachState(clusterId)}
      hasAttachPermissions={AclUtils.clusterAclsEnabled() ? clusterModel.canManage() : true}
      status={status}
      autoAttach={this.getAutoAttachState()}
      handleClusterAttachChange={handleAttach}
    />);
  }

  renderClusterListStatus(item) {
    /**
     * Do not use this as an example for tables; it needs to be refactored to use
     * ReactTable's Table and Column. For now, see ClusterDetailsLibrariesList and
     * ClusterDetailsLibrariesListView.
     */
    const clusters = this.props.clusters.activeClusters()
        .filter((clusterModel) => !clusterModel.isElasticSparkCluster())
        .map((clusterModel) => this.renderClusterRow(clusterModel, item.id));
    return (
      <table className='table table-bordered-outer'>
        <thead>
          <tr>
            <th className='span1'>Attach</th>
            <th className='span2'>Name</th>
            <th className='span2'>Status</th>
          </tr>
        </thead>
        <tbody>
          {clusters}
        </tbody>
      </table>
    );
  }
}

LibraryView.propTypes = {
  model: React.PropTypes.object.isRequired, // A library model
  clusters: React.PropTypes.instanceOf(ClusterList).isRequired, // A collection of Clusters
};
