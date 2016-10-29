/* eslint react/prefer-es6-class: 0, react/no-is-mounted: 0, consistent-return: 0 */

import $ from 'jquery';
import _ from 'underscore';
import React from 'react';
import ReactDOM from 'react-dom';
import ClassNames from 'classnames';

const ENTER = 13;
const ESC = 27;

/**
 * InlineEditableText - component for title or label that support inline editing. See its usage in
 * DashboardSideMenuView and NotebookCommandView.
 */
const InlineEditableText = React.createClass({
  propTypes: {
    initialText: React.PropTypes.string.isRequired,
    updateText: React.PropTypes.func.isRequired,
    // it will disable the input if props.allowEdit is false
    allowEdit: React.PropTypes.bool,
    // extra css class name apply to the component
    className: React.PropTypes.string,
    // max text length allowed, default is 50 character
    maxLength: React.PropTypes.number,
    // allow user to update the target input text to empty string
    allowEmpty: React.PropTypes.bool,
    // function to call after name is saved, or (if the name hasn't changed) when editing stops
    onStopEdit: React.PropTypes.func,
    // should it apply changes to local model before it returns from server
    optimisticUpdate: React.PropTypes.bool,
    // whether or not to show the default save/edit button show next to the text
    showSaveAndEditBtn: React.PropTypes.bool,
    children: React.PropTypes.node,
  },

  getDefaultProps() {
    return {
      allowEdit: true,
      className: '',
      maxLength: 50,
      allowEmpty: false,
      optimisticUpdate: true,
      showSaveAndEditBtn: true,
    };
  },

  getInitialState() {
    return {
      editing: false,
      text: this.props.initialText,
    };
  },

  // trigger cursor focus manually
  startEditing(options) {
    if (!this.props.allowEdit) {
      return;
    }

    this.setState({ editing: true });

    options = _.defaults(options || {}, {
      setFocus: true, // set focus
      setSelect: true, // select all text after focus, this overwrites the setCursor option
      setCursor: false, // set cursor at the end of the input
    });
    if (!options.setFocus) {
      return true; // enter editing state without focus on input
    }

    const focusInput = function focusInput() {
      const $el = $(ReactDOM.findDOMNode(this.refs.input));
      if ($el.length === 0) {
        // In non-editing state, refs.input might not be rendered if props.children is not empty
        return false;
      }
      $el.focus();
      if (options.setSelect) {
        $el.select();
      } else if (options.setCursor) {
        // set cursor to the end of the text
        const length = this.state.text.length || 0;
        $el[0].setSelectionRange(length, length);
      }
      return true;
    }.bind(this);

    if (!focusInput()) {
      _.defer(focusInput);
    }
  },

  _saveChanges() {
    if (this.props.onStopEdit) { this.props.onStopEdit(); }

    if (!this.props.allowEdit) {
      return;
    }

    // Should not save if text has not been changed
    if (this.props.initialText === this.state.text) {
      return this.setState({ editing: false });
    }

    // Should not save empty text if prop.allowEmpty is false(default)
    if (!this.props.allowEmpty && _.isEmpty(this.state.text.trim())) {
      return this.setState({ editing: false, text: this.props.initialText });
    }

    this.props.updateText(this.state.text, () => {
      if (this.isMounted()) {
        this.setState({ editing: false });
      }
    });

    if (this.props.optimisticUpdate) {
      this.setState({ editing: false });
    }
  },

  _handleChange(event) {
    if (!this.props.allowEdit) {
      return;
    }
    this.setState({
      text: event.target.value,
    });
  },

  _handleKeyDown(e) {
    if (e.keyCode === ENTER || e.keyCode === ESC) {
      this._saveChanges();
    }
  },

  _setEditing() {
    if (!this.props.allowEdit) {
      return;
    }
    this.setState({ editing: true });
  },

  _getButtons() {
    const buttons = [];

    if (this.props.showSaveAndEditBtn) {
      if (this.state.editing) {
        // @NOTE(jengler) 2016-02-02: Using onMouseDown for the save event so that the event fires
        // before the blur event. Using onClick causes issue PROD-8642 because the setState will
        // re-render the DOM before the click event is resolved, making the click events target the
        // edit button instead of the save changes button.
        buttons.push(
          <a key='save-btn' className='save-btn' onMouseDown={this._saveChanges}>
            <i className='fa fa-floppy-o' />
          </a>
        );
      } else {
        buttons.push(
          <a key='edit-btn' className='edit-btn' onMouseDown={this.startEditing}>
            <i className='fa fa-pencil' />
          </a>
        );
      }
    }

    if (buttons.length === 0) {
      return null;
    }
    return <div className='buttons'>{buttons}</div>;
  },

  render() {
    const classes = {
      'inline-editable': true,
      editing: this.state.editing,
      viewing: !this.state.editing,
    };
    classes[this.props.className] = true;

    let title;
    if (!this.state.editing && this.props.children) {
      // User can pass in children as a replacement of input tag when it's in non-editing state
      title = this.props.children;
    } else {
      title = (
        <input
          ref='input' type='text' value={this.state.text}
          disabled={!this.props.allowEdit}
          size={this.state.text.length}
          maxLength={this.props.maxLength ? this.props.maxLength : -1 /* -1 means no max length*/}
          className='editing-text'
          onClick={this._setEditing}
          onBlur={this._saveChanges}
          onChange={this._handleChange}
          onKeyDown={this._handleKeyDown}
        />);
    }

    return (<div className={ClassNames(classes)} >
      {title}
      {this._getButtons()}
    </div>);
  },
});

module.exports = InlineEditableText;
