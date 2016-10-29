import { StringRenderers } from '../ui_building_blocks/text/StringRenderers';

import FileSaver from '../../lib/filesaver/FileSaver';

require('../../lib/blob/Blob');

const Export = {};

/**
 * Escape a string if it contains commas, newlines or quote characters.
 */
function maybeEscape(str) {
  if (/[,"\r\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Convert a table to a CSV string.
 *
 * @param columns Names of columns
 * @param data Array of rows, each of which are an array of field values
 */
Export.tableToCSV = function tableToCSV(columns, data) {
  let csv = '';
  let i;

  for (i = 0; i < columns.length; i++) {
    csv += maybeEscape(columns[i]);
    if (i < columns.length - 1) {
      csv += ',';
    }
  }
  csv += '\n';

  for (i = 0; i < data.length; i++) {
    for (let j = 0; j < data[i].length; j++) {
      csv += maybeEscape(StringRenderers.renderString(data[i][j]));
      if (j < data[i].length - 1) {
        csv += ',';
      }
    }
    csv += '\n';
  }

  return csv;
};

/**
 * Convert a table into a CSV file and start downloading it.
 *
 * @param columns - array of column names
 * @param data - array of table rows
 * @param {String} fileName - name of cvs files to be exported
 */
Export.downloadTableAsCSV = function downloadTableAsCSV(columns, data, fileName) {
  const csv = Export.tableToCSV(columns, data);
  const blob = new Blob([csv], { type: 'application/csv;charset=utf-8' });
  window.recordUsage('dataExported', blob.size);
  FileSaver.saveAs(blob, fileName);
};

/**
 * Download results from a URL.
 */
Export.downloadFromURL = function downloadFromURL(url) {
  window.location = url;
};

module.exports = Export;
