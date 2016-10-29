/* eslint max-lines: 0, func-names: 0 */

/**
 * Parent view for editing table data.
 */

import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';

import React from 'react';
import ReactDOM from 'react-dom';

import FileTree from '../filetree/FileTree';
import NavFunc from '../filetree/NavFunc.jsx';

import { DropzoneUtils } from '../forms/DropzoneUtils';

import { TimingUtils } from '../js_polyfill/TimingUtils';

import LocalUserPreference from '../../js/local_storage/LocalUserPreference';

import HiveSchema from '../tables/HiveSchema';
import PreviewTable from '../tables/PreviewTable';
import PreviewTableView from '../tables/PreviewTableView';
import { TableCreateViewFileUploadPreview } from '../tables/TableCreateViewFileUploadPreview.jsx';
import { isValidHiveTableName, isValidTableColumnName } from '../tables/NameValidators.js';

import tableCreateTemplate from '../templates/tableCreate.html';
import noClusterTemplate from '../templates/tableCreateNoCluster.html';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';
import IconsForType from '../ui_building_blocks/icons/IconsForType';

let refreshed = false;

const tableAlreadyExistRe = /Table \w+ already exists/g;

// they key for the default data source in local preferences
const DEFAULT_DATA_SOURCE_KEY = 'defaultDataSource';

const TableCreateView = Backbone.View.extend({
  initialize() {
    this.dataSource = 'S3';
    this.files = []; // Information about uploaded files
    this.name = 'Create Table';

    // JQuery selectors
    this.selectors = {
      dataSource: "select[name='data-source-select']",
      awsKey: "input[name='s3-aws-key']",
      awsKeyId: "input[name='s3-aws-key-id']",
      bucket: "input[name='s3-bucket']",
      path: "input[name='s3-path']",
      tableName: "input[name='table-name']",
      fileType: "select[name='file-type']",
      fileUploadMessage: '.file-upload-message',
      preview: 'button.submit-preview-table',
      submitButton: 'button.submit-create-table',
      s3browser: 'div.s3-source.s3-browser',
      tableDetails: '.table-details',
      fileTreeSpinner: 'i.file-tree-preview-spinner',
      tableDetailsSpinner: 'i.table-preview-spinner',
      createSpinner: 'i.create-spinner',
      overflowMessage: '.filetree-overflow-message',
    };

    // Mapping from supported file types to selectors that contain relevant properties
    // for that file type only.
    this.fileTypeToSelector = {
      'CSV': '.csv-table-details',
      'Avro': '.avro-table-details',
      'Parquet': '.parquet-table-details',
      'JSON': '.json-table-details',
    };

    // As mentioned above, some file types may contain properties that are only relevant
    // for that type (e.g. delimiters for CSV). Mapping below stores selectors for extra
    // properties that we support (per type). Note that some of these extra options
    // might change how the table looks, so you should assign onTableInfoChanged event
    // to them so that table preview gets refreshed when option changes.
    this.extraOptionsForType = {
      'CSV': {
        delimiter: "input[name='field-delimiter']",
        useHeader: "input[name='use-header']",
      },
      'Avro': {},
      'Parquet': {},
      'JSON': {
        useFullTableInference: "input[name='use-full-table-inference']",
      },
    };

    this.localPref = new LocalUserPreference('TableCreateView');
  },

  render() {
    const clusters = window.clusterList;
    if (clusters.finishedInitialFetch && clusters.attachableClusters().length === 0) {
      this.$el.html(noClusterTemplate({
        message: 'You need to create a cluster to import tables.',
      }));
    } else if (clusters.finishedInitialFetch && clusters.getDefaultCluster() === undefined) {
      this.$el.html(noClusterTemplate({
        message: 'You need to set a default cluster to import tables.',
      }));
    } else if (clusters.finishedInitialFetch && !clusters.isDefaultClusterUsable()) {
      this.$el.html(noClusterTemplate({
        message: 'Your Default Cluster is unhealthy, please restart it or set another cluster as' +
          'default before importing tables.',
      }));
    } else {
      this.$el.html(tableCreateTemplate);
      // if the user has a preference in local storage, use it
      const initialSelection = this.localPref.get(DEFAULT_DATA_SOURCE_KEY);
      if (initialSelection) {
        this.$('select.table-import-select-field').val(initialSelection);
      }
    }
    this.$el.attr('class', 'table-import'); // Possible to define this in the view?

    // TODO(aaron) Remove this after adding a selenium test for JDBC.
    if (window.settings.enableJdbcImport === false) {
      this.$('#jdbc-data-source-option').hide();
    }
    this.onDataSourceChanged();
  },

  // clean up the reactviews mounted in this backbone view
  remove() {
    Backbone.View.prototype.remove.call(this);
    try {
      this.hideFileUploadMessage();
    } catch (err) {
      // ignore errors if it wasn't mounted
    }
  },

  _s3TempUrlDropZoneOptions() {
    const self = this;
    return {
      uploadMultiple: false,
      thumbnailWidth: 50,
      thumbnailHeight: 50,
      maxFilesize: window.settings.dropzoneMaxFileSize,
      url: window.settings.dbfsS3Host,
      dictRemoveFile: 'Remove file',
      method: 'POST',
      addRemoveLinks: true,
      dictDefaultMessage: 'Drop file or click here to upload',
      init() {
        this.on('success', function(file, message) {
          const respXml = $.parseXML(message);
          const filePath = $(respXml).find('Key').text();
          self.files.push(filePath);
          if (this.getUploadingFiles().length === 0) {
            // Only show preview once all files were uploaded.
            self.onFileUploaded();
          }
        });

        this.on('removedfile', function(file) {
          if (file.CUSTOM_STATUS === 'rejected') {
            // There is no need to make a delete request if file was rejected
            return;
          }
          $.ajax('/upload/s3_delete/', {
            type: 'GET',
            data: {
              fileName: file.name,
              dstDirectoryName: self.dstDirectoryName,
            },
            success() {
              // self.files contains full paths for all files. Remove path of the file that
              // we just removed
              self.files = _.without(self.files, file.postData.key);
              if (self.files.length === 0) {
                // There are no more files uploaded, hide preview and options
                self.hideAllExtraOptions();
                self.$(self.selectors.preview).hide();
                self.$(self.selectors.tableDetails).hide();
                self.$(self.selectors.submitButton).hide();
                self.$('.table-import-columns').empty();
                self.hideFileUploadMessage();
              } else {
                // Refresh the table preview, since some file was removed
                self.onFileUploaded();
              }
            },
            error() {
              DeprecatedDialogBox.alert('Unable to remove uploaded file from S3');
            },
          });
        });

        // Remove the file if it is not the accepted type.
        this.on('error', function(file, msg) {
          // We remove the file because data-dz-errormessage will show the
          // XML error message from Amazon
          file.CUSTOM_STATUS = 'rejected';
          this.removeFile(file);
          DeprecatedDialogBox.alert(
            'Error occurred when processing file ' + file.name + ': ' + msg);
          if (self.files.length !== 0 && this.getUploadingFiles().length === 0) {
            // If there was an error with one of the files, we still want to show the preview
            // for others, but only if there aren't any other files being uploaded.
            self.onFileUploaded();
          }
        });
      },

      accept(file, done) {
        file.postData = [];
        $.ajax('/upload/s3/', {
          contentType: 'application/json; charset=UTF-8',
          type: 'GET',
          data: {
            fileName: file.name,
            dstDirectoryName: self.dstDirectoryName,
          },
          success(response) {
            file.CUSTOM_STATUS = 'ready';
            file.postData = response;
            done();
          },
          error() {
            file.CUSTOM_STATUS = 'rejected';
            DeprecatedDialogBox.alert('Error preparing upload header');
            // Any non-empty input is treated by done() as error. However, it is not displaying
            // any error message, so we use DeprecatedDialogBox for that.
            done(' ');
          },
        });
      },

      canceled() {},

      sending(file, xhr, formData) {
        $.each(file.postData, function(k, v) {
          formData.append(k, v);
        });
      },
    };
  },

  _directDropZoneOptions() {
    const self = this;
    return {
      url: '/upload/table/' + this.dstDirectoryName,
      uploadMultiple: false,
      thumbnailWidth: 50,
      thumbnailHeight: 50,
      maxFilesize: window.settings.dropzoneMaxFileSize,
      dictRemoveFile: 'Remove file',
      addRemoveLinks: true,
      dictDefaultMessage: 'Drop file or click here to upload',
      init() {
        this.on('success', function(file, msg) {
          file.dbfsPath = window.settings.fileStoreBase + msg[0].fsPath;
          self.files.push(file.dbfsPath);
          self.requestPath = self.getFilePath();
          if (this.getUploadingFiles().length === 0) {
            // Only show preview once all files were uploaded.
            self.onFileUploaded();
          }
        });

        this.on('removedfile', function(file) {
          if (file.CUSTOM_STATUS === 'rejected') {
            // There is no need to make a delete request if file was rejected
            return;
          }
          $.ajax('/ajax-api/2.0/dbfs/delete', {
            method: 'POST',
            data: JSON.stringify({ path: '/' + file.dbfsPath }),
            success() {
              // self.files contains full paths for all files. Remove path of the file that
              // we just removed
              self.files = _.without(self.files, file.dbfsPath);
              if (self.files.length === 0) {
                // There are no more files uploaded, hide preview and options
                self.hideAllExtraOptions();
                self.$(self.selectors.preview).hide();
                self.$(self.selectors.tableDetails).hide();
                self.$(self.selectors.submitButton).hide();
                self.$('.table-import-columns').empty();
                self.hideFileUploadMessage();
              } else {
                // Refresh the table preview, since some file was removed
                self.onFileUploaded();
              }
            },
            error() {
              DeprecatedDialogBox.alert('Unable to remove uploaded file from DBFS');
            },
          });
        });

        // Remove the file if it is not the accepted type.
        this.on('error', function(file, msg) {
          file.CUSTOM_STATUS = 'rejected';
          this.removeFile(file);
          DeprecatedDialogBox.alert(
            'Error occurred when processing file ' + file.name + ': ' + msg);
          if (self.files.length !== 0 && this.getUploadingFiles().length === 0) {
            // If there was an error with one of the files, we still want to show the preview
            // for others, but only if there aren't any other files being uploaded.
            self.onFileUploaded();
          }
        });
      },
    };
  },

  renderDropZone() {
    const self = this;
    const $elt = $('div#dropzoneTableFiles');
    if ($elt.hasClass('dz-clickable')) {
      // Avoid re-inserting dropzone if the host div is already dz-clickable (PROD-2576)
      if (self.files.length > 0) {
        // There already are some files added, so preview can be shown
        this.onFileUploaded();
      }
      return;
    }

    this.dstDirectoryName = self.generateUUID();
    this.dropzoneFiles = DropzoneUtils.installDropzone(
      $elt,
      window.settings.useTempS3UrlForTableUpload ?
        this._s3TempUrlDropZoneOptions() :
        this._directDropZoneOptions(),
      false /* testModeInit = false since we bind submit below */);

    // TODO(jeffpang): remove this test code since it is a different code path than production
    // For test mode
    const form = this.$('div.dropzone form');
    if (!form) {
      return;
    }
    form.submit(function() {
      $.ajax({
        url: 'upload/table/' + this.dstDirectoryName,
        type: 'POST',
        data: new FormData(form.get(0)),
        success(response) {
          _.forEach(response, function(blob) {
            self.files.push(window.settings.fileStoreBase + '/' + blob.fsPath);
          });
          // Since we did not directly upload the file to S3, we don't know its S3 path.
          // But we do know the DBFS path. We pretend data source is DBFS from here on.
          self.dataSource = 'DBFS';
          self.requestPath = self.getFilePath();
          self.onFileUploaded();
        },
        error(msg) {
          console.log('renderDropZone', 'error', msg);
        },
        // JQuery should not infer the content-type to single-part, we force it to multi-part.
        contentType: false,
        // JQuery should not process data (which would move to another page)
        processData: false,
      });
      return false;
    });
  },

  _getFilenameFromPath(path) {
    const components = path.split('/');
    return components[components.length - 1];
  },

  showFileUploadMessage() {
    const messageDiv = this.$(this.selectors.fileUploadMessage);
    messageDiv.show();
    // just get the file names
    const files = this.files.map(this._getFilenameFromPath);
    const component =
      <TableCreateViewFileUploadPreview dbfsDirPath={this._dbfsDirPath()} filenames={files} />;
    ReactDOM.render(component, messageDiv[0]);
  },

  hideFileUploadMessage() {
    const messageDiv = this.$(this.selectors.fileUploadMessage);
    ReactDOM.unmountComponentAtNode(messageDiv[0]);
    messageDiv.hide();
  },

  // this is called when the user has uploaded at least one file
  onFileUploaded() {
    // show the user where the file was uploaded
    this.showFileUploadMessage();

    if (this.$(this.selectors.tableDetails).is(':visible')) {
      // if the table preview was already visible, update the table preview
      this.onTableSourceGiven();
    } else {
      // else, show a button that lets the user preview the table if they like
      const previewSelector = this.$(this.selectors.preview);
      previewSelector.show();
      previewSelector.attr('disabled', false);
    }
  },

  /**
   * This function generates a unique sub-directory string, where the uploaded files will
   * be placed on S3. The first part of the UUID are 8 random characters from digits and
   * lowercase English letters. The second part is the current timestamp.
   */
  generateUUID() {
    return Math.random().toString(36).substring(2, 10) +
      new Date().getTime();
  },

  renderDBFSFileTree() {
    const self = this;
    const rootNode = new FileTree.Node('#', 'root', null, true);

    this.treeProvider = {
      getRootNode() {
        return rootNode;
      },

      selectionChanged(node) {
        if (node.id !== '#') {
          self.$(self.selectors.preview).attr('disabled', false);
        }
        self.requestPath = node.id === '#' ? '/' : node.id + '/';
      },

      // Non-leaf node
      getChildren(node, callback) {
        self.requestPath = (node.id === '#' ? 'dbfs:/' : 'dbfs:' + node.id);
        self.$(self.selectors.fileTreeSpinner).css('opacity', '1');
        if (node.id !== '#') {
          self.$(self.selectors.preview).attr('disabled', false);
        }
        $.ajax('/import/dbfs/list', {
          type: 'POST',
          data: JSON.stringify({
            path: self.requestPath,
            dataSource: self.dataSource,
          }),
          success(data) {
            const overflow = data.overflow;
            if (overflow) {
              console.warn('Missing children when listing ', self.requestPath);
              self.$(self.selectors.overflowMessage).css('visibility', 'visible');
            } else {
              self.$(self.selectors.overflowMessage).css('visibility', 'hidden');
            }
            const children = data.paths.map(function(pathNode) {
              return {
                id: pathNode.id,
                name: pathNode.text,
                icon: (pathNode.children ? IconsForType.folder : 'file'),
                openIcon: (pathNode.children ? IconsForType.openFolder : undefined),
                hasChildren: pathNode.children,
              };
            });
            self.$(self.selectors.fileTreeSpinner).css('opacity', '0');
            callback(children);
          },
          error(msg, textStatus, errorThrown) {
            self.$(self.selectors.fileTreeSpinner).css('opacity', '0');
            console.error('Got an error:', textStatus, errorThrown);
            let errorMessage = '';
            try {
              const errorXml = $.parseXML(errorThrown);
              errorMessage = $(errorXml).find('Message').text();
            } catch (except) {
              // HTTP errors will not be XML, so just display them as is
              errorMessage = errorThrown;
            }
            DeprecatedDialogBox.alert('AWS Error: ' + errorMessage);
          },
        });
      },
    };

    this.fileTree = new FileTree(this.$('.FileTree'), this.treeProvider,
                                 { scrollElement: this.$('.filetree-container') });
  },


  renderFileTree(bucketName) {
    const self = this;
    const rootNode = new FileTree.Node('#', 'root', null, true);

    this.treeProvider = {
      getRootNode() {
        return rootNode;
      },

      selectionChanged(node) {
        if (node.id !== '#') {
          self.$(self.selectors.preview).attr('disabled', false);
        }
        const curPath = node.id === '#' ? bucketName : node.id;
        self.requestPath = 's3a://' + curPath + '/';
      },

      // Non-leaf node
      getChildren(node, callback) {
        const curPath = node.id === '#' ? bucketName : node.id;
        self.requestPath = 's3a://' + curPath + '/';

        self.$(self.selectors.fileTreeSpinner).css('opacity', '1');

        if (node.id !== '#') {
          self.$(self.selectors.preview).attr('disabled', false);
        }

        $.ajax('/import/s3/list', {
          type: 'POST',
          data: JSON.stringify({
            path: self.requestPath,
            awsKeyId: self.$(self.selectors.awsKeyId).val(),
            awsKey: self.$(self.selectors.awsKey).val(),
            dataSource: self.dataSource,
          }),
          success(data) {
            const overflow = data.overflow;
            if (overflow) {
              console.warn('Missing children when listing ', self.requestPath);
              self.$(self.selectors.overflowMessage).css('visibility', 'visible');
            } else {
              self.$(self.selectors.overflowMessage).css('visibility', 'hidden');
            }
            const children = data.paths.map(function(pathNode) {
              return {
                id: pathNode.id,
                name: pathNode.text,
                icon: (pathNode.children ? IconsForType.folder : 'file'),
                openIcon: (pathNode.children ? IconsForType.openFolder : undefined),
                hasChildren: pathNode.children,
              };
            });
            self.$(self.selectors.fileTreeSpinner).css('opacity', '0');

            callback(children);
          },
          error(msg, textStatus, errorThrown) {
            self.$(self.selectors.fileTreeSpinner).css('opacity', '0');
            console.error('Got an error:', textStatus, errorThrown);
            let errorMessage = '';
            try {
              const errorXml = $.parseXML(errorThrown);
              errorMessage = $(errorXml).find('Message').text();
            } catch (except) {
              // HTTP errors will not be XML, so just display them as is
              errorMessage = errorThrown;
            }
            DeprecatedDialogBox.alert('AWS Error: ' + errorMessage, false, 'OK');
          },
        });
      },
    };

    this.fileTree = new FileTree(this.$('.FileTree'), this.treeProvider,
                                 { scrollElement: this.$('.filetree-container') });
  },

  events: {
    "change select[name='data-source-select']": 'onDataSourceChanged',
    "change select[name='file-type']": 'onFileTypeChanged',
    'click .submit-create-table': 'onUserSubmit',
    "keyup input[name='table-name']": 'onTableNameChanged',
    "keydown input[name='table-name']": 'onTableNameChanged',
    "change input[name='table-name']": 'onTableNameChanged',
    'click button.s3-browse-submit': 'onAWSKeysGiven',
    'click button.submit-preview-table': 'onTableSourceGiven',
    'click button.refresh-btn': 'onFileTreeRefresh',
    'click button.jdbc-connect': 'onTableSourceGiven',
    'focus .table-import-columns': 'tableFocused',
    'blur .table-import-columns': 'tableBlurred',
    'click button.add-jdbc-property': 'addJDBCPropField',

    // The events below are for extra options that change table appearance is some way.
    // onTableInfoChanged refreshes the table preview that we show.
    "change input[name='field-delimiter']": 'onTableInfoChanged',
    "change input[name='use-header']": 'onTableInfoChanged',
    "change input[name='use-full-table-inference']": 'onTableInfoChanged',
  },

  hideAllOptions() {
    // Hide every possible option field that could be shown right now. When something
    // changed, it's easier to hide everything, and only show relevant things afterwards.
    this.$('.s3-source').hide();
    this.$('.file-source').hide();
    this.$('.jdbc-source').hide();
    this.$('.jdbc-extra-properties').hide();
    this.$(this.selectors.tableDetails).hide();
    this.hideAllExtraOptions();
  },

  onDataSourceChanged() {
    this.$(this.selectors.submitButton).hide();
    this.hideAllOptions();
    this.dataSource = this.$(this.selectors.dataSource).val();

    if (this.dataSource === 'File') {
      // Show file upload controls
      this.$('.file-source').show();
      // defer the dropzone installation since the div is not mounted on the initial render
      _.defer(this.renderDropZone.bind(this));
      this.$('.refresh-btn').hide();
      this.$(this.selectors.preview).hide();
    } else if (this.dataSource === 'S3') {
      // Hide file upload controls
      this.$('.s3-source').show();
      this.$(this.selectors.s3browser).hide();
      this.$(this.selectors.preview).hide();
      this.$('.refresh-btn').show();
    } else if (this.dataSource === 'DBFS') {
      this.$(this.selectors.s3browser).show();
      this.$(this.selectors.preview).show();
      this.renderDBFSFileTree();
      this.$('.refresh-btn').hide();
    } else if (this.dataSource === 'JDBC') {
      this.$('.jdbc-source').show();
      this.$('.jdbc-extra-properties').show();
      // We need to set fileType so that we don't render extra properties for some file type.
      this.$(this.selectors.fileType).val('JDBC');
      this.$('.refresh-btn').hide();
    }

    // save the user's selection as a local preference
    this.localPref.set(DEFAULT_DATA_SOURCE_KEY, this.dataSource);
  },

  onFileTypeChanged() {
    const selectedFileType = this.$(this.selectors.fileType).val();
    // Show the new file-type's specific properties and hide the others
    let fileType;
    for (fileType in this.fileTypeToSelector) {
      if (selectedFileType === fileType) {
        this.$(this.fileTypeToSelector[fileType]).show();
      } else {
        this.$(this.fileTypeToSelector[fileType]).hide();
      }
    }

    this.onTableInfoChanged(); // This causes us to update the preview
  },

  openS3Bucket() {
    const awsKeyId = this.$(this.selectors.awsKeyId).val();
    const awsKey = this.$(this.selectors.awsKey).val();
    if (awsKey && awsKeyId && this.s3Bucket && this.dataSource === 'S3') {
      this.$(this.selectors.s3browser).show();
      this.$(this.selectors.preview).show();
      this.renderFileTree(this.s3Bucket);
    } else {
      let missing = 'AWS Key ID';
      if (awsKey === '') {
        missing = 'AWS Key';
      } else if (this.s3Bucket === '') {
        missing = 'S3 Bucket Name';
      }
      DeprecatedDialogBox.alert('Please provide an ' + missing + '.', false, 'OK');
    }
  },

  onAWSKeysGiven() {
    refreshed = false;
    // Set the value of this.s3Bucket to the bucket value in the UI here, so clicking the refresh
    // button refreshes the view of this bucket rather than whatever is in the bucket input when
    // Refresh is clicked.
    this.s3Bucket = this.$(this.selectors.bucket).val();
    this.openS3Bucket();
  },

  onFileTreeRefresh() {
    refreshed = true;
    const openNodes = this.fileTree.openNodes;
    this.openS3Bucket();
    if (openNodes.length > 1) {
      TimingUtils.retryUntil({
        condition: function() {
          return refreshed && this.fileTree && this.isFileTreeLoading();
        }.bind(this),
        success: function() {
          const path = openNodes[openNodes.length - 2].selectedChild.split('/');
          let i;
          for (i = 1; i < path.length; i++) {
            const panel = i === 1 ? 'root' : path[i - 1];
            this.openFileTreeTo(panel, path[i]);
          }
        }.bind(this),
        interval: 500,
        maxAttempts: 5000,
      });
    }
  },

  isFileTreeLoading() {
    return $('body').find('i.file-tree-preview-spinner').css('opacity') === '0';
  },

  openFileTreeTo(panel, link) {
    TimingUtils.retryUntil({
      condition() {
        const a = $('body')
          .find("div[data-panel='" + panel + "']")
          .find("a[data-name='" + link + "']")
          .find('span');
        return refreshed && a[0] !== undefined;
      },
      success() {
        const a = $('body')
          .find("div[data-panel='" + panel + "']")
          .find("a[data-name='" + link + "']")
          .find('span');
        a.click();
      },
      interval: 100,
      maxAttempts: 24000,
    });
  },

  onTableSourceGiven() {
    const path = this.requestPath ? this.requestPath : this.getFilePath();
    const nameTokens = path ? path.split('/').filter(function(t) { return t !== ''; }) : null;
    const folderName = nameTokens ? nameTokens[nameTokens.length - 1] : '';
    // replace non-alphanumeric chars with '_'
    const tableName = folderName ? folderName.replace(/\W+/g, '_') : '';

    if (this.dataSource === 'S3') {
      const awsKeyId = this.$(this.selectors.awsKeyId).val();
      const awsKey = this.$(this.selectors.awsKey).val();

      if (path && awsKeyId && awsKey) {
        this.$(this.selectors.tableDetails).show();
        this.$('.table-import-columns').show();
        this.$('.table-import-submit').show();
        this.$(this.selectors.createSpinner).css('opacity', '0');
        this.$(this.selectors.tableName).val(tableName);
      } else {
        this.$(this.selectors.tableDetails).hide();
        this.$('.table-import-columns').hide();
      }
    } else if (this.dataSource === 'File') {
      if (this.files.length !== 0) {
        this.$(this.selectors.tableDetails).show();
        this.$('.table-import-columns').show();
        this.$('.table-import-submit').show();
        this.$(this.selectors.createSpinner).css('opacity', '0');
        this.$(this.selectors.tableName).focus();
        this.guessFileType(this.files[0]);
      } else {
        this.$(this.selectors.tableDetails).hide();
      }
    } else if (this.dataSource === 'DBFS') {
      this.$(this.selectors.tableDetails).show();
      this.$('.table-import-columns').show();
      this.$('.table-import-submit').show();
      this.$(this.selectors.createSpinner).css('opacity', '0');
      this.$(this.selectors.tableName).val(tableName);
    } else if (this.dataSource === 'JDBC') {
      this.$(this.selectors.tableDetails).show();
      this.$('.table-import-columns').show();
      this.$('.table-import-submit').show();
      this.$(this.selectors.createSpinner).css('opacity', '0');
      this.$('.filetype-options').hide(); // Not needed
    }
    // Scroll to the bottom of the page
    $('#content').animate({ scrollTop: $('#content').height() }, 1000);
    this.onFileTypeChanged();
  },

  getFilePath() {
    // We only support a single file for now
    const path = '/' + this.files[0];
    const tokens = path.split('/');
    if (tokens.length > 0) {
      return tokens.slice(0, tokens.length - 1).join('/');
    }
    return '/';
  },

  // the DBFS path of the directory
  _dbfsDirPath() {
    const filePath = this.getFilePath();
    if (!window.settings.useTempS3UrlForTableUpload) {
      // this is already a DBFS path
      return filePath;
    }
    // else this is an S3 path
    // get the index of the third /, which is the end of the /shardName/orgId/... prefix
    const startIdx = filePath.split('/', 3).join('/').length;
    return filePath.substring(startIdx);
  },

  addJDBCPropField() {
    // TODO(hossein): Rewrite this to be nicer.
    this.$('.jdbc-extra-properties').append(
      "<div class='row-fluid jdbc-table-details'>" +
        "  <div class='table-preview-left-panel'>" +
        "    <input type='text' placeholder='Key (e.g. useSSL)'" +
        "      class='jdbcPropName table-details-input-field' />" +
        '  </div>' +
        "  <div class='table-preview-right-panel'>" +
        "    <input type='text' placeholder='Value (e.g. true)'" +
        "      class='jdbcPropVal table-import-input-field' />" +
        "    <a class='removeJdbcProp'><i class='fa fa-remove fa-fw' /></a>" +
        '  </div>' +
        '</div>');
    // Assign handler to the remove button
    this.$('.removeJdbcProp').last().click(function() {
      // Remove entire div devoted to this extra property
      $(this).parent().parent().remove();
    });
  },

  collectJDBCProperties(dataSource) {
    if (dataSource !== 'JDBC') {
      return ''; // We don't have to pass JDBC properties in this case
    }

    // Construct a map of properties to put into OPTIONS clause of CREATE
    // query. (e.g. ",username 'admin',useSSL 'true'" or "").
    const props = {
      url: this.$("input[name='jdbc-url']").val(),
      dbtable: this.$("input[name='jdbc-query']").val(),
      user: this.$("input[name='jdbc-username']").val(),
      password: this.$("input[name='jdbc-password']").val(),
    };

    const extraPropNames = this.$('.jdbcPropName');
    const extraPropVals = this.$('.jdbcPropVal');
    for (let i = 0; i < extraPropNames.lenght; i++) {
      props[this.$(extraPropNames[i]).val()] = this.$(extraPropVals[i]).val();
    }

    return JSON.stringify(props);
  },

  onTableNameChanged() {
    const tableName = this.$(this.selectors.tableName).val();
    if (tableName !== '') {
      this.$(this.selectors.submitButton).attr('disabled', false);
    } else {
      this.$(this.selectors.submitButton).attr('disabled', true);
    }
  },

  onTableInfoChanged() {
    let path = this.requestPath;
    if (this.dataSource === 'File' && this.files.length !== 0) {
      path = this.getFilePath();
    }
    const awsKeyId = this.$(this.selectors.awsKeyId).val();
    const awsKey = this.$(this.selectors.awsKey).val();
    let fileType = this.$(this.selectors.fileType).val();
    this.onTableNameChanged();

    // Default error message
    const errMsg = 'Not enough information to fetch table data';

    let showTablePreview = false;
    if (this.dataSource === 'S3' && path && awsKeyId && awsKey) {
      showTablePreview = true;
    } else if (this.dataSource === 'File' && path) {
      showTablePreview = true;
    } else if (this.dataSource === 'DBFS' && path) {
      showTablePreview = true;
    } else if (this.dataSource === 'JDBC') {
      // This isn't a file type, but we need it to tell ImportHandler which datasource to use.
      fileType = 'JDBC';
      showTablePreview = true;
    }

    if (showTablePreview) {
      const _this = this;
      _this.$('.table-import-columns-message').html('Loading table preview  ');
      _this.$(_this.selectors.tableDetailsSpinner).css('opacity', '1');
      _this.$('.table-error-zone').removeClass('table-error-message');
      _this.$('.table-error-zone').text('');
      _this.$('.table-import-columns').css('visibility', 'hidden');

      // Right now CSV is the only file type that allows you to modify schema
      this.previewTable = new PreviewTable({ canModifySchema: fileType === 'CSV' });
      this.previewTableView = new PreviewTableView({ model: this.previewTable });

      $.ajax('/import/s3/preview', {
        type: 'POST',
        data: JSON.stringify($.extend({
          numLines: 20,
          path: path,
          dataSource: this.dataSource,
          awsKeyId: awsKeyId,
          awsKey: awsKey,
          fileType: fileType,
          jdbcProps: _this.collectJDBCProperties(_this.dataSource),
        },
        this.getExtraOptionsForType(fileType))),
        success(table) {
          _this.$('.table-import-columns').css('visibility', 'visible');
          if (table && table.data) {
            const parsedSchema = table.schema.map(function(x) {
              // Note: the table preview information is not persisted in tree store, so we can
              // assume we're always getting the new JSON schema.
              return {
                name: x.name,
                type: HiveSchema.parseJson(JSON.parse(x.type)),
              };
            });

            _this.previewTable.updateRowsAndSchema(table.data, parsedSchema);
            _this.$('.table-import-columns').attr('tabindex', '-1');
            _this.$('.table-import-columns').html(_this.previewTableView.$el);
            _this.$(_this.selectors.submitButton).show();
          } else {
            DeprecatedDialogBox.alert('There was a problem with getting your data.', false, 'OK');
          }
          // If delimiter was autodetected and user didn't provide it, we should set it
          const delimSelection = $(_this.extraOptionsForType.CSV.delimiter).val();
          // delimSelection is not provided (empty string) or is undefined (because view unmounted)
          if (!delimSelection && table.detectedDelimiter !== undefined) {
            // Display tab as \t so that it's easier to understand for the user
            if (table.detectedDelimiter === '\t') {
              table.detectedDelimiter = '\\t';
            }
            $(_this.extraOptionsForType.CSV.delimiter).val(table.detectedDelimiter);
          }
          $('.table-import-columns-message').html('Previewing table');
          _this.$(_this.selectors.tableDetailsSpinner).css('opacity', '0');
        },
        error(jqXHR, textStatus, errorThrown) {
          _this.$('.table-error-zone').addClass('table-error-message');
          _this.$('.table-error-zone').text('ERROR: ' + errorThrown);
          _this.$('.table-import-columns-message').html('');
          _this.$('.table-import-columns').html('');
          _this.$(_this.selectors.tableDetailsSpinner).css('opacity', '0');
          // For everything apart from JDBC user can change the file type to go away.
          // For JDBC there is no need to show that section.
          if (_this.dataSource === 'JDBC') {
            _this.$(_this.selectors.tableDetails).hide();
          }
        },
      });
    } else {
      DeprecatedDialogBox.alert(errMsg, false, 'OK');
      this.$(this.selectors.tableDetailsSpinner).css('opacity', '0');
    }
  },

  onUserSubmit() {
    const _this = this;
    const name = this.$(this.selectors.tableName).val();
    let path = this.requestPath;
    const awsKeyId = this.$(this.selectors.awsKeyId).val();
    const awsKey = this.$(this.selectors.awsKey).val();
    let fileType = this.$(this.selectors.fileType).val();

    if (!isValidHiveTableName(name)) {
      DeprecatedDialogBox.alert('Invalid Hive Table name: ' + name +
                      '. Table names can only contain alphanumeric and underscore, ' +
                      'and must start with a letter or underscore.', false, 'OK');
      return;
    }

    if (this.dataSource === 'JDBC') {
      // This isn't a file type, but we need it to tell ImportHandler which datasource to use.
      fileType = 'JDBC';
    }
    if (this.dataSource === 'File' && this.files.length !== 0) {
      path = this.getFilePath();
    }

    const colNames = _this.previewTable.get('colNames');
    const colFormats = _this.previewTable.get('colTypes');
    const numColumns = colNames.length;
    const columnArray = [];

    for (let idx = 0; idx < numColumns; idx++) {
      const curColumn = {
        name: colNames[idx],
        schema: colFormats[idx],
      };
      if (!isValidTableColumnName(curColumn.name)) {
        DeprecatedDialogBox.alert('Invalid table column name: ' + curColumn.name +
          ". Column names can consist of any characters except: , ` \" ' ;", false, 'OK');
        return;
      }
      columnArray.push(curColumn);
    }

    _this.$(_this.selectors.submitButton).attr('disabled', true);
    _this.$(_this.selectors.createSpinner).css('opacity', '1');
    $.ajax('/import/new-table', {
      contentType: 'application/json; charset=UTF-8',
      type: 'PUT',
      data: JSON.stringify($.extend({
        name: name,
        path: path,
        awsKeyId: awsKeyId,
        awsKey: awsKey,
        dataSource: _this.dataSource,
        external: true,
        columns: columnArray,
        fileType: fileType,
        jdbcProps: _this.collectJDBCProperties(_this.dataSource),
      },
                                    this.getExtraOptionsForType(fileType))
                          ),
      success() {
        NavFunc.removeView(_this);
        window.router.navigate('#/table/' + name, { trigger: true });
      },
      error(jqXHR, textStatus, errorThrown) {
        _this.$(_this.selectors.submitButton).attr('disabled', false);
        _this.$(_this.selectors.createSpinner).css('opacity', '0');
        if (jqXHR.status === 404 && errorThrown.indexOf('Bad Target') >= 0) {
          DeprecatedDialogBox.alert('No default cluster found. Please designate one.', false, 'OK');
        } else if (jqXHR.status === 500 && errorThrown.match(tableAlreadyExistRe)) {
          DeprecatedDialogBox.alert(
            'There is already a table named ' + name + ', please rename your table',
            false,
            'OK',
            function() {
              $("input[name='table-name']").focus();
              $("input[name='table-name']").select();
            });
        } else {
          DeprecatedDialogBox.alert(errorThrown.substring(0, 1000), false, 'OK');
        }
      },
    });
  },

  tableFocused() {
    this.$('.table-import-columns').removeClass('noscroll');
  },

  tableBlurred() {
    this.$('.table-import-columns').addClass('noscroll');
  },

  hideAllExtraOptions() {
    // Hide all type-specific options
    let fileType;
    for (fileType in this.fileTypeToSelector) {
      if (this.fileTypeToSelector.hasOwnProperty(fileType)) {
        this.$(this.fileTypeToSelector[fileType]).hide();
      }
    }
  },

  /**
   * Get values of type-specific extra options. For example, in case of CSV, we will
   * get the value of delimiter and bool value of weather first row should be used as
   * header. The map that we returned is combined with options that all types must
   * specify (e.g. table name) in onTableInfoChanged function.
   */
  getExtraOptionsForType(fileType) {
    const extraOptions = {};
    const optionToSelectorMap = this.extraOptionsForType[fileType];

    let optionName;
    for (optionName in optionToSelectorMap) {
      if (this.$(optionToSelectorMap[optionName]).is(':checkbox')) {
        extraOptions[optionName] = this.$(optionToSelectorMap[optionName]).is(':checked');
      } else {
        extraOptions[optionName] = this.$(optionToSelectorMap[optionName]).val();
      }
    }

    return extraOptions;
  },

  guessFileType(path) {
    // This function guesses the default file type that we should use based on extension
    if (path.match('avro$')) {
      this.$(this.selectors.fileType).val('Avro');
    } else if (path.match('parquet$')) {
      this.$(this.selectors.fileType).val('Parquet');
    } else if (path.match('json$')) {
      this.$(this.selectors.fileType).val('JSON');
    } else {
      this.$(this.selectors.fileType).val('CSV');
    }
  },
});

module.exports = TableCreateView;
