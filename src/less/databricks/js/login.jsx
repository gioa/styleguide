/**
* This polyfills missing browser functionality for ES6. This includes common functionality like
* string.startsWith
*/
import 'babel-polyfill';

import $ from 'jquery';

import React from 'react';
import ReactDOM from 'react-dom';

import { ConfigManager } from './login/ConfigManager.jsx';
import { LoginViewChooser } from './login/LoginViewChooser.jsx';
import { LoginUtils } from './login/LoginUtils.jsx';

$(document).ready(function initLoginPage() {
  // don't do anything in unit test
  if (window.jsTestMode) { return; }

  // Add listener so that if login occurs in another tab, the page will refresh
  // (if localStorage isn't available, this feature does not work)
  $(window).on('storage', () => {
    window.location.href = window.location.origin + '/' + location.search + location.hash;
  });

  const props = LoginUtils.getParams();
  const configManager = new ConfigManager();

  ReactDOM.render(<LoginViewChooser configManager={configManager} {...props} />,
    document.getElementById('login-page'));
});
