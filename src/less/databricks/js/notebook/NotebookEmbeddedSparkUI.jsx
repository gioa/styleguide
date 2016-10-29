/* eslint react/prefer-es6-class: 0, react/no-is-mounted: 0, consistent-return: 0, func-names: 0 */

import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';
import React from 'react';
import ReactDOM from 'react-dom';

const ID = 'notebook-embedded-spark-ui';

const EmbeddedSparkUI = React.createClass({

  propTypes: {
    onHide: React.PropTypes.func,
    onShow: React.PropTypes.func,
  },

  getInitialState() {
    return {
      hidden: true,
      url: '',
    };
  },

  componentDidMount() {
    const self = this;

    this.clickHandler = function(event) {
      const clickOutSide = $(event.target).closest('#' + ID).length !== 0;
      const clickOnLink = $(event.target).closest('.spark-ui-link').length !== 0;
      if (clickOutSide || clickOnLink) {
        return;
      }
      self.hide();
    };
    $(document).click(this.clickHandler);
  },

  refresh() {
    if (!this.isMounted()) {
      return;
    }
    const iframe = this.refs.iframe;
    iframe.src = iframe.contentWindow.location.href;
  },

  hide() {
    if (!this.isMounted()) {
      return;
    }
    this.setState({ hidden: true });
    if (this.props.onHide) {
      this.props.onHide();
    }
    $('.spark-ui-link').blur();
    this.events.trigger('onHide');
  },

  showOrHide(url) {
    if (!this.isMounted()) {
      return;
    }
    const iframe = this.refs.iframe;
    if (!this.state.hidden &&
        iframe &&
        iframe.contentWindow.location.href.indexOf(url) >= 0) {
      this.hide();
    } else {
      this.show(url);
    }
  },

  show(url) {
    if (!this.isMounted()) {
      return;
    }
    this.setState({
      hidden: false,
      url: url,
    });
    if (this.props.onShow) {
      this.props.onShow();
    }
    this.events.trigger('onShow');
  },

  currentUrl() {
    if (!this.isMounted()) {
      return;
    }
    const iframe = this.refs.iframe;
    return iframe.contentWindow.location.href;
  },

  events: _.extend({}, Backbone.Events),

  onLoad() {
    this.events.trigger('onLoad');
  },

  addOnloadCallback(cb) {
    this.onloadCallbacks.push(cb);
  },

  removeOnloadCallback(cb) {
    this.onloadCallbacks = _.without(this.onloadCallbacks, cb);
  },

  render() {
    if (this.state.hidden || _.isEmpty(this.state.url)) {
      return null;
    }

    return (
      <div className='wrapper'>
        <div className='controls'>
          <a onClick={this.refresh}><i className='fa fa-fw fa-refresh fa-lg'></i></a>
          <a onClick={this.hide}><i className='fa fa-fw fa-times fa-lg'></i></a>
        </div>
        <iframe
          id='sparkui-iframe'
          ref='iframe'
          src={this.state.url}
          frameBorder='0'
          onLoad={this.onLoad}
        />
      </div>
    );
  },
});

let $el;
let instance;

exports.init = function() {
  if (!$el) {
    $('body').append($("<div id='" + ID + "'></div>"));
    $el = $('#' + ID);
    instance = ReactDOM.render(
      <EmbeddedSparkUI
        onHide={function() { $el.hide(); }}
        onShow={function() { $el.show(); }}
      />, $el[0]);
  }
};

exports.show = function(url) {
  return instance && instance.show(url);
};

// hide the spark ui if given url is the current url, otherwise show the given url
exports.showOrHide = function(url) {
  return instance && instance.showOrHide(url);
};

exports.hide = function() {
  return instance && instance.hide();
};

exports.events = function() {
  return instance && instance.events;
};
