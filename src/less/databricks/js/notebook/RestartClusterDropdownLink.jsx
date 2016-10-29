import React from 'react';

import { AclUtils } from '../acl/AclUtils.jsx';

import Cluster from '../clusters/Cluster';

import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

/**
 * Renders the link to restart the currently attached-to cluster. If cluster ACLs enabled,
 * fetches restart permissions and disables link with tooltip if permissions lacking.
 */
export class RestartClusterDropdownLink extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      canRestartAttachedCluster: !AclUtils.clusterAclsEnabled() ||
        this.props.clusterModel.canRestart(),
    };
  }

  componentDidMount() {
    if (AclUtils.clusterAclsEnabled() &&
      this.props.clusterModel &&
      !this.props.clusterModel.permissionsHaveBeenFetched()) {
      this.props.clusterModel.fetchPermissionLevel(() => {
        this.setState({ canRestartAttachedCluster: this.props.clusterModel.canRestart() });
      });
    }
  }

  render() {
    const canRestart = this.state.canRestartAttachedCluster;
    let linkElem = (
      <a data-name={"Restart Cluster"} onClick={canRestart ? this.props.restartClusterFunc : null}
        disabled={!canRestart} ref={"restartClusterLink"}
      >
        Restart Cluster
      </a>
    );
    if (AclUtils.clusterAclsEnabled() && !canRestart) {
      const text = 'You do not have restart permissions on this cluster. ' +
        'Please contact your administrator.';
      linkElem = (
        <Tooltip text={text} attachToBody classes={['no-restart-cluster']} ref={"tooltip"}>
          {linkElem}
        </Tooltip>
      );
    }

    return linkElem;
  }
}

RestartClusterDropdownLink.propTypes = {
  clusterModel: React.PropTypes.instanceOf(Cluster).isRequired,
  restartClusterFunc: React.PropTypes.func.isRequired,
};
