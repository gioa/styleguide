/* eslint react/prefer-es6-class: 0 */

import React from 'react';

import ReactFormFooter from '../forms/ReactFormFooter.jsx';
import ReactModal from '../ui_building_blocks/dialogs/ReactModal.jsx';

const ReactConfirm = React.createClass({

  /**
   * title: the title in the dialog. if not provided, the message is shown in the title area
   *   reza says: ALWAYS HAVE A TITLE!
   * message: the confirmation message, which can be either a string or HTML object.
   * confirmButton: the label for the confirm button (e.g. "OK", "Confirm", "Yes").
   * confirmBtnClassName: unique class for confirm button (set to "btn" to make button grey)
   * cancelButton: the label for the cancel button (e.g. "Cancel", "No").
   * confirm: the function to call when the user clicks the confirm button.
   * cancel: the function to call when the user clicks the cancel button.
   * name: the class name of this dialog.
   */
  propTypes: {
    title: React.PropTypes.oneOfType([
      React.PropTypes.object,
      React.PropTypes.string,
    ]),
    message: React.PropTypes.oneOfType([
      React.PropTypes.object,
      React.PropTypes.string,
    ]).isRequired,
    confirmButton: React.PropTypes.string,
    confirmBtnClassName: React.PropTypes.string,
    cancelButton: React.PropTypes.string,
    showCancel: React.PropTypes.bool,
    confirm: React.PropTypes.func,
    cancel: React.PropTypes.func,
    name: React.PropTypes.string,
  },

  getDefaultProps() {
    return {
      confirmButton: 'Confirm',
      cancelButton: 'Cancel',
      showCancel: true,
      name: 'confirm',
    };
  },

  onConfirm() {
    if (this.props.confirm) {
      this.props.confirm();
    }
  },

  onCancel() {
    if (this.props.cancel) {
      this.props.cancel();
    }
  },

  componentDidMount() {
    this.refs.footer.focus();
  },

  render() {
    const header = this.props.title ?
      (<h3>{this.props.title}</h3>) :
      (<div className='modal-title'>{this.props.message}</div>);
    const body = this.props.title ? <div>{this.props.message}</div> : null;
    const footer = (
      <ReactFormFooter
        ref='footer'
        confirm={this.onConfirm}
        cancel={this.onCancel}
        showCancel={this.props.showCancel}
        confirmButton={this.props.confirmButton}
        confirmBtnClassName={this.props.confirmBtnClassName}
        cancelButton={this.props.cancelButton}
      />);
    return (
      <ReactModal
        modalName={this.props.name}
        header={header}
        body={body}
        footer={footer}
      />
    );
  },
});

module.exports = ReactConfirm;
