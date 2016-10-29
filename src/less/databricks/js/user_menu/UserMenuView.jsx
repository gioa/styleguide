import $ from 'jquery';
import React from 'react';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';

import OrgSwitcherView from '../user_menu/OrgSwitcherView.jsx';

export class UserMenuView extends React.Component {
  constructor() {
    super();
    this._logout = this._logout.bind(this);
    this._settings = this._settings.bind(this);
    this._adminConsole = this._adminConsole.bind(this);
    this._manageAccounts = this._manageAccounts.bind(this);
  }

  // navigate to the login page in the same window
  // visible for testing so we can mock the navigation
  _gotoLoginPage() {
    window.location = '/login.html';
  }

  // logout click handler
  _logout(e) {
    window.recordEvent('userMenuActionClicked', {
      userMenuAction: 'logout',
    });

    DeprecatedDialogBox.confirm({
      message: 'Are you sure you want to log out?',
      confirmButton: 'Log Out',
      confirm: () => {
        $.ajax({
          url: '/account/logout',
          async: false, // NOLINT
        }).always(this._gotoLoginPage.bind(this));
      },
    });
    e.preventDefault();
  }

  // account settings click handler
  _settings(e) {
    window.recordEvent('userMenuActionClicked', {
      userMenuAction: 'account-settings',
    });

    window.router.navigate('setting/account', { trigger: true });
    e.preventDefault();
  }

  // account settings click handler
  _adminConsole(e) {
    window.recordEvent('userMenuActionClicked', {
      userMenuAction: 'admin-console',
    });

    window.router.navigate('setting/accounts', { trigger: true });
    e.preventDefault();
  }

  _manageAccounts(e) {
    window.recordEvent('userMenuActionClicked', {
      userMenuAction: 'manage-account',
    });

    window.open(window.settings.accountsOwnerUrl);
    e.preventDefault();
  }

  // links in the Account section of the menu
  _accountLinks() {
    return (
      <div className='account-section'>
        <div className='header' title={this.props.user}>
          Signed in as {this.props.user.length > 8 ? <br /> : null}
          <b>{this.props.user}</b>
        </div>
        <ul>
          <li>
            <a href='#setting/account'
              className='accounts-link settings-button'
              onClick={this._settings}
            >
              <div className='accounts-text'>User Settings</div>
            </a>
          </li>
          {this.props.enableAccounts ?
            <li>
              <a href='#setting/account'
                className='accounts-link admin-console-button'
                onClick={this._adminConsole}
              >
                <div className='accounts-text'>Admin Console</div>
              </a>
            </li> : null}
          {this.props.isAccountOwner ?
            <li>
              <a href={window.settings.accountsOwnerUrl}
                className='accounts-link manage-account-button'
                onClick={this._manageAccounts}
              >
                <div className='accounts-text'>Manage Account</div>
              </a>
            </li> : null}
          <li>
            <a href='#setting/logout'
              className='accounts-link logout-button'
              onClick={this._logout}
            >
              <div className='accounts-text'>Log Out</div>
            </a>
          </li>
        </ul>
      </div>
    );
  }

  _orgLinks() {
    if (!window.settings.enableOrgSwitcherUI) {
      return null;
    }

    return (
      <OrgSwitcherView
        user={this.props.user}
        currentOrg={this.props.currentOrg}
        availableWorkspaces={this.props.availableWorkspaces}
      />
    );
  }

  render() {
    const orgLinks = this._orgLinks();

    return (
      <div className='user-menu-view'>
        {this._accountLinks()}
        {orgLinks ? <hr /> : null}
        {orgLinks}
      </div>
    );
  }
}

UserMenuView.propTypes = {
  // email
  user: React.PropTypes.string.isRequired,
  // The current org ID
  currentOrg: React.PropTypes.number,
  // Available workspaces to switch to
  availableWorkspaces: React.PropTypes.array,
  // If the admin console is enabled
  enableAccounts: React.PropTypes.bool,
  isAccountOwner: React.PropTypes.bool,
};

UserMenuView.defaultProps = {
  currentOrg: 0,
  availableWorkspaces: [],
  enableAccounts: true,
  isAccountOwner: false,
};
