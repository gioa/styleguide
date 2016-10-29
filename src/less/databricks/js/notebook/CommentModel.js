import _ from 'underscore';
import Backbone from 'backbone';

import BackboneRpcMixin from '../notebook/BackboneRpcMixin';

import { BrowserUtils } from '../user_platform/BrowserUtils';

const CommentModel = Backbone.Model.extend({

  defaults: {
    guid: BrowserUtils.generateGUID(),
    text: '',
    commentReference: { referenceType: 'command' },
    postedAt: 0,
    updatedAt: 0,
    replies: {},
  },

  notebook() {
    return this.get('parent');
  },

  // url being used for rpc calls in the BackboneRpcMixin
  url() {
    return '/notebook/' + this.notebook().id + '/comment';
  },

  isLocalModel() {
    return Boolean(!this.get('id'));
  },

  getCommand() {
    return this.notebook().commandCollection().find(function findThisCommandNuid(command) {
      return command.get('nuid') === this.get('commandNUID');
    }, this);
  },

  getReplies() {
    return _.sortBy(_.values(this.get('replies')), (reply) => reply.postedAt);
  },

  // Delete an unsaved comment from notebook._commandCollection
  removeLocalModel() {
    if (this.isLocalModel) {
      this.notebook().commandCollection().remove(this);
    }
  },

  saveNewComment(text, options) {
    if (!this.isLocalModel()) {
      console.error('Comment Already saved to backend');
      return;
    }

    this.rpc('addComment', {
      text: text,
      guid: this.get('guid'),
      commandNUID: this.get('commandNUID'),
      reference: this.get('commentReference'),
    }, options);
  },

  updateCommentText(text, options) {
    if (!text || _.isEqual(text, this.get('text'))) {
      return; // nothing needs to be updated
    }

    this.rpc('updateCommentText', {
      commentId: this.id,
      text: text,
    }, options);
  },

  updateCommentReference(reference, options) {
    if (_.isEqual(reference, this.get('commentReference'))) {
      return; // nothing needs to be updated
    }

    this.rpc('updateCommentRef', {
      commentId: this.id,
      reference: reference,
    }, options);
  },

  updateReferenceRange(range, selection) {
    if (this.isLocalModel()) { // do not update reference for local model
      return;
    }

    const newReference = {
      referenceType: 'commandFragment',
      selection: selection,
      range: {
        from: {
          line: range.from.line,
          ch: range.from.ch,
        },
        to: {
          line: range.to.line,
          ch: range.to.ch,
        },
      },
    };
    this.updateCommentReference(newReference);
  },

  deleteComment() {
    this.rpc('removeComment', {
      commentId: this.id,
    });
  },

  addReply(text, options) {
    this.rpc('addCommentReply', {
      commentId: this.id,
      text: text,
      nuid: BrowserUtils.generateGUID(),
    }, options);
  },

  updateReply(replyNUID, newText, options) {
    if (!this.get('replies')[replyNUID]) {
      return; // reply doesn't exist
    }
    this.rpc('updateCommentReply', {
      commentId: this.id,
      replyNUID: replyNUID,
      text: newText,
    }, options);
  },

  deleteReply(replyNUID) {
    if (!this.get('replies')[replyNUID]) {
      return; // reply doesn't exist
    }
    this.rpc('removeCommentReply', {
      commentId: this.id,
      replyNUID: replyNUID,
    });
  },

});

_.extend(CommentModel.prototype, BackboneRpcMixin);

module.exports = CommentModel;
