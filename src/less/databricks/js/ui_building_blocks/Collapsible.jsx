import React from 'react';

/**
 * Create a component that is collapsible. The header will get a toggle arrow to
 * the left of it that can be used to show/hide the child component. For example
 * usage, see user_menu/IamRoleDeleteDialogView.jsx.
 */
export class Collapsible extends React.Component {
  constructor(props) {
    super(props);

    this.getIcon = this.getIcon.bind(this);
    this.toggle = this.toggle.bind(this);
    this.renderSpacedChildren = this.renderSpacedChildren.bind(this);

    this.state = {
      collapsed: props.collapseByDefault,
    };
  }

  getIcon() {
    const icon = this.state.collapsed ?
      (<i className='fa fa-caret-right' />) : (<i className='fa fa-caret-down' />);
    return (
      <div className='icon-width-expander'>
        <center>
          {icon}
        </center>
      </div>
    );
  }

  toggle() {
    this.setState({
      collapsed: !this.state.collapsed,
    });
  }

  renderSpacedChildren() {
    return (
      <div className='collapsible-children'>
        {this.props.children}
      </div>
    );
  }

  render() {
    return (
      <div className='collapsible-region'>
        <div
          onClick={this.toggle}
          className='collapsible-header'
        >
          {this.getIcon()}
          {this.props.title}
        </div>
        {this.state.collapsed ? null : this.renderSpacedChildren()}
      </div>
    );
  }
}

Collapsible.propTypes = {
  title: React.PropTypes.node.isRequired,
  children: React.PropTypes.element.isRequired,
  collapseByDefault: React.PropTypes.bool,
};

Collapsible.defaultProps = {
  collapseByDefault: false,
};
