import React from 'react';

function Terminal({ uri }) {
  return (
    <iframe
      id='terminal-iframe'
      src={uri}
      frameBorder='0'
      height='95%'
      width='100%'
    />);
}

Terminal.propTypes = {
  uri: React.PropTypes.string.isRequired,
};

module.exports = Terminal;

