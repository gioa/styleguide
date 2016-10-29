/* eslint react/prefer-es6-class: 0 */

import $ from 'jquery';
import React from 'react';
import ReactDOM from 'react-dom';

import { DropzoneUtils } from '../forms/DropzoneUtils';

/**
 * Creates a drag-and-drop file upload tool, using Dropzone.js.
 * Props:
 *   editing: bool, true if showing/replacing a previously uploaded file
 *   existingFile: object representing the existing file to show in the dropzone:
 *                 {name: "", size: ""}
 *   classes: classes for the wrapper div
 *   options: object with options for the dropzone:
 *      {
 *        url: "/upload/elastic-jar",
 *        acceptedFiles: ".jar",
 *        addRemoveLinks: true,
 *        uploadMultiple: false,
 *        focus: true,
 *        maxFiles: 1,
 *        dictDefaultMessage: defaultMessage,
 *        init: function() {
 *          this.on("addedfile", function(file) {});
 *          this.on("success", function(file, message) {});
 *          this.on("removedfile", function(file) {});
 *          this.on("error", function(file, msg) {});
 *      }
 */

const ReactDropzone = React.createClass({
  propTypes: {
    editing: React.PropTypes.bool,
    existingFile: React.PropTypes.object,
    classes: React.PropTypes.string,
    options: React.PropTypes.object.isRequired,
  },

  getDefaultProps() {
    return ({
      editing: false,
    });
  },

  getDropzone() {
    return ReactDOM.findDOMNode(this.refs.dropzone).dropzone;
  },

  shouldComponentUpdate() {
    return false;
  },

  componentDidMount() {
    const dropzoneDiv = ReactDOM.findDOMNode(this.refs.dropzone);
    DropzoneUtils.installDropzone($(dropzoneDiv), this.props.options);

    // show previously uploaded file if there is one
    if (this.props.existingFile) {
      this.getDropzone().emit('addedfile', this.props.existingFile);
      this.getDropzone().emit('complete', this.props.existingFile);
    }
  },

  render() {
    const classes = this.props.classes + ' dropzone control-field';
    const wrapperDiv = (
      <div className={classes} id='filePicker' data-row-for='filePicker' ref='dropzone'>
      </div>
    );

    return wrapperDiv;
  },
});

module.exports = ReactDropzone;
