import $ from 'jquery';
import React from 'react';

import ReactDialogBox from '../ui_building_blocks/dialogs/ReactDialogBox.jsx';
import { Icons } from '../ui_building_blocks/icons/Icons.jsx';
import IconsForType from '../ui_building_blocks/icons/IconsForType';
import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

import { DbGuideUrls } from '../urls/DbGuideUrls';
import DbGuideLinks from '../urls/DbGuideLinks';

import { UrlValidators } from '../validators/UrlValidators';

export class SingleSignOnSettingsView extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      fetching: true,
      // shows error message and changes style of certificateInput
      blankCert: false,
      // shows error message and changes style of idpSsoTargetInput
      invalidTarget: false,
    };
    this.fetchSamlSettings = this.fetchSamlSettings.bind(this);
    this.onClickEnable = this.onClickEnable.bind(this);
    this.onClickDisable = this.onClickDisable.bind(this);
    this.onTargetInputBlur = this.onTargetInputBlur.bind(this);
    this.onCertInputBlur = this.onCertInputBlur.bind(this);
    this.fetchSamlSettings();
    // TODO(Chaoyu): This should be the same as the saml cosumer url set in the backend
    this.samlConsumerUrl = location.origin + '/saml/consume';

    // text displayed in tooltips for disabled & enabled states
    this.DISABLED_DB_HELP = 'Use the URL below to create a Databricks application ' +
      'with your identity provider.';
    this.DISABLED_SAML_HELP = 'Enter the SAML 2.0 Endpoint URL given by your identity provider.';
    this.DISABLED_IPI_HELP = 'Enter the identity provider issuer URL (Entity ID).';
    this.DISABLED_CERT_HELP = 'Provide the entire x.509 certificate from your identity provider.';

    this.ENABLED_DB_HELP = 'The URL below should be used to create a Databricks' +
      ' application with your identity provider.';
    this.ENABLED_SAML_HELP = 'This should be the SAML 2.0 Endpoint URL given by your ' +
      'identity provider.';
    this.ENABLED_IPI_HELP = 'This should be the identity provider issuer URL.';
    this.ENABLED_CERT_HELP = 'This should be the entire x.509 certificate from your identity' +
      ' provider.';
  }

  fetchSamlSettings(onSuccess) {
    $.get('/samlsettings', (data) => {
      const enabled = data.SAML_SSO_ENABLED;
      this.setState({
        fetching: false,
        enabled: enabled,
        idpIssuer: data.SAML_IDP_ISSUER_URL,
        ssoTarget: data.SAML_IDP_SSO_TARGET_URL,
        certificate: data.SAML_IDP_CERTIFICATE,
      });
      if (onSuccess) { onSuccess(); }
    }).error((jqXHR, textStatus, errorThrown) => {
      this.setState({ fetching: false });
      if (textStatus === 'error') {
        this.props.dialogBox.alert(errorThrown);
      }
    });
  }

  enableSaml({ issuer, idpSsoTarget, certificate }) {
    $.ajax({
      url: '/samlsettings/enable',
      type: 'POST',
      data: JSON.stringify({
        issuer: issuer,
        idpSsoTarget: idpSsoTarget,
        certificate: certificate,
      }),
      success: () => {
        this.fetchSamlSettings(() => {
          this.props.dialogBox.confirm({
            title: 'Single sign-on enabled',
            message: 'Single sign-on is enabled for your organization.',
            showCancel: false,
            confirmButton: 'OK',
          });
        });
      },
      error: (jqXHR, textStatus, errorThrown) => {
        if (textStatus === 'error') {
          this.props.dialogBox.alert(errorThrown);
        }
      },
      // TODO(chaoyu): backend should validate the settings and here should handle the error message
    });
  }

  disableSaml() {
    $.ajax({
      url: '/samlsettings/disable',
      type: 'POST',
      success: this.fetchSamlSettings,
    });
  }

  onClickEnable() {
    const idpSsoTarget = this.refs.idpSsoTargetInput.value.trim();
    const issuer = this.refs.issuerInput.value.trim();
    const certificate = this.refs.certificateInput.value.trim();
    const targetValid = UrlValidators.validateUrl(idpSsoTarget);
    const certificateBlank = certificate === '';

    if (!targetValid) {
      this.setState({ invalidTarget: true });
    }

    if (certificateBlank) {
      this.setState({ blankCert: true });
    }

    const valid = targetValid && !certificateBlank;

    if (idpSsoTarget && certificate && valid) {
      this.enableSaml({
        idpSsoTarget: idpSsoTarget,
        issuer: issuer,
        certificate: certificate,
      });
    }
  }

  onClickDisable() {
    this.props.dialogBox.confirm({
      title: 'Disabling SAML-based Single Sign-On',
      message: 'Once Single Sign On is disabled, users without a password should reset their' +
        ' password using the \'Forgot Password?\' option on the sign-in page to sign in to' +
        ' Databricks. Alternatively, you can manually reset their password for them in the ' +
         '\'Users\' tab in Admin Console.',
      confirmButton: 'Disable SSO',
      confirmBtnClassName: 'btn',
      cancelButton: 'Cancel',
      confirm: this.disableSaml.bind(this),
    });
  }

  getHeader() {
    return (<span>
      <h1 className='sso-header'>Single Sign-On </h1>
      <span className='subheader'>
        ({this.state.enabled ? 'Enabled' : 'Disabled'})
      </span>
    </span>);
  }

  onTargetInputBlur(e) {
    this.setState({ invalidTarget: !UrlValidators.validateUrl(e.target.value) });
  }

  removeCertificateComments(certificate) {
    // this will replace '-----BEGIN CERTIFICATE-----\ncertificate\n-----END CERTIFICATE-----'
    // with 'certificate'
    return certificate.replace(/(^\-\-\-.*\-\-\-$)/gm, '').trim();
  }

  onCertInputBlur(e) {
    const certificate = this.removeCertificateComments(e.target.value);
    e.target.value = certificate;
    this.setState({ blankCert: certificate === '' });
  }

  getStar() {
    return <div className='star'>&#42;</div>;
  }

  samlSettingsForm() {
    const inputDisabled = this.state.enabled ? true : null;
    const stepTwo = (<div>
      {Icons.getNum('2')}
      <span className='step-help-text'>Provide information from your identity provider</span>
    </div>);

    return (<div className='saml-settings-form'>
      {this.state.enabled ? null : stepTwo}

      <div className={`saml-setting-input-container ${inputDisabled ? 'disable' : 'left-indent'}`}>
        <div className='saml-setting-input'>
          <div className='saml-input-label'>
            Single Sign-On URL{this.getStar()}
            {this.getHelp(`${inputDisabled ? this.ENABLED_SAML_HELP : this.DISABLED_SAML_HELP}`,
              true)}
          </div>
          <div className='input-wrapper'>
            <input type='text' ref='idpSsoTargetInput' defaultValue={this.state.ssoTarget}
              className={this.state.invalidTarget ? 'invalid-input' : ''} disabled={inputDisabled}
              onBlur={this.onTargetInputBlur}
            />
            {this.state.invalidTarget ? <span className='invalid-warning' ref='targetWarning'>
              Invalid URL format; please enter again.
            </span> : null}
          </div>
        </div>

        <div className='saml-setting-input'>
          <div className='saml-input-label'>
            Identity Provider Issuer URL
            {this.getHelp(`${inputDisabled ? this.ENABLED_IPI_HELP : this.DISABLED_IPI_HELP}`)}
          </div>
          <div className='input-wrapper'>
            <input type='text' ref='issuerInput'
              disabled={inputDisabled} defaultValue={this.state.idpIssuer}
            />
          </div>
        </div>

        <div className='saml-setting-input'>
          <div className='saml-input-label'>
            x.509 Certificate{this.getStar()}
            {this.getHelp(`${inputDisabled ? this.ENABLED_CERT_HELP : this.DISABLED_CERT_HELP}`,
              true)}
          </div>
          <div className='input-wrapper'>
            <textarea ref='certificateInput' rows={12}
              defaultValue={this.state.certificate} onBlur={this.onCertInputBlur}
              className={this.state.blankCert ? 'invalid-input' : ''} disabled={inputDisabled}
            />
            {this.state.blankCert ? <div className='invalid-cert' ref='certWarning'>
              This field is required.
            </div> : null}
          </div>
        </div>
      </div>
    </div>);
  }

  getEnableDisableBtn() {
    if (this.state.enabled) {
      return (<div className='disable-btn-wrapper'>
        <button className='btn' onClick={this.onClickDisable}>
          Disable SSO
        </button>
      </div>);
    }
    return (
      <div>
        <button className='btn left-indent' onClick={this.onClickEnable}>
          Enable SSO
        </button>
        <span className='enable-btn-msg'>
          Once enabled, non-admin users are required to sign in with Single Sign-On only.
        </span>
      </div>);
  }

  getHelp(tooltipText, fixPosition) {
    return (
      <Tooltip text={tooltipText} customPosition={fixPosition ? { contentLeft: '0px' } : null}>
        <i className={`fa fa-${IconsForType.hint}`}></i>
      </Tooltip>);
  }

  renderStaticIdpUrl(enabled) {
    const stepOne = (<div>
      {Icons.getNum('1')}
      <span className='step-help-text'>Use this URL to configure your identity provider</span>
    </div>);

    return (<div className='static-idp-url-section'>
      {enabled ? null : stepOne}
      <div className={`static-idp-url-container ${this.state.enabled ? '' : 'left-indent'}`}>
        <div className='static-idp-url-header'>
          Databricks SAML URL
          {this.getHelp(`${this.state.enabled ? this.ENABLED_DB_HELP : this.DISABLED_DB_HELP}`)}
        </div>
        <div className='static-idp-url'>{this.samlConsumerUrl}</div>
      </div>
    </div>);
  }

  getInstructions() {
    const overviewLink = (<a href={DbGuideUrls.getDbGuideUrl(DbGuideLinks.SSO_OVERVIEW_URL)}>
      {this.state.enabled ? 'here' : 'other identity providers'}</a>);
    if (this.state.enabled) {
      return (<p className='get-started-text'>
        Single Sign-On is enabled in your organization. You may need to authorize people in your
        identity provider settings to allow access to Databricks. For more help,
        click {overviewLink}.
      </p>);
    }
    const oktaLink =
    (<a className='id-provider-help-link'
      href={DbGuideUrls.getDbGuideUrl(DbGuideLinks.SSO_OKTA_URL)}
    >Okta</a>);
    const pingIdentityLink =
    (<a className='id-provider-help-link'
      href={DbGuideUrls.getDbGuideUrl(DbGuideLinks.SSO_PING_IDENTITY_URL)}
    >Ping Identity</a>);
    const oneLoginLink =
    (<a className='id-provider-help-link'
      href={DbGuideUrls.getDbGuideUrl(DbGuideLinks.SSO_ONE_LOGIN_URL)}
    >OneLogin</a>);

    return (<p className='get-started-text'>
      View instructions for SAML 2.0 single sign-on for {oktaLink}, {pingIdentityLink}
      , {oneLoginLink} or {overviewLink}.
    </p>);
  }

  render() {
    if (this.state.fetching) {
      return (<div className='single-sign-on-admin-settings'>
        <p><i className='spinner fa fa-spinner fa-spin' />Fetching Single Sign On settings...</p>
      </div>);
    }

    return (<div className='single-sign-on-admin-settings'>
      { this.getHeader() }
      { this.getInstructions() }
      { this.renderStaticIdpUrl(this.state.enabled) }
      { this.samlSettingsForm() }
      { this.getEnableDisableBtn() }
      { this.state.enabled ? null :
        <span className='required-field-notice'>{this.getStar()}
          <span>indicates required field</span>
        </span> }
    </div>);
  }
}

SingleSignOnSettingsView.propTypes = {
  // using default prop to make testing easier
  dialogBox: React.PropTypes.object,
};

SingleSignOnSettingsView.defaultProps = {
  dialogBox: ReactDialogBox,
};
