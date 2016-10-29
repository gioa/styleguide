/* eslint react/prefer-es6-class: 0, func-names: 0 */

import $ from 'jquery';
import React from 'react';

import ReactDropzone from '../forms/ReactDropzone.jsx';
import ReactFormElements from '../forms/ReactFormElements.jsx';
import ReactFormFooter from '../forms/ReactFormFooter.jsx';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';
import ReactModal from '../ui_building_blocks/dialogs/ReactModal.jsx';
import ReactModalUtils from '../ui_building_blocks/dialogs/ReactModalUtils';
import IconsForType from '../ui_building_blocks/icons/IconsForType';

import { UrlValidators } from '../validators/UrlValidators';

const Input = ReactFormElements.Input;

const INPUT_TYPE_FILE = 'file';
const INPUT_TYPE_URL = 'url';

/**
 * The dialog that is shown when the "Import" menu item is clicked
 */
const ImportDialog = React.createClass({

  propTypes: {
    // the treeId of the folder in which the item will be imported
    parentId: React.PropTypes.number.isRequired,
  },

  getInitialState() {
    return {
      inputType: INPUT_TYPE_FILE,
      confirmed: false,
    };
  },

  _acceptedFilesString() {
    const extensions = ['.dbc', '.scala', '.py', '.sql', '.r', '.ipynb'];
    if (window.settings.enableStaticHtmlImport) {
      extensions.push('.html');
    }
    return extensions.join(', ');
  },

  _setType(importType) {
    if (!this.state.confirmed) {
      this.setState({ inputType: importType });
      this.checkInputFocus = true;
    }
  },

  _renderTypeToggle() {
    const fileChecked = this.state.inputType === INPUT_TYPE_FILE ? 'checked' : undefined;
    const urlChecked = this.state.inputType === INPUT_TYPE_URL ? 'checked' : undefined;

    const disabled = this.state.confirmed ? 'disabled' : false;

    const boundFile = this._setType.bind(this, INPUT_TYPE_FILE);
    const boundUrl = this._setType.bind(this, INPUT_TYPE_URL);
    return (
      <div className='import-from-block'>
        <span className='import-from-text'>Import from:</span>
        <a className='pointer import-from-link import-file-radio'
          onClick={boundFile}
        >
          <input type='radio' name='link'
            value={INPUT_TYPE_FILE}
            checked={fileChecked}
            disabled={disabled}
          />
          <span className='import-radio-label'> File</span>
        </a>
        <a className='pointer import-from-link import-url-radio'
          onClick={boundUrl}
        >
          <input type='radio' name='link'
            value={INPUT_TYPE_URL}
            checked={urlChecked}
            disabled={disabled}
          />
          <span className='import-radio-label'> URL</span>
        </a>
      </div>
    );
  },

  _renderDropzone() {
    const self = this;

    const options = {
      url: '/upload/import-files',
      acceptedFiles: self._acceptedFilesString(),
      addRemoveLinks: false,
      dictDefaultMessage: 'Drop file here to upload or click to select.',
      maxFiles: 1,
      init() {
        this.on('success', function(file, message) {
          self.setState({
            fileName: file.name,
            stagingURL: message[0].fsPath,
          });
        });
        // Remove the file if it is not the accepted type.
        this.on('error', function(file, msg) {
          if (msg === this.options.dictInvalidFileType) {
            this.removeFile(file);
            this.enable();
          } else {
            DeprecatedDialogBox.alert('Error uploading file: ' + msg);
          }
        });
      },
    };

    const classes = this.state.inputType !== INPUT_TYPE_FILE ? 'hidden' : null;

    return (
      <div className={classes}>
        <ReactDropzone
          options={options}
          classes='import-file-input'
          ref='fileInput'
        />
      </div>
    );
  },

  _validateUrl(text) {
    // matches http://something and https://something
    return UrlValidators.validateUrl(text);
  },

  _renderUrlInput() {
    const self = this;
    const classes = this.state.inputType !== INPUT_TYPE_URL ? 'hidden' : null;

    return (
      <div className={classes}>
        <Input
          ref='urlInput'
          inputClassName='urlInput'
          validate={this._validateUrl}
          confirm={this._confirm}
          readOnly={this.state.confirmed}
          onChange={function(text) {
            self.setState({ url: text });
          }}
        />
      </div>
    );
  },

  _renderFooter() {
    const confirmButton = this.state.confirmed ?
      (<span><i className={'fa fa-' + IconsForType.inProgress} /> Importing</span>) :
      (<span>Import</span>);

    return (
      <ReactFormFooter
        confirm={this._confirm}
        confirmDisabled={!this._validate() || this.state.confirmed}
        confirmButton={confirmButton}
        showCancel={!this.state.confirmed}
        closeOnConfirm={false}
      />
    );
  },

  _recordCompleted(success, errorMsg) {
    window.recordEvent('importItem', {
      importItemType: this.state.inputType,
      importItemSuccess: success,
      importItemErrorMsg: errorMsg,
      importItemFileName: this.state.fileName,
      importItemUrl: this.state.url,
    });
  },

  _confirm() {
    const self = this;

    const success = function(message) {
      ReactModalUtils.destroyModal();
      if (message && message.newId) {
        window.router.navigate('shell/' + message.newId, { trigger: true });
      }
      self._recordCompleted(true, null);
    };
    const error = function(jqXHR, textStatus, errorThrown) {
      ReactModalUtils.destroyModal();
      console.error('Import failed with error:', errorThrown);
      DeprecatedDialogBox.alert('Import failed with error: ' + errorThrown, false, 'OK');
      self._recordCompleted(false, errorThrown);
    };

    if (this.state.inputType === INPUT_TYPE_FILE &&
        this.state.stagingURL !== null &&
        this.state.fileName !== null) {
      // import from file
      $.ajax('/serialize/' + this.props.parentId, {
        type: 'POST',
        data: JSON.stringify({ path: this.state.stagingURL, name: this.state.fileName }),
        success: success,
        error: error,
      });
    } else if (this.state.inputType === INPUT_TYPE_URL && this.state.url) {
      // import from url
      $.ajax('/serialize/url/' + this.props.parentId, {
        type: 'POST',
        data: JSON.stringify({ url: this.state.url }),
        success: success,
        error: error,
      });
    } else {
      throw new Error('invalid state in ImportDialog._confirm');
    }

    this.setState({ confirmed: true });
  },

  _validate() {
    if (this.state.inputType === INPUT_TYPE_FILE) {
      return this.state.stagingURL && this.state.fileName;
    } else if (this.state.inputType === INPUT_TYPE_URL) {
      return this._validateUrl(this.state.url);
    }
    return false;
  },

  render() {
    const header = (
      <h3>Import Notebooks</h3>
    );

    const libraryLink =
      <a className='libraryLink' href={'#create/library/' + this.props.parentId}>click here</a>;
    const body = (
      <div>
        {window.settings.enableImportFromUrl ? this._renderTypeToggle() : null}
        {this._renderDropzone()}
        {window.settings.enableImportFromUrl ? this._renderUrlInput() : null}
        <div className='formatsMessage'>
          Accepted formats: {this._acceptedFilesString()}<br />
          (To import a library, such as a jar or egg, {libraryLink})
        </div>
      </div>
    );

    const footer = this._renderFooter();

    return (
      <ReactModal
        modalName='import-dialog'
        header={header}
        body={body}
        footer={footer}
      />);
  },

  componentDidUpdate() {
    if (this.checkInputFocus && this.state.inputType === INPUT_TYPE_URL) {
      this.refs.urlInput.focus();
      this.refs.urlInput.select();
    }
    this.checkInputFocus = false;
  },
});

ImportDialog.createDialog = function(parentId) {
  ReactModalUtils.createModal(<ImportDialog parentId={parentId} />);
};

module.exports = ImportDialog;
