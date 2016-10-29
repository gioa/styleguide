import React from 'react';

import { Pluralize } from '../../i18n/Pluralize';

function spanify(n, s) {
  return <span>{n.toFixed(2)}{' '}{Pluralize.simplePluralize(n, s)}</span>;
}

/**
 * It's a <span> the contains a time span ahaha
 */
export function TimeSpan({ seconds }) {
  if (seconds < 60) {
    return spanify(seconds, 'second');
  } else if (seconds / 60 < 60) {
    return spanify(seconds / 60, 'minute');
  } else if (seconds / 60 / 60 < 24) {
    return spanify(seconds / 60 / 60, 'hour');
  }
  return spanify(seconds / 60 / 60 / 24, 'day');
}

TimeSpan.propTypes = {
  seconds: React.PropTypes.number.isRequired,
};
