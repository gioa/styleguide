/* eslint react/prefer-es6-class: 0, react/no-is-mounted: 0 */

import $ from 'jquery';
import React from 'react';

import Presence from '../presence/Presence';

import { Protos } from '../proto.js';

import { AddButton } from '../ui_building_blocks/buttons/AddButton.jsx';
import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';
import ReactDialogBox from '../ui_building_blocks/dialogs/ReactDialogBox.jsx';
import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

import AccountList from '../user_menu/AccountList';
import AccountUtil from '../user_menu/AccountUtil.jsx';
import ReactAccountListTable from '../user_menu/ReactAccountListTable.jsx';

import { EmailValidators } from '../validators/EmailValidators';
import { PasswordValidators } from '../validators/PasswordValidators';

const ReactAccountListView = React.createClass({

  propTypes: {
    accounts: React.PropTypes.instanceOf(AccountList).isRequired,
    enableX509Authentication: React.PropTypes.bool,
  },

  getDefaultProps() {
    return {
      enableX509Authentication: false,
    };
  },

  componentDidMount() {
    this.props.accounts.on('change add remove reset', () => {
      if (this.isMounted()) {
        this.forceUpdate();
      }
    }, this);
  },

  componentWillUnmount() {
    this.props.accounts.off(null, null, this);
  },

  componentWillMount() {
    this.props.accounts.fetch({ reset: true });
  },

  _getCredentialsInput() {
    if (this.props.enableX509Authentication) {
      return {
        controlType: 'input',
        id: 'certSubject',
        type: 'text',
        label: 'X.509 Certificate Subject',
        placeholder: '/CN=emailAddress=jason@example.com/C=US/...',
        required: true,
        confirmOnEnter: true,
      };
    }

    return {
      controlType: 'input',
      id: 'password',
      type: 'password',
      label: 'New Account Password',
      placeholder: '',
      required: true,
      confirmOnEnter: true,
      validate(value, dialog) {
        const fullname = dialog.find('#fullname').val();
        const email = dialog.find('#username').val();
        const [valid, message] = PasswordValidators.validatePassword(value, fullname, email);
        $('#passwordErrorMessage').text(message);
        return valid;
      },
    };
  },

  _getInviteUserProto(dialog) {
    const username = dialog.find('#username').val();
    const shardUrl = window.location.protocol + '//' + window.location.host;
    return new Protos.InviteUser({
      email: username,
      shard_url: shardUrl,
    });
  },

  _getAddUserProto(dialog) {
    const username = dialog.find('#username').val();
    const fullname = dialog.find('#fullname').val();
    if (this.props.enableX509Authentication) {
      const subjectName = dialog.find('#certSubject').val();
      return new Protos.AddUser({
        username: username,
        fullname: fullname,
        subject_name: subjectName,
      });
    }

    const password = dialog.find('#password').val();
    return new Protos.AddUser({
      username: username,
      fullname: fullname,
      password: password,
    });
  },

  _getConfirmationText(email) {
    return ('An invitation has been sent to ' + email +
      '\n\nIf they do not receive the invitation within 5 minutes, tell them to check their spam ' +
      'filter or contact Databricks support (support@databricks.com)'
    );
  },

  addAccount() {
    const _this = this;
    const requireEmail = window.settings.requireEmailUserName;

    const validateUserName = function validateUserName(value, dialog) {
      const msgContainer = dialog.find('#userNameErrorMessage');
      if (requireEmail) {
        if (EmailValidators.isValidEmail(value)) {
          msgContainer.text('');
          return true;
        }
        msgContainer.text('Invalid Email Address');
        return false;
      }
      // Accept valid emails or valid alpha-numeric strings
      if (EmailValidators.isValidEmail(value)) {
        msgContainer.text('');
        return true;
      } else if (/^[a-zA-Z0-9]{4,}$/.test(value)) {
        msgContainer.text('');
        return true;
      } else if (value === '') {
        msgContainer.text('Cannot have empty username');
        return false;
      } else if (value.length < 4) {
        msgContainer.text('Username must be at least 4 characters');
        return false;
      }
      const msg = 'Username must be a valid email or contain only alphanumeric characters';
      msgContainer.text(msg);
      return false;
    };

    const helpMessage = (
      '<div class="add-user-help">Databricks will email an invitation to this address</div>'
    );

    DeprecatedDialogBox.custom({
      title: 'Add User',
      controls: [
        {
          controlType: 'input',
          id: 'username',
          type: requireEmail ? 'email' : 'text',
          label: requireEmail ? 'Email' : 'Username',
          placeholder: '',
          required: true,
          validate: validateUserName,
          confirmOnEnter: window.settings.enableUserInviteWorkflow,
        },
        window.settings.enableUserInviteWorkflow ? null : {
          controlType: 'input',
          id: 'fullname',
          type: 'text',
          label: 'Full Name',
          placeholder: '',
          required: false,
        },
        window.settings.enableUserInviteWorkflow ? null : this._getCredentialsInput(),
        {
          controlType: 'text',
          id: 'userNameErrorMessage',
          message: '',
        },
        window.settings.enableUserInviteWorkflow ? null : {
          controlType: 'text',
          id: 'passwordErrorMessage',
          message: '',
        },
      ],
      confirm(dialog) {
        if (window.settings.enableUserInviteWorkflow) {
          const inviteUserProto = _this._getInviteUserProto(dialog);
          AccountUtil.inviteUser(inviteUserProto, () => {
            Presence.pushHistory('Sent an invite to ' + inviteUserProto.email);
            dialog.remove();
            _this.props.accounts.fetch();
            ReactDialogBox.alert(
              _this._getConfirmationText(inviteUserProto.email),
              false,
              null,
              null,
              'invite-sent-alert');
          }, (error) => {
            dialog.remove();
            DeprecatedDialogBox.alert('Request failed: ' + error.statusText);
          });
        } else {
          const addUserProto = _this._getAddUserProto(dialog);
          AccountUtil.addUser(addUserProto, () => {
            Presence.pushHistory('Created user ' + addUserProto.username);
            dialog.remove();
            _this.props.accounts.fetch();
          }, (error) => {
            dialog.remove();
            DeprecatedDialogBox.alert('Error: ' + error.statusText);
          });
        }
      },
      confirmButton: window.settings.enableUserInviteWorkflow ? 'Send invite' : 'Ok',
      cancel() {},
      topHtml: helpMessage,
      class: 'add-user-dialog',
    }, null, true);
  },

  _getAddButton() {
    const getLink = (disabled) => (
      <AddButton
        onClick={this.addAccount}
        disabled={disabled}
        label='User'
        moreButtonProps={{ id: 'account-add-button' }}
      />
    );

    if (window.settings &&
        window.settings.accountsLimit >= 0 &&
        window.settings.accountsLimit <= this.props.accounts.size()) {
      // TODO(PROD-8497): maybe include a link to the pricing page here
      const accountsWord = window.settings.accountsLimit === 1 ? 'account' : 'accounts';
      const tooltipText =
        (<span>
          <span>Your plan does not allow more than {window.settings.accountsLimit} user&nbsp;
            {accountsWord}. </span>
          {Tooltip.getGenericUpgradeElement('To add more users')}
        </span>);
      return <Tooltip text={tooltipText}>{getLink(true)}</Tooltip>;
    }
    return getLink(false);
  },

  getCheckboxDisabling(currentUser) {
    let checkboxDisabled = false;
    let messageIfCheckboxDisabled = null;

    if (!window.settings.allowNonAdminUsers || window.settings.disallowAddingAdmins) {
      checkboxDisabled = true;
      messageIfCheckboxDisabled =
        Tooltip.getGenericUpgradeElement('For role-based access control');
    } else if (currentUser) {
      // Check that the current user is defined before trying to access it
      // Disable the checkbox for non-admins
      checkboxDisabled = !currentUser.get('isAdmin');
      messageIfCheckboxDisabled = 'You do not have permission to modify this setting.';
    }

    return {
      checkboxDisabled: checkboxDisabled,
      messageIfCheckboxDisabled: messageIfCheckboxDisabled,
    };
  },

  render() {
    const user = this.props.accounts.where({ id: window.settings.userId })[0];
    const numAdmins = this.props.accounts.where({ isAdmin: true }).length;
    const checkboxDisabling = this.getCheckboxDisabling(user);

    return (
      <div className='row-fluid accounts-view'>
        <div className='table-preamble'>
          {this._getAddButton()}
        </div>
        <ReactAccountListTable
          ref='table'
          accounts={this.props.accounts}
          adminCheckboxDisabled={checkboxDisabling.checkboxDisabled}
          clusterList={window.clusterList}
          adminCheckboxDisabledReason={checkboxDisabling.messageIfCheckboxDisabled}
          numAdmins={numAdmins}
        />
      </div>
    );
  },
});

module.exports = ReactAccountListView;
