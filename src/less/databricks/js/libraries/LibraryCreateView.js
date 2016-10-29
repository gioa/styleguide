/* eslint func-names: 0 */

/**
 * View for creating a new user library (uploading jars).
 */

import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';

import { DropzoneUtils } from '../forms/DropzoneUtils';

import NavFunc from '../filetree/NavFunc.jsx';

import { UploadErrorHandlers } from '../libraries/Upload.jsx';

import libraryCreateTemplate from '../templates/libraryCreate.html';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';

const LibraryCreateView = Backbone.View.extend({
  initialize(options) {
    this.options = options || { parentId: 0 };
    // If not provided, the parent id will be the root.
    this.parentId = this.options.parentId || 0;
    // map from file to the path returned by the server. In the future, we should probably just
    // store some hash or id for better security.
    this.jarFiles = {};

    this.name = 'Create Library';

    this.dropzoneJarFiles = null;
  },

  render() {
    this.$el.html(libraryCreateTemplate);
    this.$el.attr('class', 'library-import');

    // Disable the submit button.
    this.enableOrDisableSubmission();
    this.renderDropzone();
  },

  renderDropzone() {
    // TODO(Hossein): Maybe it is better to create a new element and attach dropzone to it.
    const self = this;
    this.$('div.dropzoneJarFiles').append('<div class="dropzone"/>');
    const elt = this.$('div.dropzoneJarFiles div.dropzone');
    self.dropzoneJarFiles = DropzoneUtils.installDropzone(elt, {
      url: '/upload/library',
      uploadMultiple: false,
      maxFiles: 1,
      acceptedFiles: '.jar',
      addRemoveLinks: true,
      maxFilesize: window.settings.dropzoneMaxFileSize,
      dictDefaultMessage: 'Drop library JAR here to upload',
      init() {
        this.on('success', function(file, msg) {
          self.jarFiles[file.name] = msg[0].fileStoreName;
          self.setLibraryNameIfEmpty(file.name);
          self.enableOrDisableSubmission();
        });

        this.on('maxfilesexceeded', function() {
          DeprecatedDialogBox.alert('You can upload only one JAR file.', false, 'OK');
        });

        this.on('removedfile', function(file) {
          delete self.jarFiles[file.name];
          self.enableOrDisableSubmission();
        });

        // Remove the file if it is not the accepted type.
        this.on('error', function(file, msg) {
          UploadErrorHandlers.defaultHandler(this, file, msg);
        });
      },
    }, false /* testModeInit = false since we bind submit below */);

    // TODO(jeffpang): remove this test code since it is a different code path than production
    // Craft a special handling of the form when the user wishes to upload it:
    // - the success and failure methods are not called
    // - we need to prevent the form from leaving the page
    // - we do some postprocessing on the request and we need to know when it is completed
    // This code is adapted from: http://stackoverflow.com/questions/166221/how-can-i-upload-
    // files-asynchronously-with-jquery
    const form = this.$('div.dropzoneJarFiles div.dropzone form');
    if (!form) {
      return;
    }
    form.submit(function() {
      const url = $(this).attr('action');
      const formDom = form.get(0);
      const data = new FormData(formDom);
      $.ajax({
        url: url,
        type: 'POST',
        data: data,
        success(response) {
          _.forEach(response, function(blob) {
            self.jarFiles[blob.name] = blob.fileStoreName;
          });
          self.enableOrDisableSubmission();
        },
        error(msg) {
          console.log('renderDropZone', 'error', msg);
          self.enableOrDisableSubmission();
        },
        // JQuery should not infer the content-type to single-part, we force it to multi-part.
        contentType: false,
        // JQuery should not process data (which would move to another page)
        processData: false,
      });
      return false;
    });
  },

  /**
   * Check whether the form is valid. If it is, enable the submission button. Otherwise, disable
   * the submission button.
   */
  enableOrDisableSubmission() {
    const name = this.$('.field_library_name').val();
    if (name === null || name === '' || _.size(this.jarFiles) === 0) {
      this.$('.submit-create-library').attr('disabled', 'disabled');
    } else {
      this.$('.submit-create-library').removeAttr('disabled');
    }
  },

  setLibraryNameIfEmpty(newName) {
    const name = this.$('.field_library_name').val();
    if (name === null || name.trim() === '') {
      this.$('.field_library_name').val(newName);
    }
  },

  events: {
    'input .field_library_name': 'enableOrDisableSubmission',
    'click .submit-create-library': 'onSubmit',
    'change .source': 'switchLibraryView',
  },

  switchLibraryView() {
    const source = document.getElementById('lib-selector');
    const src = source.options[source.selectedIndex].value;
    NavFunc.removeView(this);
    if (src === 'python') {
      window.router.navigate('create/pythonLibrary/' + this.parentId, { trigger: true });
    } else if (src === 'maven') {
      window.router.navigate('create/mavenLibrary/' + this.parentId, { trigger: true });
    }
  },

  onSubmit() {
    const self = this;
    // We don't do any validation on form input because the submit button is only enabled
    // when all the inputs are valid.
    const name = this.$('.field_library_name').val();
    let file = '';
    _.forEach(this.jarFiles, (val) => { file = val; });
    if (!file) {
      DeprecatedDialogBox.alert('You did not upload any file.', false, 'OK');
      return;
    }
    $.ajax('/libraries/create', {
      contentType: 'application/json; charset=UTF-8',
      type: 'POST',
      data: JSON.stringify({
        name: name,
        file: file,
        parentId: this.parentId,
        libraryType: 'java-jar',
        autoAttach: false,
      }),
      success(msg) {
        NavFunc.removeView(self, false);
        const libId = msg.id;
        if (libId) {
          const route = '#/library/' + libId;
          window.router.navigate(route, { trigger: true });
        } else {
          console.error('LibraryCreateView', 'onSubmit', 'success', msg);
          window.router.navigate('', { trigger: true });
        }
      },
      error(msg) {
        self.$('.library-create-message').html(msg.statusText);
      },
    });
  },
});

module.exports = LibraryCreateView;
