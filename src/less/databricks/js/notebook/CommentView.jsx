/* eslint react/prefer-es6-class: 0 */

import _ from 'underscore';
import React from 'react';
import ClassNames from 'classnames';

const CommentModel = require('../notebook/CommentModel');
const MessageView = require('../notebook/CommentMessageView.jsx');
const EditMessageView = require('../notebook/CommentEditMessageView.jsx');

const CommentView = React.createClass({

  propTypes: {
    comment: React.PropTypes.instanceOf(CommentModel).isRequired,
    userId: React.PropTypes.number.isRequired,
    setActiveComment: React.PropTypes.func.isRequired,
    styles: React.PropTypes.object.isRequired,
    active: React.PropTypes.bool.isRequired,
    onChildHeightWillUpdate: React.PropTypes.func.isRequired,
  },

  onMouseDown() {
    if (this.props.active) {
      return;
    }

    // set current comment as active comment
    const commentGUID = this.props.comment.get('guid');
    this.props.setActiveComment(commentGUID);

    // toggling new reply box will change height of commentView
    this.props.onChildHeightWillUpdate();
  },

  onSaveSucceed() {
    this.props.setActiveComment(-1);
  },

  cancelNewCommentEdit() {
    this.props.comment.removeLocalModel();
  },

  componentWillUpdate(nextProps) {
    const comment = this.props.comment;

    // for new local comment, if it loses focus and the value is empty, remove the comment
    if (this.props.active && !nextProps.active &&
        comment.isLocalModel() &&
        this.refs.newComment &&
        this.refs.newComment.state.value.replace(/\s+/g, '') === '') {
      comment.removeLocalModel();
    }
  },

  render() {
    const comment = this.props.comment;
    const userFullname = comment.get('userFullname');
    // legacy accounts don't have fullname, use 'username' field as display name instead
    const displayName = !_.isEmpty(userFullname) ? userFullname : comment.get('userName');
    const wrapperClasses = ClassNames({
      'comment-wrapper': true,
      'active': this.props.active,
    });
    const saveNewComment = comment.saveNewComment.bind(comment);

    if (comment.isLocalModel()) {
      return (
        <div className={wrapperClasses}
          style={this.props.styles}
          onMouseDown={this.onMouseDown}
        >
          <div className='notebook-comment'>
            <EditMessageView
              ref='newComment'
              className={'comment-' + comment.get('guid')}
              saveMessage={saveNewComment}
              displayName={displayName}
              cancelEdit={this.cancelNewCommentEdit}
              onSaveSucceed={this.onSaveSucceed}
              active
              confirm={"Comment"}
              onChildHeightWillUpdate={this.props.onChildHeightWillUpdate}
            />
          </div>
        </div>);
    }

    const replyMessages = _.map(comment.getReplies(), (reply) => {
      const canEditReply = reply.userId === this.props.userId;
      const messageViewDisplayName = !_.isEmpty(reply.userFullname) ?
        reply.userFullname : reply.userName;
      const updateReply = comment.updateReply.bind(comment, reply.nuid);
      const deleteReply = comment.deleteReply.bind(comment, reply.nuid);
      return (
        <MessageView
          key={reply.nuid}
          className='reply-message'
          message={reply.text}
          displayName={messageViewDisplayName}
          timestamp={reply.postedAt}
          canEdit={canEditReply}
          updateMessage={updateReply}
          deleteMessage={deleteReply}
          onChildHeightWillUpdate={this.props.onChildHeightWillUpdate}
        />);
    }, this);

    const canEditComment = comment.get('userId') === this.props.userId;

    const updateCommentText = comment.updateCommentText.bind(comment);
    const deleteComment = comment.deleteComment.bind(comment);
    const commentMessage = (<MessageView
      className='comment-message'
      message={comment.get('text')}
      displayName={displayName}
      timestamp={comment.get('postedAt')}
      canEdit={canEditComment}
      updateMessage={updateCommentText}
      deleteMessage={deleteComment}
      onChildHeightWillUpdate={this.props.onChildHeightWillUpdate}
    />);

    const addReply = comment.addReply.bind(comment);
    const newReplyBox = comment.isLocalModel() ? null : (
      <EditMessageView
        className={"new-reply"}
        key={comment.get('guid') + '-new-reply'}
        saveMessage={addReply}
        placeholderText={"Reply..."}
        confirm={"Reply"}
        hidden={!this.props.active}
        onSaveSucceed={this.onSaveSucceed}
        onChildHeightWillUpdate={this.props.onChildHeightWillUpdate}
      />);

    return (
      <div className={wrapperClasses}
        style={this.props.styles}
        onMouseDown={this.onMouseDown}
      >
        <div className='notebook-comment'>
          {commentMessage}
          <div className='comment-replies'>
            {replyMessages}
          </div>
          {newReplyBox}
        </div>
      </div>);
  },
});

module.exports = CommentView;
