/* eslint react/prefer-es6-class: 0, react/no-is-mounted: 0, react/no-is-mounted: 0,
consistent-return: 0, func-names: 0 */

import $ from 'jquery';
import React from 'react';

import ReactDropzone from '../forms/ReactDropzone.jsx';
import ReactFormFooter from '../forms/ReactFormFooter.jsx';

import ReactDialogBox from '../ui_building_blocks/dialogs/ReactDialogBox.jsx';
import ReactModal from '../ui_building_blocks/dialogs/ReactModal.jsx';
import ReactModalUtils from '../ui_building_blocks/dialogs/ReactModalUtils';
import IconsForType from '../ui_building_blocks/icons/IconsForType';

import DbGuideLinks from '../urls/DbGuideLinks';

const ReactJarJobDialog = React.createClass({
  propTypes: {
    editingJar: React.PropTypes.bool,
    job: React.PropTypes.object.isRequired,
    shouldWarnRestartCluster: React.PropTypes.bool,
    confirm: React.PropTypes.func,
  },

  getDefaultProps() {
    return {
      editingJar: false,
      shouldWarnRestartCluster: false,
    };
  },

  getInitialState() {
    const jobAction = this.props.job.attributes.basicInfo.jobActions[0];

    return {
      // Whether the hidden part of the notice section is expanded
      expandedNotice: false,
      // MainClass (str), parameters (str), & runAsNotebook (bool) are set when their
      // respective form inputs change, and then later sent in the ajax submission
      mainClass: this.props.editingJar ? jobAction.mainClassName : '',
      parameters: this.props.editingJar ? jobAction.parameters : '',
      // @DEPRECATED(jengler) 2016-07-08: No longer used. PROD-11378
      runAsNotebook: this.props.editingJar ? jobAction.runAsNotebook : true,
      // Set to true when a file is uploaded or an existing file is present due to a
      // previous upload, then checked to enable/disable the confirm button
      dropzoneValid: this.props.editingJar,
      // uploadedPath must either be true (for the edit dialog with a previously uploaded
      // file, to enable users to edit other parameters and not the file), or set
      // as the string of the JAR file path, in order for the ajax POST to be made
      uploadedPath: this.props.editingJar ? '' : null,
      // Boolean indicating whether the dropzone has an existing file passed through
      // from a previous upload. The presence of an existing file is handled differently
      // in the dropzone than a newly uploaded file, so this is used to manage the file
      // thumbnails and to check whether to update the jarPath submitted to the DB.
      existingFile: this.props.editingJar,
      // Used to bypass form validation in the edit dialog if user doesn't make any
      // changes to the form.
      formChanged: false,
    };
  },

  _getNotice() {
    const learnMoreLink = encodeURI(DbGuideLinks.JAR_JOBS_URL);
    const handleLearnMoreClick = function(e) {
      e.preventDefault();
      window.open(e.target.href, '_blank');
    };
    const expandedNotice = (
      <div className='expanded-jar-notice'>
        Jobs should not create their own Spark Context. Instead, Databricks
         will create a Spark Context that integrates better with Jobs and
         enables running JAR jobs on existing clusters.&nbsp;
        <a className='jar-notice-learn' href={learnMoreLink} onClick={handleLearnMoreClick}>
          Learn more
        </a>
      </div>
    );
    const iconType = this.state.expandedNotice ? 'chevronUp' : 'chevronDown';
    const existingClusterNotice = this.props.shouldWarnRestartCluster ? (
      <div className='jar-dialog-notice'>
        <span className='warning-font'>
          You must restart the cluster for the new JAR file to be attached to your cluster.
        </span>
      </div>
    ) : null;

    return (
      <div>
        <div className='jar-dialog-notice'>
          <span className='warning-font'><strong>Notice:&nbsp;</strong></span>
          Uploaded JARs should use a shared SparkContext by calling
          <span className='code-font'> SparkContext.getOrCreate()</span>.
          <i className={'fa toggle-jar-notice fa-' + IconsForType[iconType]}
            onClick={this._toggleNotice}
          ></i>
          {this.state.expandedNotice ? expandedNotice : null}
        </div>
        {existingClusterNotice}
      </div>
    );
  },

  _toggleNotice() {
    if (this.isMounted()) {
      this.setState({ expandedNotice: !this.state.expandedNotice });
    }
  },

  _validateDropzone() {
    if (this.refs && this.refs.dropzone) {
      const isUploading = this.refs.dropzone.getDropzone().getUploadingFiles().length > 0;
      const files = this.refs.dropzone.getDropzone().getAcceptedFiles();
      const hasFile = (this.state.existingFile ? true : files.length === 1);
      const isDropzoneValid = !isUploading && hasFile;

      if (this.isMounted()) {
        this.setState({
          dropzoneValid: isDropzoneValid,
        });
      }
    }
  },

  _setPath(path) {
    if (this.isMounted()) {
      this.setState({ uploadedPath: path });
    }
  },

  _getDropzone() {
    const self = this;
    const defaultMessage = this.props.editingJar ? 'Replace JAR here' : 'Drop JAR here to upload';
    const options = {
      url: '/upload/elastic-jar',
      acceptedFiles: '.jar',
      addRemoveLinks: true,
      uploadMultiple: false,
      focus: true,
      maxFiles: 1,
      dictDefaultMessage: defaultMessage,
      init() {
        this.on('addedfile', function(file) {
          if ($('div.dz-file-preview').length > 1) {
            // remove image representation of previously uploaded file
            if (self.props.editingJar && self.state.existingFile) {
              $($('div.dz-file-preview')[0]).remove();
            } else {
              // remove any files added while this dialog box was open
              let oldFile;
              this.files.forEach(function(f) {
                if (f.name !== file.name) { oldFile = f; }
              });
              this.removeFile(oldFile);
            }
          }

          if (self.props.editingJar) {
            $('.dz-message').show();
          }

          // dropzone does sending file upload async to adding file, set timeout so that
          // dropzone valid will be set correctly
          setTimeout(() => {
            self._validateDropzone();
          }, 10);
        });

        this.on('success', function(file, message) {
          console.log('Uploaded JAR', message);
          self._setPath(message[0].fsPath);
          // set existingFile to false so we know to update the jarPath
          if (self.props.editingJar && self.isMounted()) {
            self.setState({ existingFile: false });
          }
          self._validateDropzone();
        });

        this.on('removedfile', function() {
          self._setPath(null);
          if (self.props.editingJar && self.isMounted()) {
            self.setState({ existingFile: false });
          }
          self._validateDropzone();
        });

        // Remove the file if it is not the accepted type.
        this.on('error', function(file, msg) {
          if (msg === this.options.dictInvalidFileType) {
            const _this = this;
            $('.dz-error-message').show();
            $('.dz-remove').hide();
            setTimeout(function() {
              _this.removeFile(file);
            }, 2000);
            self._setPath(null);
            // TODO(PROD-7665) remove uploaded file from server
          }
          self._validateDropzone();
        });
      },
    };

    let existingFile = null;
    if (this.props.editingJar) {
      const jobAction = this.props.job.attributes.basicInfo.jobActions[0];
      existingFile = { name: (jobAction.s3JarFile).slice(37), size: '' };
    }

    return (
      <ReactDropzone
        editing={this.props.editingJar}
        existingFile={existingFile}
        options={options}
        classes='jar-upload-dropzone'
        ref='dropzone'
      />
    );
  },

  _handleInputChange(e) {
    if (!this.isMounted()) { return; }
    // store the inputs as state in order to grab them later
    const stateObject = { formChanged: true };
    if (e.target.type === 'checkbox') {
      stateObject[e.target.name] = !e.target.checked;
    } else {
      stateObject[e.target.name] = e.target.value;
    }
    this.setState(stateObject);
    this._validateDropzone();
  },

  _getBody() {
    // can only use legacy JARS if job is set to run on existing clusters
    const jobAction = this.props.job.attributes.basicInfo.jobActions[0];
    const defaultClass = this.props.editingJar ? jobAction.mainClassName : null;
    const defaultParams = this.props.editingJar ? jobAction.parameters : null;

    return (
      <div className={this.props.editingJar ? 'edit-jar-modal' : 'set-jar-modal'}>
        {this._getNotice()}
        {this._getDropzone()}
        <div className='multi-input-row main-class-field' data-row-for='mainClass'>
          <label>Main class</label>
          <input type='text' required className='control-field' name='mainClass' id='mainClass'
            onChange={this._handleInputChange} defaultValue={defaultClass}
          />
        </div>
        <div className='multi-input-row parameters-field' data-row-for='parameters'>
          <label>Arguments</label>
          <input type='text' className='control-field' id='parameters' name='parameters'
            onChange={this._handleInputChange} defaultValue={defaultParams}
          />
        </div>
      </div>
    );
  },

  _handleSubmit() {
    // skip if the user opened the edit dialog but didn't change anything
    if (!this.state.formChanged && this.state.existingFile) {
      return false;
    }

    // mainClass can't be null or whitespace; uploadedPath can't be null
    const classEntered = this.state.mainClass && (/\S/).test(this.state.mainClass);
    if (this.state.uploadedPath === null && !classEntered) {
      return false;
    }

    const data = {
      jobId: this.props.job.attributes.basicInfo.jobId,
      mainClass: this.state.mainClass,
      parameters: this.state.parameters,
      // @DEPRECATED(jengler) 2016-07-08: No longer used. PROD-11378
      runAsNotebook: this.state.runAsNotebook,
    };

    // only update jarPath if this is a new upload, not if editing parameters for
    // a previously uploaded jar file
    if (!this.props.editingJar || (this.props.editingJar && !this.state.existingFile)) {
      data.jarPath = this.state.uploadedPath.substring(
        this.state.uploadedPath.indexOf('/') + 1
      );
    }

    const action = this.props.editingJar ? '/jobs/update-jar-action' : '/jobs/set-action';

    $.ajax(action, {
      type: 'POST',
      data: JSON.stringify(data),
      success: this.props.confirm,
      error(xhr, status, error) {
        ReactDialogBox.alert('Request failed: ' + error);
      },
    });
  },

  render() {
    const classEntered = this.state.mainClass && (/\S/).test(this.state.mainClass);
    const formValid = classEntered && this.state.dropzoneValid;
    const headerText = this.props.editingJar ? 'Edit JAR' : 'Upload JAR to Run';
    const header = <h3>{headerText}</h3>;
    const footer = (
      <ReactFormFooter
        confirmButton='OK'
        confirmDisabled={!formValid}
        confirm={this._handleSubmit}
      />
    );

    return (
      <ReactModal
        modalName='jar-jobs-dialog'
        header={header}
        body={this._getBody()}
        footer={footer}
        classes={this.props.editingJar ? 'edit-jar-dialog' : 'set-jar-dialog'}
      />
    );
  },
});

ReactJarJobDialog.createDialog = function(isEditingJar, job, shouldWarnRestartCluster, confirm) {
  ReactModalUtils.createModal(
    <ReactJarJobDialog
      editingJar={isEditingJar}
      job={job}
      shouldWarnRestartCluster={shouldWarnRestartCluster}
      confirm={confirm}
    />
  );
};

module.exports = ReactJarJobDialog;
