/* eslint react/no-is-mounted: 0, func-names: 0 */

import _ from 'underscore';

import React from 'react';

import WorkspacePermissions from '../acl/WorkspacePermissions';

import ClusterList from '../clusters/ClusterList';

import NotebookModel from '../notebook/NotebookModel';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';

/**
 * Any ReactView that wants to re-render when the notebook model changes should extend this mixin.
 * This mixin should be extended by the least common ancestor of all the react views that should
 * re-render based on updates. It should NOT be implemented by two views if one is the ancestor
 * and the other in the rendering hierarchy, as the ancestor view will alway re-render the other.
 */
const ReactNotebookListenerMixin = {
  listening: false,

  propTypes: {
    notebook: React.PropTypes.instanceOf(NotebookModel),
    clusters: React.PropTypes.instanceOf(ClusterList),
  },

  /** One of the permissions-levels in WorkspacePermissions */
  getPermissionLevel() {
    if (this.props.notebook.get('isExample')) {
      return WorkspacePermissions.VIEW;
    }

    return this.props.notebook ?
      this.props.notebook.getPermissionLevel() :
      WorkspacePermissions.MANAGE;
  },

  componentWillUpdate(nextProps, nextState) {
    if (nextState.notebookToRender !== this.state.notebookToRender) {
      this.stopListening();
    }
  },

  componentDidUpdate() {
    this.startListening();
  },

  componentDidMount() {
    this.startListening();

    // This will only be triggered when notebook is being deleted by other user
    this.state.notebookToRender.on('remove', function() {
      DeprecatedDialogBox.alert('This notebook has been deleted', undefined, undefined, function() {
        window.router.navigate('#', { trigger: true }); // navigate to home view
      });
    }, this);
  },

  componentWillUnmount() {
    this.stopListening();
  },

  _onMessage(message) {
    if (this.isMounted() && this.listening && this.onNotebookMessage) {
      this.onNotebookMessage(message);
    }
  },

  startListening() {
    if (this.listening) {
      return;
    }
    this.listening = true;

    const _this = this;
    this.throttledForceUpdate = _.throttle(function() {
      if (_this.isMounted() && _this.listening) {
        _this.forceUpdate();
      }
    }, 100);

    this.state.notebookToRender.on('change', this.throttledForceUpdate, this);
    this.state.notebookToRender.on('message', this._onMessage, this);
    this.state.notebookToRender.registerInterest(this);

    this.state.notebookToRender.commandCollection()
      .on('add remove reset change', this.throttledForceUpdate, this);

    if (this.props.clusters) {
      this.props.clusters.on('add remove change reset', this.throttledForceUpdate, this);
    }
  },

  stopListening() {
    if (!this.listening) {
      return;
    }
    this.listening = false;
    this.state.notebookToRender.unregisterInterest(this);
    this.state.notebookToRender.off(null, null, this);
    this.state.notebookToRender.commandCollection().off(null, null, this);
    if (this.props.clusters) {
      this.props.clusters.off(null, null, this);
    }
  },
};

module.exports = ReactNotebookListenerMixin;
