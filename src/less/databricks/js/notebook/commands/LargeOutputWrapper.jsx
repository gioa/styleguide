/* eslint react/prefer-es6-class: 0, react/no-is-mounted: 0 */

import $ from 'jquery';
import _ from 'underscore';
import React from 'react';

import '../../../lib/jquery-ui-bundle'; // jquery-ui

/*
 * This is a wrapper component we put around large text output in notebooks, we used
 * it for command results of html type, and for error output.
 *
 * Main features include:
 * 1) Only show wrapper if the text output is large (compare to window height);
 * 2) Only allow child scroll after clicking on it;
 * 3) Allow to resize the output area;
 * 4) Blur focus on mouse leave or ESC key pressed;
 * 5) Lock parent scroll when child in focus;
 *
 * The wrapper should have only one subnode as child node
 */

const LargeOutputWrapper = React.createClass({

  propTypes: {
    // use for locking parent scroll when child in focus
    lockParentScrollEnabled: React.PropTypes.bool,
    scrollableParentSelector: React.PropTypes.string,

    // when resizeEnabled prop is set to false, the wrapper will disable resize and
    // always auto resize itself to fit its parent
    resizeEnabled: React.PropTypes.bool,
    defaultWrapperHeight: React.PropTypes.number,
    minWrapperHeight: React.PropTypes.number,
    enabled: React.PropTypes.bool,
    children: React.PropTypes.node,
  },

  getDefaultProps() {
    return {
      // Default props for locking scrollable parent element, this it to prevent the
      // browser continue to scroll the page when inside this wrapper, the scrolling
      // hits its bottom. You have to define .lock-scoll css class in the parent:
      //
      //  .scrallable-parent-selector {
      //    &.lock-scroll {
      //      overflow: hidden;
      //    }
      //  }
      lockParentScrollEnabled: true,
      scrollableParentSelector: '#content',
      enabled: true,
      // Resizing options
      resizeEnabled: true,
      defaultWrapperHeight: 400,
      minWrapperHeight: 100,
    };
  },

  getInitialState() {
    return {
      // when showWrapper is ture, we will add a wrapper to the children content
      // and make it resizable and scrollable
      showWrapper: false,

      // only allow scrolling inside the wrapper when it is focused
      childFocused: false,
    };
  },

  componentDidMount() {
    if (this.props.enabled) {
      this.checkSizeAndSetWrapper();

      // Reset wrapper width after user resize the browser window
      $(window).on('resize', this.checkSizeAndSetWrapper);
    }
  },

  componentDidUpdate() {
    if (this.props.enabled) {
      this.checkSizeAndSetWrapper();
    } else {
      $(window).off('resize', this.checkSizeAndSetWrapper);
    }
  },

  componentWillUnmount() {
    $(window).off('resize', this.checkSizeAndSetWrapper);
  },

  getParentHeight() {
    return $(this.props.scrollableParentSelector).height();
  },

  getChildHeight() {
    return $(this.refs.child).height();
  },

  // check the actual display size of the text content, based on which to set the
  // showWrapper state,
  checkSizeAndSetWrapper() {
    if (!this.props.enabled || !this.isMounted()) {
      return;
    }
    const parentHeight = this.getParentHeight();
    const childHeight = this.getChildHeight();

    if (childHeight < parentHeight * 0.8 && this.state.showWrapper) {
      this.setState({ showWrapper: false });
    }

    // check if the height of child is too large that need this wrapper
    if (childHeight > parentHeight * 0.8 && !this.state.showWrapper) {
      this.setState({ showWrapper: true });
    }

    if (this.state.showWrapper) {
      this.setWrapper();
    }
  },

  setWrapper() {
    if (!this.state.showWrapper) {
      return;
    }

    const resizableWrapper = $(this.refs.resizableWrapper);
    const childHeight = $(this.refs.child).height();
    const parentHeight = $(this.props.scrollableParentSelector).height();

    if (this.props.resizeEnabled) {
      const wrapper = $(this);
      const contentWidth = wrapper.parent().width();

      resizableWrapper.width(contentWidth);
      resizableWrapper.resizable({
        handles: 'se',

        minHeight: this.props.minWrapperHeight,
        maxHeight: _.min([childHeight, parentHeight * 0.8]),

        // TODO(Chaoyu), this made the wrapper fixed width, replace it with configurable
        // props if we need to allow horrizental resizing later
        minWidth: contentWidth,
        maxWidth: contentWidth,
      });
    }
  },

  getChildWithRef() {
    // Throws if there are multiple children node
    const child = React.Children.only(this.props.children);

    return React.cloneElement(child, {
      ref: 'child', // add ref to children node
    });
  },

  onFocus() {
    this.setState({ childFocused: true });
  },

  onBlur() {
    this.setState({ childFocused: false });
  },

  // Blur the focus on mouse leave
  onMouseLeave() {
    $(this.refs.noscrollWrapper).blur();
    this.setState({ childFocused: false });
  },

  // Blur the focus on pressing ESC key
  onKeyUp(e) {
    if (e.which === 27) {
      $(this.refs.noscrollWrapper).blur();
      this.setState({ childFocused: false });
    }
  },

  render() {
    const child = this.getChildWithRef();
    const shouldLockParentScroll = this.state.childFocused && this.props.lockParentScrollEnabled;

    if (this.state.showWrapper) {
      if (shouldLockParentScroll) {
        $(this.props.scrollableParentSelector).addClass('lock-scroll');
      } else {
        $(this.props.scrollableParentSelector).removeClass('lock-scroll');
      }

      return (
        <div ref='resizableWrapper'
          className='resizable-wrapper'
          style={{ height: this.props.defaultWrapperHeight }}
          onKeyUp={this.onKeyUp}
          onMouseLeave={this.onMouseLeave}
        >
          <div ref='noscrollWrapper'
            className={'noscroll-wrapper' + (this.state.childFocused ? '' : ' noscroll')}
            tabIndex='-1'
            onFocus={this.onFocus}
            onBlur={this.onBlur}
          >
            <div className='inner'>
              { [child] }
            </div>
          </div>
        </div>);
    }
    return child;
  },
});

module.exports = LargeOutputWrapper;
