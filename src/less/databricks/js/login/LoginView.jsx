import React from 'react';

import { ClientCertLoginView } from '../login/ClientCertLoginView.jsx';
import { LoginInputElem } from '../login/LoginInputElem.jsx';
import { LoginUtils } from '../login/LoginUtils.jsx';
import PasswordUtils from '../login/PasswordUtils';

import { Panel, Tabs } from '../ui_building_blocks/TabsView.jsx';

const INVALID_EMAIL_OR_PW_MSG = 'Invalid email address or password';
const UNABLE_TO_RESET_MSG = 'We are unable to reset your password at this time.';
const ENTER_VALID_EMAIL_MSG = 'Please enter a valid email.';

export class LoginView extends React.Component {
  constructor(props) {
    super(props);

    this.onClickSubmit = this.onClickSubmit.bind(this);
    this.onKeydown = this.onKeydown.bind(this);
    this.onClickForgotPassword = this.onClickForgotPassword.bind(this);
    this.setWarningMsg = this.setWarningMsg.bind(this);
    this.onSubmitFail = this.onSubmitFail.bind(this);
    this.onTabClick = this.onTabClick.bind(this);

    this.SSO_TAB = 'single-sign-on';
    this.PW_TAB = 'password-sign-on';

    this.state = {
      activeTab: this.SSO_TAB,
      // enables/disables the submit button
      submitting: false,
      warningMsg: '',
    };
  }

  componentDidMount() {
    if (this.refs.loginEmail) {
      this.refs.loginEmail.focusInput();
    }

    if (this.props.error) {
      this.setWarningMsg(this.props.error);
      if (history) {
        history.replaceState(null, null, 'login.html');
      }
    }
  }

  setWarningMsg(msg) {
    this.setState({ warningMsg: msg });
  }

  /** Password-based auth error handler */
  onSubmitFail() {
    this.setWarningMsg(INVALID_EMAIL_OR_PW_MSG);
    this.setState({ submitting: false });
  }

  /** Password-based auth submit handler */
  onClickSubmit() {
    this.setWarningMsg('');
    this.setState({ submitting: true });
    LoginUtils.logUserIn(
      this.refs.loginEmail.getValue(),
      this.refs.loginPassword.getValue(),
      LoginUtils.redirectWithHash,
      this.onSubmitFail);
  }

  onClickForgotPassword() {
    const email = this.refs.loginEmail.getValue();
    if (/.+@.+\..+/.test(email)) {
      PasswordUtils.sendForgotPasswordToken(email, this.setWarningMsg,
        this.setWarningMsg.bind(this, UNABLE_TO_RESET_MSG));
    } else {
      this.setWarningMsg(ENTER_VALID_EMAIL_MSG);
      this.refs.loginEmail.clear();
      this.refs.loginEmail.focusInput();
    }
  }

  onKeydown(e) {
    if (e.keyCode === 13 /* enter */) {
      this.onClickSubmit();
    }
  }

  renderPasswordView() {
    let btnClasses = 'signin btn btn-primary btn-large';
    if (this.state.submitting) {
      btnClasses += ' submitting';
    }

    let signupLink = null;
    if (this.props.showSignupLink) {
      signupLink = (
        <div className='signup-link-wrapper'>
          {'New to Databricks? '}
          <a id='signup-link' target='_blank'
            href={this.props.signupUrl}
          >Sign Up</a>.
        </div>
      );
    }

    return (
      <div>
        <LoginInputElem
          defaultValue={this.props.user}
          iconClass='fa fa-user'
          inputId='login-email'
          inputName='j_username'
          inputPlaceholder='Email / Username'
          keydownHandler={this.onKeydown}
          ref='loginEmail'
          required
          showIcon
          type='text'
        />
        <LoginInputElem
          iconClass='fa fa-lock'
          inputId='login-password'
          inputName='j_password'
          inputPlaceholder='Password'
          keydownHandler={this.onKeydown}
          ref='loginPassword'
          required
          showIcon
          type='password'
        />
        <div className='reset-password-wrapper'>
          <a id='reset-pw' onClick={this.onClickForgotPassword}>Forgot Password?</a>
        </div>
        {this.state.warningMsg !== '' ?
          <div className='login-error-message'>{this.state.warningMsg}</div> : null}
        <div>
          <button className={btnClasses} onClick={this.onClickSubmit}
            disabled={this.state.submitting ? true : null}
          >
            Sign In
          </button>
        </div>
        {signupLink}
      </div>);
  }

  renderSSOView() {
    return (
      <div>
        <p className='instructions'>Single Sign On is enabled in your organization. Use your
          organization's network to sign in.</p>
        <a href={'/saml/auth?hash=' + btoa(this.props.browserHash)}
          className='btn btn-primary btn-large sso-btn'
        >
          Single Sign On
        </a>
        <p className='instructions'>Contact your site administrator to request access.</p>
        {this.state.warningMsg !== '' ?
          <div className='login-error-message'>{this.state.warningMsg}</div> : null}
      </div>
    );
  }

  renderClientCertView() {
    return (
      <ClientCertLoginView
        submitting={this.state.submitting}
        warningMsg={this.state.warningMsg}
        onStateChange={this.onStateChange}
        x509CertSubjectName={this.props.x509CertSubjectName}
        loginTermsText={this.props.loginTermsText}
      />
    );
  }

  onTabClick(activeTab) {
    if (activeTab !== this.state.activeTab) {
      this.setWarningMsg('');
    }
    this.setState({ activeTab: activeTab });
  }

  renderTabsView() {
    return (
      <Tabs activeTab={this.state.activeTab} linkClass='sso-tab-link' onTabClick={this.onTabClick}>
        <Panel title='Single Sign On' name={this.SSO_TAB}>
          {this.renderSSOView()}
        </Panel>
        <Panel title='Admin Log In' name={this.PW_TAB}>
          {this.renderPasswordView()}
        </Panel>
      </Tabs>
    );
  }

  render() {
    const header = this.props.isDevTier ?
      <span>
        <img className='ce-logo'
          src='/login/databricks_ce_icon.svg' title='Community Edition'
        /> Sign In to Databricks
      </span>
      : 'Sign In to Databricks';

    let internalView;
    if (this.props.enableX509Authentication) {
      internalView = this.renderClientCertView();
    } else if (this.props.enableSingleSignOn) {
      internalView = this.renderTabsView();
    } else {
      internalView = this.renderPasswordView();
    }

    return (
      <LoginUtils.ViewWrapper containerId='login-container' header={header}>
        {internalView}
      </LoginUtils.ViewWrapper>
    );
  }
}

LoginView.propTypes = {
  user: React.PropTypes.string,
  showSignupLink: React.PropTypes.bool,
  signupUrl: React.PropTypes.string,
  isDevTier: React.PropTypes.bool,
  enableSingleSignOn: React.PropTypes.bool,
  enableX509Authentication: React.PropTypes.bool,
  x509CertSubjectName: React.PropTypes.string,
  loginTermsText: React.PropTypes.string,
  error: React.PropTypes.string,
  // browser hash for SSO redirect
  browserHash: React.PropTypes.string,
};

LoginView.defaultProps = {
  enableSingleSignOn: false,
  enableX509Authentication: false,
  x509CertSubjectName: '',
  loginTermsText: '',
};

LoginView.INVALID_EMAIL_OR_PW_MSG = INVALID_EMAIL_OR_PW_MSG;
LoginView.UNABLE_TO_RESET_MSG = UNABLE_TO_RESET_MSG;
LoginView.ENTER_VALID_EMAIL_MSG = ENTER_VALID_EMAIL_MSG;
