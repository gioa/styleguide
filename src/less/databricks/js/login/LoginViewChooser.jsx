import React from 'react';

import { UserInviteSignupView } from '../login/UserInviteSignupView.jsx';
import { LoginView } from '../login/LoginView.jsx';
import { ResetPasswordView } from '../login/ResetPasswordView.jsx';

import { ResourceUrls } from '../urls/ResourceUrls';

/**
 * Handles the logic deciding which view (login, password reset, CE signup) to render
 */
export class LoginViewChooser extends React.Component {
  componentDidMount() {
    const self = this;
    this.props.configManager.configPromise.done(() => {
      self.forceUpdate();
    });
  }

  isResettingPassword() {
    // Require reset token, email & expiration date to go to reset password or CE signup pages
    const allParamsExist = this.props.token && this.props.expiration && this.props.username;
    return allParamsExist && location.search.indexOf('?reset') === 0;
  }

  render() {
    const props = this.props;

    if (this.isResettingPassword()) {
      if (location.search.indexOf('?resetnewuser') === 0) {
        return (
          <UserInviteSignupView
            configManager={this.props.configManager}
            existingUserLink={'/login.html?o=' + props.o}
            expiration={props.expiration}
            token={props.token}
            username={props.username}
            isDevTier={window.settings && window.settings.useDevTierLoginScreen}
          />);
      }
      return (
        <ResetPasswordView
          configManager={this.props.configManager}
          expiration={props.expiration}
          token={props.token}
          username={props.username}
        />);
    }
    // if public config is not fetched, we delay showing the view to prevent it from
    // flashing either the SSO-enabled or regular view and then switching
    if (!this.props.configManager.isConfigReady()) {
      return <img className='login-spinner' src={ResourceUrls.getResourceUrl('img/spinner.svg')} />;
    }
    return (
      <LoginView
        user={props.user}
        enableSingleSignOn={window.settings && window.settings.userEnabledSingleSignOn}
        enableX509Authentication={window.settings && window.settings.enableX509Authentication}
        x509CertSubjectName={window.settings && window.settings.x509CertSubjectName}
        loginTermsText={window.settings && window.settings.loginTermsText}
        showSignupLink={window.settings && window.settings.showSignupLink}
        signupUrl={window.settings && window.settings.signupUrl}
        isDevTier={window.settings && window.settings.useDevTierLoginScreen}
        error={props.error}
        browserHash={window.location.hash}
      />);
  }
}

LoginViewChooser.propTypes = {
  // Object to manage configuration fetch state
  configManager: React.PropTypes.object.isRequired,
  expiration: React.PropTypes.string,
  o: React.PropTypes.string,
  token: React.PropTypes.string,
  user: React.PropTypes.string,
  username: React.PropTypes.string,
  // server side authentication error
  error: React.PropTypes.string,
};
