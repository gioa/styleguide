/* eslint react/prefer-es6-class: 0 */

import _ from 'underscore';
import React from 'react';

import LargeOutputWrapper from '../notebook/commands/LargeOutputWrapper.jsx';

// PROD-4854: there are some old TreeStore nodes that have errors with raw strings in them
// which might have unescaped HTML chars. All newer errors are HTML and are escaped by the
// webapp. This is workaround to check for those old nodes and escape them
// TODO(jeffpang): we should pass the full HTML error result back from the webapp so that
// the frontend can sanitize the HTML itself. That is a major schema change though.
const escapeError = function escapeError(string) {
  // all new errors from the webapp are HTML and start with a <div> tag or something similar
  return string.indexOf('<') === 0 ? string : _.escape(string);
};

const CommandError = React.createClass({

  propTypes: {
    state: React.PropTypes.string.isRequired,
    collapsed: React.PropTypes.bool.isRequired,
    error: React.PropTypes.string.isRequired,
  },

  render() {
    if (this.props.state === 'error' && !this.props.collapsed) {
      return (
        // LargeOutputWrapper should have only one child inside
        <LargeOutputWrapper>
          <div
            className='ansiout command-result-error'
            dangerouslySetInnerHTML={{ __html: escapeError(this.props.error) }}
          />
        </LargeOutputWrapper>
      );
    }
    return null;
  },
});

module.exports = CommandError;
