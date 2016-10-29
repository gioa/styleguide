import $ from 'jquery';

import React from 'react';

import { PublishNotebookConfirmed } from '../notebook/PublishNotebookConfirmed.jsx';
import { PublishNotebookModal } from '../notebook/PublishNotebookModal.jsx';
import { PublishHubModal } from '../notebook/PublishHubModal.jsx';

import ReactModalUtils from '../ui_building_blocks/dialogs/ReactModalUtils.js';

/**
 * Sends a request to the ImportExportHandler to publish the notebook with the given id.
 * As soon as the ImportExportHandler has generated a public URL for the notebook, opens a
 * Confirmation modal that informs the user of the url.
 */
export function publishNotebookAndShowConfirmation(notebookId, isDashboard) {
  const path = `${window.settings.orgId.toString()}/${notebookId.toString()}`;
  const target = '/serialize/publish/' + path;
  $.ajax({
    url: target,
    async: true,
    dataType: 'json',
    success(response) {
      const confirmed = (
        <PublishNotebookConfirmed
          url={response.url}
          isDashboard={isDashboard}
        />
      );
      ReactModalUtils.createModal(confirmed);
    },
    error(jqXHR, textStatus, errorThrown) {
      const nodeType = isDashboard ? 'dashboard' : 'notebook';
      const message = ('There was an error publishing the ' + nodeType + ' with id ' + notebookId +
      ': ' + textStatus + ': ' + errorThrown);
      window.oops(message);
    },
  });
}

/**
 * Initiates the notebook publishing workflow. We first ask the user to confirm that they want to
 * publish their notebook (unless they've previously asked us to not show them that warning again),
 * then we publish the notebook and present them with the URL at which the notebook can be seen.
 */
export function triggerPublishNotebookWorkflow(notebookId, isDashboard) {
  if (window.prefs.get('autoPublish')) {
    publishNotebookAndShowConfirmation(notebookId, isDashboard);
  } else {
    const view = (
      <PublishNotebookModal
        notebookId={notebookId}
        isDashboard={isDashboard}
      />
    );
    ReactModalUtils.createModal(view);
  }
}

export function triggerHubPublishWorkflow(notebookId, isDashboard, notebookName) {
  const view = (
    <PublishHubModal
      notebookId={notebookId}
      isDashboard={isDashboard}
      notebookName={notebookName}
    />
  );
  ReactModalUtils.createModal(view);
}

