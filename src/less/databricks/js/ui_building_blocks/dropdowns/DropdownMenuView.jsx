/* eslint react/prefer-es6-class: 0 */

import $ from 'jquery';
import _ from 'lodash';
import React from 'react';

/**
 * Dropdown Menu Component
 *
 * Required Properties:
 *   - outsideClickHandler: The handler that will be triggered when a user clicks outside of the
 *   dropdown
 *   - getItems: function that returns an array of React DOM elements
 *   It will be called to populate the dropdown menu
 *
 * Optional Properties:
 *   - heading: String or element that will be used as the menu heading
 *   - classes: array of strings of class names to attach to the dropdown menu div
 *   - handleClickInMenu: call the outsideClickHandler even if the click is inside the menu div
 *   - ignoreClickClasses: don't call the outsideClickHandler if clicked on an element with one
 *     of these classes.
 *
 * TODO(?) Refactor so that all the state of the menu (up/down) is an internal state of this class
 */
const DropdownMenuView = React.createClass({

  propTypes: {
    heading: React.PropTypes.oneOfType([
      React.PropTypes.string,
      React.PropTypes.node,
    ]),
    outsideClickHandler: React.PropTypes.func.isRequired,
    getItems: React.PropTypes.func.isRequired,
    handleClickInMenu: React.PropTypes.bool,
    ignoreClickClasses: React.PropTypes.array,
    classes: React.PropTypes.array,
    getPosition: React.PropTypes.func,
  },

  getDefaultProps() {
    return {
      handleClickInMenu: true,
      classes: [],
      getPosition: () => {},
    };
  },

  // Set up a handler so that we hide the dropdown on outside clicks
  // We save a reference to it so that we can unbind it from the document later
  componentDidMount() {
    const self = this;
    this.clickHandler = function clickHandler(e) {
      const ignoreClasses = ['dropdown-menu']
        .concat(self.props.ignoreClickClasses ? self.props.ignoreClickClasses : []);
      const ignore = _.some(
        ignoreClasses,
        (cls) => $(e.target).closest('.' + cls).length !== 0
      );
      if (!ignore && self.props.outsideClickHandler) {
        self.props.outsideClickHandler();
      }
      return true;
    };

    $(document).click(this.clickHandler);
    // For if there's an iframe on the page. We still want the clickHandler to trigger
    // because there isn't supposed to be a visible difference to the user
    $('#sparkui-iframe').contents().click(this.clickHandler);
  },

  // Unbind the outside click handler when we remove the dropdown from the DOM
  componentWillUnmount() {
    $(document).off('click', this.clickHandler);
    $('#sparkui-iframe').contents().off('click', this.clickHandler);
  },

  render() {
    const dropDownStyle = _.extend({ display: 'block' }, this.props.getPosition());

    // Wrap each passed in item in a <li>
    let key = 0;
    const items = _.map(this.props.getItems(), (item) => {
      key++;
      return (<li key={key} className={"dropdown-menu-item"}>{item}</li>);
    });

    const classes = 'dropdown-menu ' + this.props.classes.join(' ');

    const heading = this.props.heading ? (
      <li className='heading'><span>{this.props.heading}</span></li>
    ) : null;

    const clickHandler = this.props.handleClickInMenu ? this.props.outsideClickHandler : null;

    return (
      <div className={classes} style={dropDownStyle} onClick={clickHandler}>
        {heading}
        {items}
      </div>
    );
  },
});

module.exports = DropdownMenuView;
