/* eslint react/prefer-es6-class: 0 */

import $ from 'jquery';
import React from 'react';
import ReactDOM from 'react-dom';
import ClassNames from 'classnames';

const SidebarPanelElement = React.createClass({
  propTypes: {
    display: React.PropTypes.string,
    domAttributes: React.PropTypes.object,
    hasMenu: React.PropTypes.bool,
    highlight: React.PropTypes.bool,
    icon: React.PropTypes.string.isRequired,
    isHomeFolder: React.PropTypes.bool.isRequired,
    name: React.PropTypes.string.isRequired,
    url: React.PropTypes.string.isRequired,
    onMenuClicked: React.PropTypes.func,
    nameHTML: React.PropTypes.element,
    selected: React.PropTypes.bool,
  },

  getDefaultProps() {
    return {
      domAttributes: {},
      hasMenu: false,
      highlight: false,
      isHomeFolder: false,
      onMenuClicked() {},
    };
  },

  getMenuOffset() {
    return $(ReactDOM.findDOMNode(this.refs.menu)).offset();
  },

  render() {
    const liClasses = {
      'highlight-recent': this.props.highlight,
      'home-folder': this.props.isHomeFolder,
      'top-link': this.props.display === 'top-link',
      'heading': this.props.display === 'heading',
      'selected': this.props.selected,
      'sidebar-panel-element': true,
    };

    const icon = this.props.icon || 'file-alt';

    const clusterReady = ('data-cluster-ready' in this.props.domAttributes) ?
        this.props.domAttributes['data-cluster-ready'] : null;

    const cacheState = ('data-cache-state' in this.props.domAttributes) ?
        this.props.domAttributes['data-cache-state'] : null;

    return (
        <li key={this.props.url} className={ClassNames(liClasses)}>
          <a href={this.props.url}
            data-name={this.props.name}
            className={"sidebar-panel-link"}
            title={this.props.name}
          >
            <i className={'fa fa-fw fa-' + icon}
              data-cache-state={cacheState}
              data-cluster-ready={clusterReady}
            />
            <span>{this.props.nameHTML ? this.props.nameHTML : this.props.name}</span>
          </a>
          {this.props.hasMenu ?
            <div className={'dropdown sidebar-dropdown sidebar-dropdown-' + this.props.name}
              onClick={this.props.onMenuClicked}
              ref='menu'
            >
              <i className='fa fa-caret-down' />
            </div> : null}
        </li>);
  },
});

module.exports = SidebarPanelElement;
