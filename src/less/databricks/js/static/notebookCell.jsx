/* global notebookModelJson */
/* global notebookModelCommandCollection */

import React from 'react';
import ReactDOM from 'react-dom';

import WorkspacePermissions from '../acl/WorkspacePermissions';

import NotebookCommandModel from '../notebook/NotebookCommandModel';
import NotebookModel from '../notebook/NotebookModel';
import ReactNotebookCommandView from '../notebook/ReactNotebookCommandView.jsx';

import IconsForType from '../ui_building_blocks/icons/IconsForType';

const NOOP = () => {};

const notebookModel = new NotebookModel(JSON.parse(atob(notebookModelJson)));
notebookModel.set({ permissionLevel: WorkspacePermissions.VIEW });
// TODO(jeffpang): include the subcommands of the command here for %run commands
// also when we have multi-select, we will support multiple command models here
// also allowing multiple commands here also keeps the format consistent with static notebooks
// so that in the future we can also import notebooks from static cells
const commandModel = new NotebookCommandModel(JSON.parse(atob(notebookModelCommandCollection))[0]);
commandModel.set({ permissionLevel: WorkspacePermissions.VIEW });

window.recordEvent = NOOP;
window.recordUsage = NOOP;
window.settings.isStaticNotebook = true;

const devWarning = window.settings.deploymentMode === 'development' ? (
  <div className='cell-dev-version'>
    <i className={'fa fa-' + IconsForType.warning} />
  </div>
) : null;

ReactDOM.render((
  <div id={"overallView"} style={{ top: '0px' }}>
    <div id={"content"} style={{ top: '0px' }}>
      <div className={"overallContainer"}>
        {devWarning}
        <div id={"cellContainer"}
          className={"shell-top new-notebook"}
          style={{ position: 'absolute', width: '100%' }}
        >
          <ReactNotebookCommandView
            addCommandAbove={NOOP}
            addCommandBelow={NOOP}
            command={commandModel}
            index={0}
            isCommenting={false}
            isFirstCommand
            isLastCommand={false}
            isLocked={false}
            isStatic
            mobile={false}
            moveDown={NOOP}
            moveUp={NOOP}
            navigateDown={NOOP}
            navigateUp={NOOP}
            notebook={notebookModel}
            onTextSelected={NOOP}
            pasteCommandAbove={NOOP}
            pasteCommandBelow={NOOP}
            permissionLevel={WorkspacePermissions.VIEW}
            resultsOnly={false}
            showCommentMarks={false}
            subCommands={[]}
          />
        </div>
      </div>
    </div>
  </div>
), document.getElementById('databricks-notebook-cell'));
