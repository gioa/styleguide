/* eslint react/prefer-es6-class: 0, react/no-is-mounted: 0 */

import React from 'react';
import ClassNames from 'classnames';

import { ResourceUrls } from '../urls/ResourceUrls';

// this component is userd for adding new comment/reply in CommentView
// and for editing comment/reply in MessageView
const EditMessageView = React.createClass({
  propTypes: {
    className: React.PropTypes.string,
    displayName: React.PropTypes.string,
    placeholderText: React.PropTypes.string,
    onChildHeightWillUpdate: React.PropTypes.func.isRequired,

    // show confrim and cancel button in active state
    // props.active is the default value for state.active
    active: React.PropTypes.bool,

    // hide the EditMessageView completely
    hidden: React.PropTypes.bool,

    // callback function when click save message button
    saveMessage: React.PropTypes.func.isRequired,

    // callback function when save message call succeed
    onSaveSucceed: React.PropTypes.func.isRequired,

    // for new message, default value should be empty string
    // for editing existing message, default value should be the old value
    defaultValue: React.PropTypes.string,

    // callback function when click on cancel button
    cancelEdit: React.PropTypes.func,

    // text labels on confirm and cancel button
    confirm: React.PropTypes.string,
    cancel: React.PropTypes.string,
  },

  getInitialState() {
    const defaultValue = this.props.defaultValue ? this.props.defaultValue : '';
    return {
      active: this.props.active,
      value: defaultValue,
    };
  },

  getDefaultProps() {
    return {
      placeholderText: '',
      hidden: false,
      active: false,
      confirm: 'Save',
      cancel: 'Cancel',
      displayName: '',
    };
  },

  resetEditbox() {
    if (this.isMounted()) {
      this.setState(this.getInitialState());
    }
    this.props.onChildHeightWillUpdate();
  },

  handleChange(event) {
    // TODO(Chaoyu): give visual feedback when the content reach max length
    // truncate the value to first 1024 charaters
    this.setState({ value: event.target.value.substr(0, 2048) });
  },

  onSaveSucceed() {
    this.resetEditbox();
    if (this.props.onSaveSucceed) {
      this.props.onSaveSucceed();
    }
  },

  saveMessage() {
    this.props.saveMessage(this.state.value, {
      success: this.onSaveSucceed.bind(this),
    });
  },

  cancelEdit() {
    if (this.props.cancelEdit) {
      this.props.cancelEdit();
    }
    this.resetEditbox();
  },

  onMouseDown() {
    this.setState({ active: true });
  },

  // Short cut 'Shift-enter' to save the message
  onKeyPress(e) {
    if (e.shiftKey && e.charCode === 13) {
      e.preventDefault();
      this.saveMessage();
    }
  },

  render() {
    const userInfo = this.props.displayName ? (
      <div className='message-author'>
        <img src={ResourceUrls.getResourceUrl('img/placeholder_pic.png')}
          className='message-author-avatar'
        />
        <div className='message-author-info'>
          <h4 className='message-author-name'>{this.props.displayName}</h4>
        </div>
      </div>) : null;

    // can't save message if current value equals default value,
    // or if current value is empty string
    const canConfirm = this.state.value !== this.props.defaultValue &&
      (this.state.value.replace(/\s+/g, '') !== '');

    const confirmBtn = !canConfirm ? (
      <button
        className='btn btn-mini'
        disabled
      >{this.props.confirm}</button>) : (
        <button
          className='btn btn-mini'
          onClick={this.saveMessage}
        >{this.props.confirm}</button>);

    const btns = this.state.active ? (<div className='new-message-btns'>
      {confirmBtn}
      <button className='btn btn-mini' onClick={this.cancelEdit}>{this.props.cancel}</button>
    </div>) : null;

    const classes = {
      'new-message-box': true,
      'hidden': this.props.hidden && !canConfirm, // don't hide me if text are changed
    };
    classes[this.props.className] = this.props.className;

    // TODO(Chaoyu): make the textarea auto-resize
    // https://github.com/andreypopp/react-textarea-autosize
    return (
      <div className={ClassNames(classes)} onMouseDown={this.onMouseDown}>
        {userInfo}
        <textarea
          className='new-message-input-textarea'
          onKeyPress={this.onKeyPress}
          placeholder={this.props.placeholderText}
          value={this.state.value}
          onChange={this.handleChange}
          onSubmit={this.saveMessage}
        />
        {btns}
      </div>
    );
  },
});

module.exports = EditMessageView;
