/* eslint react/prefer-es6-class: 0 */

import React from 'react';

import ReactFormFooter from '../forms/ReactFormFooter.jsx';
import { Input } from '../forms/ReactFormElements.jsx';

import ReactModal from '../ui_building_blocks/dialogs/ReactModal.jsx';
import ReactModalUtils from '../ui_building_blocks/dialogs/ReactModalUtils';

const ReactPrompt = React.createClass({

  /**
   * message: the message to display, which can be a string or HTML object.
   * defaultValue: the default value for the input in this dialog.
   * confirmButton: the label for the confirm button (e.g. "OK", "Confirm", "Yes").
   * cancelButton: the label for the cancel button (e.g. "Cancel", "No").
   * confirm: the function to call when the user clicks the confirm button.
   * cancel: the function to call when the user clicks the cancel button.
   * validate: a function that is called on every input and key down event in the input, which
   *   returns true when the input value is valid and false when the input value is invalid.
   * focusRange: highlights range on the default value of the input, in the format [a, b],
   *   corresponding to the function setSelectionRange(a, b).
   * name: the class name of for this dialog.
   * inputID: the id and ref of the input.
   */
  propTypes: {
    message: React.PropTypes.oneOfType([
      React.PropTypes.object,
      React.PropTypes.string,
    ]).isRequired,
    defaultValue: React.PropTypes.string,
    confirmButton: React.PropTypes.string,
    cancelButton: React.PropTypes.string,
    confirm: React.PropTypes.func,
    cancel: React.PropTypes.func,
    validate: React.PropTypes.func,
    focusRange: React.PropTypes.array,
    name: React.PropTypes.string,
    inputID: React.PropTypes.string,
  },

  getDefaultProps() {
    return {
      defaultValue: '',
      confirmButton: 'Yes, go ahead.',
      cancelButton: 'Cancel',
      name: 'prompt',
      inputID: 'input',
    };
  },

  getInitialState() {
    return {
      confirmDisabled: true,
    };
  },

  onConfirm() {
    ReactModalUtils.destroyModal();
    this.confirm();
  },

  confirm() {
    if (this.props.confirm) {
      this.props.confirm(this.refs.input.value());
    }
  },

  onCancel() {
    if (this.props.cancel) {
      this.props.cancel();
    }
  },

  validate(value) {
    let valid = value !== '';
    if (this.props.validate) {
      valid = this.props.validate(value);
    }
    this.setState({ confirmDisabled: !valid });
    return valid;
  },

  onKeyDown(e) {
    this.validate(e);
    // If the user presses enter, call onConfirm if the input value is valid
    if (e.which === 13 && !this.state.confirmDisabled) {
      ReactModalUtils.destroyModal();
      this.onConfirm(e);
    }
  },

  componentDidMount() {
    this.validate(this.refs.input.value());
    const input = this.refs.input.refs[this.props.inputID];
    input.focus();
    if (this.props.focusRange && this.props.focusRange.length === 2) {
      const start = this.props.focusRange[0];
      const end = this.props.focusRange[1];
      if (start > 0 && end > start) {
        input.setSelectionRange(start, end);
      }
    } else {
      input.select();
    }
  },

  render() {
    const header = (<div className='modal-title'>{this.props.message}</div>);
    const body = (
      <Input
        ref='input'
        id='input'
        type='text'
        inputID={this.props.inputID}
        defaultValue={this.props.defaultValue}
        inputClassName='prompt-input'
        validate={this.validate}
        confirm={this.onConfirm}
        required
      />
    );
    const footer = (
      <ReactFormFooter
        confirm={this.confirm}
        cancel={this.onCancel}
        confirmButton={this.props.confirmButton}
        cancelButton={this.props.cancelButton}
        confirmDisabled={this.state.confirmDisabled}
      />
    );
    return (
      <ReactModal
        modalName={this.props.name}
        header={header}
        body={body}
        footer={footer}
      />
    );
  },
});

module.exports = ReactPrompt;
