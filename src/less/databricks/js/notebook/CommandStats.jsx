/* eslint react/prefer-es6-class: 0 */

import React from 'react';
import ClassNames from 'classnames';

import { CommandStateUtils } from '../notebook/CommandUtils';
import { DisplayTypeUtils } from '../notebook/commands/DisplayTypeUtils';

import { TimeSpan } from '../ui_building_blocks/text/TimeSpan.jsx';

const CommandStats = React.createClass({

  propTypes: {
    state: React.PropTypes.string.isRequired,
    clusterName: React.PropTypes.string, // @NOTE(lauren) this is undefined inside job run view
    clusterMemory: React.PropTypes.number, // TODO(PROD-12740) this is inaccurate - remove
    latestUser: React.PropTypes.string,
    startTime: React.PropTypes.number,
    finishTime: React.PropTypes.number,
    submitTime: React.PropTypes.number, // @NOTE(lauren) this is always inaccurate in jobs
    displayType: React.PropTypes.string,
    results: React.PropTypes.object,
    hidden: React.PropTypes.bool,
    showCommandRunTime: React.PropTypes.bool,
    showCommandRunUser: React.PropTypes.bool,
    showCommandClusterName: React.PropTypes.bool,
  },

  getDefaultProps() {
    return {
      clusterName: 'unknown cluster',
      clusterMemory: 0,
      results: { type: '' }, // TODO(cg): this does not appear to do what we actually want.
      latestUser: 'unknown user',
    };
  },

  getCommandRunTime() {
    const submitDate = new Date(this.props.submitTime);
    return (
      <span>
        {' '}at{' '}{submitDate.toLocaleString()}
      </span>
    );
  },

  getCommandRunUser() {
    return (
      <span className='command-provenance'>
        --{' '}by{' '}{this.props.latestUser}
      </span>
    );
  },

  getCommandClusterName() {
    return (
      <span>
        {' '}on{' '}{this.props.clusterName}
      </span>
    );
  },

  render() {
    const running = CommandStateUtils.isRunning(this.props.state);
    const results = this.props.results;
    const resultType = results && results.type ? results.type : '';

    const displayType = DisplayTypeUtils.computeDisplayType(this.props.displayType, resultType);
    const startTime = this.props.startTime;
    const finishTime = this.props.finishTime;

    if (!running && startTime && finishTime && displayType !== 'markdown') {
      const classes = ClassNames({
        'command-result-stats': true,
        'hidden': this.props.hidden,
      });
      const statTime = (finishTime - startTime) / 1000;

      return (
        <div className={classes}>
          <span>Command took</span>
          {' '}
          <TimeSpan seconds={statTime} />{' '}
          {this.props.showCommandRunUser ? this.getCommandRunUser() : null}
          {this.props.showCommandRunTime ? this.getCommandRunTime() : null}
          {this.props.showCommandClusterName ? this.getCommandClusterName() : null}
        </div>
      );
    }
    return null;
  },
});

module.exports = CommandStats;
