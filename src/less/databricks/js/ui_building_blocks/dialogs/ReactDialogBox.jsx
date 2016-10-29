import React from 'react';

import ReactAlert from '../../forms/ReactAlert.jsx';
import ReactConfirm from '../../forms/ReactConfirm.jsx';
import ReactPrompt from '../../forms/ReactPrompt.jsx';

import ReactModalUtils from '../../ui_building_blocks/dialogs/ReactModalUtils';

const ReactDialogBox = {

  /**
   * Show an alert box, similar to window.alert().
   *
   * @param message alert message.
   * @param allowHTML whether to allow html in the message.
   * @param button If specified, overrides button text.
   * @param callback If specified, runs this callback after the button is clicked.
   * @param className Class name for this dialog.
   */
  alert(message, allowHTML, button, callback, className) {
    const props = { message: message };
    if (allowHTML) {
      console.warn('HTML strings are no longer supported.');
      props.message = (<div dangerouslySetInnerHTML={{ __html: message }} />);
    }
    if (button) {
      props.button = button;
    }
    if (callback) {
      props.callback = callback;
    }
    if (className) {
      props.className = className;
    }
    const dialog = (<ReactAlert {...props} />);
    ReactModalUtils.createModal(dialog);
    return dialog;
  },

  /**
   * Show a confirm dialog, similar to window.confirm(). Example usage:
   *
   *   ReactDialogBox.confirm({
   *     title: "Proceed",
   *     message: "Are you sure you want to confirm?",
   *     messageHTML: "<b>Overrides message if present.</b>",
   *     confirmButton: "Yes, I confirm",
   *     cancelButton: "No, cancel",
   *     confirm: function(){ console.log("confirm!"); },
   *     cancel: function(){ console.log("cancel"); },
   *     confirmBtnClassName: unique class for confirm button (set to "btn" to make button grey)
   *     name: "some-css-class"
   *   });
   *
   * Only "message" is required. Every other attribute is optional.
   */
  confirm(options) {
    const props = options;
    if (options.messageHTML) {
      console.warn('HTML strings are no longer supported.');
      props.message = (<div dangerouslySetInnerHTML={{ __html: options.messageHTML }} />);
    }
    const dialog = (<ReactConfirm {...props} />);
    ReactModalUtils.createModal(dialog);
    return dialog;
  },

  /**
   * Show a prompt modal, asking the user for input. Example usage:
   *
   *   ReactDialogBox.prompt({
   *     message: "Rename the table to",
   *     defaultValue: "newTable",
   *     confirmButton: "Rename",
   *     cancelButton: "Cancel",
   *     confirm: function(input){ console.log(input); },
   *     cancel: function(){ console.log("cancel"); },
   *     validate: function() { return true; },
   *     focusRange: [1, 2],
   *     name: "some-css-class"
   *   });
   *
   * Only "message" is required. Every other attribute is optional.
   */
  prompt(options) {
    const dialog = (<ReactPrompt {...options} />);
    ReactModalUtils.createModal(dialog);
    return dialog;
  },
};

module.exports = ReactDialogBox;
