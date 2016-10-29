/* eslint react/prefer-es6-class: 0, consistent-return: 0, func-names: 0 */

import $ from 'jquery';
import React from 'react';
import ClassNames from 'classnames';

import { MacUtils } from '../user_platform/MacUtils';

/**
 * Renders keyboard shortcuts in a table.
 *
 * Properties:
 *   defaultOpenState: default to false, sets whether the content is visible or not
 *   defaultCloseIcon: default to false, provides a close icon that will close
 *   the modal if the component is rendered inside a modal.
 *
 * Hitting ESC or clicking outside the component will close it,
 * as set in componentDidMount.
 */

const ESC = 27;
const keydownCb = document.onkeydown;

const KeyboardShortcutsView = React.createClass({
  propTypes: {
    defaultOpenState: React.PropTypes.bool,
    defaultCloseIcon: React.PropTypes.bool,
    style: React.PropTypes.object,
  },

  getInitialState() {
    return {
      open: this.props.defaultOpenState,
      closeIcon: this.props.defaultCloseIcon,
    };
  },

  getDefaultProps() {
    return {
      defaultOpenState: false,
      defaultCloseIcon: false,
    };
  },

  toggleState() {
    this.setState({ open: !this.state.open });
  },

  componentDidMount() {
    const _this = this;

    // Close the component when ESC is pressed
    $(document).on('keyup.KeyboardShortcutsView.escapeHandler', function(e) {
      e = (e || window.event);
      if (e.keyCode === ESC) {
        try {
          e.preventDefault(); // Non-IE
        } catch (x) {
          e.returnValue = false; // IE
        }
        if (_this.isMounted()) {
          _this.setState({ open: false });
        }
      }
      if (keydownCb) {
        keydownCb(e);
      }
    });

    // Close the component when user clicks outside of it
    $(document).on('click.KeyboardShortcutsView.clickHandler', function(e) {
      // Ignore the keyboard icon if clicked, as the close functionality
      // for that is already provided by the parent component.
      if ($(e.target).parents('#shortcut-wrapper').length > 0) {
        return false;
      }

      // If the click happens anywhere outside of the component's top-level
      // div or its children, set the state to closed.
      let clickingModal;
      if ($(e.target).parents('#shortcut-content').length > 0 ||
        (e.target && e.target.id === 'shortcut-content')) {
        clickingModal = true;
      }
      if (!clickingModal && _this.isMounted()) {
        _this.setState({ open: false });
      }
    });
  },

  componentWillUnmount() {
    // Unbind all the handlers
    $(document).off('.KeyboardShortcutsView');
  },

  // This property returns a close icon that will close the modal when
  // clicked, in the case when the component is rendered inside a ReactModal.
  closeIcon() {
    const click = function() {
      $('.react-modal-place').modal('hide');
    };
    return (
      <i className='fa fa-times-circle-o modal-close' onClick={click}></i>
    );
  },

  commandKeys: ['Cmd', 'Ctrl', 'Alt', 'Option', 'Enter', 'Shift', 'Esc', 'Tab', 'Up', 'Down'],

  shortcutContent() {
    const cmdOrCtrl = MacUtils.isMac() ? 'Cmd' : 'Ctrl';
    const optionOrAlt = MacUtils.isMac() ? 'Option' : 'Alt';
    const shortcuts = {
      'Run command and move to next cell': ['Shift', '&&', 'Enter'],
      'Run command and insert new cell below': [optionOrAlt, '&&', 'Enter'],
      'Run command': ['Ctrl', '&&', 'Enter'],
      'Move to previous/next cell': [optionOrAlt, '&&', 'Up', '||', 'Down'],
      'Insert a cell above': ['Ctrl', '&&', optionOrAlt, '&&', 'P'],
      'Insert a cell below': ['Ctrl', '&&', optionOrAlt, '&&', 'N'],
      'Move a cell up': ['Ctrl', '&&', optionOrAlt, '&&', 'Up'],
      'Move a cell down': ['Ctrl', '&&', optionOrAlt, '&&', 'Down'],
      'Toggle comments panel': ['Ctrl', '&&', optionOrAlt, '&&', 'M'],
      'Copy current cell': ['Ctrl', '&&', optionOrAlt, '&&', 'C'],
      'Cut current cell': ['Ctrl', '&&', optionOrAlt, '&&', 'X'],
      'Paste cell below': ['Ctrl', '&&', optionOrAlt, '&&', 'V'],
      'Delete current cell': ['Ctrl', '&&', optionOrAlt, '&&', 'D'],
      'Move up or to previous cell': ['Up'],
      'Move down or to next cell': ['Down'],
      'Autocomplete, indent selection': ['Tab'],
      'Unindent selection': ['Shift', '&&', 'Tab'],
      'Indent/Unindent selection': [cmdOrCtrl, '&&', ']', '||', '['],
      'Undo typing': [cmdOrCtrl, '&&', 'Z'],
      'Redo typing': [cmdOrCtrl, '&&', 'Shift', '&&', 'Z'],
      'Toggle line comment': [cmdOrCtrl, '&&', '/'],
    };
    const elements = [];

    for (const description in shortcuts) {
      if (!shortcuts.hasOwnProperty(description)) {
        continue;
      }
      const commandArray = shortcuts[description];
      const commandElements = [];
      for (let i = 0; i < commandArray.length; i++) {
        if (commandArray[i] === '&&') {
          commandElements.push(<span key={i} className={"plus-sign"}>+</span>);
        } else if (commandArray[i] === '||') {
          commandElements.push(<span key={i} className={"plus-sign"}>/</span>);
        } else {
          const classes = ClassNames({
            'shortcut-command': true,
            'command-key': this.commandKeys.indexOf(commandArray[i]) >= 0,
          });
          commandElements.push(
            <span key={i} className={classes}>{commandArray[i]}</span>
          );
        }
      }

      elements.push(
        <tr key={description}>
          <td className={"shortcut-instruction"}>{commandElements}</td>
          <td className={"shortcut-colon"}>:</td>
          <td className={"shortcut-description"}>{description}</td>
        </tr>
      );
    }

    return (
      <table id={"shortcut-table"}><tbody>{elements}</tbody></table>
    );
  },

  render() {
    if (this.state.open) {
      return (
        <div id={"shortcut-content"} style={this.props.style} ref={"shortcutView"}>
          {this.props.defaultCloseIcon ? this.closeIcon() : null}
          {this.shortcutContent()}
        </div>
      );
    }
    return null;
  },
});

module.exports = KeyboardShortcutsView;
