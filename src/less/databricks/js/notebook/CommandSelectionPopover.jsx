/* eslint react/prefer-es6-class: 0 */

import $ from 'jquery';
import React from 'react';
import ClassNames from 'classnames';

import CodeMirrorUtils from '../notebook/CodeMirrorUtils';

const CommandSelectionPopover = React.createClass({

  propTypes: {
    createComment: React.PropTypes.func.isRequired,
  },

  getInitialState() {
    return {
      popoverActive: false,
      top: 0,
      left: 0,
    };
  },

  componentDidMount() {
    const self = this;
    // remove the popover when user start typing
    this.documentKeydownHandler = function documentKeydownHandler(e) {
      const keyCode = e.keyCode;

      // control-a or command-a(mac)
      const isSelectingAll = keyCode === 65 && (e.metaKey || e.ctrlKey);

      // shfit-arrowKey
      const isSelecting = e.shiftKey && (keyCode === 37 || // left arrow
                                       keyCode === 38 || // up arrow
                                       keyCode === 39 || // right arrow
                                       keyCode === 40);  // down arrow

      if (isSelecting || isSelectingAll) {
        return;
      }

      if (self.state.popoverActive) {
        self.hidePopover();
      }
    };
    $(document).keydown(this.documentKeydownHandler);
    // remove the popover when click outside
    this.clickHandler = function clickHandler() {
      if (self.state.popoverActive) {
        self.hidePopover();
      }
    };
    $(document).mousedown(this.clickHandler);
  },

  componentWillUnmount() {
    $(document).off('keydown', document, this.documentEscHandler);
    $(document).off('click', document, this.clickHandler);
  },

  hidePopover() {
    this.setState({ popoverActive: false });
  },

  showPopover(cm) {
    const from = cm.getCursor('from');
    const to = cm.getCursor('to');
    const selectionEnd = CodeMirrorUtils.comparePos(from, to) >= 0 ? from : to;
    const cursorCoords = cm.cursorCoords(selectionEnd);
    const scrollTop = $('#content').scrollTop() - 74;

    const cursorLength = cursorCoords.bottom - cursorCoords.top;
    const top = cursorCoords.top - (cursorLength * 0.5) + scrollTop;
    const left = $('.command-active').width() - 15;

    this.setState({
      popoverActive: true,
      top: top,
      left: left,
    });
  },

  render() {
    const positionStyles = {
      top: this.state.top + 'px',
      left: this.state.left + 'px',
    };

    const classes = {
      'hidden': !this.state.popoverActive,
      'add-comment': true,
    };

    return (
      <div id='selection-popover' style={positionStyles}
        className={ClassNames(classes)}
      >
        <a className='btn btn-default btn-circle'
          onMouseDown={this.props.createComment}
        >
          <i className='fa fa-comment-o fa-fw fa-stack' />
        </a>
      </div>);
  },
});

module.exports = CommandSelectionPopover;
