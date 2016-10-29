/* eslint react/prefer-es6-class: 0, react/no-is-mounted: 0 */

import _ from 'underscore';
import React from 'react';
import ClassNames from 'classnames';

import { Tooltip } from '../../ui_building_blocks/Tooltip.jsx';

/**
 * Make a react element highlight-able with a similar effect to jQuery UI .effect("highlight").
 * Usage:
 *
 * <Highlight ref="myElem">
 *   ...
 * </Highlight>
 *
 * // somewhere else in the code:
 * // highlight the element inside the Highlight block by pulsing it for 2 seconds
 * this.refs["myElem"].highlight()
 *
 * // highlight the element and show a tooltip below it:
 * this.refs["myElem"].highlight({tooltip: "a tooltip that will appear below the element" })
 */
const Highlight = React.createClass({
  // all of these props can be overridden in the options to highlight()
  // the props will also be passed to the enclosing tooltip, so you can pass any tooltip props
  propTypes: {
    // the tooltip to show when the element is highlighted (default: none)
    tooltip: React.PropTypes.node,
    // whether to wrap the element in a tooltip (default: true)
    withTooltip: React.PropTypes.bool,
    // whether the element should animate when highlighted (default: true)
    animate: React.PropTypes.bool,
    // if animating, use a smaller animate frame (default: false)
    smallAnimate: React.PropTypes.bool,
    // whether the tooltip should be hidden when the highlight is over (default: false)
    autoHideTooltip: React.PropTypes.bool,
    // the time the highlight will last in milliseconds (default: 2000)
    duration: React.PropTypes.number,
    children: React.PropTypes.node,
  },

  getDefaultProps() {
    // props are default options to highlight()
    return {
      animate: true,
      smallAnimate: false,
      tooltip: '',
      withTooltip: true,
      autoHideTooltip: false,
      duration: 2000,
    };
  },

  getInitialState() {
    // state is the actual state of the current highlight()
    return {
      highlightTimer: null,
    };
  },

  componentWillUnmount() {
    this.clearHighlight();
  },

  clearHighlight() {
    if (this.state.highlightTimer && this.state.highlightTimer !== 'forever') {
      clearTimeout(this.state.highlightTimer);
    }
  },

  /**
   * Trigger highlighting of an item with the given id.
   *
   * @param options {object} Available options that override the defaults in props:
   *   duration - how long to highlight the item in milliseconds. -1 means forever until
   *     unhighlight is called explicitly.
   *   tooltip - show a tooltip on the highlighted item, which by default will remain
   *     until the user clicks somewhere outside the tooltip or presses ESC.
   *   animate - add the .highlight-activate class to the highlighted element, which causes it
   *     to animate for the duration of the highlight.
   *   autoHideTooltip - hide the tooltip when the highlight is finished.
   *   classes - array of additional classes to add to the highlighted element.
   */
  highlight(options) {
    if (!this.isMounted()) {
      return;
    }

    options = options !== undefined ? options : {};
    const tooltipText = options.tooltip !== undefined ? options.tooltip : this.props.tooltip;
    const time = options.duration !== undefined ? options.duration : this.props.duration;
    const animate = options.animate !== undefined ? options.animate : this.props.animate;
    const autoHideTooltip = options.autoHideTooltip !== undefined ?
      options.autoHideTooltip : this.props.autoHideTooltip;
    const classes = options.classes;

    this.clearHighlight();

    let timer;
    if (time > 0) {
      timer = setTimeout(this.unhighlight, time);
    } else {
      timer = 'forever';
    }
    this.setState({
      highlightTimer: timer,
      tooltip: tooltipText,
      animate: animate,
      autoHideTooltip: autoHideTooltip,
      classes: classes,
    });
    if (tooltipText) {
      this.refs.tooltip.showTooltip();
    }
  },

  /** Unhighlight this element with the given id if it is still highlighted */
  unhighlight(hideTooltip) {
    if (!this.isMounted()) {
      return;
    }

    if (this.isHighlighted()) {
      this.clearHighlight();

      this.setState({ highlightTimer: null });
      if (hideTooltip || this.state.autoHideTooltip) {
        this.refs.tooltip.hideTooltip();
      }
    }
  },

  isHighlighted() {
    return this.state.highlightTimer !== null;
  },

  render() {
    let classes;
    if (this.isHighlighted()) {
      classes = {
        'highlight-active': true,
        'highlight-animation': this.state.animate,
        'small-frame': this.props.smallAnimate,
      };
      _.each(this.state.classes, (cls) => {
        classes[cls] = true;
      });
    } else {
      classes = {
        'highlight-inactive': true,
      };
    }

    const innerDiv = <div className={ClassNames(classes)}>{this.props.children}</div>;

    if (!this.props.withTooltip) {
      return innerDiv;
    }

    return (
      <Tooltip ref='tooltip'
        toggleOnHover={false}
        {...this.props}
        text={this.state.tooltip}
      >
        {innerDiv}
      </Tooltip>
    );
  },
});

module.exports = Highlight;
