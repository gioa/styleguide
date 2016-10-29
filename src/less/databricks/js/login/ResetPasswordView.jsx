import React from 'react';

import { LoginInputElem } from '../login/LoginInputElem.jsx';
import { LoginUtils } from '../login/LoginUtils.jsx';

export class ResetPasswordView extends React.Component {
  constructor(props) {
    super(props);

    this.onClickReset = this.onClickReset.bind(this);
    this.onKeydown = this.onKeydown.bind(this);
    this.setWarningState = this.setWarningState.bind(this);

    this.state = {
      warning: '',
    };
  }

  componentDidMount() {
    this.refs.resetPassword1.focusInput();
  }

  setWarningState(message) {
    this.setState({ warning: message });
  }

  onClickReset() {
    // do not continue if config is not successfully fetched
    const configFetched = this.props.configManager.checkConfigState(
      this.setWarningState, LoginUtils.cannotResetPwMsg());
    if (!configFetched) { return; }

    const password1 = this.refs.resetPassword1.getValue();
    const password2 = this.refs.resetPassword2.getValue();
    const [valid, msg] = LoginUtils.checkFormValidity(password1, password2);
    this.setWarningState(msg);
    function invalidPasswordCallback(resp) {
      this.setWarningState('Invalid new password: ' + resp.warnings.join(', '));
    }

    if (valid) {
      const invalidLinkMsg = LoginUtils.invalidResetLinkMsg();
      LoginUtils.postPasswordReset({
        username: this.props.username,
        expiration: this.props.expiration,
        newPassword: password2,
        token: this.props.token,
      }, invalidPasswordCallback.bind(this), this.setWarningState.bind(this, invalidLinkMsg));
    }
  }

  onKeydown(e) {
    if (e.keyCode === 13 /* enter */) {
      this.onClickReset();
    }
  }

  render() {
    const star = <span className='required-star'>*</span>;
    return (
      <LoginUtils.ViewWrapper containerId='reset-container' formClass='reset-form'
        headerClass='reset-page-only' header='Reset Password'
      >
        <p className='reset-page-only'>Please enter your new password:{star}</p>
        <LoginInputElem
          ref='resetPassword1'
          id='reset-password-1'
          inputClass='reset-form-element'
          name='j_password'
          inputPlaceholder='Password'
          required
          type='password'
        />
        <p className='reset-page-only'>Please confirm your new password:{star}</p>
        <LoginInputElem
          ref='resetPassword2'
          id='reset-password-2'
          inputClass='reset-form-element'
          inputPlaceholder='Confirm Password'
          keydownHandler={this.onKeydown}
          name='j_password_2'
          required
          type='password'
        />
        {this.state.warning !== '' ? <p id='reset-warning'>{this.state.warning}</p> : null}
        <div>
          <button className='btn btn-primary btn-large reset-form-element reset-page-only'
            onClick={this.onClickReset}
          >
            Reset password
          </button>
        </div>
      </LoginUtils.ViewWrapper>
    );
  }
}

ResetPasswordView.propTypes = {
  // ConfigManager object used to manage configuration fetching
  configManager: React.PropTypes.object.isRequired,
  expiration: React.PropTypes.string.isRequired,
  token: React.PropTypes.string.isRequired,
  username: React.PropTypes.string.isRequired,
};
