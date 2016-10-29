/**
 * A Backbone model for a user account
 *
 * DEPENDENCIES: Backbone
 */

import _ from 'underscore';
import Backbone from 'backbone';

import BackboneRpcMixin from '../notebook/BackboneRpcMixin';

/**
 * Frontend Account Object, should be kept in sync with FrontendUser in
 * BrowserMessages.scala
 */
const Account = Backbone.Model.extend({
  defaults: {
    username: '',
    fullname: '',
    password: '',
    // TODO(someone): Add organization ID
    organization: '',
    isAdmin: false,
  },

  urlRoot: '/accounts',

  toggleAdmin(onComplete) {
    const self = this;

    // Flip current admin state
    const rpcAttrs = {
      setAdmin: !this.get('isAdmin'),
    };

    const handleResponse = function handleResponse(updatedUser) {
      self.set(updatedUser);
      if (onComplete) {
        onComplete(updatedUser);
      }
    };

    const rpcOptions = {
      success: handleResponse,
      url: '/accounts/' + this.id,
    };

    this.rpc('setAdmin', rpcAttrs, rpcOptions);
  },

  isValid() {
    return (this.get('username') !== '');
  },
});

_.extend(Account.prototype, BackboneRpcMixin);

module.exports = Account;
