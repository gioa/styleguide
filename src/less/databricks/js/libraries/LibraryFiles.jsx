import React from 'react';

export function LibraryFiles({ libraryType, files }) {
  // In the case of PyPI, there is no files.
  if (!files) {
    return (<div></div>);
  }
  const isPypi = libraryType === 'python-pypi';
  const isMaven = libraryType === 'maven';
  const isJavaJar = libraryType === 'java-jar';
  const fileElems = files.map((file) => {
    let link;
    if (isPypi) {
      link = 'https://pypi.python.org/pypi/' + file;
    } else if (isMaven) {
      link = '/files/jars/maven/' + file.replace('#', '-');
    } else if (file.indexOf('jars/') === 0) {
      // Old link format may include a 'jars/' prefix as well.
      link = '/files/' + file;
    } else {
      link = '/files/jars/' + file;
    }
    let displayName = file;
    if (isJavaJar) {
      // The format of the JAR names is [UUID][DASH][JAR_NAME][DASH][SUFFIX][DOT JAR].
      const splits = file.split('-');
      if (splits.length === 2) {
        // There was a time where we did not include the suffix, so it's possible that there
        // are only two splits:
        displayName = splits[splits.length - 1];
      } else {
        displayName = splits[splits.length - 2] + '.jar';
      }
    } else if (isMaven) {
      // We hide the groupId from the user
      const nameSplits = file.split('/');
      displayName = nameSplits[nameSplits.length - 1].replace('#', '-');
    }
    return (
      <div key={file}><a className='file' href={link}>{ displayName }</a></div>
    );
  });
  let header = isPypi ? 'PyPI rules' : 'Files';
  header = isMaven ? 'Artifacts' : header;
  return (
    <div>
      <h3>{header}</h3>
      {fileElems}
    </div>
  );
}

LibraryFiles.propTypes = {
  libraryType: React.PropTypes.string.isRequired,
  files: React.PropTypes.array.isRequired,
};
