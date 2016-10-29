import React from 'react';
import _ from 'lodash';

import { TableRowAdderView } from '../../ui_building_blocks/tables/TableRowAdderView.jsx';

export class TableRowAdder extends React.Component {
  constructor(props) {
    super(props);

    this.onClickAdd = this.onClickAdd.bind(this);
    this.validateAndSetState = this.validateAndSetState.bind(this);
    this.clearInvalidInputState = this.clearInvalidInputState.bind(this);
    this.onInputKeydown = this.onInputKeydown.bind(this);
    this.onInputBlur = this.onInputBlur.bind(this);

    this.state = {
      // Map of input ids to valid state of input: { inputId1: true, inputId2: false }
      inputValidStateMap: this.getInitialInputValidMap(),
      invalidInputMsgList: [],
    };
  }

  getInitialInputValidMap() {
    const map = {};
    this.props.inputPropertiesList.forEach((propObj) => {
      map[propObj.id] = true;
    });
    return map;
  }

  /**
   * @return {Array} list of input ids
   */
  getInputIDs() {
    return this.props.inputPropertiesList.map((propObj) => propObj.id);
  }

  /**
   * @return {Object} map of input ids to user-entered values: { inputId1: val1, inputId2: val2 }
   */
  getAllInputValues() {
    const newInputList = {};
    this.getInputIDs().forEach((id) => {
      newInputList[id] = this.adderView.getInputValue(id).trim();
    });
    return newInputList;
  }

  areAllInputsValid() {
    return !_.includes(this.state.inputValidStateMap, false);
  }

  areAllInputsEmpty() {
    const inputValues = Object.values(this.getAllInputValues());
    return inputValues.every(_.isEmpty);
  }

  validateInput(inputPropObj, value) {
    const validator = inputPropObj.validator;
    return validator ? validator(value) : true;
  }

  onClickAdd() {
    if (this.validateAllInputs() && !this.props.disabled && !this.areAllInputsEmpty()) {
      this.props.onAddValidRow(this.getAllInputValues());
      this.adderView.clearInputs();
      this.adderView.focusFirstInput();
    }
  }

  /**
   * Sets a new inputValidStateMap state, given the new isValid state of a specific inputId
   * @param {Boolean} isValid
   * @param {String} inputId
   */
  setInputValidStateMap(isValid, inputId) {
    const newInputValidStateMap = _.cloneDeep(this.state.inputValidStateMap);
    newInputValidStateMap[inputId] = isValid;
    this.setState({
      inputValidStateMap: newInputValidStateMap,
    });
  }

  /**
   * Validates a specific input and sets appropriate state
   * @param {String} inputId
   * @param {String} inputValue
   * @return {Boolean} validity of input
   */
  validateAndSetState(inputId, inputValue) {
    const inputPropObj = this.getInputPropertyObj(inputId);
    const isValid = this.validateInput(inputPropObj, inputValue);
    const validStateIsUnchanged = isValid === this.state.inputValidStateMap[inputId];
    if (validStateIsUnchanged) {
      return isValid;
    }
    this.setInputValidStateMap(isValid, inputId);
    if (!isValid) {
      this.addToInvalidInputMsgList(inputPropObj.invalidMsg);
    }
    return isValid;
  }

  hideTooltip(inputId) {
    const inputTooltip = this.adderView[`${inputId}Tooltip`];
    if (inputTooltip) {
      inputTooltip.hideTooltip();
    }
  }

  showTooltip(inputId) {
    const inputTooltip = this.adderView[`${inputId}Tooltip`];
    if (inputTooltip) {
      inputTooltip.showTooltip();
    }
  }

  addToInvalidInputMsgList(newMsg) {
    const newInvalidInputMsgList = _.cloneDeep(this.state.invalidInputMsgList).concat(newMsg);
    this.setState({
      invalidInputMsgList: newInvalidInputMsgList,
    });
  }

  removeFromInvalidInputMsgList(inputId) {
    const newInvalidInputMsgList = [];
    this.props.inputPropertiesList.forEach((propObj) => {
      const isInputToRemove = propObj.id === inputId;
      if (!this.isInputValid(propObj.id) && !isInputToRemove) {
        newInvalidInputMsgList.push(propObj.invalidMsg);
      }
    });
    this.setState({
      invalidInputMsgList: newInvalidInputMsgList,
    });
  }

  isInputValid(inputId) {
    return this.state.inputValidStateMap[inputId];
  }

  getInputPropertyObj(inputId) {
    return _.find(this.props.inputPropertiesList, (propObj) => propObj.id === inputId);
  }

  /** Called on input key down, clears invalid input msg states for that specific input */
  clearInvalidInputState(inputId) {
    const targetInputWasInvalid = !this.state.inputValidStateMap[inputId];
    if (!targetInputWasInvalid) {
      return;
    }
    this.setInputValidStateMap(true, inputId);
    this.removeFromInvalidInputMsgList(inputId);
  }

  /**
   * Validates all inputs and sets appropriate state
   * @return {Boolean} whether all inputs are valid
   */
  validateAllInputs() {
    // this.getAllInputValues() returns an object, so use _.forEach rather than native JS func
    let allAreValid = true;
    _.forEach(this.getAllInputValues(), (inputValue, inputId) => {
      allAreValid = this.validateAndSetState(inputId, inputValue) && allAreValid;
    });
    return allAreValid;
  }

  onInputKeydown(e) {
    const inputId = e.target.id;
    if (e.keyCode === 13) { // enter
      this.onClickAdd();
      return;
    }
    this.clearInvalidInputState(inputId);
    this.showTooltip(inputId);
  }

  /** Clears ALL invalid input states */
  clearAllInvalidState() {
    this.setState({
      inputValidStateMap: this.getInitialInputValidMap(),
      invalidInputMsgList: [],
    });
  }

  onInputBlur(propObj, e) {
    if (this.props.disabled) {
      return;
    }
    const allInputsAreEmpty = this.areAllInputsEmpty();
    const inputValue = propObj.trimTrailingLeadingWhitespace ?
      this.adderView.trimAndSetValue(propObj.id) : e.target.value;
    if (propObj.validator && !allInputsAreEmpty) {
      this.validateAndSetState(propObj.id, inputValue);
    }
    if (allInputsAreEmpty) {
      this.clearAllInvalidState();
    }
    this.hideTooltip(propObj.id);
  }

  /**
   * Builds array of objects, each with properties for an input element for the view to render
   * @return {Array} list of objects
   */
  buildInputElementAttrs() {
    const newInputPropertiesList = _.cloneDeep(this.props.inputPropertiesList);
    newInputPropertiesList.forEach((propObj) => {
      propObj.onBlur = this.onInputBlur.bind(null, propObj);
      propObj.className = this.isInputValid(propObj.id) ? '' : 'invalid';
      propObj.onKeyDown = this.onInputKeydown;
    });
    return newInputPropertiesList;
  }

  render() {
    const adderViewRef = (ref) => this.adderView = ref;
    return (
      <TableRowAdderView
        ref={adderViewRef}
        header={this.props.header}
        onAddValidRow={this.props.onAddValidRow}
        inputElementAttrs={this.buildInputElementAttrs()}
        disableAddButton={!this.areAllInputsValid() || this.props.disabled}
        disabled={this.props.disabled}
        invalidInputMsgList={this.state.invalidInputMsgList}
        onClickAdd={this.onClickAdd}
      />
    );
  }
}

TableRowAdder.propTypes = {
  header: React.PropTypes.node,
  onAddValidRow: React.PropTypes.func.isRequired,
  inputPropertiesList: React.PropTypes.arrayOf(React.PropTypes.shape({
    id: React.PropTypes.string.isRequired,
    key: React.PropTypes.string.isRequired,
    validator: React.PropTypes.func,
    placeholder: React.PropTypes.string,
    invalidMsg: React.PropTypes.string,
    tooltipTextRenderer: React.PropTypes.func,
    trimTrailingLeadingWhitespace: React.PropTypes.bool,
  })).isRequired,
  disabled: React.PropTypes.bool,
};
