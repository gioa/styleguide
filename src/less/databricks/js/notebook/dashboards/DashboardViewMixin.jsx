/* eslint react/no-is-mounted: 0 */

import _ from 'underscore';
import React from 'react';

import WorkspacePermissions from '../../acl/WorkspacePermissions';

import NotebookModel from '../../notebook/NotebookModel';

/**
 * Any ReactView that wants to render a dashboard view model and re-render upon changes should
 * extend this mixin.
 *
 * This mixin should be extended by the least common ancestor of all the react views that should
 * re-render based on updates. It should NOT be implemented by two views if one is the ancestor
 * and the other in the rendering hierarchy, as the ancestor view will alway re-render the other.
 */
const DashboardViewMixin = {
  listening: false,

  propTypes: {
    notebook: React.PropTypes.instanceOf(NotebookModel).isRequired,
    // This can be either dashboard id or dashboard nuid
    dashboardId: React.PropTypes.string.isRequired,
    redirectWhenDashboardNotFound: React.PropTypes.bool,
  },

  getDefaultProps() {
    return {
      redirectWhenDashboardNotFound: true,
    };
  },

  getInitialState() {
    return {
      dashboard: null,
      showSpinner: false,
    };
  },

  tags() {
    const tags = this.props.notebook.tags();
    tags.dashboardId = this.props.dashboardId;
    tags.source = 'DashboardViewMixin';
    return tags;
  },

  setContentLoading(isLoading) {
    this.setState({ showSpinner: isLoading });
  },

  getPermissionLevel() {
    return this._getDashboardPermission();
  },

  _getDashboardPermission() {
    if (this.state.dashboard) {
      if (this.state.dashboard.notebook().get('isExample')) {
        // returns VIEW permission for dashboard in databricks guide notebooks
        return WorkspacePermissions.VIEW;
      }
      // returns NONE before fetch permission success
      return this.state.dashboard.getPermissionLevel();
    }
    // returns NONE before dashboard model is fetched
    return WorkspacePermissions.NONE;
  },

  dashboardModelReady() {
    return Boolean(this.state.dashboard && this.getPermissionLevel() !== WorkspacePermissions.NONE);
  },

  _onMessage(message) {
    if (this.isMounted() && this.onNotebookMessage) {
      this.onNotebookMessage(message);
    }
  },

  handleDashboardNotFound() {
    const tags = this.tags();
    tags.eventType = 'notFound';
    window.recordEvent('dashboard', tags);

    if (this.props.redirectWhenDashboardNotFound) {
      // The user navigated to a dashboard that does not exist.
      window.router.navigate('notebook/' + this.props.notebook.get('id'), {
        trigger: true,
        replace: true,
      });
    }
  },

  getDashboardNode() {
    const notebook = this.props.notebook;
    // try find dashboard model by id
    let dashboard = notebook.getDashboardViewModelById(this.props.dashboardId);
    // if not found, try again by nuid - we use nuid in jobs result dashboard view
    if (!dashboard) {
      dashboard = notebook.getDashboardViewModelByNuid(this.props.dashboardId);
    }
    return dashboard;
  },

  onDashboardReady() {
    const notebook = this.props.notebook;
    const dashboard = this.getDashboardNode();

    if (!dashboard) {
      this.handleDashboardNotFound();
      return;
    }

    this.setState({ dashboard: dashboard });

    // TODO(Chaoyu): remove, testing only
    window.dashboard = dashboard;

    if (!window.settings.isStaticNotebook) {
      dashboard.fetchPermissionLevel(this.throttledForceUpdate);
    }

    dashboard.on('change', this.throttledForceUpdate, this);
    notebook.on('change', this.throttledForceUpdate, this);
    notebook.on('message', this._onMessage, this);
  },

  initialize(props) {
    props = props || this.props;
    this.setState(this.getInitialState());
    const notebook = props.notebook;

    this.throttledForceUpdate = _.throttle(() => {
      if (this.isMounted()) {
        this.forceUpdate();
      }
    }, 100);

    // subscribe to all changes under the notebook node, this allows dashboard view model and
    // notebook command model to receive delta updates on their changes
    notebook.registerInterest(this, {
      registerCommandCollectionOnly: true,
      done: this.throttledForceUpdate,
    });

    if (this.getDashboardNode()) {
      this.onDashboardReady();
    } else {
      // listen to the delta update for new dashboard node or initial load of command collection
      notebook.commandCollection().once('add reset', this.onDashboardReady, this);
    }
  },

  componentDidMount() {
    this.initialize(this.props);
  },

  componentWillReceiveProps(nextProps) {
    // Received a differnt notebook, re-initialize everything for rendering new notebook
    if (this.props.notebook.id !== nextProps.notebook.id) {
      this.initialize(nextProps);
    }
  },

  componentWillUnmount() {
    this.props.notebook.unregisterInterest(this);
    this.props.notebook.off(null, null, this);
    if (this.state.dashboard) {
      this.state.dashboard.off(null, null, this);
    }
  },
};

module.exports = DashboardViewMixin;
