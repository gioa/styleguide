/* eslint react/prefer-es6-class: 0 */

import $ from 'jquery';
import React from 'react';

const SparkUIContextBar = React.createClass({
  propTypes: {
    hostUrl: React.PropTypes.string.isRequired,
  },

  isHistoryServer() {
    return this.props.hostUrl === 'HISTORY_SERVER';
  },

  componentDidMount() {
    $('iframe').on('load', function onLoad() {
      const sparkVersion = $('iframe').contents().find('.version').text();
      if (sparkVersion.length > 1) {
        // PROD-12432: Space before Spark Version improves Chrome highlighting behavior.
        $('.spark-version-placeholder').text(' Spark Version: ' + sparkVersion);
      }
    });
  },

  componentWillUnmount() {
    $('iframe').off('load');
  },

  render() {
    $('#topbar .tb-title').text(this.isHistoryServer() ? 'Spark UI (Historical)' : 'Spark UI');
    if (this.isHistoryServer()) {
      return <span className='context-bar-item'></span>;
    }
    return (
      <div>
        <span className='context-bar-item'>
          Hostname: {this.props.hostUrl}
        </span>
        <span className='spark-version-placeholder context-bar-item'></span>
      </div>
    );
  },
});

module.exports = SparkUIContextBar;
