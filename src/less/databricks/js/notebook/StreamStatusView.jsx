/* eslint react/prefer-es6-class: 0 */

import _ from 'lodash';

import React from 'react';

import RichCommandError from '../notebook/RichCommandError.jsx';

export class StreamStateUtils {
  static isNonEmptyString(string) {
    return _.isString(string) && !_.isEmpty(string);
  }

  static isNonEmptyObject(obj) {
    return _.isObject(obj) && !_.isEmpty(obj);
  }

  static isValidSource(source) {
    return this.isNonEmptyObject(source) && this.isNonEmptyString(source.description);
  }

  static isValidSink(sink) {
    return this.isNonEmptyObject(sink) && this.isNonEmptyString(sink.description);
  }
}

const StreamSourceStateView = React.createClass({

  // sourceState has the fields:
  //  - description: A Human Readable Descriptor for the source
  //  - offset: The latest offset read by this source, if defined
  propTypes: {
    sourceState: React.PropTypes.object,
  },

  render() {
    const source = this.props.sourceState;
    if (!StreamStateUtils.isValidSource(source)) {
      return null;
    }
    let offset;
    if (StreamStateUtils.isNonEmptyString(source.latestOffset)) {
      offset = ' - Last Offset: ' + source.latestOffset;
    }
    return (
      <div data-source={source.description}>
      {source.description + offset}
      </div>
    );
  },
});

const StreamSinkStateView = React.createClass({

  // sinkState has the fields:
  //  - description: A Human Readable Descriptor for the source
  //  - offset: The latest offset read by this source, if defined
  // Even though the sink looks exactly like the source now, it may have different parameters later.
  propTypes: {
    sinkState: React.PropTypes.object,
  },

  render() {
    const sink = this.props.sinkState;
    if (!StreamStateUtils.isValidSink(sink)) {
      return null;
    }
    let offset;
    if (StreamStateUtils.isNonEmptyString(sink.latestOffset)) {
      offset = ' - Last Offset: ' + sink.latestOffset;
    }
    return (
      <div>
      <b>Sink:</b><br />
      {sink.description + offset}
      </div>
    );
  },
});

const StreamStatusView = React.createClass({

  // streamState has the fields:
  //  - name: The name of the stream
  //  - isActive: Whether the stream is active
  //  - sources: List of source states
  //  - sink: The status of the sink
  //  - exception: Optional. If the exception exists, then we should show the exception. The state
  //               will be inactive.
  propTypes: {
    streamState: React.PropTypes.object,
  },

  getInitialState() {
    return {
      collapsed: true,
    };
  },

  toggleCollapsed() {
    this.setState({ collapsed: !this.state.collapsed });
  },

  renderSources(streamState) {
    const validSources = _.filter(
      streamState.sources,
      (source) => StreamStateUtils.isValidSource(source)
    );
    const sources = _.map(
      validSources,
      (element, index) => (<li><StreamSourceStateView sourceState={element} key={index} /></li>)
    );
    if (sources.length === 0) {
      return (
        <div>
          Awaiting data...
        </div>
      );
    }
    return (
      <div>
        <b>Sources ({sources.length}):</b>
        <ul>
          {sources}
        </ul>
      </div>
    );
  },

  renderDetailToggle() {
    let classNames;
    if (this.state.collapsed) {
      classNames = 'fa fa-caret-right fa-fw';
    } else {
      classNames = 'fa fa-caret-down fa-fw';
    }
    return (
      <div className='pointer stream-details-toggle' onClick={this.toggleCollapsed}>
        <i className={classNames} />
        Details
      </div>
    );
  },

  render() {
    const streamState = this.props.streamState;
    if (!StreamStateUtils.isNonEmptyObject(streamState) ||
        !StreamStateUtils.isNonEmptyString(streamState.name)) {
      return null;
    }
    const name = streamState.name;
    const status = streamState.isActive ? 'ACTIVE' : 'TERMINATED';
    const sources = !this.state.collapsed ? this.renderSources(streamState) : null;
    const sink = !this.state.collapsed ?
      (<StreamSinkStateView sinkState={streamState.sink} />) : null;
    let exception;
    if (StreamStateUtils.isNonEmptyString(streamState.exception)) {
      // the first line sometimes is empty, therefore we trim. We want the summary to not be blank.
      const exceptionLines = streamState.exception.trim().split('\n');
      const summary = exceptionLines[0];
      const stackTrace = exceptionLines.length > 1 ? exceptionLines.slice(1).join('\n') : '';
      exception = (<RichCommandError
        state='error'
        parentCollapsed={false}
        errorSummary={summary}
        error={stackTrace}
      />);
    }

    return (
      <div className='stream-status'>
        <h3>Stream: {name}</h3>
        <div>Status: {status}</div>
        {this.renderDetailToggle()}
        <div className='stream-status-details'>
        {sources}
        {sink}
        </div>
        {exception}
      </div>
    );
  },
});

module.exports = StreamStatusView;
