/* eslint react/prefer-es6-class: 0, max-lines: 0 */

import $ from 'jquery';
import _ from 'lodash';
import React from 'react';
import ReactDOM from 'react-dom';

import DropdownMenuView from '../ui_building_blocks/dropdowns/DropdownMenuView.jsx';
import Highlight from '../ui_building_blocks/highlight/Highlight.jsx';

/**
 * TooltipMixin wraps its parent form element in a tooltip. It requires the parent to define
 * highlight() and unhighlight().
 */
const TooltipMixin = {

  /**
   * tooltipConditions: [{condition: function, tooltip: str}...] - for each (func, str), if
   *   func(value) === true, highlight with tooltip. This array serves as an alternative to
   *   calling `highlight()` in onChange.
   */
  propTypes: {
    tooltipConditions: React.PropTypes.array,
  },

  checkTooltipConditions(value) {
    if (this.props.tooltipConditions) {
      const tooltips = [];
      this.props.tooltipConditions.forEach(function checkSingleCondition(obj) {
        if (obj.condition(value)) {
          tooltips.push(obj.tooltip);
        }
      });
      if (tooltips.length > 0) {
        this.highlight({
          animate: false,
          duration: -1,
          autoHideTooltip: true,
          tooltip: tooltips.join(' '),
        });
      } else {
        this.unhighlight();
      }
    }
  },
};

const Input = React.createClass({

  mixins: [TooltipMixin],

  /**
   * type: "text", "number", etc.
   * inputID: the id and ref of the input
   * defaultValue: initial value in the input
   * placeholder: placeholder for the input
   * inputClassName: space delimited list of classes for the input
   * validate: `function(x) {return whether x is valid}`. Input has class invalid-form if this
   *   function returns false. This function is used by the default validator in `ReactCustom`.
   *   It is called on every change event.
   * onChange: function that is called on every change event. `highlight()` should be called here
   *   if needed.
   * onBlur: function that is called on blur event.
   * confirm: function called on enter. Any validation to be done before submitting the form must
   *   be done in this function because `validate` can only check the value of this input, not the
   *   input values elsewhere in the form.
   * valid: overrides `validate` to set state.valid
   * required: whether the input is required
   * disabled: whether the input should be disabled
   * readOnly: whether the input should be read-only
   * trimInput: whether to trim the input
   * value: the value for the textbox, will cause the element to be a controlled component
   * min: minimum value
   * max: maximum value
   */
  propTypes: {
    type: React.PropTypes.string,
    inputID: React.PropTypes.string,
    defaultValue: React.PropTypes.oneOfType([
      React.PropTypes.string,
      React.PropTypes.number,
    ]),
    placeholder: React.PropTypes.string,
    inputClassName: React.PropTypes.string,
    validate: React.PropTypes.func,
    onChange: React.PropTypes.func,
    onBlur: React.PropTypes.func,
    confirm: React.PropTypes.func,
    valid: React.PropTypes.bool,
    required: React.PropTypes.bool,
    disabled: React.PropTypes.bool,
    readOnly: React.PropTypes.bool,
    trimInput: React.PropTypes.bool,
    value: React.PropTypes.oneOfType([
      React.PropTypes.string,
      React.PropTypes.number,
    ]),
    min: React.PropTypes.number,
    max: React.PropTypes.number,
  },

  getDefaultProps() {
    return {
      type: 'text',
      inputID: 'input', // TODO(Chaoyu): Fix this PROD-9909
      disabled: false,
      readOnly: false,
      trimInput: true,
    };
  },

  getInitialState() {
    return {
      valid: this.props.valid !== false,
    };
  },

  componentWillReceiveProps(nextProps) {
    if ('valid' in nextProps) {
      this.setState({
        valid: nextProps.valid,
      });
    }
  },

  _validate() {
    if (!this.props.valid && this.props.validate) {
      const valid = this.props.validate(this.value());
      this.setState({ valid: valid });
      return valid;
    }
    return true;
  },

  _onChange(e) {
    this._validate(e);
    if (this.props.onChange) {
      this.props.onChange(this.value(), e);
    }
    this.checkTooltipConditions(this.value());
  },

  _onBlur(e) {
    if (this.props.onBlur) {
      this.props.onBlur(this.value(), e);
    }
  },

  _onKeyDown(e) {
    const valid = this._validate(e);
    if (this.props.onChange) {
      this.props.onChange(this.value(), e);
    }
    // Confirm on ENTER if possible
    if (this.props.confirm && e.which === 13 && valid) {
      this.props.confirm(e, this.value());
    }
  },

  value() {
    const value = this.refs[this.props.inputID].value;
    if (this.props.trimInput) {
      return value.trim();
    }
    return value;
  },

  focus() {
    this.refs[this.props.inputID].focus();
  },

  select() {
    this.refs[this.props.inputID].select();
  },

  highlight(options) {
    this.refs.highlight.highlight(options);
  },

  unhighlight() {
    this.refs.highlight.unhighlight();
  },

  render() {
    const required = this.props.required ? 'required' : '';
    let classes = this.props.inputClassName;
    if (!this.state.valid) {
      classes += ' invalid-form';
    }
    const input = (
      <input
        type={this.props.type}
        ref={this.props.inputID}
        id={this.props.inputID}
        disabled={this.props.disabled ? true : null}
        defaultValue={this.props.defaultValue}
        placeholder={this.props.placeholder}
        className={classes}
        onInput={this._onChange}
        onBlur={this._onBlur}
        onKeyDown={this._onKeyDown}
        required={required}
        readOnly={this.props.readOnly}
        value={this.props.value}
        min={this.props.min}
        max={this.props.max}
      />
    );
    return (
      <Highlight ref='highlight' id='highlight'>
        {input}
      </Highlight>
    );
  },
});

const LabeledCheckbox = React.createClass({

  mixins: [TooltipMixin],

  /**
   * label: the text that belongs in the label
   * checkboxID: the id and ref of the checkbox
   * defaultChecked: whether the checkbox should start out as checked
   * checkboxClassName: space delimited list of classes the input (checkbox) should have
   * labelClassName: space delimited list of classes the label should have
   * onChange: function that is called on every change event. `highlight()` should be called here
   *   if needed.
   * confirm: function called on enter. Any validation to be done before submitting the form must
   *   be done in this function because `validate` can only check the value of this input, not the
   *   input values elsewhere in the form.
   * disabled: whether the checkbox should be disabled and the label made unclickable.
   * required: whether the input is required
   */
  propTypes: {
    label: React.PropTypes.string.isRequired,
    checkboxID: React.PropTypes.string,
    defaultChecked: React.PropTypes.bool,
    checkboxClassName: React.PropTypes.string,
    labelClassName: React.PropTypes.string,
    onChange: React.PropTypes.func,
    confirm: React.PropTypes.func,
    disabled: React.PropTypes.bool,
    required: React.PropTypes.bool,
  },

  getDefaultProps() {
    return {
      checkboxID: 'checkbox',
    };
  },

  _onChange(e) {
    if (this.props.onChange) {
      this.props.onChange(this.checked(), e);
    }
    this.checkTooltipConditions(this.checked());
    ReactDOM.findDOMNode(this.refs[this.props.checkboxID]).blur();
  },

  _onKeyDown(e) {
    this._onChange(e);
    // Confirm on ENTER if possible
    if (this.props.confirm && e.which === 13) {
      this.props.confirm(e);
    }
  },

  checked() {
    return this.refs[this.props.checkboxID].checked;
  },

  highlight(options) {
    this.unhighlight();
    this.refs.highlight.highlight(options);
  },

  unhighlight() {
    this.refs.highlight.unhighlight();
  },

  setChecked(checked) {
    $(ReactDOM.findDOMNode(this.refs[this.props.checkboxID])).prop('checked', checked);
  },

  render() {
    const required = this.props.required ? 'required' : '';
    let classes = this.props.labelClassName;
    if (this.props.disabled) {
      if (!classes) {
        classes = 'unclickable';
      } else {
        classes += ' unclickable';
      }
    }
    return (
      <div ref='outer' className='labeled-checkbox'>
        <label
          ref='label' id='label'
          className={classes}
        >
          <Highlight ref='highlight' id='highlight'>
            <input
              type='checkbox'
              ref={this.props.checkboxID}
              id={this.props.checkboxID}
              defaultChecked={this.props.defaultChecked}
              className={this.props.checkboxClassName}
              onChange={this._onChange}
              onKeyDown={this._onKeyDown}
              required={required}
              disabled={this.props.disabled}
            />
          </Highlight>
          {this.props.label}
        </label>
      </div>
    );
  },
});

const Select = React.createClass({

  mixins: [TooltipMixin],

  /**
   * options: [{value: v1, label: l1, disabled: false}, ...]
   * disableAllSelection: whether the whole dropdown should be disabled
   * selectID: the id and ref of the select
   * defaultValue: the value of the default option
   * selectClassName: space delimited string of classes the select should have
   * optionClassName: space delimited string of classes the options should have
   * onChange: function that is called on every change event. `highlight()` should be called here
   *   if needed.
   * confirm: function called on enter. Any validation to be done before submitting the form must
   *   be done in this function because `validate` can only check the value of this input, not the
   *   input values elsewhere in the form.
   * required: whether this form element is required.
   * value: the value selected, will cause the element to be a controlled component
   * useLowerCaseValue: whether to use the lower case version of each label for the values
   */
  propTypes: {
    options: React.PropTypes.array.isRequired,
    disableAllSelection: React.PropTypes.bool,
    selectID: React.PropTypes.string,
    defaultValue: React.PropTypes.string,
    selectClassName: React.PropTypes.string,
    optionClassName: React.PropTypes.string,
    onChange: React.PropTypes.func,
    confirm: React.PropTypes.func,
    required: React.PropTypes.bool,
    value: React.PropTypes.string,
    useLowerCaseValue: React.PropTypes.bool,
  },

  getDefaultProps() {
    return {
      selectID: 'select',
      useLowerCaseValue: true,
      disableAllSelection: false,
    };
  },

  _onChange(e) {
    if (this.props.onChange) {
      this.props.onChange(this.value(), e);
    }
    this.checkTooltipConditions(this.value());
  },

  _onKeyDown(e) {
    this._onChange(e);
    // Confirm on ENTER if possible
    if (this.props.confirm && e.which === 13) {
      this.props.confirm(e);
    }
  },

  _options() {
    const options = [];
    let i;
    let label;
    let value;
    let disabled;
    for (i in this.props.options) {
      if (typeof this.props.options[i] === 'object') {
        label = this.props.options[i].label;
        value = this.props.options[i].value;
        disabled = this.props.options[i].disabled;
      } else {
        label = this.props.options[i];
        value = this.props.useLowerCaseValue ? label.toLowerCase() : label;
      }
      const props = {
        key: i,
        className: this.props.optionClassName,
        value: value,
        'data-label': label,
        disabled: disabled,
      };
      options.push(
        <option {...props}>
          {label}
        </option>
      );
    }
    return options;
  },

  value() {
    return this.refs[this.props.selectID].value;
  },

  highlight(options) {
    this.unhighlight();
    this.refs.highlight.highlight(options);
  },

  unhighlight() {
    this.refs.highlight.unhighlight();
  },

  render() {
    const required = this.props.required ? 'required' : '';
    return (
      <Highlight ref='highlight' id='highlight'>
        <select
          disabled={this.props.disableAllSelection}
          ref={this.props.selectID}
          id={this.props.selectID}
          defaultValue={this.props.defaultValue}
          className={this.props.selectClassName}
          onChange={this._onChange}
          onKeyDown={this._onKeyDown}
          required={required}
          value={this.props.value}
        >
          {this._options()}
        </select>
      </Highlight>
    );
  },
});

const TextArea = React.createClass({

  mixins: [TooltipMixin],

  /**
   * textareaID: the id and ref of the textarea
   * defaultValue: the value of the default option
   * textareaClassName: space delimited list of classes the textarea should have
   * placeholder: the placeholder attribute in <textarea />
   * rows: the rows attribute in <textarea />
   * cols: the cols attribute in <textarea />
   * onChange: function that is called on every change event. `highlight()` should be called here
   *   if needed.
   * confirm: function called on enter. Any validation to be done before submitting the form must
   *   be done in this function because `validate` can only check the value of this input, not the
   *   input values elsewhere in the form.
   * required: whether this form element is required.
   */
  propTypes: {
    textareaID: React.PropTypes.string,
    defaultValue: React.PropTypes.string,
    textareaClassName: React.PropTypes.string,
    placeholder: React.PropTypes.string,
    rows: React.PropTypes.number,
    cols: React.PropTypes.number,
    onChange: React.PropTypes.func,
    confirm: React.PropTypes.func,
    required: React.PropTypes.bool,
    readOnly: React.PropTypes.bool,
  },

  getDefaultProps() {
    return {
      textareaID: 'textarea',
      cols: 63,
      readOnly: false,
    };
  },

  _onChange(e) {
    if (this.props.onChange) {
      this.props.onChange(this.value(), e);
    }
    this.checkTooltipConditions(this.value());
  },

  _onKeyDown(e) {
    this._onChange(e);
    // Confirm on ENTER if possible
    if (this.props.confirm && e.which === 13) {
      this.props.confirm(e);
    }
  },

  value() {
    return this.refs[this.props.textareaID].value;
  },

  focus() {
    this.refs[this.props.textareaID].focus();
  },

  select() {
    this.refs[this.props.textareaID].select();
  },

  highlight(options) {
    this.refs.highlight.highlight(options);
  },

  unhighlight() {
    this.refs.highlight.unhighlight();
  },

  render() {
    const required = this.props.required ? 'required' : '';
    return (
      <Highlight ref='highlight' id='highlight'>
        <textarea
          ref={this.props.textareaID}
          id={this.props.textareaID}
          className={this.props.textareaClassName}
          rows={this.props.rows}
          cols={this.props.cols}
          placeholder={this.props.placeholder}
          onChange={this._onChange}
          onKeyDown={this._onKeyDown}
          required={required}
          readOnly={this.props.readOnly}
          defaultValue={this.props.defaultValue}
        />
      </Highlight>
    );
  },
});

const parseOptions = (options) => options.map((option) => {
  if (typeof option === 'object') {
    return {
      label: option.label,
      value: option.value,
      disabled: option.disabled,
    };
  }
  return {
    label: option,
    value: option,
    disabled: false,
  };
});

class MultiSelect extends React.Component {
  constructor(props) {
    super(props);

    this.toggleShowSelections = this.toggleShowSelections.bind(this);
    this.onChange = this.onChange.bind(this);
    this.onConfirm = this.onConfirm.bind(this);
    this.getSelectionList = this.getSelectionList.bind(this);
    this.renderSelectOption = this.renderSelectOption.bind(this);

    this.state = {
      showSelections: false,
      selected: props.defaultSelection ? props.defaultSelection : [],
    };
  }

  toggleShowSelections() {
    const showSelections = !this.state.showSelections;
    if (!showSelections) {
      this.onConfirm();
    }
    this.setState({
      showSelections: showSelections,
    });
  }

  onChange(option) {
    const options = parseOptions(this.props.options).map((op) => op.value);
    let selected = _.reject(this.state.selected, (s) => !_.contains(options, s));
    if (_.contains(selected, option)) {
      selected = _.reject(selected, (selectedOp) => selectedOp === option);
    } else {
      selected.push(option);
    }
    this.setState({ selected: selected });
    if (this.props.onChange) {
      this.props.onChange(selected);
    }
  }

  onConfirm() {
    if (this.props.onConfirm) {
      this.props.onConfirm(this.state.selected);
    }
  }

  getSelectionList() {
    return parseOptions(this.props.options).map(this.renderSelectOption);
  }

  renderSelectOption({ label, value, disabled }) {
    const boundOnChange = this.onChange.bind(this, value);
    return (<a className='multi-select-list-item' onClick={boundOnChange}>
      <input
        type='checkbox'
        disabled={disabled}
        className='multi-select-checkbox'
        id={`multi-select-${this.props.id}-${value}`}
        checked={_.contains(this.state.selected, value)}
      />
      <label title={label}>{label}</label>
    </a>);
  }

  render() {
    const options = parseOptions(this.props.options).map((option) => option.value);
    const value = _.reject(this.state.selected, (s) => !_.contains(options, s)).join(', ');
    const toggleBtnClass = `toggle-btn-${this.props.id}`;
    return (<div id={this.props.id} className={`multi-select ${this.props.wrapperClassName}`}>
      <a className={`btn btn-small ${toggleBtnClass}`}
        title={value} onClick={this.toggleShowSelections}
      >
        {value} <span className='caret'></span>
      </a>
      {this.state.showSelections ?
        <DropdownMenuView
          getPosition={this.props.getPosition}
          outsideClickHandler={this.toggleShowSelections}
          ignoreClickClasses={[toggleBtnClass]}
          handleClickInMenu={false}
          getItems={this.getSelectionList}
          classes={['multi-select-dropdown-menu']}
        /> : null}
    </div>);
  }
}

/**
 * Note(chaoyu): options such as [{value: v1, label: l1, disabled: false}, ...] is not supported
 * in current implementation of multiselect
 *
 * id: the id and ref of the select
 * options: [value1, value2, value3]
 * defaultSelection: the value of the default option
 * wrapperClassName: space delimited list of classes the select should have
 * optionClassName: space delimited list of classes the options should have
 * onChange: function that is called on every change event.
 * confirm: function called on selection menu closed. Any validation to be done before submitting
 *   the form must be done in this function because `validate` can only check the value of this
 *   input, not the input values elsewhere in the form.
 * required: whether this form element is required.
 * readOnly: whether this form element is read only.
 * getPosition: when using fixed position, pass a function to get dropdown menu offset
 */
MultiSelect.propTypes = {
  id: React.PropTypes.string,
  options: React.PropTypes.array.isRequired,
  defaultSelection: React.PropTypes.array,
  wrapperClassName: React.PropTypes.string,
  onChange: React.PropTypes.func,
  onConfirm: React.PropTypes.func,
  required: React.PropTypes.bool,
  readOnly: React.PropTypes.bool,
  getPosition: React.PropTypes.func,
};

// Combo of type text input and dropdown select
class Combobox extends React.Component {
  constructor(props) {
    super(props);

    this.toggleShowSelections = this.toggleShowSelections.bind(this);
    this.onChange = this.onChange.bind(this);
    this.onConfirm = this.onConfirm.bind(this);
    this.onSelect = this.onSelect.bind(this);
    this.getSelectionList = this.getSelectionList.bind(this);
    this.renderSelectOption = this.renderSelectOption.bind(this);

    this.state = {
      showSelections: false,
      value: props.defaultValue ? props.defaultValue : '',
    };
  }

  toggleShowSelections() {
    const showSelections = !this.state.showSelections;
    this.setState({
      showSelections: showSelections,
    });
  }

  onChange(value) {
    this.setState({ value: value });
    if (this.props.onChange) {
      this.props.onChange(value);
    }
  }

  onConfirm(e, value) {
    if (this.props.onConfirm) {
      this.props.onConfirm(value);
    }
  }

  onSelect(value) {
    this.setState({ value: value });
    this.onConfirm(null, value);
  }

  getSelectionList() {
    return parseOptions(this.props.options).map(this.renderSelectOption);
  }

  renderSelectOption({ label, value }) {
    const selected = value === this.state.value;
    const boundOnSelect = this.onSelect.bind(this, value);
    return (<a className='combo-select-list-item' onClick={boundOnSelect}>
      {selected ? <i className='fa fa-check' /> : <i className='fa' />}
      <label title={label}>{label}</label>
    </a>);
  }

  render() {
    const toggleBtnClass = `toggle-btn-${this.props.id}`;
    return (<div id={this.props.id} className={`combo-box ${this.props.wrapperClassName}`}>
      {this.state.showSelections ?
        <DropdownMenuView
          getPosition={this.props.getPosition}
          outsideClickHandler={this.toggleShowSelections}
          ignoreClickClasses={[toggleBtnClass]}
          handleClickInMenu
          getItems={this.getSelectionList}
          classes={['combobox-dropdown-menu']}
        /> : null}
      <div className='relative-wrapper'>
        <Input ref='input' onChange={this.onChange} trimInput={false}
          confirm={this.onConfirm} value={this.state.value}
        />
        <div className={`caret-wrapper ${toggleBtnClass}`} onClick={this.toggleShowSelections}>
          <span className='caret' />
        </div>
      </div>
    </div>);
  }
}

/**
 * * Note(chaoyu): options such as [{value: v1, label: l1, disabled: false}, ...] is not supported
 * in current implementation of combobox
 *
 * id: the id and ref of the select
 * options: [value1, value2, value3]
 * defaultValue: the value of the default option
 * wrapperClassName: space delimited list of classes the select should have
 * optionClassName: space delimited list of classes the options should have
 * onChange: function that is called on every change event.
 * confirm: function called on selection menu closed. Any validation to be done before submitting
 *   the form must be done in this function because `validate` can only check the value of this
 *   input, not the input values elsewhere in the form.
 * required: whether this form element is required.
 * readOnly: whether this form element is read only.
 * getPosition: when using fixed position, pass a function to get dropdown menu offset
 */
Combobox.propTypes = {
  id: React.PropTypes.string,
  options: React.PropTypes.array.isRequired,
  defaultValue: React.PropTypes.string,
  wrapperClassName: React.PropTypes.string,
  onChange: React.PropTypes.func,
  onConfirm: React.PropTypes.func,
  required: React.PropTypes.bool,
  readOnly: React.PropTypes.bool,
  getPosition: React.PropTypes.func,
};

module.exports.Input = Input;
module.exports.LabeledCheckbox = LabeledCheckbox;
module.exports.Select = Select;
module.exports.TextArea = TextArea;
module.exports.MultiSelect = MultiSelect;
module.exports.Combobox = Combobox;
