import React from 'react';

import { Input } from '../../forms/ReactFormElements.jsx';

export class FilterInput extends React.Component {
  render() {
    return (
      <div className='filter-input'>
        <i className='fa fa-search fa-fw'></i>
        <Input
          ref='input'
          placeholder='Filter'
          onChange={this.props.onChange}
        />
      </div>
    );
  }
}

FilterInput.propTypes = {
  onChange: React.PropTypes.func.isRequired,
};
