/* eslint react/prefer-es6-class: 0 */

import React from 'react';

import FileBrowserView from '../filebrowser/FileBrowserView';

import SidebarPanelElement from './SidebarPanelElement.jsx';

const SidebarRecentPanel = React.createClass({

  propTypes: {
    fbView: React.PropTypes.instanceOf(FileBrowserView),
    recentRoutes: React.PropTypes.array.isRequired,
    pinned: React.PropTypes.bool.isRequired,
    toggleRecentPinned: React.PropTypes.func.isRequired,
    // object representing currently active view { id: id, type: type }
    currentView: React.PropTypes.object,
    depth: React.PropTypes.number,
  },

  getDefaultProps() {
    return {
      depth: 1,
    };
  },

  // (PROD-7710) Highlight the element if it's currently active
  shouldHighlightElement(elem) {
    if (!elem.type || !elem.uniqueId || !this.props.currentView) {
      return false;
    }
    return this.props.currentView.type === elem.type &&
      this.props.currentView.id.toString() === elem.uniqueId.toString();
  },

  render() {
    const recentItems = [];
    this.props.recentRoutes.forEach((recentRoute) => {
      const elem = this.props.fbView.entryFromViewRoute(recentRoute);
      if (elem) {
        recentItems.push(<SidebarPanelElement
          key={elem.name}
          display={undefined}
          domAttributes={elem.domAttributes}
          highlight={this.shouldHighlightElement(elem)}
          hasMenu={false}
          icon={elem.icon}
          isHomeFolder={elem.isHomeFolder}
          name={elem.name}
          url={elem.url}
          menuItems={[]}
        />);
      }
    }, this);

    return (
        <div className={'sidebar-panel filetree sidebar-panel-' + this.props.depth}>
          <div className='ft-panel ft-recents-panel' data-panel='Recent'>
            <div className='recent-panel-title'>
              Recent
            </div>
            <ul>
              {recentItems}
            </ul>
            <a className={'ft-pin-button' + (this.props.pinned ? ' active' : '')}
              title='Pin recent menu'
              onClick={this.props.toggleRecentPinned}
            >
              <i className='fa fa-thumb-tack'></i>
            </a>
          </div>
        </div>
    );
  },
});

module.exports = SidebarRecentPanel;
