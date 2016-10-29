import $ from 'jquery';
import React from 'react';

import PasswordUtils from '../login/PasswordUtils';

import { PasswordValidators } from '../validators/PasswordValidators';

/**
 * Utility functions for components in LoginView
 */
export class LoginUtils {
  static cannotResetPwMsg() {
    return 'Can not reset your password at this moment, please contact support@databricks.com';
  }

  static invalidResetLinkMsg() {
    return 'This link is invalid. You may have already used it or it may have expired.';
  }

  static invalidSignupLinkMsg() {
    const loginUrl = window.location.protocol + '//' + window.location.host + '/login.html';
    const link = <a href={loginUrl}>here</a>;
    return (
      <span>
        You have already registered using this link. Sign into Databricks {link}.
      </span>
    );
  }

  /**
   * Logs user in. If request fails, redirects to login page saying failed.
   * @param {string} username
   * @param {string} password
   * @param {function} onSuccess  function to call on success
   * @param {function} onFail  function to call if request fails
   */
  static logUserIn(username, password, onSuccess, onFail) {
    document.cookie = 'csrf-token=' + LoginUtils.getCsrfToken() + '; ';

    $.ajax({
      url: '/j_security_check',
      type: 'POST',
      data: {
        'j_username': username,
        'j_password': password,
      },
      success: () => {
        onSuccess();
      },
      error: (xhr, type, error) => {
        if (onFail) {
          onFail(xhr, type, error);
        }
      },
    });
  }

  /**
   * Logs a user in via x509 certificate authentication.
   * If request fails, redirects to login page saying failed.
   *
   * @param {function} onSuccess  function to call on success
   * @param {function} onFail  function to call if request fails
   */
  static logUserInWithClientCert(onSuccess, onFail) {
    $.ajax({
      url: '/x509cert/auth',
      type: 'GET',
      success: () => {
        onSuccess();
      },
      error: (xhr, type, error) => {
        if (onFail) {
          onFail(xhr, type, error);
        }
      },
    });
  }

  /**
   * Checks the validity of the reset password and Community Edition signup forms, including:
   *    - whether password is valid
   *    - whether passwords match
   *
   * @param {string} pass1 first password user entered
   * @param {string} pass2 second password user entered
   * @param {string} username (optional)
   * @return {array} [bool, string] valid status of form and message to display
   */
  static checkFormValidity(pass1, pass2, username) {
    let [valid, passwordWarning] = PasswordValidators.validatePassword(pass1, username);
    if (valid) {
      [valid, passwordWarning] = PasswordUtils.checkEquality(pass1, pass2);
    }
    if (valid) { passwordWarning = ''; }

    return [valid, passwordWarning];
  }

  /**
   * Tries to post a password reset or Community Edition signup request to the server.
   */
  static postPasswordReset(data, invalidPasswordCallback, onFail) {
    $.ajax({
      url: '/resetpassword/reset',
      type: 'POST',
      data: JSON.stringify(data),
      success: (resp) => {
        LoginUtils.handleResetResult(resp, data, invalidPasswordCallback, onFail);
      },
      error: () => {
        onFail();
      },
    });
  }

  static redirect() {
    window.location.href = '/';
  }

  static redirectWithHash() {
    // location.search preserves the org ID for Community Edition
    window.location.href = '/' + location.search + location.hash;
  }

  /**
   * Handles the response received from the server after postPasswordReset is successful.
   * Either logs the user in, calls an invalid password callback, or calls onFail function.
   */
  static handleResetResult(resp, data, invalidPasswordCallback, onFail) {
    if (resp && resp.type) {
      // We got confirmation the password got reset, log the user in.
      if (resp.type === 'PasswordReset') {
        // If SSO is enabled, redirect to the SSO page on failed (non-admin) login
        const onLoginFail = ((window.settings && window.settings.userEnabledSingleSignOn) ?
          LoginUtils.redirect : undefined);
        LoginUtils.logUserIn(data.username, data.newPassword, LoginUtils.redirect, onLoginFail);
        return;
      } else if (resp.type === 'InvalidPassword' && resp.warnings && resp.warnings.length > 0) {
        invalidPasswordCallback(resp);
        return;
      }
    }
    onFail();
  }

  /**
   * Stateless wrapper component providing some common elements to the individual views
   */
  static ViewWrapper(props) {
    return (
      <div id={props.containerId} className='container'>
        <img src='/login/databricks_logoTM_rgb_TM.svg' className='login-logo' />
        <div className={`login-form${props.formClass ? ' ' + props.formClass : ''}`}>
          <h3 className={`sub-header${props.headerClass ? ' ' + props.headerClass : ''}`}>
            {props.header}
          </h3>
          {props.children}
        </div>
      </div>
    );
  }

  /**
   * Body of the terms of service dialog (for certificate based authentication only)
   */
  static TermsOfServiceBody(props) {
    return (
      <div className='login-dialog-body'>
        Please accept the following terms to continue.
        <div className='scrolling-text'>
          {props.termsText}
        </div>
      </div>
    );
  }

  /**
   * Body of the x509 certificate helper dialog that shows the user's subject name.
   */
  static CertHelperBody(props) {
    return (
      <div className='login-dialog-body'>
        Contact your site administrator to request access.
        Your administrator will need your X.509 certificate subject name:
        <div className='scrolling-text'>
          {props.subjectName}
        </div>
      </div>
    );
  }

  static getCsrfToken() {
    let csrfToken = '';
    // Only make the ajax request if loginCsrf is enabled
    if (window.settings && window.settings.loginCsrf) {
      // If the handler does not respond with a token, proceed with an empty token.
      $.ajax({
        dataType: 'json',
        url: '/login-csrf',
        success: (json) => {
          csrfToken = json.token;
        },
        async: false, // NOLINT
      });
    }
    return csrfToken;
  }

  static getParams() {
    let match;
    const pl = /\+/g; // Regex for replacing addition symbol with a space
    const search = /([^&=]+)=?([^&]*)/g;
    const decode = function decode(s) { return decodeURIComponent(s.replace(pl, ' ')); };
    const query = window.location.search.substring(1);

    const urlParams = {};
    match = search.exec(query);
    while (match) {
      urlParams[decode(match[1])] = decode(match[2]);
      match = search.exec(query);
    }
    return urlParams;
  }
}

LoginUtils.ViewWrapper.propTypes = {
  containerId: React.PropTypes.string,
  header: React.PropTypes.node,
  headerClass: React.PropTypes.string,
  formClass: React.PropTypes.string,
};

LoginUtils.TermsOfServiceBody.propTypes = {
  termsText: React.PropTypes.string,
};

LoginUtils.CertHelperBody.propTypes = {
  subjectName: React.PropTypes.string,
};
