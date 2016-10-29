import _ from 'lodash';

const USERNAME = /(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))/;
const DOMAIN =
/((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/;
const EMAIL_REGEX = new RegExp('^' + USERNAME.source + '@' + DOMAIN.source + '$');

export class EmailValidators {
  /**
   * Return if the specified string could possibly be an email addresses.
   * This should remain in sync with validateEmail in AdminAccountHandler
   */
  static isValidEmail(value) {
    const email = value.trim();
    return EMAIL_REGEX.test(email);
  }

  /**
   * Return if the specified string could possibly be a comma-separated list of email addresses.
   */
  static isValidEmailsField(value) {
    return _.every(value.split(','), function validateEmailChunk(email) {
      email = email.trim();
      return email.length === 0 || EmailValidators.isValidEmail(email);
    });
  }
}
