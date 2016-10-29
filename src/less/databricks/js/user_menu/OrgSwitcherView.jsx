/* eslint react/prefer-es6-class: 0 */

import React from 'react';

import ReactDialogBox from '../ui_building_blocks/dialogs/ReactDialogBox.jsx';
import IconsForType from '../ui_building_blocks/icons/IconsForType';

/**
 * The part of the user menu that contains the links to switch workspaces.
 *
 * Also includes the workspaces the user has been invited to (default not expanded).
 */
const OrgSwitcherView = React.createClass({
  propTypes: {
    // array of workspaces available to this user to switch to (including the current one)
    // each workspace object: {name: string, owner: string, orgId: number, needsConfirmation: bool}
    availableWorkspaces: React.PropTypes.array.isRequired,
    // the current orgId
    currentOrg: React.PropTypes.number.isRequired,
    // the target of orgId links, _blank if not provided
    linkTarget: React.PropTypes.string,
  },

  getDefaultProps() {
    return {
      linkTarget: '_blank',
    };
  },

  getInitialState() {
    return {
      // whether or not to show invited workspaces
      showInvited: false,
    };
  },

  // record that a workspace was clicked on, whether it was invited and if so, if it was accepted
  _recordClick(workspace, invited, accepted) {
    const numConfirmed = this.props.availableWorkspaces.filter(
      (availableWorkspace) => !availableWorkspace.needsConfirmation).length;
    const numInvited = this.props.availableWorkspaces.length - numConfirmed;
    let acceptedInvite = null;
    if (invited) {
      acceptedInvite = accepted ? 'true' : 'false';
    }

    window.recordEvent('userMenuActionClicked', {
      userMenuAction: 'organization',
      numConfirmedOrgs: numConfirmed,
      numInvitedOrgs: numInvited,
      selectedOrgId: workspace.orgId,
      selectedOrgName: workspace.name,
      selectedOrgOwner: workspace.owner,
      orgInviteAccepted: acceptedInvite,
    });
  },

  _toggleInvited() {
    this.setState({ showInvited: !this.state.showInvited });
  },

  /**
   * Get a <li><a>...</a></li> link to a workspace in the organization list.
   *
   * @param workspace the workspace object
   * @param icon a <i> icon to show to the left of the workspace, or null if none
   * @param href the destination of the link. May be null if onClick is provided.
   * @param target the browser target of the link (e.g., "_blank"). May be null
   * @param onClick a click handler. This overrides href and target if e.preventDefault is called.
   * @private
   */
  _workspaceItem(workspace, icon, href, target, onClick) {
    let title = workspace.name;
    if (workspace.owner) {
      title += ' (' + workspace.owner + ')';
    }

    return (
      <li key={workspace.orgId}>
        <a className='workspace-link'
          data-name={workspace.name}
          target={target}
          href={href}
          onClick={onClick}
          title={title}
        >
          <div className='workspace-item'>
            <div className='workspace-text'>
              <div className='icon'>{icon}</div>
              <div className='workspace-name'>{workspace.name}</div>
            </div>
            {workspace.owner ? <div className='workspace-owner'>{workspace.owner}</div> : null}
          </div>
        </a>
      </li>
    );
  },

  // workspaces that we already belong to
  _confirmedLinks() {
    const currentOrg = this.props.currentOrg;

    const confirmed = this.props.availableWorkspaces
      .filter((workspace) => !workspace.needsConfirmation)
      .sort((a, b) => a.name.localeCompare(b.name));

    const links = confirmed.map((workspace) => {
      let link;
      let icon;
      if (workspace.orgId === currentOrg) {
        link = null;
        icon = <i className={'fa fa-' + IconsForType.active} />;
      } else {
        link = '?o=' + workspace.orgId;
        icon = null;
      }

      const onClick = () => {
        this._recordClick(workspace, false);
      };

      return this._workspaceItem(workspace, icon, link, this.props.linkTarget, onClick);
    });

    return (
      <div className='org-section'>
        <div className='header'>Organizations</div>
        <ul className='confirmed-workspaces'>
          {links}
        </ul>
      </div>
    );
  },

  // open a dialog box to confirm an invitation to join a workspace
  _confirmInvite(workspace) {
    const message =
      (<span>
        Accept invitation to join <b>{workspace.name}</b> ({workspace.owner})?
      </span>);
    const link = '?o=' + workspace.orgId;

    ReactDialogBox.confirm({
      title: 'Accept Invitation',
      message: message,
      confirmButton: 'Yes',
      cancelButton: 'No',
      confirm: () => {
        this._recordClick(workspace, true, true);
        workspace.needsConfirmation = false;
        window.open(link, this.props.linkTarget);
        this.forceUpdate();
      },
      cancel: () => {
        this._recordClick(workspace, true, false);
      },
    });
  },

  // workspaces that we have been invited to join
  _invitedLinks() {
    const invited = this.props.availableWorkspaces
      .filter((workspace) => workspace.needsConfirmation)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (invited.length === 0) {
      return null;
    }

    const arrowIcon = this.state.showInvited ? 'angle-double-up' : 'angle-double-down';
    const header = (
      <div className='header invited-header no-close-user-menu' onClick={this._toggleInvited}>
        <div className='invited-text'>
          Invitations <span className='invite-count'>{invited.length}</span>
        </div>
        <div className='expand-icon'><i className={'fa fa-' + arrowIcon} /></div>
      </div>
    );

    const invitedList = this.state.showInvited ?
      invited.map((workspace) => this._workspaceItem(
        workspace, null, null, null, this._confirmInvite.bind(null, workspace))) : [];

    return (
      <div className='invited-section'>
        {header}
        <ul className='invited-workspaces'>
          {invitedList}
        </ul>
      </div>
    );
  },

  render() {
    const confirmed = this._confirmedLinks();
    const invited = this._invitedLinks();

    return (
      <div>
        {confirmed}
        {invited ? <hr /> : null}
        {invited}
      </div>
    );
  },
});

module.exports = OrgSwitcherView;
