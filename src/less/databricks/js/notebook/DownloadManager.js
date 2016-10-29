import Export from '../notebook/Export';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';

class DownloadManager {
  constructor(alwaysDownloadExistingData, mayHaveStoredResults, getExistingData,
              getResultDownloadURL, runCommandAndSaveResults) {
    this.alwaysDownloadExistingData = alwaysDownloadExistingData;
    this.mayHaveStoredResults = mayHaveStoredResults;
    this.getExistingData = getExistingData;
    this.getResultDownloadURL = getResultDownloadURL;
    this.runCommandAndSaveResults = runCommandAndSaveResults;
  }

  handleDownload() {
    if (this.alwaysDownloadExistingData) {
      this.downloadExistingData();
    } else {
      this.handleLargeTableDownload();
    }
  }

  downloadExistingData() {
    const data = this.getExistingData();
    Export.downloadTableAsCSV(data.columnNames, data.rows, 'export.csv');
  }

  downloadStoredResults(noStoredResultsCallback) {
    this.getResultDownloadURL({
      success(res) {
        if (!res.hasStoredResults) {
          if (noStoredResultsCallback) {
            noStoredResultsCallback();
          }
        } else {
          Export.downloadFromURL(res.url);
        }
      },
    });
  }

  handleLargeTableDownload() {
    if (!this.mayHaveStoredResults) {
      // We need to re-execute the command to store the results to DBFS.
      this.handleNoStoredResults();
    } else {
      // We may have results we can serve directly without re-executing.  If there are not actually
      // stored results (e.g.: if garbage collection occured), we call handleNoStoredResults.
      this.downloadStoredResults(this.handleNoStoredResults.bind(this));
    }
  }

  handleNoStoredResults() {
    DeprecatedDialogBox.confirm({
      message: 'You must re-execute the command in order to download over ' +
        window.settings.displayRowLimit + ' rows.',
      confirm: this.reexecuteCommand.bind(this),
      confirmButton: 'Re-execute and download',
    });
  }

  reexecuteCommand() {
    const onDBFSResultPath = function onDBFSResultPath() {
      this.getResultDownloadURL({
        success(res) {
          if (res.hasStoredResults) {
            Export.downloadFromURL(res.url);
          }
        },
      });
    }.bind(this);

    this.runCommandAndSaveResults({ commandFinished: onDBFSResultPath });
  }
}

module.exports = {
  /*
   * Download a command result. This will download results from the browser or from DBFS.
   *
   * See the design doc for info:
   * https://docs.google.com/document/d/1GqD7N9kgE5uUpCak_WV2yB3kRMn4Numo88KddaCu8v4/edit#
   *
   * @param alwaysDownloadExistingData if true, always download the data served to the browser.
   * @param mayHaveStoredResults if true, full results may already be stored.
   * @param getExistingData a function that returns the data that has already been served to the
   *                        browser and is being viewed. The returned object should contain fields
   *                        "columnNames" and "rows".
   * @param getResultDownloadURL RPC to get the URL to download the full results from.
   * @param runCommandAndSaveResults RPC to re-run the command to store the full results.
   */
  download(alwaysDownloadExistingData, maybeHaveStoredResults, getExistingData,
                     getResultDownloadURL, runCommandAndSaveResults) {
    const mgr = new DownloadManager(alwaysDownloadExistingData, maybeHaveStoredResults,
        getExistingData, getResultDownloadURL, runCommandAndSaveResults);
    mgr.handleDownload();
  },
};
