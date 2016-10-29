/* eslint react/prefer-es6-class: 0 */

import React from 'react';

import ReactFormElements from '../forms/ReactFormElements.jsx';
import ReactFormFooter from '../forms/ReactFormFooter.jsx';

import ReactModal from '../ui_building_blocks/dialogs/ReactModal.jsx';

const Input = ReactFormElements.Input;

/**
 * The dialog that is shown when the "Import Notebook" button is clicked on a static notebook.
 */
const StaticNotebookImportDialog = React.createClass({

  propTypes: {
    url: React.PropTypes.string.isRequired,
    signupUrl: React.PropTypes.string.isRequired,
  },

  componentDidMount() {
    if (this.refs.url) {
      this.refs.url.select();
    }
  },

  render() {
    const header = (<h3>Import Notebook</h3>);

    const isLink =
      this.props.url.indexOf('http://') === 0 ||
      this.props.url.indexOf('https://') === 0;

    const headerText =
      'You can edit and run this notebook by importing it into your Databricks account. ';
    const bodyText = isLink ? (
      <div>
        <p>
          {headerText}
          Select <b>Import</b> from any folder's menu and paste the URL below.
        </p>
        <Input
          ref='url'
          inputID='url'
          defaultValue={this.props.url}
          readOnly
        />
      </div>
    ) : (
      <div>
        <p>
          {headerText}
          Select <b>Import</b> from any folder's menu and upload this HTML file.
        </p>
      </div>
    );

    const body = (
      <div>
        {bodyText}
        <p className='signup-text'>
          {"New to Databricks? "}
          <a className='signup-link' href={this.props.signupUrl} target='_blank'>Try it now.</a>
        </p>
      </div>
    );

    const footer = (
      <ReactFormFooter
        showCancel={false}
        confirmButton='Done'
      />);

    return (
      <ReactModal
        modalName='import-static-notebook-dialog'
        header={header}
        body={body}
        footer={footer}
      />);
  },
});

module.exports = StaticNotebookImportDialog;
