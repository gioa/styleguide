/* eslint react/prefer-es6-class: 0 */

import $ from 'jquery';
import React from 'react';
import ClassNames from 'classnames';

import ReactDialogBox from '../ui_building_blocks/dialogs/ReactDialogBox.jsx';
import { Panel, Tabs } from '../ui_building_blocks/TabsView.jsx';
import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

import { ResourceUrls } from '../urls/ResourceUrls';

import { PasswordValidators } from '../validators/PasswordValidators';

/**
 * A pref panel for all the misc settings you can have. Currently it only works with preferences
 * stored in window.prefs; we should eventually migrate these to be stored in the backend.
 */
const PreferencesPanel = React.createClass({
  sections: [
    {
      title: 'Notebook Settings',
      prefs: [
        {
          prefType: 'boolean',
          prefKey: 'autoLaunchAndAttach',
          description: ('When running commands in Notebooks, automatically launch and attach ' +
            'to clusters without prompting'),
        },
        {
          prefType: 'boolean',
          prefKey: 'disableSmartQuotes',
          description: 'Turn off smart quote and bracket matching',
        },
      ],
    },
  ],

  render() {
    return (
      <div className='accounts-prefs-area'>
        {this.renderSections(this.sections)}
      </div>);
  },

  renderSections(sections) {
    const self = this;
    return sections.map((section) => (
      <div>
        <div className='row-fluid'>
          <h2>{section.title}</h2>
        </div>
        <div className='row-fluid'>
          <div>
            {section.prefs.map(self.renderPref)}
          </div>
        </div>
      </div>
    ));
  },

  renderPref(pref) {
    if (pref.prefType !== 'boolean') {
      throw new Error('Unsupported pref type: ' + pref.prefType);
    }
    return (
      <div>
        <input key={pref.prefKey} className={'user-pref-key pref-' + pref.prefKey} type='checkbox'
          onClick={() => this.togglePref(pref.prefKey)}
          checked={window.prefs.get(pref.prefKey)}
        >
          {pref.description}
        </input>
      </div>);
  },

  togglePref(prefKey) {
    window.prefs.set(prefKey, !window.prefs.get(prefKey));
    window.recordEvent('prefChange', {
      'property': prefKey,
      'propertyValue': window.prefs.get(prefKey).toString(),
    });
    this.forceUpdate();
  },
});

const GitHubSettingsPanel = React.createClass({

  getInitialState() {
    return {
      gitNotification: '',
      gitNotificationStatus: '',
      showTokenArea: true,
      enableSaveTokenBtn: false,
      showEditTokenBtn: false,
      showRetryTokenBtn: false,
    };
  },

  componentDidMount() {
    this.getTokenStatus();
  },

  allowGitHubSave() {
    const histHorizon = (window.settings && window.settings.notebookRevisionVisibilityHorizon) || 0;
    return histHorizon === 0;
  },

  getTokenStatus() {
    this.setState({
      showRetryTokenBtn: false,
    });
    $.ajax('/account/git/credentials', {
      context: this,
      type: 'GET',
      error() {
        console.error("Error checking user's token.");
        this.setState({
          gitNotification: 'Error checking GitHub token.',
          gitNotificationStatus: 'error',
        });
      },
      complete(xhr, status) {
        const newState = {};
        if (status === 'success') {
          if (xhr.responseJSON.hasToken) {
            newState.showEditTokenBtn = true;
            newState.showTokenArea = false;
          } else {
            newState.showEditTokenBtn = false;
            newState.showTokenArea = true;
          }
        } else {
          newState.showRetryTokenBtn = true;
        }
        this.setState(newState);
      },
    });
  },

  onSaveToken() {
    if (!this.allowGitHubSave()) {
      ReactDialogBox.alert(Tooltip.getUpgradeElement('Github integration', false));
    } else {
      this.setState({ showTokenArea: false });
      const token = this.refs.gitToken.value;
      $.ajax('/account/git', {
        context: this,
        type: 'POST',
        data: JSON.stringify({
          token: token,
        }),
        success() {
          this.setState({
            gitNotification: 'Successfully saved GitHub token.',
            gitNotificationStatus: 'success',
          });
        },
        error(xhr, status, error) {
          console.error(error);
          this.setState({
            gitNotification: 'Failed to save GitHub token. Please try again.',
            gitNotificationStatus: 'error',
          });
        },
        complete(xhr, status) {
          if (status !== 'nocontent') {
            this.setState({ showTokenArea: true });
          } else {
            this.setState({ showEditTokenBtn: true });
          }
        },
      });
    }
  },

  onTokenInput(e) {
    e.preventDefault();
    const token = this.refs.gitToken.value;
    if (token !== null && token.trim().length === 40) {
      this.setState({ enableSaveTokenBtn: true });
    } else {
      this.setState({ enableSaveTokenBtn: false });
    }
  },

  onEditToken() {
    this.setState({
      showEditTokenBtn: false,
      showTokenArea: true,
      enableSaveTokenBtn: false,
      gitNotification: '',
    });
  },

  onRetryToken() {
    this.setState({
      showRetryTokenBtn: false,
    });
    this.getTokenStatus();
  },

  render() {
    const alertDiv = (
        <div className='alert-area alert-area-git'>
          <span className={'alert alert-git alert-' + this.state.gitNotificationStatus}>
            {this.state.gitNotification}
          </span>
        </div>);

    const retryButton = (
        <div id='retry-git-token-button'
          onClick={this.onRetryToken}
        >
          <button className='btn btn-medium git-button'>
            Retry
          </button>
        </div>);

    const editTokenButton = (
        <div id='edit-git-token-button'
          onClick={this.onEditToken}
        >
          <button className='btn btn-medium git-button'>
            Change GitHub Token
          </button>
        </div>);

    const enableSaveTokenBtn = this.state.enableSaveTokenBtn;
    const saveBtnClasses = ClassNames({
      'btn btn-medium git-button': true,
      'btn-primary': enableSaveTokenBtn,
      'disabled': !enableSaveTokenBtn,
    });

    const saveButtonTitle = 'Your GitHub token should be 40 characters long.';

    const tokenArea = (
        <div id='git-token-area'>
          <div className='row-fluid'>
            <div className='span10'>
              <label>Token
                <input type='password'
                  placeholder='GitHub Api Token with repo permissions'
                  id='gitToken'
                  ref='gitToken'
                  name='gitToken'
                  onChange={this.onTokenInput}
                  required='true'
                />
              </label>
            </div>
          </div>
          <div className='row-fluid'>
            <div className='span12'>
              <button
                className={saveBtnClasses}
                id='save-git-token-button'
                onClick={this.onSaveToken}
                disabled={!enableSaveTokenBtn ? 'disabled' : undefined}
                title={!enableSaveTokenBtn ? saveButtonTitle : 'Save your GitHub Token.'}
              >
                Save
              </button>
            </div>
          </div>
        </div>);

    const inst = 'https://help.github.com/articles/creating-an-access-token-for-command-line-use/';

    return (
        <div className='accounts-git-area'>
          <div className='row-fluid'>
            <h2>Connect to your GitHub Account</h2>
          </div>
          <div className='row-fluid'>
            <p>
              In order to seamlessly connect your notebooks to GitHub repositories, we need a
              GitHub<br />
              Personal Access Token. Generating one is very easy. Simply follow the steps provided
              in<br />
              <a href={inst} target='_blank'>the GitHub documentation.</a>
            </p>
            <p>
              In order to make commits, and connect to private repositories, we need the token to
              <br />
              provide "repo" authorization as shown in the image below.
            </p>
            <img src={ResourceUrls.getResourceUrl('images/github-auth.png')} width='35%' />
          </div>
          <div className='row-fluid'>
            <div className='span12'>
              {this.state.showEditTokenBtn ? editTokenButton : null}
              {this.state.showRetryTokenBtn ? retryButton : null}
            </div>
          </div>
          {this.state.showTokenArea ? tokenArea : null}
          {this.state.gitNotification !== '' ? alertDiv : null}
        </div>);
  },
});

const PasswordChangePanel = React.createClass({

  getInitialState() {
    return {
      passwordMessage: '',
      passwordValid: false,
      passwordsMatch: false,
      notification: '',
      notificationStatus: '',
    };
  },

  onSubmit(e) {
    e.preventDefault();

    const basicattr = {};

    // only set the password fields if the customer is changing their password
    if (this.state.passwordValid && this.state.passwordsMatch) {
      basicattr.newPassword = this.refs.password1.value;
      basicattr.currentPassword = this.refs.currentPassword.value;
    } else {
      return;
    }

    $.ajax({
      url: '/account/changePassword',
      method: 'POST',
      dataType: 'json',
      data: JSON.stringify(basicattr),
      context: this,
    }).done(function successCallback() {
      this.setState({
        notification: 'Your Password was successfully saved.',
        notificationStatus: 'success',
      });
    }).fail(function errorCallback(jqXHR, textStatus, message) {
      this.setState({
        notification: message || 'Your Password was not saved. ' +
        'Please please try again or contact your account admin.',
        notificationStatus: 'error',
      });
    });
  },

  onPasswordChange() {
    const pw1 = this.refs.password1.value;
    const pw2 = this.refs.password2.value;

    const [valid, message] = PasswordValidators.validatePassword(
      pw1, window.settings.user, window.settings.userFullname);
    if (!valid) {
      // The password is weak
      this.setState({
        passwordMessage: message,
        passwordValid: false,
        passwordsMatch: false,
      });
    } else if (pw1 === pw2) {
      // Everything is good!
      this.setState({
        passwordMessage: '',
        passwordValid: true,
        passwordsMatch: true,
      });
    } else {
      // The passwords do not match
      this.setState({
        passwordMessage: "Passwords don't match",
        passwordValid: true,
        passwordsMatch: false,
      });
    }
  },

  render() {
    const pwInputClasses = ClassNames({
      'error': !this.state.passwordValid,
      'success': this.state.passwordValid,
    });

    const pwSubmitClasses = ClassNames({
      'btn btn-medium': true,
      'disabled': !this.state.passwordValid || !this.state.passwordsMatch,
      'btn-primary': this.state.passwordValid && this.state.passwordsMatch,
    });

    const notifyDiv = (
        <div className='alert-area'>
          <span className={'alert alert-' + this.state.notificationStatus}>
            {this.state.notification}
          </span>
        </div>);

    return (
        <div id='password-change' className='content-wrapper'>
          <form className='container-fluid' role='form'>
              {this.state.notification !== '' ? notifyDiv : null}
            <div className='row-fluid'>
              <h2>Change Your Password</h2>
            </div>
            <div className='row-fluid'>
              <p className='instructions'>Your password should be longer than 8 characters.</p>
            </div>
            <div className='row-fluid'>
              <div className='span2'><label>Current Password</label></div>
              <div className='span10'>
                <input type='password'
                  placeholder='Current Password'
                  ref='currentPassword'
                  id='currentPassword'
                  name='currentPassword'
                  required='true'
                />
              </div>
            </div>
            <div className='row-fluid'>
              <div className='span2'><label>New Password</label></div>
              <div className='span10'>
                <input type='password'
                  ref='password1'
                  className={pwInputClasses}
                  onChange={this.onPasswordChange}
                  placeholder='New Password'
                  id='newPassword'
                  name='newPassword'
                  required='true'
                />
              </div>
            </div>
            <div className='row-fluid'>
              <div className='span2'><label>Confirm Password</label></div>
              <div className='span10'>
                <input type='password'
                  ref='password2'
                  className={pwInputClasses}
                  onChange={this.onPasswordChange}
                  placeholder='Confirm New Password'
                  id='newPassword2'
                  name='newPassword2'
                  required='true'
                />
              </div>
            </div>
            <div className='row-fluid'>
              <span className='span2'></span>
              <span ref='passwordMessage' className='span10 passwordMessage'>
                {this.state.passwordMessage}
              </span>
            </div>
            <div className='row-fluid'>
              <div className='span12'>
                <button
                  onClick={this.onSubmit}
                  className={pwSubmitClasses}
                  id='change-password-button'
                >
                  Change Password
                </button>
              </div>
            </div>
          </form>
        </div>);
  },
});

export class AccountSettingsView extends React.Component {
  constructor(props) {
    super(props);

    this.activeTab = this.getActiveTab();
  }

  getActiveTab() {
    // make sure not to show the change password tab as active if it is disabled
    if (this.props.disablePasswordTab) {
      if (this.props.defaultTab && this.props.defaultTab !== 'password') {
        return this.props.defaultTab;
      }
      return 'github';
    }
    return this.props.defaultTab;
  }

  render() {
    return (
        <Tabs activeTab={this.activeTab} ref='tab'>
          <Panel title='Password' name='password' ref='pwTab'
            tooltipText={this.props.disablePasswordTooltip}
            disabled={this.props.disablePasswordTab}
          >
            <PasswordChangePanel ref='pwChangePanel' />
          </Panel>
          <Panel title='GitHub Integration' name='github'>
            <GitHubSettingsPanel />
          </Panel>
          <Panel title='Notebook Settings' name='prefs'>
            <PreferencesPanel />
          </Panel>
        </Tabs>);
  }
}

AccountSettingsView.propTypes = {
  defaultTab: React.PropTypes.string,
  disablePasswordTab: React.PropTypes.bool,
  disablePasswordTooltip: React.PropTypes.string,
};

module.exports.PasswordChangePanel = PasswordChangePanel;
module.exports.GitHubSettingsPanel = GitHubSettingsPanel;
module.exports.PreferencesPanel = PreferencesPanel;
