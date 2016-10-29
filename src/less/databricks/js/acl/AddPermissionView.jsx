/* eslint react/prefer-es6-class: 0, func-names: 0 */

import _ from 'underscore';
import React from 'react';
import ClassNames from 'classnames';

import PermissionSelection from '../acl/PermissionSelection.jsx';
import WorkspacePermissions from '../acl/WorkspacePermissions';

import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

function matchFragment(input, string) {
  input = input.toLowerCase();
  string = string.toLowerCase();

  if (!_.isEmpty(input) && string.indexOf(input) !== -1) {
    return true;
  }
  return false;
}

/**
 * Used by PermissionEditView to create the "Add Users and Groups" section
 * of the edit permissions dialog.
 */
const AddPermissionView = React.createClass({
  propTypes: {
    permissions: React.PropTypes.array.isRequired,
    setPermission: React.PropTypes.func.isRequired,
    onAddPermission: React.PropTypes.func.isRequired,
    nodeType: React.PropTypes.string.isRequired,
  },

  getInitialState() {
    return {
      inputValue: '',
      permissionToAdd: WorkspacePermissions.getInitialPermissionToAdd(this.props.nodeType),
      // whether the dropdown menu showing addible users & groups is expanded
      showSuggestions: false,
      selectedUserPerm: null,
      focusIndex: -1,
      selectableUsers: this.getSelectableUsers(),
    };
  },

  componentWillReceiveProps(nextProps) {
    this.setState({ selectableUsers: this.getSelectableUsers(nextProps) });
  },

  onSelectionChange(value) {
    this.setState({ permissionToAdd: value });
  },

  focusPrevious() {
    const currentFocusIndex = this.state.focusIndex;
    const maxIndex = this.state.selectableUsers.length - 1;
    if (currentFocusIndex > 0) {
      this.setFocusIndex(currentFocusIndex - 1);
    } else {
      this.setFocusIndex(maxIndex);
    }
    this.scrollFocusedItemIntoView();
  },

  focusNext() {
    const currentFocusIndex = this.state.focusIndex;
    const maxIndex = this.state.selectableUsers.length - 1;
    if (currentFocusIndex < maxIndex) {
      this.setFocusIndex(currentFocusIndex + 1);
    } else {
      this.setFocusIndex(0);
    }
    this.scrollFocusedItemIntoView();
  },

  setFocusIndex(index) {
    const selectableUsers = this.state.selectableUsers;
    const value = selectableUsers[index].user.username;
    const input = this.refs.input;
    this.setState({
      focusIndex: index,
      inputValue: value,
      selectedUserPerm: this.findUserperm(value),
    });
    _.defer(function() {
      input.select();
    });
  },

  scrollFocusedItemIntoView(focusIndex) {
    const self = this;
    _.defer(function() {
      if (!self.isMounted()) {
        return;
      }
      const index = _.isNumber(focusIndex) ? focusIndex : self.state.focusIndex;
      const item = self.refs['selection-list-' + index];
      if (item) {
        item.scrollIntoView(false);
      }
    });
  },

  onKeyDown(e) {
    if (e.keyCode === 13) { // enter
      e.preventDefault();
      this.submit();
    } else if (e.keyCode === 38 || (e.shiftKey && e.keyCode === 9)) {
      // up arrow key or shift-tab
      e.preventDefault();
      this.focusPrevious();
    } else if (e.keyCode === 40 || e.keyCode === 9) {
      // down arrow key or tab
      e.preventDefault();
      this.focusNext();
    }
  },

  findUserperm(value) {
    return _.find(this.props.permissions, function(userPerm) {
      return userPerm.user.username.toLowerCase() === value.toLowerCase() ||
        userPerm.user.fullName.toLowerCase() === value.toLowerCase();
    });
  },

  handleInputChange(event) {
    const value = event.target.value.substr(0, 48);
    this.setState({
      inputValue: value,
      selectedUserPerm: this.findUserperm(value),
      showSuggestions: true,
      focusIndex: -1,
      selectableUsers: this.getSelectableUsers(null, value),
    });
    this.scrollFocusedItemIntoView(0);
  },

  submit(userPerm) {
    userPerm = (userPerm && userPerm.user) ? userPerm : this.state.selectedUserPerm;
    const permission = this.state.permissionToAdd;
    if (!userPerm) {
      return;
    }
    this.props.setPermission(
      userPerm.user.id,
      WorkspacePermissions.toActions(permission, this.props.nodeType)
    );
    this.setState({
      inputValue: '',
      showSuggestions: false,
      selectedUserPerm: null,
      focusIndex: -1,
    });
    this.props.onAddPermission(userPerm);
  },

  toggleSuggestions(e) {
    e.preventDefault();
    const showSuggestions = this.state.showSuggestions;
    if (!showSuggestions) {
      this.refs.input.focus();
    } else {
      this.refs.input.blur();
    }
  },

  onInputBlur() {
    this.setState({ showSuggestions: false });
  },

  onInputFocus() {
    this.setState({ showSuggestions: true });
  },

  onListItemClicked(userPerm) {
    this.setState({
      selectedUserPerm: userPerm,
      inputValue: userPerm.user.username,
    });
  },

  _getInputValue(input) {
    let inputValue = input;
    if (input === undefined) {
      inputValue = this.state ? this.state.inputValue : '';
    }
    return inputValue;
  },

  getSelectableUsers(props, input) {
    const inputValue = this._getInputValue(input);
    const userPerms = props ? props.permissions : this.props.permissions;
    const matchedUsers = [];
    let allUsersIndex;
    const sortedUsers = userPerms.sort(function(a, b) {
      // make groups always appear first
      if (a.user.kind === 'group' && b.user.kind === 'user') {
        return -1;
      } else if (a.user.kind === 'user' && b.user.kind === 'group') {
        return 1;
      }
      return a.user.fullName.toLowerCase().localeCompare(b.user.fullName.toLowerCase());
    });

    // Go through sorted users and store them if they match the input value.
    // If there's no input value, store the index of the 'all users' group
    // to put it at the top of the list later.
    sortedUsers.forEach(function(user, index) {
      if (inputValue) {
        if (matchFragment(inputValue, user.user.fullName) ||
            matchFragment(inputValue, user.user.username)) {
          matchedUsers.push(user);
        }
      } else if (user.user.username === 'users' && user.user.kind === 'group') {
        allUsersIndex = index;
      }
    });

    // return matched users if there's an input value, or all sorted users if not
    if (!_.isEmpty(inputValue) && matchedUsers.length > 0) {
      return matchedUsers;
    }
    // move 'all users' to the top of the list
    if (allUsersIndex) {
      const allUsersObj = sortedUsers.splice(allUsersIndex, 1)[0];
      sortedUsers.unshift(allUsersObj);
    }
    return sortedUsers;
  },

  render() {
    const selectedUserPerm = this.state.selectedUserPerm;

    const autoCompleteSuggestions = _.map(
      this.state.selectableUsers, function(userPerm, index) {
        const hasFocus = index === this.state.focusIndex;
        const classes = ClassNames({
          selected: selectedUserPerm && userPerm.user.id === selectedUserPerm.user.id,
          focused: hasFocus,
        });
        const onClick = _.bind(this.onListItemClicked, this, userPerm);
        return (
          <li data-user={userPerm.user.username}
            ref={'selection-list-' + index}
            className={classes}
            onMouseDown={onClick}
          >
            <span className='user-fullname'>{userPerm.user.fullName}</span>
            <span>({userPerm.user.username})</span>
          </li>);
      }, this);

    const submitBtn = _.isEmpty(selectedUserPerm) ? (
      <a
        className='btn'
        data-action='add'
        disabled
      >Add</a>) : (
        <a
          className='btn btn-primary'
          data-action='add'
          onClick={this.submit}
        >Add</a>);

    const selectUser = this.state.selectableUsers.length > 0 ? (<div className='select-user'>
      <input
        ref='input'
        className='username-input'
        onKeyDown={this.onKeyDown}
        value={this.state.inputValue}
        onBlur={this.onInputBlur}
        onFocus={this.onInputFocus}
        onChange={this.handleInputChange}
      />
      <span
        className='auto-complete-btn'
        onMouseDown={this.toggleSuggestions}
      >▾</span>
      <div className={'auto-complete-list' + (this.state.showSuggestions ? ' visible' : '')}>
        <ul>{autoCompleteSuggestions}</ul>
      </div>
    </div>) : (<Tooltip text='There are no more users or groups to add.'>
      <div className='select-user select-user-tooltip'>
        <input
          ref='input'
          className='username-input'
          disabled
        />
        <span className='auto-complete-btn'>▾</span>
      </div>
    </Tooltip>);

    return (<div className='add-user'>
      {selectUser}
      {submitBtn}
      <PermissionSelection
        principalName={"Users"}
        nodeType={this.props.nodeType}
        currentPermission={this.state.permissionToAdd}
        onChange={this.onSelectionChange}
        showPermissionDescriptions
        hideNoPermissionsOption
      />
    </div>);
  },
});

module.exports = AddPermissionView;
