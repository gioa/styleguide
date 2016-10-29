/* eslint react/prefer-es6-class: 0 */

import React from 'react';

import { TextArea } from '../forms/ReactFormElements.jsx';
import ReactFormFooter from '../forms/ReactFormFooter.jsx';

import ReactModal from '../ui_building_blocks/dialogs/ReactModal.jsx';

const ReactCellExportDialog = React.createClass({

  propTypes: {
    codeSnippet: React.PropTypes.string.isRequired,
  },

  componentDidMount() {
    this.refs.textarea.select();
  },

  render() {
    const header = (<h3>Cell Export</h3>);
    const body = (
      <div>
        <span>
          Paste the code below into the body of any HTML file.
        </span>
        <TextArea
          ref='textarea'
          textareaID='cell-export-textarea'
          defaultValue={this.props.codeSnippet}
          rows={10}
        />
      </div>
    );
    const footer = (
      <ReactFormFooter
        confirmButton='Done'
      />);
    return (
      <ReactModal
        modalName='export-notebook-cell-dialog'
        header={header}
        body={body}
        footer={footer}
      />);
  },
});

module.exports = ReactCellExportDialog;
