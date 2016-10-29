import React from 'react';

export class JobActionElement extends React.Component {
  legacyNotebookAction(action) {
    return <span key={action.notebookPath}>Snapshot of {action.notebookPath}</span>;
  }

  notebookAction(action) {
    return (
        <span key={action.notebookPath}>
          <span>Notebook at </span>
          <a className='job-action-link'
            href={'#workspace' + action.notebookPath}
          >{action.notebookPath}</a>
        </span>
    );
  }

  jarNameFromFile(s3JarFile) {
    const splitPoint = s3JarFile.indexOf('-');
    return s3JarFile.substring(splitPoint + 1);
  }

  jarAction(action) {
    return (
        <span key={action.s3JarFile}>
          <span>{action.mainClassName} in </span>
          <a href={'/files/job-jars/' + action.s3JarFile}>{action.s3JarFile}</a>
        </span>
    );
  }

  unknownAction(action) {
    return <span key='unknownAction'>Unknown type: {JSON.stringify(action)}</span>;
  }

  isLegacyNotebookAction(notebookPath) {
    // Invalid path, which indicates a legacy (pre-1.2.0) notebook action.
    // Show the old message for backwards compatibility.
    return !notebookPath || notebookPath.indexOf('/') !== 0;
  }

  render() {
    const allActions = this.props.actions.map((action) => {
      if (action.type === JobActionElement.TYPE_NOTEBOOK) {
        if (this.isLegacyNotebookAction(action.notebookPath)) {
          return this.legacyNotebookAction(action);
        }
        return this.notebookAction(action);
      } else if (action.type === JobActionElement.TYPE_JAR) {
        return this.jarAction(action);
      }
      return this.unknownAction(action);
    });
    return <span className='job-action'>{allActions}</span>;
  }
}

JobActionElement.propTypes = {
  actions: React.PropTypes.array,
};

JobActionElement.TYPE_NOTEBOOK = 'notebook';
JobActionElement.TYPE_JAR = 'jar';
