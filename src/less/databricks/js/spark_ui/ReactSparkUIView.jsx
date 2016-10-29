
import React from 'react';

function SparkUI({ sparkUiUrl }) {
  return (
    <iframe
      id='sparkui-iframe'
      src={sparkUiUrl}
      frameBorder='0'
      width='100%'
    />);
}

SparkUI.propTypes = {
  sparkUiUrl: React.PropTypes.string,
};

module.exports = SparkUI;

