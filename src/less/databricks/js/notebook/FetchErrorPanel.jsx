import React from 'react';

import WorkspacePermissions from '../acl/WorkspacePermissions';

/**
 * @param{object} error: Object returned from notebook.notebookFetchError().
 */
export function FetchErrorPanel({ error }) {
  let heading;
  let message = error.statusText;

  if (error.status === 403) {
    heading = 'Permission Denied';
    const parsed = WorkspacePermissions.parsePermissionError(message);
    if (parsed) {
      message =
      (<span>
        <b>{parsed.username}</b> does not have <b>{parsed.permission}</b> permissions on
        <i> {parsed.path}</i>.
        <br /><br />
        Please contact your administrator for access.
      </span>);
    }
  } else {
    heading = 'Loading Error';
  }

  // show an error view if the initial notebook fetch fails
  // we include an empty context-bar since the Router tries to unmount it
  return (
    <div>
      <div className='new-notebook context-bar' id='context-bar'>
      </div>
      <div id='content'>
        <div className='new-notebook error-panel'>
          <h1>{heading}</h1>
          <p>{message}</p>
        </div>
      </div>
    </div>
  );
}

FetchErrorPanel.propTypes = {
  error: React.PropTypes.shape({
    statusText: React.PropTypes.string,
    status: React.PropTypes.number,
  }).isRequired,
};
