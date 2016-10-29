/* eslint react/prefer-es6-class: 0, react/no-is-mounted: 0 */

import React from 'react';

import ClusterList from '../clusters/ClusterList';

const ClusterDetailsContextBar = React.createClass({
  propTypes: {
    clusterId: React.PropTypes.string.isRequired,
    clusters: React.PropTypes.instanceOf(ClusterList).isRequired,
  },

  _forceUpdate() {
    if (this.isMounted()) {
      this.forceUpdate();
    }
  },

  componentDidMount() {
    this.props.clusters.on('add change remove reset', this._forceUpdate.bind(this, null), this);
  },

  render() {
    const cluster = this.props.clusters.findWhere({ clusterId: this.props.clusterId });
    let clusterName;

    if (cluster) {
      clusterName = cluster.get('clusterName');
    }

    return (
      <span>
        <span className='context-clusters-link'>
          <a href='#setting/clusters'>Clusters</a> /
        </span> {clusterName}
      </span>
    );
  },
});

module.exports = ClusterDetailsContextBar;
