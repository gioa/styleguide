import React from 'react';

export function SideMenu(props) {
  const className = 'side-menu' + (props.addClass ? ' ' + props.addClass : '');
  return (
    <div className={className}>
      {props.children}
    </div>
  );
}

SideMenu.propTypes = {
  addClass: React.PropTypes.string,
  children: React.PropTypes.node,
};

export function SideMenuSection(props) {
  const className = 'side-menu-section' + (props.addClass ? ' ' + props.addClass : '');
  return (
    <div className={className}>
      {props.children}
    </div>
  );
}

SideMenuSection.propTypes = {
  addClass: React.PropTypes.string,
  children: React.PropTypes.node,
};
