import React from 'react';

import { LoginUtils } from '../login/LoginUtils.jsx';
import ReactDialogBox from '../ui_building_blocks/dialogs/ReactDialogBox.jsx';

const MISSING_CERT_ERROR_MSG =
  'Your browser did not send a X.509 certificate. A valid certificate is required to sign in.';
const GENERIC_CERT_AUTH_ERROR_MSG =
  'We are unable to validate your X.509 certificate at this time.';

export class ClientCertLoginView extends React.Component {
  constructor(props) {
    super(props);

    this.onSubmitFail = this.onSubmitFail.bind(this);
    this.onClickSubmit = this.onClickSubmit.bind(this);
    this.showTermsOfService = this.showTermsOfService.bind(this);
    this.showRequestAccessDialog = this.showRequestAccessDialog.bind(this);
    this.onKeydown = this.onKeydown.bind(this);

    this.state = {
      submitting: false,
      warningMsg: !props.x509CertSubjectName ? MISSING_CERT_ERROR_MSG : '',
    };
  }

  componentDidMount() {
    this.refs.loginButton.focus();
  }

  onSubmitFail(xhr, type, error) {
    this.setState({ submitting: false });
    this.setState({ warningMsg: error || GENERIC_CERT_AUTH_ERROR_MSG });
  }

  onClickSubmit() {
    this.setState({ submitting: true });
    LoginUtils.logUserInWithClientCert(
      LoginUtils.redirectWithHash,
      this.onSubmitFail);
  }

  showTermsOfService() {
    ReactDialogBox.confirm({
      name: 'login-dialog',
      title: 'Welcome Message',
      message: <LoginUtils.TermsOfServiceBody termsText={this.props.loginTermsText} />,
      confirmButton: 'I accept',
      cancelButton: 'I don\'t accept',
      confirm: this.onClickSubmit,
    });
  }

  showRequestAccessDialog() {
    ReactDialogBox.confirm({
      name: 'login-dialog',
      title: 'Request Access',
      message: <LoginUtils.CertHelperBody subjectName={this.props.x509CertSubjectName} />,
      confirmButton: 'OK',
      showCancel: false,
    });
  }

  onKeydown(e) {
    if (e.keyCode === 13 /* enter */) {
      this.showTermsOfService();
    }
  }

  render() {
    let btnClasses = 'signin btn btn-primary btn-large';
    if (this.state.submitting) {
      btnClasses += ' submitting';
    }

    const certMessage = this.props.x509CertSubjectName ?
      <span>
        Contact your site administrator
        to <a className='cert-link' onClick={this.showRequestAccessDialog}>request access</a>.
      </span> :
      'Contact your site administrator to request access.';

    return (
      <div className='client-cert-view'>
        <div>
          <button ref={'loginButton'}
            className={btnClasses}
            onClick={this.showTermsOfService}
            onKeyDown={this.onKeydown}
            disabled={this.state.submitting ? true : null}
          >
            Sign In
          </button>
        </div>
        <p className='instructions'>{certMessage}</p>
        {this.state.warningMsg ?
          <div className='login-error-message'>{this.state.warningMsg}</div> : null}
      </div>
    );
  }
}

ClientCertLoginView.propTypes = {
  x509CertSubjectName: React.PropTypes.string,
  loginTermsText: React.PropTypes.string,
};
