/* eslint react/prefer-es6-class: 0, react/no-is-mounted: 0, func-names: 0 */

import React from 'react';

import ReactFormElements from '../../forms/ReactFormElements.jsx';
import ReactFormFooter from '../../forms/ReactFormFooter.jsx';

import DashboardElementModel from '../../notebook/dashboards/DashboardElementModel';
import ButtonBar from '../../notebook/ButtonBar.jsx';
import DashboardViewConstants from '../../notebook/dashboards/DashboardViewConstants.js';

import ReactModal from '../../ui_building_blocks/dialogs/ReactModal.jsx';
import ReactModalUtils from '../../ui_building_blocks/dialogs/ReactModalUtils';

const Input = ReactFormElements.Input;
const LabeledCheckbox = ReactFormElements.LabeledCheckbox;

const ConfigureDashboardElementDialog = React.createClass({
  propTypes: {
    element: React.PropTypes.instanceOf(DashboardElementModel).isRequired,
  },

  componentDidMount() {
    this.props.element.on('change', function() {
      if (this.isMounted()) { this.forceUpdate(); }
    }.bind(this), this);
  },

  componentWillUnmount() {
    this.props.element.off(null, null, this);
  },

  getInitialState() {
    const element = this.props.element;
    return {
      // used to reset the value if user cancels
      originalOptions: element.getOptions(),
      titleError: false,
      confirmed: false,
    };
  },

  _validateTitle(input) {
    if (input.length > DashboardViewConstants.MAX_ELEMENT_TITLE_LENGTH) {
      this.setState({ titleError: true });
      return false;
    }
    this.setState({ titleError: false });
    return true;
  },

  _onTitleAlignChange(value, callback) {
    this.props.element.setLocalOptions({ titleAlign: value }, callback);
  },

  _confirm() {
    this.setState({ confirmed: true });
    this.props.element.saveLocalOptions(function() {
      ReactModalUtils.destroyModal();
    });
  },

  _cancel() {
    if (this.state.confirmed) {
      return;
    }
    // discard local changes and restore the original settings
    this.props.element.updateOptions(
      this.state.originalOptions, function() { ReactModalUtils.destroyModal(); });
  },

  _showRunButton(checked, event) {
    this.props.element.setLocalOptions({ showRunButton: event.target.checked });
  },

  _onShowTitleChanged(checked, event) {
    this.props.element.setLocalOptions({ showTitle: event.target.checked });
  },

  _onTitleChanged(value) {
    this.props.element.setLocalOptions({ title: value });
  },

  render() {
    const elementOptions = this.props.element.getOptions();
    const titleError = (
      <span className='warning-font title-error'>
        Maximum {DashboardViewConstants.MAX_ELEMENT_TITLE_LENGTH} characters.
      </span>
    );
    const body = (
      <div>
        <LabeledCheckbox
          label='Show Title'
          checkboxClassName='show-title-checkbox'
          onChange={this._onShowTitleChanged}
          defaultChecked={elementOptions.showTitle}
        />
        <Input
          ref='titleInput'
          disabled={elementOptions.showTitle ? null : true}
          defaultValue={elementOptions.title}
          onChange={this._onTitleChanged}
          validate={this._validateTitle}
          placeholder='Untitled'
          inputClassName='dashboard-element-title-input'
        />
        <ButtonBar
          className='title-align-config'
          disabled={!elementOptions.showTitle}
          defaultValue={elementOptions.title}
          buttons={{ left: 'left', center: 'center', right: 'right' }}
          useIcons
          defaultActiveBtnKey={elementOptions.titleAlign ? elementOptions.titleAlign : 'center'}
          onChange={this._onTitleAlignChange}
        />
        <div className='error-wrapper'>{this.state.titleError ? titleError : null}</div>
        <LabeledCheckbox
          label='Show Run button'
          checkboxClassName='show-run-btn-checkbox'
          onChange={this._showRunButton}
          defaultChecked={elementOptions.showRunButton}
        />
      </div>
    );
    const footer = (
      <ReactFormFooter
        confirm={this._confirm}
        confirmButton='Save'
        confirmDisabled={this.state.titleError}
        closeOnConfirm={false}
        cancel={this._cancel}
      />);

    return (
      <ReactModal
        onHide={this._cancel}
        header={<h3>Configure Dashboard Element</h3>}
        body={body}
        footer={footer} modalName='configure-dashboard-element-modal'
      />
    );
  },
});

module.exports = ConfigureDashboardElementDialog;
