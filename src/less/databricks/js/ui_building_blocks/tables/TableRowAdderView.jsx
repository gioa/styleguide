import React from 'react';
import _ from 'lodash';

import { Tooltip } from '../../ui_building_blocks/Tooltip.jsx';

export class TableRowAdderView extends React.Component {
  renderInputs() {
    return this.props.inputElementAttrs.map((propObj) => {
      const refFunc = (ref) => this[propObj.id] = ref;
      let input = (
        <input
          type='text'
          ref={refFunc}
          {...propObj}
          disabled={this.props.disabled}
        />
      );

      if (propObj.tooltipTextRenderer) {
        const tooltipRefFunc = (ref) => this[`${propObj.id}Tooltip`] = ref;
        input = (
          <Tooltip
            ref={tooltipRefFunc}
            key={propObj.key}
            text={propObj.tooltipTextRenderer()}
            toggleOnHover={false}
            children={input}
          />
        );
      }

      return input;
    });
  }

  componentDidMount() {
    this.focusFirstInput();
  }

  focusFirstInput() {
    if (!this.props.disabled) {
      const firstInput = _.first(this.props.inputElementAttrs);
      this[firstInput.id].focus();
    }
  }

  getInputValue(inputId) {
    return this[inputId].value;
  }

  trimAndSetValue(inputId) {
    const trimmedValue = this.getInputValue(inputId).trim();
    this[inputId].value = trimmedValue;
    return trimmedValue;
  }

  clearInputs() {
    this.props.inputElementAttrs.forEach((attrObj) => {
      this[attrObj.id].value = '';
    });
  }

  renderInvalidMessages() {
    return _.map(this.props.invalidInputMsgList, (msg) =>
      <span key={msg}>{msg}</span>
    );
  }

  render() {
    return (
      <div className='table-row-adder'>
        {this.props.header}
        <div className='input-list'>
          {this.renderInputs()}
        </div>
        <button
          className='btn cancel-btn'
          onClick={this.props.onClickAdd}
          disabled={this.props.disableAddButton || this.props.disabled}
        >
          Add
        </button>
        <div className='invalid-msg'>
          {this.renderInvalidMessages()}
        </div>
      </div>
    );
  }
}

TableRowAdderView.propTypes = {
  onClickAdd: React.PropTypes.func.isRequired,
  header: React.PropTypes.node,
  onAddValidRow: React.PropTypes.func.isRequired,
  inputElementAttrs: React.PropTypes.arrayOf(React.PropTypes.shape({
    id: React.PropTypes.string.isRequired,
    key: React.PropTypes.string.isRequired,
    onBlur: React.PropTypes.func,
    placeholder: React.PropTypes.string,
    validator: React.PropTypes.func,
    invalidMsg: React.PropTypes.string,
    className: React.PropTypes.string,
    onKeyDown: React.PropTypes.func,
    tooltipTextRenderer: React.PropTypes.func,
    trimTrailingLeadingWhitespace: React.PropTypes.bool,
  })).isRequired,
  disableAddButton: React.PropTypes.bool,
  disabled: React.PropTypes.bool,
  invalidInputMsgList: React.PropTypes.arrayOf(React.PropTypes.string),
};

TableRowAdderView.defaultProps = {
  invalidInputMsgList: [],
};
