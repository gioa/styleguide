import $ from 'jquery';

import React from 'react';

import CollectionDeltaReceiver from '../../delta_receiver/CollectionDeltaReceiver';
import FullElasticJobStatus from '../../jobs/FullElasticJobStatus';

import { TimingUtils } from '../../js_polyfill/TimingUtils';

import { IamRoleDeleteDialogView } from './IamRoleDeleteDialogView.jsx';

export class IamRoleDeleteDialog extends React.Component {
  constructor(props) {
    super(props);

    // es6 binds
    this.setJobsUsingRole = this.setJobsUsingRole.bind(this);

    // jobList is only a state because we still need to get the list from
    // CollectionDeltaReceiver, which is asynchronous. Ideally, we should get
    // a static list and pass that to the view, like we do for the clusters list.
    this.state = {
      jobList: [],
      jobCollection: null,
    };
  }

  componentDidMount() {
    this.setupCollectionDeltaReceiver();
  }

  componentWillUnmount() {
    if (this.state.jobCollection) {
      this.state.jobCollection.stopWatching();
    }
  }

  clusterTerminationFilter(cluster) {
    return !cluster.isTerminating() && !cluster.isTerminated();
  }

  /**
   * @param {ClusterModel} clusterModel: the model attached to window.clusterList
   * @return {object} a single row object containing name and href
   */
  clusterModelToRow(clusterModel) {
    const id = clusterModel.get('clusterId');
    return {
      name: clusterModel.get('clusterName'),
      href: '#setting/clusters/' + id + '/configuration',
    };
  }

  getClustersUsingRole() {
    return window.clusterList
      .where({
        instanceProfileArn: this.props.arn,
      })
      .filter(this.clusterTerminationFilter)
      .map(this.clusterModelToRow);
  }

  /**
   * @param {FullElasticJobStatus} jobModel: a model to extract row data from
   * @return {object} a single row object containing name and href
   */
  jobModelToRow(jobModel) {
    return {
      name: jobModel.get('jobName'),
      href: '#job/' + jobModel.get('jobId'),
    };
  }

  /**
   * @param {CollectionDeltaReceiver} collection: collection of all FullElasticJobStatuses
   * @return {Array} list of row objects for jobs using this arn
   */
  getJobsUsingRole(collection) {
    const jobsUsingThisArn = collection.filter((model) =>
      model.get('resources').instanceProfileArn === this.props.arn);
    return jobsUsingThisArn.map(this.jobModelToRow);
  }

  /**
   * The collection always initially loads with 0 models. This retries getting a list of them
   * in case there are actually jobs, and the list is not supposed to be empty.
   */
  setJobsUsingRole() {
    if (this.state.jobCollection.length === 0) {
      // Either (1) there are really no jobs or (2) the jobs haven't loaded yet
      // If (1), then the initial state [] of jobList is correct, so we can let this run through
      //   all its attempts and then never call success.
      // If (2), then as long as the jobs list loads in under 5 seconds, we update the visible
      //   jobs corresponding to that loaded job list via the success function.
      TimingUtils.retryUntil({
        condition: () => this.state.jobCollection.length > 0,
        // Retry for 50 * 100 / 100 = 5 seconds
        // (aribitrary number, we can tweak this for good UX over time)
        interval: 50, // This needs to be low enough to possibly appear instantaneous
        maxAttempts: 100, // This needs to be long enough to cover slow loading cases
        success: this.setJobsUsingRole,
      });
    } else {
      const rows = this.getJobsUsingRole(this.state.jobCollection);
      this.setState({ jobList: rows });
    }
  }

  /**
   * This still needs to use CollectionDeltaReceiver because we need the list of all
   * jobs attached to an IAM role. As a result, we need a state for the job list.
   */
  setupCollectionDeltaReceiver() {
    $.ajax('/jobs/root', {
      success: (data) => {
        const collection = new CollectionDeltaReceiver([], {
          deltaPublisherRoot: data.root,
          model: FullElasticJobStatus,
        });
        this.setState({ jobCollection: collection });
        collection.startWatching();
        this.setJobsUsingRole();
      },
    });
  }

  render() {
    return (
      <IamRoleDeleteDialogView
        deleteFunc={this.props.deleteFunc}
        clustersUsingRole={this.getClustersUsingRole()}
        jobsUsingRole={this.state.jobList}
        showShiftTip={this.props.showShiftTip}
      />
    );
  }
}

IamRoleDeleteDialog.propTypes = {
  arn: React.PropTypes.string.isRequired,
  deleteFunc: React.PropTypes.func.isRequired,
  // This is for showing the Shift+Click delete tip. We need it because of logic outside of the
  // scope of this component (i.e., we show it in one place but not another). In this particular
  // case, the list view needs it for quick deletes of IAM roles, but the details view does not.
  // Deleting in the details view navigates away from the page, so there's no quick action there.
  showShiftTip: React.PropTypes.bool,
};
