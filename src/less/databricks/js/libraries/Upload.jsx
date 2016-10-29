/**
 * This file holds common functionality and helpers for code allowing the user to upload a file.
 * Its purpose is faciliate sharing of common and default functionality between table upload,
 * library upload, etc.
 */

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';

/**
 * Helper for common upload error handling scenarios, including:
 * - Invalid file type
 * - Size too large
 * - Default catch-all
 */
export class UploadErrorHandlers {
  /**
   * Default handler that will attempt to detect the type of failure and show the user an error
   * message dialog. It will also remove the file that had the error from the upload list.
   *
   * @param  {Dropzone} uploadInterface A dropzone object instance.
   * @param  {DropzoneFileUpload} file
   * @param  {string} msg The error message. Possible the server response.
   * @return {none}
   */
  static defaultHandler(uploadInterface, file, msg) {
    console.error('Upload error', file, msg);
    // It is possible the user cancelled the upload, in which case we do not need to manually
    // remove the file. In that case, the file.status message will be "canceled".
    if (file.status === 'error') {
      if (UploadErrorHandlers.isInvalidFileTypeError(uploadInterface, msg)) {
        UploadErrorHandlers.invalidFileType(uploadInterface, file);
      } else if (UploadErrorHandlers.isSizeLimitExceedError(file.xhr, msg)) {
        UploadErrorHandlers.fileSizeLimitExceeded(uploadInterface, file, msg);
      } else {
        UploadErrorHandlers.unhandledError(uploadInterface, file);
      }

      uploadInterface.removeFile(file);
    }
  }

  /**
   * Show a dialog box for invalid file type errors.
   *
   * @param  {Dropzone} uploadInterface A dropzone object instance.
   * @param  {DropzoneFileUpload} file
   * @param  {string} msg The error message. Possible the server response.
   * @return {none}
   */
  static invalidFileType(uploadInterface, file) {
    DeprecatedDialogBox.alert(
      'The file you attempted to upload is not a valid type.' +
      ` Received (${file.type}).`,
      false,
      'OK');
  }

  /**
   * Show a dialog box for file limit exceed errors.
   *
   * @param  {Dropzone} uploadInterface A dropzone object instance.
   * @param  {DropzoneFileUpload} file
   * @param  {string} msg The error message. Possible the server response.
   * @return {none}
   */
  static fileSizeLimitExceeded(uploadInterface, file, msg) {
    DeprecatedDialogBox.alert(
      'The file you attempted to upload exceeds the maximum size limit. ' +
      UploadErrorHandlers.getUserMessagingForSizeExceededError(file.xhr, msg),
      false,
      'OK');
  }

  /**
   * Show a dialog box for an error. This will expose the XHR's statusText response if it is
   * available.
   *
   * @param  {Dropzone} uploadInterface A dropzone object instance.
   * @param  {DropzoneFileUpload} file
   * @param  {string} msg The error message. Possible the server response.
   * @return {none}
   */
  static unhandledError(uploadInterface, file) {
    // @TODO(jengler) 2016-03-01: We should find out all the different possible exceptions
    // so we can provide better messaging.
    DeprecatedDialogBox.alert(
      'There was an error uploading your file. ' + UploadErrorHandlers.getFileXHRStatusText(file),
      false,
      'OK');
  }

  /**
   * Did the dropzone upload fail use to a size exceeded warning. This checks in two ways just in
   * case one changes. First, it checks the XHR attribute of the file to see if its statusText
   * matches the size exceeded error message. If not, then it will check the provided msg to see
   * if it matches the size exceeded error message. Checking both things just to provided
   * flexibility, but we probably do not need both.
   *
   * @param  {XMLHttpRequest}  xhr  The file object created by Dropzone
   * @param  {string} msg The error message. Possible the server response.
   * @return {Boolean} True iff the exception type matches the file size exceeded error.
   */
  static isSizeLimitExceedError(xhr, msg) {
    const xhrFailedDueToSize = xhr && xhr.statusText && xhr.statusText.match(/size.*exceeds/);
    const msgFailedDueToSize = msg && (msg.match(/size.*exceeds/) || msg.match(/File is too big/));
    return Boolean(xhrFailedDueToSize || msgFailedDueToSize);
  }

  /**
   * Check if the failure message is a dropzone style invalid file type error.
   *
   * @param  {Dropzone} uploadInterface A dropzone object instance.
   * @param  {string} msg The error message. Possible the server response.
   * @return {Boolean} True iff msg matches dropdoze dictInvalidFileType string.
   */
  static isInvalidFileTypeError(uploadInterface, msg) {
    return msg === uploadInterface.options.dictInvalidFileType;
  }

  /**
   * Get the statusText from and XHR or return empty string if not present.

   * @param  {DropzoneFileUpload} file
   * @return {string}      The XHR status text for the file or empty string.
   */
  static getFileXHRStatusText(file) {
    const xhr = file.xhr;
    return (xhr && xhr.statusText) || '';
  }

  /**
   * Parse out the max size limitation from a server side exception message. It could be string
   * or an HTML string that is returned, but we only look for something of the format:
   *   "maximum (12345)""
   * and return the "12345" as a string.
   *
   * @param  {string} msg The error message. Possible the server response.
   * @return {string|null} If found returns the matching string. This is unit-less.
   */
  static parseSizeFromServerSideException(msg) {
    const maxSize = msg.match(/maximum \((\d*)\)/);
    return maxSize && maxSize[1];
  }

  /**
   * Format a nice error message for users when they hit a file too big exception. If a max file
   * size can be determined, will return a description of the max size. Otherwise, returns an empty
   * string.
   *
   * @param  {DropzoneFileUpload} file
   * @param  {string} msg The error message. Possible the server response.
   * @return {string} If max size can be parsed from exception, returns it. Otherwise, empty string.
   */
  static getUserMessagingForSizeExceededError(xhr, msg) {
    if (xhr && xhr.statusText) {
      const maxSize = UploadErrorHandlers.parseSizeFromServerSideException(xhr.statusText);
      if (maxSize) {
        return `Maximum file size is ${maxSize} bytes.`;
      }
    }

    if (msg) {
      let maxSize = msg.match(/filesize: ([^.]*)\./);
      if (maxSize && maxSize[1]) {
        return `Maximum file size is ${maxSize[1]}.`;
      }

      maxSize = UploadErrorHandlers.parseSizeFromServerSideException(msg);
      if (maxSize) {
        return `Maximum file size is ${maxSize} bytes.`;
      }
    }

    return '';
  }
}
