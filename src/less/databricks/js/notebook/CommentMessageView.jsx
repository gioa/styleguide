/* eslint react/prefer-es6-class: 0 */

import React from 'react';
import ClassNames from 'classnames';

import EditMessageView from '../notebook/CommentEditMessageView.jsx';

import { ResourceUrls } from '../urls/ResourceUrls';

const MessageView = React.createClass({
  propTypes: {
    className: React.PropTypes.string,
    onChildHeightWillUpdate: React.PropTypes.func.isRequired,

    // message content
    message: React.PropTypes.string.isRequired,

    // message author name
    displayName: React.PropTypes.string.isRequired,

    // can current user edit this message
    canEdit: React.PropTypes.bool.isRequired,

    // when is this message created
    timestamp: React.PropTypes.number.isRequired,

    updateMessage: React.PropTypes.func.isRequired,
    deleteMessage: React.PropTypes.func.isRequired,
  },

  getInitialState() {
    return {
      editing: false,
    };
  },

  startEditing() {
    this.setState({ editing: true });
    this.props.onChildHeightWillUpdate();
  },

  stopEditing() {
    this.setState({ editing: false });
    this.props.onChildHeightWillUpdate();
  },

  render() {
    const displayTime = (new Date(this.props.timestamp)).toLocaleString();

    const editButtons = this.props.canEdit ? (
      <div className='message-controls'>
        <i onMouseDown={this.startEditing} className='edit fa fa-pencil' />
        <i onMouseDown={this.props.deleteMessage} className='delete fa fa-trash-o' />
      </div>) : null;

    const classes = {
      'message': true,
    };
    classes[this.props.className] = this.props.className;

    const content = this.state.editing ? (<EditMessageView
      ref='editMessageView'
      saveMessage={this.props.updateMessage}
      cancelEdit={this.stopEditing}
      defaultValue={this.props.message}
      onSaveSucceed={this.stopEditing}
      active
      onChildHeightWillUpdate={this.props.onChildHeightWillUpdate}
    />) : (<div className='message-content'>
      {this.props.message}
    </div>);

    return (
      <div className={ClassNames(classes)}>
        {editButtons}
        <div className='message-author'>
          <img src={ResourceUrls.getResourceUrl('img/placeholder_pic.png')}
            className='message-author-avatar'
          />
          <div className='message-author-info'>
            <h4 className='message-author-name'>{this.props.displayName}</h4>
            <p className='message-posted-at'>
              {displayTime}
            </p>
          </div>
        </div>
        {content}
      </div>);
  },
});

module.exports = MessageView;
