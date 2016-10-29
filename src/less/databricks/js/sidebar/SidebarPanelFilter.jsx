import _ from 'lodash';
import React, { Component, PropTypes } from 'react';

export class SidebarPanelFilter extends Component {
  constructor(props) {
    super(props);

    this.onChange = _.throttle(this.onChange.bind(this), this.props.throttleWait);
  }

  onChange() {
    this.props.onFilterChange(this.input.value);
  }

  render() {
    return (
      <li key='filter' className='sidebar-panel-element sidebar-panel-filter'>
        <i className={'fa fa-fw fa-search'} />
        <input
          ref={(ref) => this.input = ref}
          placeholder={this.props.placeholder}
          onChange={this.onChange}
        />
      </li>);
  }
}

SidebarPanelFilter.propTypes = {
  onFilterChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  throttleWait: PropTypes.number,
};

SidebarPanelFilter.defaultProps = {
  throttleWait: 100,
  placeholder: '',
};
