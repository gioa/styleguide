import React from 'react';

export function SuccessMessage({ message }) {
  return (
    <div className='alert-message success-alert-message'>
      {message}
    </div>
  );
}

SuccessMessage.propTypes = {
  message: React.PropTypes.string.isRequired,
};
