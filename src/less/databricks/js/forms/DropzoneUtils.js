// Do not remove jquery or dropzone. These dependencies install some hooks into jquery and are
// required for a working dropzone.
import $ from 'jquery';
import _ from 'lodash';

import 'dropzone/dist/dropzone-amd-module';

export class DropzoneUtils {
  /**
   * Installs a dropzone object on the specified element.
   *
   * This method adds the csrf token and sets up dropzone in fallback mode if we run in test
   * environment.
   * @param jqElt a jquery element
   * @param dropzoneOpts the options for the dropzone plugin
   * @param testModeInit when in selenium test mode, automatically run the init() function in
   *   dropzoneOpts and bind the success and error callbacks correctly. Default to true. If
   *   testModeInit is false, then in selenium test mode, the drop zone form will by default
   *   not run init() or forward the success and error callbacks, so you must implement the
   *   form submission yourself. You should NOT set testModeInit to false unless you know what
   *   you are doing since it will generally imply that the testing code path is different than
   *   the production code path -- this option is only exposed for legacy code that did this.
   * @return the dropzone element
   */
  static installDropzone(jqElt, dropzoneOpts, testModeInit) {
    testModeInit = testModeInit === undefined ? true : testModeInit;
    const optionsCopy = _.clone(dropzoneOpts);
    // Set the CSRF token in the request headers
    optionsCopy.headers = optionsCopy.headers || {};
    optionsCopy.headers['X-CSRF-Token'] = window.settings ? window.settings.csrfToken : null;
    if (window.testMode) {
      optionsCopy.forceFallback = true;
    }
    const dropzoneElt = jqElt.dropzone(optionsCopy);

    // The following code path is only used in selenium testMode. It is used because selenium
    // can not upload files using the standard dropzone UI.
    if (window.testMode && testModeInit) {
      const form = dropzoneElt.find('form');
      const dropzone = dropzoneElt[0].dropzone;
      if (dropzoneOpts.init) {
        // in fallback mode, the initialization is not called
        dropzoneOpts.init.bind(dropzone)();
      }

      const getMockFile = function getMockFile() {
        // the val() of the input field has a fake value of something like C:\fakepath\<filename>
        const filename = form.find('input[type=file]').val().split('/').pop().split('\\').pop();
        return {
          previewElement: $('<div/>')[0],
          name: filename,
          type: 'file',
          size: 0,
          accepted: true,
        };
      };

      // We must rewrite the submission button action so that we remain on the page even after the
      // file is uploaded. We perform the ajax request ourselves and invoke the success and error
      // callbacks that were installed into the dropzone
      form.submit(function submitFunc() {
        const url = $(this).attr('action');
        const formDom = form.get(0);
        const data = new FormData(formDom);
        $.ajax({
          url: url,
          type: 'POST',
          data: data,
          // forward success and errors to the appropriate callbacks
          success(response) {
            const mockFile = getMockFile();
            dropzone.files.push(mockFile);
            dropzone.emit('success', mockFile, response);
          },
          error(msg) {
            dropzone.emit('error', getMockFile(), msg.responseText);
          },
          contentType: false,
          processData: false,
        });
        return false;
      });
    }

    return dropzoneElt;
  }
}
