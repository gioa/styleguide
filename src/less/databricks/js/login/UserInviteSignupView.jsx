import React from 'react';

import { LoginInputElem } from '../login/LoginInputElem.jsx';
import { LoginUtils } from '../login/LoginUtils.jsx';

/**
 * Note: CE signup and user invite use the same server endpoints as the ResetPasswordView.
 */
export class UserInviteSignupView extends React.Component {
  constructor(props) {
    super(props);

    this.onClickSignup = this.onClickSignup.bind(this);
    this.onKeydown = this.onKeydown.bind(this);
    this.setWarningState = this.setWarningState.bind(this);

    this.state = {
      warning: '',
    };
  }

  componentDidMount() {
    this.refs.fullname.focusInput();
  }

  setWarningState(message) {
    this.setState({ warning: message });
  }

  onClickSignup() {
    // do not continue if config is not successfully fetched
    const configFetched = this.props.configManager.checkConfigState(
      this.setWarningState, LoginUtils.cannotResetPwMsg());
    if (!configFetched) { return; }

    const password1 = this.refs.password1.getValue();
    const password2 = this.refs.password2.getValue();
    const [valid, msg] = LoginUtils.checkFormValidity(password1, password2, this.props.username);
    const fullname = this.refs.fullname.getValue();
    this.setWarningState(msg);
    function invalidPasswordCallback(resp) {
      this.setWarningState('Invalid new password: ' + resp.warnings.join(', '));
    }

    if (valid) {
      const invalidLinkMsg = LoginUtils.invalidSignupLinkMsg();
      LoginUtils.postPasswordReset({
        username: this.props.username,
        expiration: this.props.expiration,
        newPassword: password2,
        newFullname: fullname,
        token: this.props.token,
      }, invalidPasswordCallback.bind(this), this.setWarningState.bind(this, invalidLinkMsg));
    }
  }

  onKeydown(e) {
    if (e.keyCode === 13 /* enter */) {
      this.onClickSignup();
    }
  }

  render() {
    const star = <span className='required-star'>*</span>;
    const header = (this.props.isDevTier ?
      'Sign Up for Databricks Community Edition' : 'Sign into Databricks');
    return (
      <LoginUtils.ViewWrapper containerId='reset-container' formClass='reset-form'
        headerClass='new-user-page' header={header}
      >
        <p className='new-user-page'>Email:</p>
        <div className='new-user-page'>
          <LoginInputElem
            inputClass='reset-form-element'
            inputId='email-placeholder'
            disabled
            inputPlaceholder={this.props.username}
            type='text'
          />
        </div>
        <p className='new-user-page'>First and last name:</p>
        <div className='new-user-page'>
          <LoginInputElem
            ref='fullname'
            inputClass='reset-form-element'
            inputPlaceholder='First and Last Name'
            inputId='fullname'
            type='text'
          />
        </div>
        <p className='new-user-page'>Password:{star}</p>
        <LoginInputElem
          ref='password1'
          inputId='reset-password-1'
          inputClass='reset-form-element'
          name='j_password'
          inputPlaceholder='Password'
          required
          type='password'
        />
        <p className='new-user-page'>Confirm password:{star}</p>
        <LoginInputElem
          ref='password2'
          inputId='reset-password-2'
          inputClass='reset-form-element'
          inputPlaceholder='Confirm Password'
          keydownHandler={this.onKeydown}
          name='j_password_2'
          required
          type='password'
        />
        {this.state.warning !== '' ? <p id='reset-warning'>{this.state.warning}</p> : null}
        <div>
          <button className='btn btn-primary btn-large reset-form-element new-user-page'
            onClick={this.onClickSignup}
          >
            Sign Up
          </button>
        </div>
        <p className='new-user-page'>
          {"Existing user? "}
          <a className='existing-user'
            href={this.props.existingUserLink}
          >Sign in</a>
        </p>
      </LoginUtils.ViewWrapper>
    );
  }
}

UserInviteSignupView.propTypes = {
  // ConfigManager object used to manage configuration fetching
  configManager: React.PropTypes.object.isRequired,
  existingUserLink: React.PropTypes.string.isRequired,
  token: React.PropTypes.string.isRequired,
  username: React.PropTypes.string.isRequired,
  expiration: React.PropTypes.string,
  isDevTier: React.PropTypes.bool,
};
