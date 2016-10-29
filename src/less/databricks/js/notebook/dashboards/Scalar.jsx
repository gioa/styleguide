/* eslint react/prefer-es6-class: 0 */

import React from 'react';

import DashboardViewConstants from '../../notebook/dashboards/DashboardViewConstants';

/**
 * A wrapper around CommandResult components, used inside DashboardElementView,
 * that scales commands in size when user clicks on +/- buttons. Note that the
 * width of children elements may need to be adjusted to handle overflow properly.
 */

const Scalar = React.createClass({
  propTypes: {
    children: React.PropTypes.node,
    scale: React.PropTypes.number,
  },

  getDefaultProps() {
    return { scale: 1 };
  },

  _getStyle() {
    const scale = this.props.scale;
    return {
      transform: 'scale(' + Math.pow(DashboardViewConstants.SCALAR_BASE, scale) + ')',
      'transformOrigin': 'left top',
    };
  },

  render() {
    return <div className='scalar' style={this._getStyle()}>{this.props.children}</div>;
  },
});

module.exports = Scalar;
