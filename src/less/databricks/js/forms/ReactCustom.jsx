/* eslint react/prefer-es6-class: 0 */

import React from 'react';

import { Input, LabeledCheckbox, Select } from '../forms/ReactFormElements.jsx';
import ReactFormFooter from '../forms/ReactFormFooter.jsx';

import ReactModal from '../ui_building_blocks/dialogs/ReactModal.jsx';

const ReactCustomRow = React.createClass({
  propTypes: {
    options: React.PropTypes.object.isRequired,
    confirm: React.PropTypes.func.isRequired,
    validate: React.PropTypes.func.isRequired,
  },

  value() {
    const options = this.props.options;
    if (options.controlType === 'input' && options.type === 'checkbox') {
      return this.refs.control.checked();
    }
    return this.refs.control.value();
  },

  render() {
    const options = this.props.options;
    let leftLabel = options.label;
    let control = (<div />);

    if (options.controlType === 'input') {
      if (options.type === 'checkbox') {
        leftLabel = '';
        let defaultChecked = false;
        if (options.props && options.props.checked) {
          defaultChecked = true;
        }
        control = (
          <LabeledCheckbox
            ref='control'
            label={options.label}
            checkboxID={options.id}
            checkboxClassName={options.class}
            defaultChecked={defaultChecked}
            onChange={this.props.validate}
            confirm={this.props.confirm}
            required={options.required}
          />
        );
      } else {
        control = (
          <Input
            ref='control'
            type={options.type}
            inputID={options.id}
            inputClassName={options.class}
            defaultValue={options.value}
            placeholder={options.placeholder}
            validate={options.validate}
            onChange={this.props.validate}
            confirm={this.props.confirm}
            required={options.required}
          />
        );
      }
    } else if (options.controlType.indexOf('select') === 0) {
      control = (
        <Select
          ref='control'
          options={options.options}
          selectID={options.id}
          selectClassName={options.class}
          defaultValue={options.value}
          onChange={this.props.validate}
          confirm={this.props.confirm}
          required={options.required}
        />
      );
    } else if (options.controlType === 'react') {
      control = options.component;
    }

    const outerProps = {
      className: 'multi-input-row',
      'data-row-for': options.id,
    };

    return (
      <div {...outerProps}>
        <div>
          <label className='unclickable'>{leftLabel}</label>
          <div>
            {control}
          </div>
        </div>
      </div>
    );
  },
});

const ReactCustom = React.createClass({

  /**
   * title: the title of this form
   * controls: array of inputs defined by objects like:
   *   [
   *     {
   *       controlType: "select"
   *       label: "Pick a new name"
   *       class: "newNameSelector", // optional
   *       id: "myNameSelector", // optional
   *       // The 'value' attributes of the options are simply the displayed text as lowercase
   *       options: ["Alice", "Bob", "Carol"]
   *     },
   *     {
   *        controlType: "input",
   *        type: "text", // This translates to <input type="text">
   *        label: "Please input some useless stuff here",
   *        value: "Default Value",
   *        class: "uselessTextInput",
   *        id: "myUselessId",
   *        placeholder: "Placeholder Text",
   *        required: false,
   *        focus: true, // optional, indicates this input will get focus
   *        validate: function(value) { value !== ""; }
   *      }
   *   ]
   * confirmButton: the label for the confirm button (e.g. "OK", "Confirm", "Yes").
   * showConfirmButton: hides the confirm button if this is set to false.
   * confirm: the function to call when the user clicks the confirm button.
   * cancelButton: the label for the cancel button (e.g. "Cancel", "No").
   * showCancelButton: hides the cancel button if this is set to false.
   * cancel: the function to call when the user clicks the cancel button.
   * validate: the function used to validate this form if valid is not defined.
   * name: the class name of this dialog.
   */
  propTypes: {
    title: React.PropTypes.string.isRequired,
    controls: React.PropTypes.array,
    confirmButton: React.PropTypes.string,
    showConfirmButton: React.PropTypes.bool,
    confirm: React.PropTypes.func,
    cancelButton: React.PropTypes.string,
    showCancelButton: React.PropTypes.bool,
    cancel: React.PropTypes.func,
    validate: React.PropTypes.func,
    name: React.PropTypes.string,
    children: React.PropTypes.node,
  },

  getDefaultProps() {
    return {
      controls: [],
      confirmButton: 'Confirm',
      cancelButton: 'Cancel',
      name: 'custom-form',
    };
  },

  getInitialState() {
    return {
      valid: true,
    };
  },

  _validateControls() {
    let valid = true;
    this.props.controls.forEach(function validateSingleControl(control, i) {
      if (control.validate && !control.validate(this.refs['control' + i].value())) {
        valid = false;
      }
    }.bind(this));
    return valid;
  },

  validate() {
    let valid;
    if (this.props.validate) {
      valid = this.props.validate();
    } else {
      valid = this._validateControls();
    }
    this.setState({ valid: valid });
  },

  onConfirm() {
    if (this.props.confirm && this.state.valid) {
      this.props.confirm(this);
    }
  },

  onCancel() {
    if (this.props.cancel) {
      this.props.cancel();
    }
  },

  componentDidMount() {
    this.validate();
  },

  _renderControls() {
    if (this.props.controls.length === 0) {
      return this.props.children;
    }
    const controls = [];
    this.props.controls.forEach(function addCustomRow(control, i) {
      controls.push(
        <ReactCustomRow
          ref={'control' + i}
          options={control}
          validate={this.validate}
          confirm={this.onConfirm}
        />
      );
    }.bind(this));
    return (
      <div>
        {controls}
      </div>
    );
  },

  render() {
    const header = (<h3>{this.props.title}</h3>);
    const body = this._renderControls();
    const footer = (
      <ReactFormFooter
        ref='footer'
        confirm={this.onConfirm}
        cancel={this.onCancel}
        confirmButton={this.props.confirmButton}
        cancelButton={this.props.cancelButton}
        showConfirm={this.props.showConfirmButton}
        showCancel={this.props.showCancelButton}
        confirmDisabled={!this.state.valid}
      />
    );
    return (
      <ReactModal
        ref='modal'
        modalName={this.props.name}
        header={header}
        body={body}
        footer={footer}
      />
    );
  },
});

module.exports = ReactCustom;
