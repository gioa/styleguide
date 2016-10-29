import React from 'react';

const RichCommandError = require('../notebook/RichCommandError.jsx');
const CommandResult = require('../notebook/CommandResult.jsx');
const NotebookCommandModel = require('../notebook/NotebookCommandModel');

function SubCommandResults({ model, tags }) {
  const updateCommand = model.updateCommand.bind(model);
  const runCommand = model.runCommand.bind(model);

  return (
    <div className='command-result command-child'>
      <CommandResult
        {...model.attributes}
        tags={tags}
        updateCommand={updateCommand}
        runCommand={runCommand}
        isChild
        isComplexResult={model.isComplexResult()}
        isParamQuery={model.isParamQuery()}
        commandModel={model}
      />
      <RichCommandError
        parentCollapsed={model.get('collapsed')}
        state={model.get('state')}
        errorSummary={model.get('errorSummary') || ''}
        error={model.get('error') || ''}
      />
    </div>
  );
}

SubCommandResults.propTypes = {
  model: React.PropTypes.instanceOf(NotebookCommandModel).isRequired,
  tags: React.PropTypes.object,
};

module.exports = SubCommandResults;
