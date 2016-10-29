import $ from 'jquery';
import _ from 'underscore';
import React from 'react';
import ReactDOM from 'react-dom';
import ClassNames from 'classnames';

const ESC = 27;

// ensure that the tooltip is at least this many px from the left margin and right margin
const MIN_LEFT_MARGIN = 10;
const MIN_RIGHT_MARGIN = 10;

/**
 * Show a tooltip below an element. Usage:
 *
 * <Tooltip text="foobar">
 *   Hello
 * </Tooltip>
 *
 * By default, the tooltip will appear on mouse hover.
 *
 * @NOTE: The tooltip should have a positioned ancestor that is closer than the closest scrollable
 * ancestor in the DOM, otherwise the tooltip position will be incorrect when the viewport is
 * scrolled. For example, it could be inside a <div> with style 'position: relative', but not
 * inside a <div> with 'position: static' or 'position: initial' if that div is inside a
 * scrollable element.
 */
export class Tooltip extends React.Component {

  /** @NOTE: Check with Reza before using this. He probably prefers getUpgradeElement below. */
  static getGenericUpgradeElement(desiredActionStr) {
    const upgradeLink = (
      <a href='https://databricks.com/product/pricing' target='_blank'>
        upgrade your Databricks subscription.
      </a>
    );
    return <span>{desiredActionStr}, please {upgradeLink}</span>;
  }

  /**
   * Use this as the tooltipText prop with disabled features with upsell messaging.
   * @param {string} featureName (should not contain trailing space)
   * @param {boolean} isPlural
   */
  static getUpgradeElement(featureName, isPlural) {
    const upgradeLink = (
      <a href='https://databricks.com/product/pricing' target='_blank' rel='noopener noreferrer'>
        Upgrade now
      </a>
    );
    const verb = isPlural ? ' are ' : ' is ';
    const message = featureName + verb + 'only available in Databricks Professional and ' +
      'Enterprise accounts. ';
    return <span>{message}{upgradeLink}</span>;
  }

  constructor(props) {
    super(props);

    this._onMouseLeave = this._onMouseLeave.bind(this);
    this._onMouseEnterElement = this._onMouseEnterElement.bind(this);

    this.tooltipStyle = {};
    this.state = {
      isHovered: false,
      tooltipActive: false,
      tooltipWidth: null,
    };
    this.pendingCallbacks = [];
  }

  componentDidMount() {
    // Remove the tooltip when ESC is pressed
    this.documentEscHandler = (event) => {
      if ((event.keyCode || event.which) === ESC && this.state.tooltipActive) {
        this.hideTooltip();
      }
    };
    $(document).on('keydown', this.documentEscHandler);

    // Remove the tooltip when click outside the tooltip
    this.clickHandler = (event) => {
      if ($(event.target).closest('.tooltip-react-content').length === 0) {
        this.hideTooltip();
      }
    };

    const clickElem = this.props.toggleOnOutsideClick ? document : ReactDOM.findDOMNode(this);
    $(clickElem).on('click', this.clickHandler);

    // If attachToBody is true, we attach the tooltip, but it is not visible yet
    if (this.props.attachToBody) {
      this.attachToBody();
    }
    this._recalculateTooltipWidth();
  }

  componentWillUnmount() {
    $(document).off('keydown', this.documentEscHandler);
    const clickElem = this.props.toggleOnOutsideClick ? document : ReactDOM.findDOMNode(this);
    $(clickElem).off('click', this.clickHandler);

    if (this.props.attachToBody && this.$tooltipNode[0]) {
      ReactDOM.unmountComponentAtNode(this.$tooltipNode[0]);
      $('.body-tooltip-wrapper').remove();
    }

    // isMounted is not available anymore, clear the timeouts!
    this.pendingCallbacks.forEach((cancel) => {
      clearTimeout(cancel);
    });
  }

  showTooltip() {
    if (!this.state.tooltipActive) {
      this.setState({ tooltipActive: true });
    }
  }

  hideTooltip() {
    if (this.state.tooltipActive) {
      this.setState({ tooltipActive: false });
    }

    if (this.props.attachToBody && !this.state.tooltipActive && this.$tooltipNode[0]) {
      ReactDOM.unmountComponentAtNode(this.$tooltipNode[0]);
    }
  }

  /* We have to get position here since the DOM node isn't available in the initial render */
  componentWillUpdate(nextProps, nextState) {
    if (this.props.attachToBody) {
      this.positionBodyTooltip();
      return;
    }

    this.positionInnerTooltip(nextProps, nextState);
  }

  positionInnerTooltip(nextProps, nextState) {
    // the position according to the screen
    const domNode = this.outer;
    if (!domNode) {
      console.error("Tooltip: positionInnerTooltip can't find it's DOM node.");
      return;
    }
    const absolutePosition = $(domNode).offset();
    const relativePosition = $(domNode).position();
    const height = $(domNode).outerHeight(true);
    const width = $(domNode).outerWidth(true);
    const midpoint = relativePosition.left + (width / 2);
    const rightOffshoot = (absolutePosition.left + nextState.tooltipWidth + MIN_RIGHT_MARGIN) -
      window.innerWidth;
    const makeWidth = nextState.tooltipWidth - (rightOffshoot * (rightOffshoot > 0));

    this.tooltipStyle = {
      // don't get too close to the edge of the window
      left: Math.max((midpoint - (nextState.tooltipWidth / 2)), MIN_LEFT_MARGIN),
      top: relativePosition.top + height,
      width: makeWidth,
    };
    this.arrowStyle = {
      // position arrow in the middle of the tooltip or middle of the element if tooltip is
      // against the left edge of the window
      left: (this.tooltipStyle.left > MIN_LEFT_MARGIN && rightOffshoot <= 0) ?
        nextState.tooltipWidth / 2 : midpoint,
    };

    // Move the tooltip & arrow over by a custom amount, if prop is specified
    if (this.props.customPosition) {
      if (this.props.customPosition.contentLeft) {
        this.tooltipStyle.left = this.props.customPosition.contentLeft;
      }
      if (this.props.customPosition.arrowLeft) {
        this.arrowStyle.left = this.props.customPosition.arrowLeft;
      }
      if (this.props.customPosition.contentTop) {
        this.tooltipStyle.top = this.props.customPosition.contentTop;
      }
      if (this.props.customPosition.arrowTop) {
        this.arrowStyle.top = this.props.customPosition.arrowTop;
      }
      if (this.props.customPosition.width) {
        this.tooltipStyle.width = this.props.customPosition.width;
      }
    }
  }

  renderTooltip() {
    // If attaching to body, we don't check if this.state.tooltipWidth is not null
    // because the width is only set when the tooltip is appended to the DOM.
    const classes = {
      'tooltip-react-content': true,
      'visible': this.state.tooltipActive &&
      (this.state.tooltipWidth !== null || this.props.attachToBody) &&
        !_.isEmpty(this.props.text),
    };
    _.each(this.props.classes, (cls) => {
      classes[cls] = true;
    });

    const innerRef = this.props.attachToBody ? null : 'inner';
    const noMinWidthClass = this.props.setMinWidth ? '' : ' tooltip-no-min-width';

    return (
      <div style={this.tooltipStyle} id={this.props.id} className={ClassNames(classes)}
        onMouseEnter={this.props.toggleOnHover ? this._onMouseEnterTooltip.bind(this) : null}
        onMouseLeave={this.props.toggleOnHover ? this._onMouseLeaveTooltip.bind(this) : null}
      >
        <div style={this.arrowStyle} className='tooltip-react-arrow'></div>
        <div className={'tooltip-react-inner' + noMinWidthClass} ref={innerRef}>
          {this.props.text}
        </div>
      </div>
    );
  }

  /** When we mouse over the tooltip, if it is already active, keep showing it */
  _onMouseEnterTooltip() {
    if (!this.state.tooltipActive) {
      return;
    }
    this.setState({ isHovered: true });
  }

  /** When we mouse out of the tooltip, if it is active, hide it */
  // We only need this when attachToBody is true because we are no longer
  // wrapping this in the parent div.tooltip-react-outer in render, which
  // handles mouse exit events for its children.
  _onMouseLeaveTooltip() {
    if (!this.state.tooltipActive || !this.props.attachToBody) {
      return;
    }
    this.setState({ isHovered: false });

    this.pendingCallbacks.push(_.delay(() => {
      if (this.state.tooltipActive) {
        this.hideTooltip();
      }
    }, 150));
  }

  /** When we mouse over the element above the tooltip, wait a bit, then show the tooltip */
  _onMouseEnterElement() {
    this.setState({ isHovered: true });
    this.pendingCallbacks.push(_.delay(() => {
      if (this.state.isHovered && !this.state.tooltipActive) {
        this.showTooltip();
      }
    }, this.props.hoverDelayMillis));
  }

  /** When we leave the the div around the element and the tooltip */
  _onMouseLeave() {
    this.setState({ isHovered: false });
    this.pendingCallbacks.push(_.delay(() => {
      if (!this.state.isHovered && this.state.tooltipActive) {
        this.hideTooltip();
      }
    }, 150));
  }

  attachToBody() {
    // If the tooltip already exists, don't recreate it.
    if (this.$tooltipNode) { return; }

    // We will reference this.$tooltipNode whenever managing this particular tooltip.
    const tooltipNodeId = Math.random().toString(36).substring(7);
    const tooltipWrapperElement = $('<div class="body-tooltip-wrapper" id=' +
      tooltipNodeId + '></div>');
    this.$tooltipNode = tooltipWrapperElement.appendTo('body');
    ReactDOM.render(this.renderTooltip(), this.$tooltipNode[0]);
  }

  render() {
    // A width is needed for tooltip-react-outer in order to trigger the mouse leave event
    const classes = {
      'tooltip-react-outer': true,
      'body-tooltip-outer': this.props.attachToBody,
      'inline-auto-position': this.props.inlineAutoPosition,
    };
    const refFunc = (ref) => this.outer = ref;

    return (
      <div
        ref={refFunc}
        className={ClassNames(classes)}
        onMouseLeave={this.props.toggleOnHover ? this._onMouseLeave : null}
      >
        <div className='tooltip-react-element'
          onMouseEnter={this.props.toggleOnHover ? this._onMouseEnterElement : null}
        >
          {this.props.children}
        </div>
        {this.props.attachToBody ? null : this.renderTooltip()}
      </div>
    );
  }

  componentDidUpdate() {
    this._recalculateTooltipWidth();
    if (this.props.attachToBody && this.$tooltipNode[0]) {
      ReactDOM.unmountComponentAtNode(this.$tooltipNode[0]);
      ReactDOM.render(this.renderTooltip(), this.$tooltipNode[0]);
    }
  }

  _recalculateTooltipWidth() {
    // update the tooltip again if the rendered width of the tooltip changed, so that it
    // is properly centered below the element (we can't estimate its width without
    // rendering it to the DOM)
    let tooltipWidth;
    if (this.props.attachToBody) {
      tooltipWidth = this.$tooltipNode.find('.tooltip-react-inner').outerWidth(true);
    } else {
      tooltipWidth = $(this.refs.inner).outerWidth(true);
    }
    if (this.state.tooltipWidth !== tooltipWidth) {
      this.setState({ tooltipWidth: tooltipWidth });
    }
  }

  positionBodyTooltip() {
    // positioning calculations are different if attaching to body
    // TODO(lauren) set minimum margins near the document margins as in componentWillUpdate
    const absPosition = $(this.outer).offset();
    const tooltipElemWidth = this.$tooltipNode.find('.tooltip-react-inner').outerWidth(true);
    const outerDivWidth = $(this.outer).outerWidth(true);
    const outerDivHeight = $(this.outer).outerHeight(true);
    const arrowHeight = this.$tooltipNode.find('.tooltip-react-arrow').outerHeight(true);

    this.tooltipStyle = {
      left: ((absPosition.left - (tooltipElemWidth / 2)) + (outerDivWidth / 2)),
      top: (absPosition.top + (outerDivHeight / 2) + arrowHeight),
    };

    this.arrowStyle = {
      left: tooltipElemWidth / 2,
    };
  }
}

Tooltip.propTypes = {
  children: React.PropTypes.node,
  // contents of the tooltip when it is shown.
  text: React.PropTypes.node,
  // show the tooltip on hover and hide on mouse leave (default = true)
  toggleOnHover: React.PropTypes.bool,
  // how long to wait on hover before showing the tooltip
  hoverDelayMillis: React.PropTypes.number,
  // toggle the tooltip if the user clicks outside the enclosed element(s) (default = true)
  toggleOnOutsideClick: React.PropTypes.bool,
  // extra classes to apply to the tooltip box
  classes: React.PropTypes.array,
  // id property of the tooltip div
  id: React.PropTypes.string,
  // whether or not to attach to body instead of wrapped around the triggering element
  attachToBody: React.PropTypes.bool,
  // an object specifying the positioning (in px) of the .tooltip-react-content
  // and tooltip-react-arrow divs, if customing positioning is needed,
  // e.g. {contentLeft: 25px, arrowLeft: 55px}. You can also optionally specify the
  // contentTop and arrowTop positions.
  customPosition: React.PropTypes.object,
  // if the tooltip target(props.children) has 'display: inline/inline-block', set this option to
  // true to automatically position the tooltip, this option will override props.customPosition and
  // currently only works with default width(260px) tooltip
  inlineAutoPosition: React.PropTypes.bool,
  // @WARNING
  // DO NOT DO THIS HACK AGAIN!!!!!
  // We need it because jQuery depends on min width for calculating the width of tooltips, but some
  // tooltips are smaller than the min width of 180px and so to be rendered properly they should
  // have no min width set. See PROD-12291
  // A boolean that can be set to false for tooltips that are smaller than the standard tooltip
  // min width.
  setMinWidth: React.PropTypes.bool,
};

Tooltip.defaultProps = {
  text: '',
  toggleOnHover: true,
  hoverDelayMillis: 300,
  toggleOnOutsideClick: true,
  classes: [],
  id: null,
  attachToBody: false,
  customPosition: {},
  inlineAutoPosition: false,
  setMinWidth: true,
};
