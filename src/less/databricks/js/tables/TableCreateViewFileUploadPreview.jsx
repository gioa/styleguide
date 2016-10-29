import React from 'react';

import IconsForType from '../ui_building_blocks/icons/IconsForType';
import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

import { DbGuideUrls } from '../urls/DbGuideUrls';
import DbGuideLinks from '../urls/DbGuideLinks';

/**
 * A very simple class that shows files that are uploaded in the TableCreateView.
 *
 * TODO(jeffpang): refactor this when we redo the TableCreateView as a react view.
 */
export class TableCreateViewFileUploadPreview extends React.Component {

  _dbfsFilePaths() {
    const dir = this.props.dbfsDirPath;
    return this.props.filenames.map((filename) => dir + '/' + filename);
  }

  render() {
    const paths = this._dbfsFilePaths();

    if (paths.length === 0) {
      return null;
    }

    // array of paths uploaded (as code divs)
    const pathList = (
      <div>
        {paths.map((path) => <div key={path}><code>{path}</code></div>)}
      </div>
    );

    // the path that would be passed to sc.textFile(...)
    const scTextFile = paths.length === 1 ? paths[0] : this.props.dbfsDirPath + '/*';

    const guideUrl = DbGuideUrls.getDbGuideUrl(DbGuideLinks.DBFS_PYTHON_URL);
    const tooltipText =
      (<div>
        <p>
          Spark can access files in the Databricks File System (DBFS).
          For example, you can use:
        </p>
        <p>
          <code>sc.textFile("{scTextFile}")</code>
        </p>
        <p>
          Click <em>Preview Table</em> to create a table from these files.&nbsp;
          <a target='_blank' href={guideUrl}>Learn more about DBFS.</a>
        </p>
      </div>);

    const helpIcon =
      (<Tooltip text={tooltipText} customPosition={{ contentLeft: '0px' }}>
        <i className={'fa fa-' + IconsForType.hint} />
      </Tooltip>);

    return (
      <div className='file-upload-row'>
        <div className='table-preview-left-panel'>
          <label>Uploaded to DBFS {helpIcon}</label>
        </div>
        <div className='table-preview-right-panel'>
          {pathList}
        </div>
      </div>
    );
  }
}

TableCreateViewFileUploadPreview.propTypes = {
  // the directory path in DBFS where we uploaded the files to
  dbfsDirPath: React.PropTypes.string.isRequired,
  // an array of all the filenames that have been uploaded to the directory
  // their full path is $s3dirPath/$filename[$i]
  filenames: React.PropTypes.array.isRequired,
};
