/**
 * Utility functions for passwords
 */

import $ from 'jquery';

const PasswordUtils = {};

/**
 * Check whether passwords are equal.
 * @return {array} [bool, string] equality & message to display
 */
PasswordUtils.checkEquality = function checkEquality(password1, password2) {
  if (password1 === password2) {
    return [true, ''];
  }
  return [false, 'The two passwords do not match!'];
};

PasswordUtils.sendForgotPasswordToken = (email, onSuccess, onFail) => {
  $.ajax(
    '/resetpassword/sendtoken',
    {
      type: 'POST',
      data: JSON.stringify({ username: email }),
      error: (xhr, status, error) => {
        console.error(error);
        if (onFail) {
          onFail();
        }
      },
      success: (resp) => {
        if (resp && resp.message) {
          if (onSuccess) {
            onSuccess(resp.message);
          }
        }
      },
    }
  );
};

/**
 * Check whether to disable the reset password tab on the Account Settings page (for when
 * X509 authentication is enabled OR if SSO is enabled and the user is not an admin)
 * @return {bool}
 */
PasswordUtils.shouldDisablePasswordReset = () =>
  // check feature flag, whether user has enabled, tier flag, and if user is admin
  window.settings.enableX509Authentication ||
    (window.settings.enableSingleSignOn && window.settings.enableSingleSignOnLogin &&
    window.settings.enableSingleSignOnByTier && !window.settings.isAdmin);

/**
 * The tooltip to display on the reset password tab on the Account Settings page if it is disabled.
 * @returns {string}
 */
PasswordUtils.disablePasswordTooltip = () => {
  if (window.settings.enableX509Authentication) {
    return 'Client certificate authentication is enabled for your organization. ' +
      'Please log in using your X.509 Certificate.';
  }

  return 'Single Sign-On is enabled for your organization. Please log in using Single Sign-On.';
};

module.exports = PasswordUtils;
