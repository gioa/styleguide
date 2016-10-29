/* eslint react/prefer-es6-class: 0 */

import React from 'react';

import ReactNotebookCommandListView from '../notebook/ReactNotebookCommandListView.jsx';
import ReactNotebookListenerMixin from '../notebook/ReactNotebookListenerMixin.jsx';
import NotebookModel from '../notebook/NotebookModel';

const ReactNotebookCommandListeningListView = React.createClass({
  propTypes: {
    notebook: React.PropTypes.instanceOf(NotebookModel).isRequired,
    resultsOnly: React.PropTypes.bool,
    isLocked: React.PropTypes.bool,
    showLastDivider: React.PropTypes.bool,
    showSubmitHint: React.PropTypes.bool,
    showCommandRunTime: React.PropTypes.bool,
    showCommandRunUser: React.PropTypes.bool,
    showCommandClusterName: React.PropTypes.bool,
  },

  componentWillReceiveProps(nextProps) {
    if (this.props.notebook !== nextProps.notebook) {
      this.setState({ notebookToRender: nextProps.notebook });
    }
  },

  getInitialState() {
    return {
      notebookToRender: this.props.notebook,
    };
  },

  mixins: [ReactNotebookListenerMixin],

  render() {
    return (
      <ReactNotebookCommandListView
        notebook={this.props.notebook}
        isLocked={this.props.isLocked}
        showLastDivider={this.props.showLastDivider}
        showSubmitHint={this.props.showSubmitHint}
        resultsOnly={this.props.resultsOnly}
        showCommandRunTime={this.props.showCommandRunTime}
        showCommandRunUser={this.props.showCommandRunUser}
        showCommandClusterName={this.props.showCommandClusterName}
      />);
  },
});

module.exports = ReactNotebookCommandListeningListView;
