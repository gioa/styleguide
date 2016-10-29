import Backbone from 'backbone';

import Account from '../user_menu/Account';

const AccountList = Backbone.Collection.extend({
  model: Account,
  url: '/accounts',
});

module.exports = AccountList;
