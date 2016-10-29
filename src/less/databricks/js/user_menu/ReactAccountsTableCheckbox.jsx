/* eslint react/prefer-es6-class: 0 */

import _ from 'underscore';
import React from 'react';

import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

import Account from '../user_menu/Account';

const ReactAccountsTableCheckbox = React.createClass({
  propTypes: {
    adminCheckboxDisabled: React.PropTypes.bool,
    adminCheckboxDisabledReason: React.PropTypes.object,
    model: React.PropTypes.instanceOf(Account).isRequired,
    numAdmins: React.PropTypes.number,
    onChangeCallback: React.PropTypes.func,
  },

  getInitialState() {
    return ({
      // Are we currently updating the admin state? If true, disable some UI elements
      // in the parent table
      updateInFlight: false,
    });
  },

  onChangeAdmin() {
    const self = this;
    if (self.isMounted()) {
      self.setState({ updateInFlight: true });
    }
    const onComplete = function onComplete() {
      if (self.isMounted()) {
        self.setState({ updateInFlight: false });
      }
      self.props.onChangeCallback();
    };

    // We defer sending the RPC because we want React to update any UI elements before we send the
    // RPC. As of now, we just disable the admin check box, so that you can't rapidly check it and
    // un-check it.
    _.defer(() => self.props.model.toggleAdmin(onComplete));
  },

  render() {
    let isAdminChecked = this.props.model.get('isAdmin');

    // If we are updating the state, we should make the checkbox reflect the change that was just
    // made which is the opposite of the current state.
    if (this.state.updateInFlight) {
      isAdminChecked = !isAdminChecked;
    }

    let checkboxDisabled = false;
    let checkboxTooltipText = null;

    // Hack to extract the actual text of the React tooltip from its React element representation.
    // This is necessary to work around the data-tooltip-text hack, which is only used in tests.
    const extractText = function extractText(elem) {
      if (elem === null) {
        return elem;
      }
      let str = '';
      const spanElems = elem.props ? elem.props.children : [elem];
      spanElems.forEach((child) => {
        const toAdd = child.props ? child.props.children : child;
        str += toAdd;
      });

      return str;
    };

    if (this.state.updateInFlight) {
      // If it's disabled because it's inflight, don't show a message
      checkboxDisabled = true;
    } else if (this.props.adminCheckboxDisabled) {
      // If it's disabled by props, then use that message
      checkboxDisabled = true;
      checkboxTooltipText = this.props.adminCheckboxDisabledReason;
    } else if (isAdminChecked && (this.props.numAdmins === 1)) {
      // If the current user is the last admin, don't let them be removed
      checkboxDisabled = true;
      checkboxTooltipText = 'Cannot remove last admin user';
    }

    let checkbox = (
      // Right now, the data-tooltip-text prop is only used for testing
      <div ref='adminCheckbox' className='checkbox-wrapper'>
        <input type='checkbox'
          className='admin-checkbox'
          key={this.props.model.get('username') + '-admin-checkbox'}
          data-name={this.props.model.get('username') + '-admin-checkbox'}
          name='admin'
          onChange={this.onChangeAdmin}
          defaultChecked={isAdminChecked}
          disabled={checkboxDisabled}
          data-tooltip-text={extractText(checkboxTooltipText)}
        />
      </div>
    );

    // Wrap the checkbox in a tooltip if the tooltip text is defined.
    // We attach to the body because otherwise the tooltip shows up under
    // the table rows that follow.
    if (checkboxTooltipText) {
      checkbox = (
        <Tooltip ref='stateTooltip' text={checkboxTooltipText} attachToBody
          hoverDelayMillis={0}
        >
          {checkbox}
        </Tooltip>
      );
    }

    return checkbox;
  },
});

module.exports = ReactAccountsTableCheckbox;
