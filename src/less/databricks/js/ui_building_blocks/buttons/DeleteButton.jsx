import React from 'react';

export function DeleteButton({ onClick, disabled }) {
  return (
    <button
      className='btn btn-default'
      disabled={disabled}
      onClick={onClick}
    >
      <i className='fa fa-times'></i>
      {' '}
      Delete
    </button>
  );
}

DeleteButton.propTypes = {
  onClick: React.PropTypes.func.isRequired,
  disabled: React.PropTypes.bool,
};

DeleteButton.defaultProps = {
  disabled: false,
};
