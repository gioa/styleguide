/* eslint react/prefer-es6-class: 0, react/no-is-mounted: 0, func-names: 0 */

import $ from 'jquery';
import _ from 'underscore';
import React from 'react';

import ItemDeltaReceiverView from '../delta_receiver/ItemDeltaReceiverView';

import FullElasticJobStatus from '../jobs/FullElasticJobStatus';
import FullElasticRunStatus from '../jobs/FullElasticRunStatus';
import JobRunView from '../jobs/JobRunView.jsx';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';

const LatestJobRunView = React.createClass({ displayName: 'LatestJobRunView',
  propTypes: {
    job: React.PropTypes.instanceOf(FullElasticJobStatus).isRequired,
    hideHeader: React.PropTypes.bool,
    showFailures: React.PropTypes.bool,
    showInProgress: React.PropTypes.bool,
    modelFetcher: React.PropTypes.func,
    displayMode: React.PropTypes.string,
    dashboardNUID: React.PropTypes.string,
  },

  title: null,
  markPageAsBeta: false,
  runIdShown: null,
  receiver: null,

  getDefaultProps() {
    return {
      hideHeader: true,
      showFailures: false,
      showInProgress: false,
    };
  },

  getInitialState() {
    const job = this.props.job;
    const jobId = job.get('basicInfo').jobId;
    const runId = this.getRunIdToShow();
    const run = new FullElasticRunStatus({ jobId: jobId, runId: runId });
    run.deltaUpdate = true;
    return { model: run };
  },

  componentWillMount() {
    this.runIdShown = this.getRunIdToShow();
    this.doModelFetch(this.state.model);
    this.receiver = new ItemDeltaReceiverView();
    this.receiver.startWatching(this.props.job.get('publisherRootId'), FullElasticJobStatus);
    this.receiver.onChange(_.bind(this.onChange, this));
  },

  onChange() {
    if (this.receiver.model === null) {
      const jobId = this.props.job.get('basicInfo').jobId;
      DeprecatedDialogBox.alert('Job not found: ' + jobId, false, 'Jobs Page', function() {
        location.hash = '#joblist';
      });
      this.receiver.onChange(function() {});
      return;
    }
    this.setProps({ job: this.receiver.model });
    const runId = this.getRunIdToShow();
    if (runId !== this.runIdShown) {
      // remember current page scroll position
      this.currentScrollPos = $('#content').scrollTop();
      this.runIdShown = runId;
      const newModel = new FullElasticRunStatus({
        jobId: this.state.model.get('jobId'),
        runId: this.runIdShown,
      });
      newModel.deltaUpdate = true;
      this.doModelFetch(newModel, {
        complete: _.bind(function() {
          if (this.isMounted()) {
            this.setState({ model: newModel });
          } else {
            console.debug('Latest run view unmounted, ignoring fetch update.');
          }
        }, this),
      });
    }
  },

  componentDidUpdate() {
    if (this.currentScrollPos) {
      // Scroll to the previously scrolled position. As page needs to re-render when it received
      // new success run results, delay the scoll call to wait until page is rendered
      const pos = this.currentScrollPos;
      this.currentScrollPos = null;
      this.delayedScrollTimer = _.delay(function() {
        $('#content').scrollTop(pos);
      }, 1000);
    }
  },

  componentWillUnmount() {
    clearTimeout(this.delayedScrollTimer);
    this.props.job.off(null, null, this);
    this.receiver.remove();
  },

  getUpdateInfo() {
    const job = this.props.job;
    const title = 'Run ' + this.runIdShown;
    const updateTime = Date(job.get('basicInfo').lastUpdateTime).toString();
    return (
      <div className='job-latest-run-info'>
        <p className='run-title'>{title} / Updated at: {updateTime}</p>
      </div>);
  },

  render() {
    const jobId = this.props.job.get('basicInfo').jobId;
    return (
      <JobRunView
        key={this.runIdShown}
        ref='jobRunView'
        model={this.state.model}
        hideHeader={this.props.hideHeader}
        displayMode={this.props.displayMode}
        dashboardNUID={this.props.dashboardNUID}
        viewBaseUrl={'job/' + jobId + '/run/latestSuccess'}
      >
        {[this.getUpdateInfo()]}
      </JobRunView>);
  },

  doModelFetch(model, args) {
    if (this.props.modelFetcher) {
      this.props.modelFetcher(model, args);
    } else {
      model.fetch(args);
    }
  },

  getRunIdToShow() {
    const history = this.props.job.get('history');
    if (history.length === 0) {
      return null;
    }
    if (this.props.showInProgress) {
      return history[0].idInJob;
    }
    let i;
    for (i in history) {
      if (!history.hasOwnProperty(i)) {
        continue;
      }
      const item = history[i];
      if (item.status === 'Succeeded' ||
          (this.props.showFailures && (item.status === 'Failed' || item.status === 'Error'))) {
        return item.idInJob;
      }
    }
    return history[0].idInJob;
  },
});

module.exports = LatestJobRunView;
