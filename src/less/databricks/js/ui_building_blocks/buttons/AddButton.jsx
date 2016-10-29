import React from 'react';

export function AddButton({ onClick, href, label, disabled, moreButtonProps }) {
  let clickHandler = onClick;
  if (href) {
    clickHandler = () => window.router.navigate(href, { trigger: true });
  }
  return (
    <button
      className='btn btn-primary add-button'
      disabled={disabled}
      onClick={clickHandler}
      {...moreButtonProps}
    >
      <i className='fa fa-plus fa-fw'></i>
      Add
      {label ? ' ' + label : null}
    </button>
  );
}

AddButton.propTypes = {
  onClick: React.PropTypes.func,
  href: React.PropTypes.string,
  label: React.PropTypes.string,
  disabled: React.PropTypes.bool,
  // All other button attributes belong in moreButtonProps, NOT as new props.
  // Do NOT encourage continued use of usually-irrelevant attributes by
  // giving them their own named props in this list.
  // This component has one SPECIFIC purpose. Do not use it as a generic
  // button component for any button that contains the 'Add' substring.
  moreButtonProps: React.PropTypes.object,
};

AddButton.defaultProps = {
  disabled: false,
  moreButtonProps: {},
};
