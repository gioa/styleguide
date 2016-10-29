/* eslint react/prefer-es6-class: 0, consistent-return: 0 */

import React from 'react';
import _ from 'underscore';
import ClassNames from 'classnames';

import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

/*
 * Usage:
 *  <Tabs activeTab="Settings">
 *    <Panel title='Tab One' name="tab-one">
 *      Content
 *    </Panel>
 *    <Panel title='Tab Two' name="tab-two">
 *      <div>Content</div>
 *    </Panel>
 *  </Tabs>
 *
 *
 * Tab props:
 * activeTab (string): which tab is initially active
 * linkClass (string): extra class to apply to <a> tag
 * onTabClick (function): optional function to run on tab click. usually used for saving tab state
 *
 * Panel props:
 * title (required, React element): title of tab. Can be a React element (i.e., dropdown menu)
 * name (required, string): name of tab, more semantic than activeTabIndex
 * href (string): href for tab if you want it to have a dedicated link
 *                TabsView doesn't take care of anything for you in terms of rendering that link
 *                You have to have a rendered view in the router
 *                TabsView also doesn't take care of extending the current link, it just uses what's
 *                  passed in
 * disabled (boolean): whether the tab is greyed out or not
 * tooltipText (string): tooltip text to display with disabled tab
 */
const Tabs = React.createClass({
  propTypes: {
    activeTab: React.PropTypes.string,
    linkClass: React.PropTypes.string,
    onTabClick: React.PropTypes.func,
    children: React.PropTypes.node,
  },

  getInitialState() {
    const firstChild = this.props.children.find(
      (child) => (child !== null || child !== undefined) && !child.props.disabled
    );
    return {
      activeTab: this.props.activeTab || firstChild.props.name,
    };
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.activeTab) {
      this.setState({ activeTab: nextProps.activeTab });
    }
  },

  _onClick(panel, e) {
    if (panel.props.onClick) {
      panel.props.onClick();
    }
    if (panel.props.href) {
      return;
    }
    this._setActiveTab(panel.props.name, e);
  },

  _setActiveTab(activeTab, e) {
    e.preventDefault();
    if (this.props.onTabClick) {
      this.props.onTabClick(activeTab);
    }
    this.setState({ activeTab: activeTab });
  },

  _initializeChildren() {
    if (!this.props.children || this.props.children.length === 0) {
      console.error('TabsView must contain at least one Panel');
    }
  },

  _renderNav() {
    const navItems = _.map(this.props.children, (panel, index) => {
      if (!panel) {
        return;
      }

      const ref = 'tab-nav-' + index;
      const active = this.state.activeTab === panel.props.name;
      const classes = {
        'tab-nav-item': true,
        'active': active,
      };
      const linkClass = this.props.linkClass ? this.props.linkClass : '';

      if (panel.props.disabled) {
        const link = <a disabled className={`disabled-tab ${linkClass}`}>{panel.props.title}</a>;
        return (
          <li
            key={ref}
            ref={ref}
            className={ClassNames(classes)}
            data-tab-name={panel.props.title}
          >

            {panel.props.tooltipText ?
              <Tooltip text={panel.props.tooltipText}>{link}</Tooltip> : link}
          </li>
        );
      }
      const panelClick = this._onClick.bind(this, panel);
      return (
        <li
          key={ref}
          ref={ref}
          className={ClassNames(classes)}
          data-tab-name={panel.props.title}
          onClick={panelClick}
        >
          <a href={panel.props.href ? panel.props.href : '#'} className={linkClass}>
            {panel.props.title}
          </a>
        </li>
      );
    }, this);

    return (<ul className='nav nav-tabs'>{navItems}</ul>);
  },

  _renderActivePanel() {
    const panel = this.props.children.find(
      (somePanel) => somePanel && somePanel.props.name === this.state.activeTab
    );
    return <div className='active-panel'>{panel}</div>;
  },

  render() {
    this._initializeChildren();

    return (<div className='react-tab-view'>
      {this._renderNav()}
      {this._renderActivePanel()}
    </div>);
  },
});

const Panel = (props) => <div className='react-tabs-panel'>{props.children}</div>;

Panel.propTypes = {
  title: React.PropTypes.node.isRequired,
  name: React.PropTypes.string.isRequired,
  href: React.PropTypes.string,
  disabled: React.PropTypes.bool,
  tooltipText: React.PropTypes.oneOfType([
    React.PropTypes.element,
    React.PropTypes.string,
    React.PropTypes.bool,
  ]),
  onClick: React.PropTypes.func,
  children: React.PropTypes.node,
};

module.exports.Tabs = Tabs;
module.exports.Panel = Panel;
