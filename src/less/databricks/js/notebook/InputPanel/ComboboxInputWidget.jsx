/* eslint react/prefer-es6-class: 0 */

import $ from 'jquery';

import React from 'react';
import ReactDOM from 'react-dom';

import InputWidgetManager from '../InputWidgetManager.js';

import ReactFormElements from '../../forms/ReactFormElements.jsx';

import NotebookConstants from '../../notebook/NotebookConstants';

const Combobox = ReactFormElements.Combobox;

const ComboboxInputWidget = React.createClass({
  propTypes: {
    inputsMgr: React.PropTypes.instanceOf(InputWidgetManager).isRequired,
    argName: React.PropTypes.string.isRequired,
    widget: React.PropTypes.object.isRequired,
    autoRunOption: React.PropTypes.oneOf(NotebookConstants.AUTO_RUN_ALL_OPTIONS),
  },

  save(newValue) {
    this.props.inputsMgr.setInputValue(this.props.argName, newValue, {
      silent: true,
      autoRunOption: this.props.autoRunOption,
    });
  },

  onConfirm(newValue) {
    this.props.inputsMgr.setInputValue(this.props.argName, newValue, {
      silent: false,
      autoRunOption: this.props.autoRunOption,
      changedArgs: [this.props.argName],
    });
  },

  /**
   * Generate the label for the current input widget. If the widget info specifies a label, this
   * is used. Otherwise, the argName is used by default.
   *
   * @return {string}
   */
  generateLabel() {
    const widgetInfo = this.props.widget.widgetInfo;
    return widgetInfo.label ? widgetInfo.label : this.props.argName;
  },

  getPosition() {
    const { top, left } = $(ReactDOM.findDOMNode(this.refs.combobox)).offset();
    return {
      top: top + NotebookConstants.INPUT_BTN_HEIGHT - NotebookConstants.TOPBAR_HEIGHT + 3 + 'px',
      left: left - NotebookConstants.SIDE_NAV_WIDTH + 'px',
    };
  },

  render() {
    const widget = this.props.widget;
    const argName = this.props.argName;
    const widgetInfo = widget.widgetInfo;
    const choices = widgetInfo.options.choices;
    const label = this.generateLabel();
    const currentValue = widget.currentValue;

    return (
        <div className='combobox-input-widget'>
          <Combobox
            id={'widget-' + argName}
            ref='combobox'
            wrapperClassName='combobox-input'
            defaultValue={currentValue}
            options={choices}
            onChange={this.save}
            onConfirm={this.onConfirm}
            getPosition={this.getPosition}
          />
          <label className='input-label' title={label}>{label} : </label>
        </div>
    );
  },
});

module.exports = ComboboxInputWidget;
