/* eslint react/prefer-es6-class: 0 */

import React from 'react';

import { AclSettingsView } from '../acl/AclSettingsView.jsx';

import { Panel, Tabs } from '../ui_building_blocks/TabsView.jsx';
import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

import { IamRolesList } from '../user_menu/iam_roles/IamRolesList.jsx';
import AccountList from '../user_menu/AccountList';
import AccountListView from '../user_menu/ReactAccountListView.jsx';
import { SingleSignOnSettingsView } from '../user_menu/SingleSignOnSettingsView.jsx';

const SettingsView = React.createClass({

  propTypes: {
    accounts: React.PropTypes.instanceOf(AccountList).isRequired,
    activeTab: React.PropTypes.string,
  },

  _renderSSOPanel() {
    const greyOutSSOPanel = !window.settings.enableSingleSignOnByTier;
    const tooltipText = Tooltip.getGenericUpgradeElement('To enable single sign-on');

    return (
      <Panel
        title='Single Sign On'
        disabled={greyOutSSOPanel}
        tooltipText={greyOutSSOPanel ? tooltipText : undefined}
        href='#setting/accounts/singleSignOnSettings'
        name='singleSignOnSettings'
      >
        <SingleSignOnSettingsView />
      </Panel>
    );
  },

  _renderIamRolesPanel() {
    const greyOutIamRolesPanel = !window.settings.enableInstanceProfilesByTier;
    const tooltipText = Tooltip.getUpgradeElement('IAM roles', true);

    return (
      <Panel
        title='IAM Roles'
        disabled={greyOutIamRolesPanel}
        tooltipText={greyOutIamRolesPanel ? tooltipText : undefined}
        href='#setting/accounts/iamRoles'
        name='iamRoles'
      >
        <IamRolesList />
      </Panel>
    );
  },

  render() {
    const refFunc = (ref) => this.aclSettingsView = ref;
    return (
      <Tabs activeTab={this.props.activeTab}>
        <Panel title='Users' href='#setting/accounts/users' name='users'>
          <AccountListView
            accounts={this.props.accounts}
            enableX509Authentication={window.settings.enableX509Authentication}
          />
        </Panel>
        {window.settings.enableInstanceProfilesUI ? this._renderIamRolesPanel() : null}
        <Panel title='Access Control' href='#setting/accounts/accessControl' name='accessControl'>
          <AclSettingsView ref={refFunc} />
        </Panel>
        {window.settings.enableSingleSignOn ? this._renderSSOPanel() : null}
      </Tabs>);
  },
});

module.exports = SettingsView;
