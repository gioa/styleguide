/* eslint react/prefer-es6-class: 0 */

import React from 'react';

import ReactFormFooter from '../forms/ReactFormFooter.jsx';
import ReactModal from '../ui_building_blocks/dialogs/ReactModal.jsx';

const ReactAlert = React.createClass({

  /**
   * message: the alert to display to the user, either a string or HTML object.
   * button: the label for the confirm button (e.g. "OK", "Confirm").
   * callback: the function to call when the user clicks the confirm button.
   * className: the class name for this dialog.
   */
  propTypes: {
    message: React.PropTypes.oneOfType([
      React.PropTypes.object,
      React.PropTypes.string,
    ]).isRequired,
    button: React.PropTypes.string,
    callback: React.PropTypes.func,
    className: React.PropTypes.string,
  },

  getDefaultProps() {
    return {
      button: 'OK',
      className: 'alert-form',
    };
  },

  onConfirm() {
    if (this.props.callback) {
      this.props.callback();
    }
  },

  componentDidMount() {
    this.refs.footer.focus();
  },

  render() {
    const header = (<div className='modal-title'>{this.props.message}</div>);
    const footer = (
      <ReactFormFooter
        ref='footer'
        confirm={this.onConfirm}
        showCancel={false}
        confirmButton={this.props.button}
      />
    );
    return (
      <ReactModal
        modalName={this.props.className}
        header={header}
        footer={footer}
      />
    );
  },
});

module.exports = ReactAlert;
