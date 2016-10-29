/* eslint react/prefer-es6-class: 0, complexity: 0, react/no-is-mounted: 0, func-names: 0 */

import $ from 'jquery';
import _ from 'underscore';
import React from 'react';
import ReactDOM from 'react-dom';
import ClassNames from 'classnames';

import CodeMirrorUtils from '../notebook/CodeMirrorUtils';
import CommentView from '../notebook/CommentView.jsx';

const topbarHeight = 74;

const CommentsPanelView = React.createClass({

  propTypes: {
    comments: React.PropTypes.array.isRequired,
    showCommentsPanel: React.PropTypes.bool.isRequired,
    userId: React.PropTypes.number.isRequired,
    getCommandViewOffsets: React.PropTypes.func.isRequired,
    onActiveCommentChanges: React.PropTypes.func.isRequired,
  },

  getInitialState() {
    return {
      // activeCommentGUID = -1 means no comment is active
      activeCommentGUID: -1,
    };
  },

  setActiveComment(commentGUID) {
    if (this.state.activeCommentGUID === commentGUID) {
      return;
    }
    this.setState({ activeCommentGUID: commentGUID });
    this.highlightActiveCommentMark(commentGUID);
    this.scrollActiveCommentIntoView(commentGUID);
    this.props.onActiveCommentChanges();
  },

  scrollActiveCommentIntoView(commentGUID) {
    if (commentGUID === -1) {
      return;
    }

    _.defer(function() {
      const activeCommentView = this.refs[commentGUID];
      if (!activeCommentView || !activeCommentView.isMounted()) {
        return;
      }

      const top = parseInt(ReactDOM.findDOMNode(activeCommentView).style.top, 10);
      const scrollTop = $('.shell-top').scrollParent().scrollTop();

      // if active comment view is not in current viewport, scoll it into view
      if (scrollTop > top) {
        $('.shell-top').scrollParent().animate({ scrollTop: top - 10 }, '400');
      }
    }.bind(this));
  },

  highlightActiveCommentMark(commentGUID) {
    $('.comment-mark').removeClass('active');
    $('.comment-mark-' + commentGUID).addClass('active');
  },

  getActiveComment() {
    return _.find(this.props.comments, function(comment) {
      return comment.get('guid') === this.state.activeCommentGUID;
    }, this);
  },

  getActiveCommentGUID() {
    return this.state.activeCommentGUID;
  },

  resetActivateComment() {
    this.setActiveComment(-1);
  },

  onClickOutside(e) {
    const container = $('.comment-wrapper.active'); // the current active comment
    const clickOnAddComment = $(e.target).closest('.add-comment').length !== 0;
    // if the target of the click isn't the container, nor a descendant of the container
    const clickSomewhereElse = !container.is(e.target) && container.has(e.target).length === 0;
    if (clickSomewhereElse && !clickOnAddComment) {
      this.resetActivateComment();
    }
  },

  onClickCommentMark(e) {
    const closestMark = $(e.target).closest('.comment-mark');
    if (closestMark.length !== 0) { // click on mark
      let commentGUID = -1;
      const classes = closestMark.attr('class').split(' ');
      _.each(classes, function(c) {
        if (c.indexOf('comment-mark-') === 0) { // startsWith 'comment-mark'
          commentGUID = c.replace('comment-mark-', '');
        }
      });
      this.setActiveComment(commentGUID);
    }
  },

  // track if comments panel has been rendered at least once (showCommentsPanel=true)
  _hasRendered: false,

  componentDidMount() {
    this.clickHandler = function(e) {
      this.onClickOutside(e);
      this.onClickCommentMark(e);
    }.bind(this);
    $(document).mousedown(this.clickHandler);

    // For initial render, comment position is calculated based on estimated CommentView height,
    // when showCommentsPanel is true for initial render, trigger a forceUpdate immediately after
    // initial render to update the comment position based on real CommentView display height
    if (this.props.showCommentsPanel) {
      this._hasRendered = true;
      this.deferForceUpdate();
    }
  },

  componentWillUpdate(nextProps) {
    // if it's initial render of the CommentsPanel, we don't have the CommentView height as they
    // are not yet displayed, this.collectCommentViewHeight will use an estimated height for this
    // initial render, and here we defer another forceUpdate so that the second render will have
    // the correct comment view height data
    if (!this._hasRendered && nextProps.showCommentsPanel) {
      this._hasRendered = true;
      this.deferForceUpdate();
    }
  },


  collectPositioningInfo() {
    this.collectCommentViewHeight();
    this.collectCommentReferenceOffsets();
  },

  _commentViewHeightMap: {},
  _commandViewOffsetMap: {},
  _commentReferenceTopMap: {},

  collectCommentViewHeight() {
    if (!this.isMounted()) {
      return;
    }

    _.each(this.props.comments, function(comment) {
      const commentGUID = comment.get('guid');
      const commentView = this.refs[commentGUID];
      if (!commentView || !commentView.isMounted) {
        return;
      }

      const height = $(ReactDOM.findDOMNode(commentView)).height();

      // when toggling comments panel, the height of all comment view will be 0 initially,
      // in this case we will use previous height map for rendering, if there is no previous
      // height map, use an estimated height for initial render
      this._commentViewHeightMap[commentGUID] = height ||
        this._commentViewHeightMap[commentGUID] ||
        140;
    }, this);
  },

  componentWillUnmount() {
    $(document).off('mousedown', this.clickHandler);
  },

  collectCommentReferenceOffsets() {
    this._commandViewOffsetMap = this.props.getCommandViewOffsets();
    const scrollTop = $('#content').scrollTop();

    _.each(this.props.comments, function(comment) {
      const commandViewOffset = this._commandViewOffsetMap &&
        this._commandViewOffsetMap[comment.get('commandNUID')];
      const commentGUID = comment.get('guid');

      if (!commandViewOffset) {
        this._commentReferenceTopMap[commentGUID] = null;
        return; // command view not exist
      }

      const reference = comment.get('commentReference');

      let lineOffset = null;
      if (reference.referenceType === 'commandFragment') {
        const commentOnLine = reference.referenceType && reference.range &&
          reference.range.from.line;
        const editor = comment.get('editor');
        lineOffset = editor && commentOnLine && editor.heightAtLine(commentOnLine);
      }

      let offsetTop = lineOffset ? lineOffset + scrollTop : commandViewOffset;
      // OffsetTop should always be larger than command view offset top, if it is smaller than
      // that it means the codemirror is actually hidden and the line offset returned from
      // codemirror will be very small
      if (offsetTop <= commandViewOffset) {
        offsetTop = commandViewOffset;
      }

      this._commentReferenceTopMap[commentGUID] = offsetTop - topbarHeight;
    }, this);
  },

  commentsComparator(c1, c2) {
    const nuid1 = c1.get('commandNUID'),
      nuid2 = c2.get('commandNUID');
    const ref1 = c1.get('commentReference'),
      ref2 = c2.get('commentReference');
    const type1 = ref1.referenceType,
      type2 = ref2.referenceType;
    const types = ['command', 'commandFragment', 'commandResults'];

    if (nuid1 !== nuid2) {
      return this._commandViewOffsetMap[nuid1] - this._commandViewOffsetMap[nuid2];
    }

    if (type1 !== type2) {
      return types.indexOf(type1) < types.indexOf(type2);
    }

    const compareRange = CodeMirrorUtils.compareRange(ref1.range, ref2.range);
    if (type1 === 'commandFragment' && compareRange !== 0) {
      return compareRange;
    }

    return c1.get('postedAt') - c2.get('postedAt');
  },

  lastActiveComment: -1,

  calculateDisplayPosition() {
    // filter out comments have invalid reference to command(command has been deleted)
    // then sort comments using comparator defined abrove
    const comments = _.filter(this.props.comments, function(comment) {
      return this._commentReferenceTopMap[comment.get('guid')];
    }, this).sort(this.commentsComparator);

    let i;
    let comment;
    let activeCommentIndex;
    const len = comments.length;

    // save last active comment guid, we use it to maintain the same layout when user lose
    // focus on current active comment
    if (this.state.activeCommentGUID !== -1) {
      this.lastActiveComment = this.state.activeCommentGUID;
    }

    for (i = 0; i < len; i++) {
      if (comments[i].get('guid') === this.lastActiveComment) {
        activeCommentIndex = i;
        break;
      }
    }

    // initially active comment is set to the first comment in the sorted list
    if (!activeCommentIndex) {
      activeCommentIndex = 0;
    }

    if (!comments[activeCommentIndex]) {
      return;
    }

    // position current active comment first to it's desired position, and then layout the reset
    // comments based on their desired position and adjacent comment's position
    const margin = 12;
    let curTopVal = 0;
    let referenceTop;
    let commentHeight;
    for (i = activeCommentIndex; i < len; i++) {
      comment = comments[i];
      commentHeight = this._commentViewHeightMap[comment.get('guid')];
      referenceTop = this._commentReferenceTopMap[comment.get('guid')];

      if (i !== activeCommentIndex && comment.top &&
          referenceTop >= comment.top &&
          comment.top - margin >= curTopVal) {
        curTopVal = comment.top + commentHeight;
        continue;
      }

      if (referenceTop - margin > curTopVal) {
        comment.top = referenceTop;
      } else {
        comment.top = curTopVal + margin;
      }
      curTopVal = comment.top + commentHeight;
    }

    curTopVal = comments[activeCommentIndex].top;
    for (i = activeCommentIndex - 1; i >= 0; i--) {
      comment = comments[i];
      commentHeight = this._commentViewHeightMap[comment.get('guid')];
      referenceTop = this._commentReferenceTopMap[comment.get('guid')];

      if (comment.top && comment.top >= referenceTop &&
          comment.top + commentHeight + margin <= curTopVal) {
        curTopVal = comment.top;
        continue;
      }

      if (referenceTop + commentHeight + margin > curTopVal) {
        comment.top = curTopVal - commentHeight - margin;
      } else {
        comment.top = referenceTop;
      }
      curTopVal = comment.top;
    }
  },

  deferForceUpdate(delay) {
    setTimeout(() => {
      if (this.isMounted()) {
        this.forceUpdate();
      }
    }, delay || 0);
  },

  // CommentsPanelView wants to re-render when child view height changes, this is to
  // prevent overlapping of comment views as they are 'position:absolute'
  onChildHeightWillUpdate() {
    this.deferForceUpdate();
  },

  render() {
    const commentsPanelClasses = {
      'comments-panel-wrapper': true,
      'hidden': !this.props.showCommentsPanel,
    };

    // collect layout information from browser before render, so this.calculatedisplayposition
    // can use the latest layout information to calculate display position
    this.collectPositioningInfo();
    // calculated offset top is stored in comments[i].top
    this.calculateDisplayPosition();

    const commentViews = _.map(this.props.comments, function(comment) {
      // if position is not calculated, rendered it at -1000(invisible), this is for getting
      // the CommentView display height for next render which correct the comment view position
      const offsetTop = comment.top || -100;

      const commentGUID = comment.get('guid');
      const styles = {
        position: 'absolute',
        top: offsetTop + 'px',
      };

      return (
        <CommentView
          key={commentGUID}
          ref={commentGUID}
          styles={styles}
          active={this.state.activeCommentGUID === commentGUID}
          setActiveComment={this.setActiveComment}
          comment={comment}
          userId={this.props.userId}
          onChildHeightWillUpdate={this.onChildHeightWillUpdate}
        />);
    }, this);

    const noCommentHint = commentViews.length > 0 ? null : (
      <div className='comment-wrapper no-comments-hint'>
        Select some code from the notebook to start commenting
      </div>);

    return (
      <div className={ClassNames(commentsPanelClasses)}>
        <div className='comments-panel'>
          {noCommentHint}
          {commentViews}
        </div>
      </div>);
  },
});

module.exports = CommentsPanelView;
