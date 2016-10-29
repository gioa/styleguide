import $ from 'jquery';
import React from 'react';

import { publishNotebookAndShowConfirmation } from '../notebook/PublishNotebookView.jsx';

import ReactModal from '../ui_building_blocks/dialogs/ReactModal.jsx';
import ReactModalUtils from '../ui_building_blocks/dialogs/ReactModalUtils';

// Asks the user if they want to publish the notebook
export class PublishNotebookModal extends React.Component {
  constructor() {
    super();
    this.onConfirm = this.onConfirm.bind(this);
  }

  onConfirm(e) {
    e.preventDefault();
    if ($('input.pref-autoPublish').prop('checked')) {
      window.prefs.set('autoPublish', true);
    }
    ReactModalUtils.destroyModal();
    publishNotebookAndShowConfirmation(this.props.notebookId, this.props.isDashboard);
  }

  render() {
    const nodeType = this.props.isDashboard ? 'Dashboard' : 'Notebook';
    const header = <h3>Publish {nodeType}</h3>;

    const dontShowAgain = (
      <input className='pref-autoPublish' type='checkbox' ref='autoPublish'>
        {" Don't show me this again"}
      </input>
    );
    const cancel = (
      <a href='#' ref='cancel'
        className='btn cancel-button'
        data-dismiss='modal'
        onClick={ReactModalUtils.destroyModal}
        tabIndex='2'
      >
        Cancel
      </a>
    );
    const confirm = (
      <a href='#' ref='confirm'
        className='btn btn-primary confirm-button'
        onClick={this.onConfirm}
        tabIndex='1'
      >
        Publish
      </a>
    );
    const footer = (
      <div>
        {dontShowAgain}
        <span className='publish-notebook-buttons'>
          {cancel}
          {confirm}
        </span>
      </div>
    );
    const body = (
      <div>
        Do you want to publish this {nodeType.toLowerCase()} publicly?
        This action will overwrite any previously-published version of
        this {nodeType.toLowerCase()}.
        Anyone with the link can view it and link will remain valid for 6 months.
      </div>
    );
    return (
      <ReactModal
        modalName = 'publish-notebook-modal'
        header = {header}
        body = {body}
        footer = {footer}
      />);
  }
}

/**
 * @param notebookId: ID of the notebook to be published
 */
PublishNotebookModal.propTypes = {
  notebookId: React.PropTypes.number.isRequired,
  isDashboard: React.PropTypes.bool,
};
