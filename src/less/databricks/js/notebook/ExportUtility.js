/* eslint callback-return: 0, func-names: 0 */

import _ from 'underscore';
import $ from 'jquery';
import React from 'react';

import ReactCellExportDialog from '../notebook/ReactCellExportDialog.jsx';

import ReactModalUtils from '../ui_building_blocks/dialogs/ReactModalUtils';

import { CommandStateUtils } from '../notebook/CommandUtils';
import { ResourceUrls } from '../urls/ResourceUrls';

const ExportUtility = function() {
  // Data URIs for the files in cssPaths will be stored here
  this._cssUris = {};
  // Data URIs for the files in htmlPaths will be stored here
  this._htmlUris = {};
};

/**
 * Get the URL for a static versioned resource for the correct version, e.g.
 * https://cdn.domain.com/path/to/$filename-$version.$ext
 */
ExportUtility.prototype.getStaticResourceUrl = function(filename) {
  return ResourceUrls.getResourceUrl(filename, true);
};

// Convert an image to a data uri
ExportUtility.prototype._calcDataUri = function(path, callback) {
  const image = $('<img/>');
  image.load(function() {
    let canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.height = this.height;
    canvas.width = this.width;
    ctx.drawImage(this, 0, 0);
    const dataURL = canvas.toDataURL();
    callback(dataURL);
    canvas = null;
  });
  image.error(function(error) {
    console.error('failed to load image', path, error);
    callback(null);
  });
  image[0].src = path;
};

/**
 * Replace images in the command model with base64 encoded URIs. When finished, calls the callback
 * with the new model.
 */
ExportUtility.prototype._fixCommandModel = function(commandModel, callback) {
  const baseFiles = window.settings.files !== undefined ? window.settings.files : '';

  const newModel = commandModel.clone();

  newModel.set({
    // parent model is not necessary and wastes space
    parent: null,
  });

  if (newModel.get('type') === 'command') {
    newModel.set({
      // don't export presence marks
      presenceMarks: [],
      // set state to finished if the command is currently running or cancelling
      state: (CommandStateUtils.isRunning(newModel.get('state')) ||
        CommandStateUtils.isCancelling(newModel.get('state'))) ? 'finished' : newModel.get('state'),
      // don't export spark stages (the links to the spark UI are broken)
      stages: [],
      // don't export cluster info
      clusterId: '',
      clusterName: '',
      clusterMemory: 0,
      // comments are a circular ref
      comments: null,
      // don't need last modified
      lastModifiedBy: '',
    });
  } else if (newModel.get('type') === 'comment') {
    newModel.set({
      // internal reference to CodeMirror
      editor: null,
    });
  }

  if (newModel.get('results') && newModel.get('results').type === 'image') {
    const newResult = _.clone(newModel.get('results'));
    this._calcDataUri(baseFiles + newResult.data, function(dataUrl) {
      newResult.data = dataUrl === null ? '' : dataUrl;
      newModel.set({ results: newResult });
      callback(newModel);
    });
  } else {
    callback(newModel);
  }
};

/**
 * Generate an html code snippet the user can copy and paste into an html file to render the
 * exported cell.
 */
ExportUtility.prototype.exportCell = function(notebookCellModel, notebookModel) {
  const self = this;
  // TODO(jeffpang): move this HTML generation to the webapp in HTMLExporter
  // TODO(jeffpang): export a WordPress compatible [iframe] version of this (ask from marketing)
  const exportFixedCell = function(cellModel) {
    const selector = 'div.cell-' + cellModel.get('parentId') + '-' + cellModel.get('id');
    // extra height is to prevent a vertical scroll bar from appearing
    const height = $(selector).height() - $(selector + ' .command-result-stats').height() + 8;

    const inner = "<html><head><meta charset='utf-8'>" +
      "<meta name='google' content='notranslate'>" +
      "<meta http-equiv='Content-Language' content='en'>" +
      "<link rel='stylesheet' " +
      "href='https://fonts.googleapis.com/css?family=Source+Code+Pro:400,700'>" +
      "<link rel='stylesheet' type='text/css' href='" +
        self.getStaticResourceUrl('lib/css/bootstrap.min.css') + "'>" +
      "<link rel='stylesheet' type='text/css' href='" +
        self.getStaticResourceUrl('css/main.css') + "'>" +
      "<meta http-equiv='content-type' content='text/html; charset=UTF8'>" +
      '</head>' +
      '<body>' +
      "<div id='databricks-notebook-cell'></div>" +
      "<script>window.settings = {staticNotebookResourceUrl: '" +
        window.settings.staticNotebookResourceUrl + "', deploymentMode: '" +
        window.settings.deploymentMode + "'};" +
      "const notebookModelJson = '" + btoa(JSON.stringify(notebookModel)) + "';" +
      "const notebookModelCommandCollection = '" + btoa(JSON.stringify([cellModel])) + "';" +
      '</script>' +
      "<script src='" + self.getStaticResourceUrl('js/cell-main.js') + "'></script>" +
      '</body>' +
      '</html>';

    const output = '<iframe style="width:100%;border-width:0px;height:' +
      height + 'px" srcdoc="' + inner + '"></iframe>';
    const ReactCellExportDialogFactory = React.createFactory(ReactCellExportDialog);
    const dialog = ReactCellExportDialogFactory({
      codeSnippet: output.replace(/\\/g, '\\\\'),
    });
    ReactModalUtils.createModal(dialog);
  };

  this._fixCommandModel(notebookCellModel, exportFixedCell);
};

module.exports = ExportUtility;
