/* eslint react/prefer-es6-class: 0 */

import React from 'react';

import ReactModalUtils from '../ui_building_blocks/dialogs/ReactModalUtils';

import '../../lib/bootstrap';

const ReactFormFooter = React.createClass({

  /**
   * confirm: the function to call when the user clicks the confirm button.
   * showConfirm: whether or not to show the confirm button.
   * cancel: the function to call when the user clicks the cancel button.
   * showCancel: whether or not to show the cancel button.
   * confirmDisabled: when the confirm button should be disabled.
   * confirmButton: the label for the confirm button (e.g. "Confirm", "Yes").
   * confirmBtnClassName: unique class for confirm button (set to "btn" to make button grey)
   * cancelButton: the label for the cancel button (e.g. "Cancel, "No").
   * closeOnConfirm: if false, don't close the dialog on confirm (the parent should close it
   *   manually with ReactModalUtils.destroyModal()
   */
  propTypes: {
    confirm: React.PropTypes.func,
    showConfirm: React.PropTypes.bool,
    cancel: React.PropTypes.func,
    showCancel: React.PropTypes.bool,
    confirmDisabled: React.PropTypes.bool,
    confirmButton: React.PropTypes.node,
    confirmBtnClassName: React.PropTypes.string,
    cancelButton: React.PropTypes.node,
    closeOnConfirm: React.PropTypes.bool,
  },

  getDefaultProps() {
    return {
      showConfirm: true,
      showCancel: true,
      confirmDisabled: false,
      confirmButton: 'Confirm',
      confirmBtnClassName: 'btn btn-primary confirm-button',
      cancelButton: 'Cancel',
      closeOnConfirm: true,
    };
  },

  confirm(e) {
    e.preventDefault();
    if (this.props.confirm) {
      this.props.confirm(e);
    }
    if (this.props.closeOnConfirm) {
      ReactModalUtils.destroyModal();
    }
  },

  cancel(e) {
    ReactModalUtils.destroyModal();
    if (this.props.cancel) {
      this.props.cancel(e);
    }
  },

  focus() {
    if (this.props.showConfirm) {
      this.refs.confirm.focus();
    }
  },

  render() {
    const disable = this.props.confirmDisabled ? 'disable' : '';
    let cancel = (<div />);
    let confirm = (<div />);
    if (this.props.showCancel) {
      cancel = (
        <a href='#' ref='cancel'
          className='btn cancel-button'
          data-dismiss='modal'
          onClick={this.cancel}
          tabIndex='2'
        >
          {this.props.cancelButton}
        </a>
      );
    }
    if (this.props.showConfirm) {
      confirm = (
        <a href='#' ref='confirm'
          className={this.props.confirmBtnClassName}
          disabled={disable}
          onClick={disable ? null : this.confirm}
          tabIndex='1'
        >
          {this.props.confirmButton}
        </a>
      );
    }
    return (
      <div>
        {cancel}
        {confirm}
      </div>
    );
  },
});

module.exports = ReactFormFooter;
