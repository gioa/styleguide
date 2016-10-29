/* eslint react/prefer-es6-class: 0 */

import React from 'react';

import InputWidgetManager from '../InputWidgetManager.js';

import ReactFormElements from '../../forms/ReactFormElements.jsx';

import NotebookConstants from '../../notebook/NotebookConstants';

const Select = ReactFormElements.Select;

const DropdownInputWidget = React.createClass({
  propTypes: {
    inputsMgr: React.PropTypes.instanceOf(InputWidgetManager).isRequired,
    argName: React.PropTypes.string.isRequired,
    widget: React.PropTypes.object.isRequired,
    autoRunOption: React.PropTypes.oneOf(NotebookConstants.AUTO_RUN_ALL_OPTIONS),
  },

  save(newValue) {
    this.props.inputsMgr.setInputValue(this.props.argName, newValue, {
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

  render() {
    const widget = this.props.widget;
    const argName = this.props.argName;
    const widgetInfo = widget.widgetInfo;
    const label = this.generateLabel();

    return (
        <div className='dropdown-input-widget'>
          <Select
            selectID={'widget-' + argName}
            defaultValue={widget.currentValue}
            options={widgetInfo.options.choices}
            onChange={this.save}
            useLowerCaseValue={false}
          />
          <label className='input-label' title={label}>{label} : </label>
        </div>
    );
  },
});

module.exports = DropdownInputWidget;
