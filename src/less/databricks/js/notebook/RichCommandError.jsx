/* eslint react/prefer-es6-class: 0 */

import _ from 'underscore';
import React from 'react';
import LargeOutputWrapper from '../notebook/commands/LargeOutputWrapper.jsx';

// PROD-4854: there are some old TreeStore nodes that have errors with raw strings in them
// which might have unescaped HTML chars. All newer errors are HTML and are escaped by the
// webapp. This is workaround to check for those old nodes and escape them
// TODO(jeffpang): we should pass the full HTML error result back from the webapp so that
// the frontend can sanitize the HTML itself. That is a major schema change though.
function escapeError(string) {
  // all new errors from the webapp are HTML and start with a <div> tag or something similar
  return string.indexOf('<') === 0 ? string : _.escape(string);
}

const RichCommandError = React.createClass({

  propTypes: {
    state: React.PropTypes.string.isRequired,
    parentCollapsed: React.PropTypes.bool.isRequired,
    errorSummary: React.PropTypes.string.isRequired,
    error: React.PropTypes.string.isRequired,
    overrideStackTraceString: React.PropTypes.string,
  },

  getInitialState() {
    return { collapsed: true };
  },

  toggleCollapse() {
    const currentCollapseState = this.state.collapsed;
    this.setState({ collapsed: !currentCollapseState });
  },

  render() {
    if (this.props.state === 'error' && !this.props.parentCollapsed) {
      return (
        <div>
          <div>
            <span className='ansiout command-result-error-summary'>
              {this.props.error === null || this.props.error === '' ? null :
                <a className='toggle-error-btn command-button'
                  onClick={this.toggleCollapse}
                  title={this.state.collapsed ? 'Maximize' : 'Minimize'}
                >
                  <i className={this.state.collapsed ?
                    'fa fa-fw fa-plus-square-o' : 'fa fa-fw fa-minus-square-o'}
                  >
                  </i>
                </a>}
              <span dangerouslySetInnerHTML={{ __html: escapeError(this.props.errorSummary) }} />
            </span>
          </div>

          {this.state.collapsed ? null :
            // LargeOutputWrapper should have only one child inside
            <LargeOutputWrapper>
              <div
                className='ansiout command-result-error-stackTrace'
                dangerouslySetInnerHTML={{ __html: escapeError(this.props.error) }}
              />
            </LargeOutputWrapper>}
        </div>
      );
    }
    return null;
  },
});

module.exports = RichCommandError;
