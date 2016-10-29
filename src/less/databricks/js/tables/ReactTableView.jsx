/* eslint react/prefer-es6-class: 0 */

import _ from 'underscore';
import React from 'react';

import WorkspacePermissions from '../acl/WorkspacePermissions';

import ClusterList from '../clusters/ClusterList';

import NotebookCommandModel from '../notebook/NotebookCommandModel';
import CommandSpinner from '../notebook/CommandSpinner.jsx';
import CommandResult from '../notebook/CommandResult.jsx';
import LargeOutputWrapper from '../notebook/commands/LargeOutputWrapper.jsx';

import TableQueryMixin from '../tables/TableQueryMixin';

const NOOP = () => {};

function getTableCommand(options) {
  const cmd = new NotebookCommandModel(_.extend({
    runAsQuery: true,
  }, options));
  return _.extend(cmd, TableQueryMixin);
}

function getSchemaCommand(tableName) {
  return getTableCommand({
    command: 'describe ' + tableName,
    resizable: false,
    tableCommandType: 'schema',
  });
}

function getPreviewCommand(tableName) {
  return getTableCommand({
    command: 'select * from `' + tableName + '` limit 20',
    height: '400',
    tableCommandType: 'preview',
  });
}

const NO_ERROR = {
  hasError: false,
  errorMessage: null,
};

class TableView extends React.Component {
  constructor(props) {
    super(props);

    this.refresh = this.refresh.bind(this);
    this.setError = this.setError.bind(this);
    this.clearError = this.clearError.bind(this);
    this.onCommandChange = this.onCommandChange.bind(this);

    this.state = {
      errorInfo: NO_ERROR,
    };
  }

  refresh() {
    const clusters = this.props.clusters;

    // if clusters list if not fetched yet, wait 200ms and try refresh again, this is for handling
    // visiting a table view directly and this page is rendered before clusterList is fetched
    if (!clusters.finishedInitialFetch) {
      setTimeout(this.refresh, 200);
      return;
    }

    const defaultCluster = clusters.getDefaultCluster();

    if (defaultCluster === undefined) {
      this.setError(
        <p>
          You need to <a href='#setting/clusters'>set a default cluster</a> to view table.
        </p>);
    } else if (!clusters.isDefaultClusterUsable()) {
      this.setError(
        <p>
          Default cluster is not healthy, please
          <a href='#setting/clusters'> restart it or set another cluster as default </a>
          before viewing tables.
        </p>);
    } else {
      this.clearError();
      this.schemaCommand.runQuery();
      this.previewCommand.runQuery();
    }
  }

  componentWillMount() {
    this.schemaCommand = getSchemaCommand(this.props.tableName);
    this.previewCommand = getPreviewCommand(this.props.tableName);
  }

  componentDidMount() {
    this.schemaCommand.on('change', this.onCommandChange.bind(this, null), this);
    this.previewCommand.on('change', this.onCommandChange.bind(this, null), this);
    this.refresh();
  }

  setError(originalErrorMessage) {
    const errorInfo = {
      hasError: true,
      errorMessage: originalErrorMessage,
    };
    this.setState({ errorInfo: errorInfo });
  }

  clearError() {
    this.setState({ errorInfo: NO_ERROR });
  }

  onCommandChange() {
    // The backend QueryHandler will return execution error as a html type result
    if (this.schemaCommand.hasError()) {
      this.setError(this.getCommandError(this.schemaCommand));
    } else if (this.previewCommand.hasError()) {
      this.setError(this.getCommandError(this.previewCommand));
    } else {
      this.forceUpdate();
    }
  }

  getCommandError(command) {
    const error = command.getError();
    // Handle other types of backend errors here, otherwise it will display the stacktrace
    if (error.indexOf('AnalysisException: no such table') >= 0) {
      return (<p>No such table</p>);
    }
    return (<p>{error}</p>);
  }

  componentWillUnmount() {
    this.schemaCommand.off(null, null, this);
    this.previewCommand.off(null, null, this);
  }

  getTableCommandView(command) {
    const state = command.get('state');
    if (state === 'running') {
      return (
        <CommandSpinner
          state={state}
          stages={command.get('stages')}
          showCancel={false}
          cancelQuery={NOOP}
        />);
    }

    const results = command.get('results');
    if (results && results.data && results.data.length === 0) {
      return (<p>Table is empty.</p>);
    }

    const runQuery = command.runQuery.bind(command);

    return (<CommandResult
      {...command.attributes}
      permissionLevel={WorkspacePermissions.VIEW}
      isChild={false}
      isComplexResult={command.isComplexResult()}
      isParamQuery={command.isParamQuery()}
      runCommand={runQuery}
    />);
  }

  getRefreshButton() {
    return (
      <button className='btn' onClick={this.refresh}>
        <i className='fa fa-refresh'></i>
        {' '}
        Refresh
      </button>);
  }

  renderError(error) {
    return (
      <div className='table-view error'>
        {this.getRefreshButton()}
        <h1>
          <i className='fa fa-exclamation-triangle fa-1x text-danger'></i>
          An error occurred while fetching table <b>{this.props.tableName}</b>
        </h1>
        <LargeOutputWrapper>
          {error}
        </LargeOutputWrapper>
      </div>);
  }

  renderHeader() {
    return (
      <h1>
        {this.props.tableName}
        <span className='header-separator'>
          {'|'}
        </span>
        {this.getRefreshButton()}
      </h1>
    );
  }

  render() {
    if (this.state.errorInfo.hasError) {
      return this.renderError(this.state.errorInfo.errorMessage);
    }
    return (
      <div className='table-view'>
        {this.renderHeader()}
        <h2>Schema:</h2>
        <div className='schema'>
          {this.getTableCommandView(this.schemaCommand)}
        </div>
        <h2>Sample Data:</h2>
        <div className='preview'>
          {this.getTableCommandView(this.previewCommand)}
        </div>
      </div>);
  }
}

TableView.propTypes = {
  tableName: React.PropTypes.string,
  clusters: React.PropTypes.instanceOf(ClusterList),
};

module.exports = TableView;
