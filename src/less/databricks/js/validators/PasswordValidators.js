import _ from 'underscore';

const passwordRequirements = {};

passwordRequirements.default = {
  // By default, a valid password:
  // * Must be longer longer than eight characters
  // * Must have at least one lowercase character
  // * Must have at least one uppercase character
  // * Must have at least one digit
  // * Must have at least one especial character
  checks: {
    length: (pass) => pass.length > 8,
    lower: (pass) => (/[a-z]/).test(pass),
    upper: (pass) => (/[A-Z]/).test(pass),
    digits: (pass) => (/\d/).test(pass),
    nonWords: (pass) => (/[^A-Za-z0-9]/).test(pass),
  },
  messages: {
    length: 'Password must be longer than eight characters',
    lower: 'Password must have at least one lowercase character',
    upper: 'Password must have at least one uppercase character',
    digits: 'Password must have at least one digit',
    nonWords: 'Password must have at least one symbol',
  },
};

passwordRequirements.strong = {
  // When conf.enableStrongPassword = true, a valid password should meet SOC standard:
  // * Must be longer longer than 10 characters
  // * Must have at least one lowercase character
  // * Must have at least one uppercase character
  // * Must have at least one digit
  // * Must have at least one especial character
  // * Must not include the user name
  checks: {
    length: (pass) => pass.length >= 10,
    lower: (pass) => (/[a-z]/).test(pass),
    upper: (pass) => (/[A-Z]/).test(pass),
    digits: (pass) => (/\d/).test(pass),
    nonWords: (pass) => (/[^A-Za-z0-9]/).test(pass),
    nonUsername: (pass, usernames) =>
      _.every(usernames, (n) => pass.toLowerCase().indexOf(n.toLowerCase()) === -1),
  },
  messages: {
    length: 'Password must have at least ten characters',
    lower: 'Password must have at least one lowercase character',
    upper: 'Password must have at least one uppercase character',
    digits: 'Password must have at least one digit',
    nonWords: 'Password must have at least one symbol',
    nonUsername: 'Password must not include user name',
  },
};

export class PasswordValidators {
  /**
   * Validate the given password
   * @return {{valid: bool, message: string}} validation result
   */
  static validatePassword(pass, ...usernames) {
    if (!pass) {
      return [false, 'Password must not be empty'];
    }

    let requirement = passwordRequirements.default;
    if (window.settings && window.settings.enableStrongPassword) {
      requirement = passwordRequirements.strong;
    }

    // look at email prefix and individual words in username
    usernames = _.unique(_.flatten(_.map(
      usernames,
      (n) => (n ? n.split(' ').concat(n.split('@')) : [])
    )));

    const checks = requirement.checks;
    const messages = requirement.messages;
    for (const check in checks) {
      if (checks[check](pass, usernames) !== true) {
        return [false, messages[check]];
      }
    }
    return [true, ''];
  }
}
