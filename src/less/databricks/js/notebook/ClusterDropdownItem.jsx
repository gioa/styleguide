import React from 'react';

import { AclUtils } from '../acl/AclUtils.jsx';

import { Cluster } from '../clusters/Cluster';
import { ClusterUtil } from '../clusters/Common.jsx';

import IconsForType from '../ui_building_blocks/icons/IconsForType';
import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

/**
 * Rendered by ContextBarView in cluster attach/detach dropdown.
 */
export class ClusterDropdownItem extends React.Component {
  constructor(props) {
    super(props);

    this._onClickClusterAttach = this._onClickClusterAttach.bind(this);
    this._onClickClusterNav = this._onClickClusterNav.bind(this);
  }

  componentDidMount() {
    if (AclUtils.clusterAclsEnabled() &&
      this.props.cluster &&
      !this.props.cluster.permissionsHaveBeenFetched()) {
      this.props.cluster.fetchPermissionLevel();
    }
  }

  _onClickClusterAttach() {
    if (this._hasAttachPermissions()) {
      this.props.clickHandler();
    }
  }

  _getClusterHref() {
    return ClusterUtil.getDetailsLinks(this.props.cluster.get('clusterId')).notebooks;
  }

  _onClickClusterNav() {
    const link = this._getClusterHref();
    window.open(link);
    window.recordEvent('notebookActionsClicked', this.props.tagsFunction({
      actionSelected: 'navigateToCluster',
    }));
  }

  _getDisabledClusterLink(link) {
    const text = 'You do not have attach permissions on this cluster. ' +
      'Please contact your administrator.';
    return (
      <Tooltip text={text} ref='tooltip' attachToBody classes={['no-attach-cluster']}>
        {link}
      </Tooltip>
    );
  }

  _getAttachLinkClass(shouldDisable) {
    const attachLinkClass = 'cluster-attach-link';
    return shouldDisable ? `${attachLinkClass} disabled` : attachLinkClass;
  }

  _hasAttachPermissions() {
    return !AclUtils.clusterAclsEnabled() || this.props.cluster.canAttach();
  }

  _getClusterAttachLink(cluster) {
    const iconType = cluster.isAttachable() ? IconsForType.cluster : IconsForType.inProgress;
    const shouldDisable = !this._hasAttachPermissions();
    let clusterAttachLink = (
      <div onClick={this._onClickClusterAttach} className={this._getAttachLinkClass(shouldDisable)}>
        <i className={'fa fa-' + iconType} />
        {' ' + cluster.shortDescription()}
      </div>
    );
    if (cluster.isAttachable() && shouldDisable) {
      clusterAttachLink = this._getDisabledClusterLink(clusterAttachLink);
    }
    return clusterAttachLink;
  }

  render() {
    const cluster = this.props.cluster;
    const dataName = 'Context Bar Attach ' + cluster.get('clusterName');
    return (
      <a
        data-name={dataName}
        key={cluster.get('clusterId')}
        className={'attach-detach-wrapper'}
      >
        {this._getClusterAttachLink(cluster)}
        <span onClick={this._onClickClusterNav} className='cluster-nav-link' title='Open cluster'>
          <i className={'cluster-nav-link-icon fa fa-fw fa-' + IconsForType.navigate} />
        </span>
      </a>
    );
  }
}

ClusterDropdownItem.propTypes = {
  clickHandler: React.PropTypes.func.isRequired,
  cluster: React.PropTypes.instanceOf(Cluster).isRequired,
  tagsFunction: React.PropTypes.func.isRequired,
};
