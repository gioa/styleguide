import React from 'react';

export class LoginInputElem extends React.Component {
  clear() {
    this.refs.input.value = '';
  }

  focusInput() {
    this.refs.input.focus();
  }

  getValue() {
    return this.refs.input.value;
  }

  render() {
    const icon = <span className='add-on'><i className={this.props.iconClass}></i></span>;
    let inputClass = 'input-block-level';
    if (this.props.inputClass) { inputClass = inputClass + ' ' + this.props.inputClass; }

    return (
      <div className='input-prepend'>
        {this.props.showIcon ? icon : null}
        <input
          onKeyDown={this.props.keydownHandler ? this.props.keydownHandler : null}
          disabled={this.props.disabled}
          defaultValue={this.props.defaultValue}
          id={this.props.inputId}
          type={this.props.type}
          name={this.props.inputName}
          className={inputClass}
          placeholder={this.props.inputPlaceholder}
          ref='input'
          required={this.props.required}
        >
        </input>
      </div>
    );
  }
}

LoginInputElem.propTypes = {
  defaultValue: React.PropTypes.string,
  iconClass: React.PropTypes.string,
  inputId: React.PropTypes.string,
  inputClass: React.PropTypes.string,
  inputName: React.PropTypes.string,
  inputPlaceholder: React.PropTypes.string,
  keydownHandler: React.PropTypes.func,
  required: React.PropTypes.bool,
  showIcon: React.PropTypes.bool,
  disabled: React.PropTypes.bool,
  type: React.PropTypes.string,
};
