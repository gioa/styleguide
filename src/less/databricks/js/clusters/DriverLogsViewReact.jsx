/* eslint react/prefer-es6-class: 0, func-names: 0 */

/**
 * Do not use this as an example for tables; it needs to be refactored to use
 * ReactTable's Table and Column. For now, see ClusterDetailsLibrariesList and
 * ClusterDetailsLibrariesListView.
 */

import $ from 'jquery';
import _ from 'underscore';
import React from 'react';

import NavFunc from '../filetree/NavFunc.jsx';

// This should match the string returned by DriverLogsHandler in the case of a user attempting
// to access the driver logs without permissions
const PERMISSIONS_ERROR =
  'You do not have sufficient permissions to view the driver logs for this cluster.';

const DriverLogsViewReact = React.createClass({
  propTypes: {
    clusterId: React.PropTypes.string,
    shouldFetchLogs: React.PropTypes.bool.isRequired,
  },

  getInitialState() {
    return {
      stdoutTail: '',
      stderrTail: '',
      log4jTail: '',
      localFiles: [],
      error: PERMISSIONS_ERROR,
    };
  },

  componentDidMount() {
    this.fetchDriverLogs(this.props);
  },

  componentWillReceiveProps(nextProps) {
    this.fetchDriverLogs(nextProps);
  },

  fetchDriverLogs(props) {
    if (!props.shouldFetchLogs) {
      return;
    }

    this.setState({
      error: '',
    });
    this.driverLogsFetch = $.ajax('/driver-logs/' + this.props.clusterId, {
      success: (data) => this._setDriverLogsData(data),
      error: (xhr) => this._setErrorMsg(xhr),
    });
  },

  componentWillUnmount() {
    if (this.driverLogsFetch) {
      this.driverLogsFetch.abort();
    }
  },

  _setDriverLogsData(data) {
    this.setState({
      stdoutTail: data.stdoutTail,
      stderrTail: data.stderrTail,
      log4jTail: data.log4jTail,
      localFiles: data.localFiles,
    });
  },

  _setErrorMsg(xhr) {
    this.setState({
      error: xhr.statusText === PERMISSIONS_ERROR ? PERMISSIONS_ERROR :
        `Driver logs for cluster ${this.props.clusterId} are not currently accessible.`,
    });
  },

  render() {
    /**
     * Do not use this as an example for tables; it needs to be refactored to use
     * ReactTable's Table and Column. For now, see ClusterDetailsLibrariesList and
     * ClusterDetailsLibrariesListView.
     */
    if (this.state.error) {
      return (<div className='spark-driver-logs-view'>
        <h2>Spark Driver Logs</h2>
        <p>{this.state.error}</p>
      </div>);
    }
    return (<div className='spark-driver-logs-view'>
      <h2>Spark Driver Logs</h2>
      {this.renderFileList(this.state.localFiles)}
      {this.renderTextOutput('Standard output', this.state.stdoutTail, 'driver-stdout')}
      {this.renderTextOutput('Standard error', this.state.stderrTail, 'driver-stderr')}
      {this.renderTextOutput('Log4j output', this.state.log4jTail, 'driver-log4j')}
    </div>);
  },

  renderTextOutput(name, output, className) {
    _.defer(function() {
      // scroll stdout/stderr to bottom by default
      $('.console-output textarea').each(function(i, el) {
        el.scrollTop = el.scrollHeight;
      });
    });
    const refFunc = (ref) => this[className] = ref;
    return (
      <div>
        <p>
          {name}
        </p>
        <div className={'console-output ' + className}>
          <textarea
            ref={refFunc}
            readOnly
            value={output}
            onFocus={this.textOutputFocused}
            onBlur={this.textOutputBlurred}
          />
        </div>
      </div>);
  },

  renderFileList(files) {
    if (!files || files.length === 0) {
      return null;
    }
    const that = this;
    const stdoutFiles = _.sortBy(files.filter(function(file) {
      return file.name.indexOf(window.settings.driverStdoutFilePrefix) === 0;
    }), 'name');
    const stderrFiles = _.sortBy(files.filter(function(file) {
      return file.name.indexOf(window.settings.driverStderrFilePrefix) === 0;
    }), 'name');
    const log4jFiles = _.sortBy(files.filter(function(file) {
      return file.name.indexOf(window.settings.driverLog4jFilePrefix) === 0;
    }), 'name');
    return (<div>
      <p>Recent log files</p>
      <table style={{ width: '100%' }}>
        <tbody>
          <tr>
            <td className='stdoutFiles'>
              {
                stdoutFiles.map(function(file) {
                  return (
                    <span key={file.name}>
                      <a className='stdout-download' download
                        href={'/driver-logs/' + that.props.clusterId + '/download/' + file.name +
                          NavFunc.sessionParams()}
                      >
                        {file.name + ' (' + file.size + ' bytes)'}
                      </a>
                      <br />
                    </span>);
                })
              }
            </td>
            <td className='stderrFiles'>
              {
                stderrFiles.map(function(file) {
                  const href = '/driver-logs/' + that.props.clusterId + '/download/' + file.name +
                    NavFunc.sessionParams();
                  return (
                    <span key={file.name}>
                      <a className='stderr-download' download href={href}>
                        {file.name + ' (' + file.size + ' bytes)'}
                      </a>
                      <br />
                    </span>);
                })
              }
            </td>
            <td className='log4jFiles'>
              {
                log4jFiles.map(function(file) {
                  const href = '/driver-logs/' + that.props.clusterId + '/download/' + file.name +
                    NavFunc.sessionParams();
                  return (
                    <span key={file.name}>
                      <a className='log4j-download' download href={href}>
                        {file.name + ' (' + file.size + ' bytes)'}
                      </a>
                      <br />
                    </span>);
                })
              }
            </td>
          </tr>
        </tbody>
      </table>
      <br />
    </div>);
  },

  textOutputFocused(e) {
    $(e.target).css('overflow-y', 'scroll');
  },

  textOutputBlurred(e) {
    $(e.target).css('overflow-y', 'hidden');
  },
});

module.exports = DriverLogsViewReact;
