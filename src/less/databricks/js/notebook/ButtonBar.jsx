/* eslint react/prefer-es6-class: 0 */

import _ from 'underscore';
import React from 'react';

import IconsForType from '../ui_building_blocks/icons/IconsForType';

const ButtonBar = React.createClass({
  propTypes: {
    defaultActiveBtnKey: React.PropTypes.string.isRequired,
    buttons: React.PropTypes.object.isRequired,
    // props.onChange should take two parameters. The new value, and the callback
    onChange: React.PropTypes.func.isRequired,
    className: React.PropTypes.string,
    confirmChange: React.PropTypes.func,
    // if useIcons is true, the keys in the buttons prop must correspond to IconsForType icons
    useIcons: React.PropTypes.bool,
    label: React.PropTypes.string,
    disabled: React.PropTypes.bool,
  },

  getDefaultProps() {
    return {
      useIcons: false,
      disabled: false,
    };
  },

  getInitialState() {
    return {
      activeBtnKey: this.props.defaultActiveBtnKey,
      updating: false,
    };
  },

  getLabel() {
    if (this.props.label) {
      return <span>{this.props.label}:</span>;
    }
    return null;
  },

  onChange(btnKey) {
    if (this.state.updating) {
      return;
    }

    const self = this;
    const value = self.props.buttons[btnKey];
    const toggle = function toggle() {
      // update local state optimistically
      self.setState({ updating: true, activeBtnKey: btnKey });
      self.props.onChange(value, function onChange() {
        // on update success, end updating state
        self.setState({ updating: false });
      });
    };

    // if confirmChange is provided, pass in the new value and callback on confirmation
    // otherwise do the change immediately
    if (this.props.confirmChange) {
      this.props.confirmChange(value, toggle);
    } else {
      toggle();
    }
  },

  getButtons() {
    const buttons = this.props.buttons;
    return _.map(_.keys(buttons), function getEachButton(btnKey) {
      let btnClasses = 'btn';
      const icon = <i className={'fa fa-' + IconsForType[btnKey]}></i>;
      if (this.state.activeBtnKey === btnKey) { btnClasses += ' active'; }
      const btnOnChange = this.onChange.bind(this, btnKey);
      return (
        <a
          className={btnClasses}
          disabled={this.state.updating || this.props.disabled ? true : null}
          key={btnKey}
          onClick={btnOnChange}
          value={buttons[btnKey]}
        >
          {this.props.useIcons ? icon : btnKey}
        </a>);
    }, this);
  },

  render() {
    return (<div className={'buttons-bar ' + this.props.className}>
      {this.getLabel()}
      <div className='btn-group'>
        {this.getButtons()}
      </div>
    </div>);
  },

});

module.exports = ButtonBar;
