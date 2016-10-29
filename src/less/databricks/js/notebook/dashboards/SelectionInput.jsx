/* eslint react/prefer-es6-class: 0 */

import _ from 'underscore';
import React from 'react';

const SelectionInput = React.createClass({
  propTypes: {
    defaultValue: React.PropTypes.string.isRequired,
    options: React.PropTypes.arrayOf(React.PropTypes.string).isRequired,
    // props.onChange should take two parameters. The new value, and the callback
    onChange: React.PropTypes.func.isRequired,
    className: React.PropTypes.string,
    label: React.PropTypes.string,
  },

  getInitialState() {
    return {
      value: this.props.defaultValue,
      updating: false,
    };
  },

  getLabel() {
    if (this.props.label) {
      return <span>{this.props.label}:</span>;
    }
    return null;
  },

  getOptions() {
    return _.uniq(this.props.options).map(
      (option) => <option key={option} value={option}>{option}</option>
    );
  },

  onChange(event) {
    const value = event.target.value;
    this.setState({ value: value, updating: true });
    this.props.onChange(value, () => this.setState({ updating: false }));
  },

  render() {
    return (<div className={'react-selection ' + this.props.className}>
      {this.getLabel()}
      <select
        value={this.state.value}
        onChange={this.onChange}
        disabled={this.state.updating ? true : null}
      >
        {this.getOptions()}
      </select>
    </div>);
  },
});

module.exports = SelectionInput;
