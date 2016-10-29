/* eslint react/prefer-es6-class: 0 */

import React from 'react';
import $ from 'jquery';
import _ from 'underscore';

import DropdownMenuView from '../ui_building_blocks/dropdowns/DropdownMenuView.jsx';

// The class name we use for the div that contains the filter text box in our dropdown view.
// The filter text box element is passed on to the elements list of DropdownMenuView, therefore
// we handle it specially using this class name.
const BRANCH_FILTER = 'github-input-branch-filter';
// The reference name for the filter text box. Having the reference name helps getting the value
// in the text box much simpler.
const BRANCH_FILTER_INPUT = 'branchFilter';

/**
 * The representation of a list item in our GitHubBranchDropdownView. This class is very lightweight
 * and is used more for storing the state and properties of the list item than to behave as a
 * complex UI component. There are two styles of list items:
 *   1) Regular element: Simply contains branch name, and shows a checkbox if it is the current
 *                       branch.
 *   2) Create Branch Element: Element that allows users to create a branch with the name in the
 *                             filter text box.
 * @params
 * - onSelected: Function to handle item selection. Should take in two arguments: the branch name,
 *               and whether the branch should be created or not. The second parameter will only
 *               be true if this element is a "Create Branch Element".
 * - value: The name of the branch
 * - isCreateBranch: Whether this is the "Create Branch Element".
 * - currentBranch: The name of the current branch. Used by the "Create Branch Element" to notify
 *                  the user where the new branch will be created (branched) from.
 */
const GitHubBranchListItem = React.createClass({

  propTypes: {
    onSelected: React.PropTypes.func.isRequired,
    value: React.PropTypes.string.isRequired,
    isCreateBranch: React.PropTypes.bool.isRequired,
    currentBranch: React.PropTypes.string.isRequired,
    iconClasses: React.PropTypes.string,
  },

  _onClick() {
    this.props.onSelected(this.props.value, this.props.isCreateBranch);
  },

  _isCurrentBranch() {
    return this.props.value === this.props.currentBranch;
  },

  _renderRegularElement() {
    const iClasses = 'fa fa-check';
    const iconClasses = this._isCurrentBranch() ? iClasses : iClasses + ' invisible';
    return (
      <div title={this.props.value}>
        <a className='github-branch-list-icon'><i className={iconClasses}></i></a>
        <span>{this.props.value}</span>
      </div>
    );
  },

  _renderCreateBranchElement() {
    return (
      <div className='github-branch-create'>
        <div>
          <a className='github-branch-list-icon'><i className='fa fa-code-fork'></i></a>
          <span>{'Create branch: ' + this.props.value}</span>
        </div>
        <div className='git-branch-from-text'>
          <a className='github-branch-list-icon'>
            <i className={this.props.iconClasses + ' invisible'}></i>
          </a>
          <span>{'from ' + this.props.currentBranch}</span>
        </div>
      </div>
    );
  },

  render() {
    return (
      <div className='github-branch-list-element' data-value={this.props.value}
        onClick={this._onClick}
      >
        {this.props.isCreateBranch ?
         this._renderCreateBranchElement() : this._renderRegularElement()
        }
      </div>
    );
  },
});

/**
 * A view that imitates GitHub's branch selection, that allows for filtering existing branches
 * and creating branches on the fly from the current selected branch (default: master).
 *
 * - setBranch: A function in the parent that handles branch selection. The function must take two
 *              inputs: the branch name, and whether it should be created.
 * - hideDropdown: A function in the parent that hides the dropdown.
 * - branchesForRepo: The existing branches for the given repository
 * - currentBranch: The current branch the notebook is linked to (default: master).
 */
const GitHubBranchDropdownView = React.createClass({

  propTypes: {
    setBranch: React.PropTypes.func.isRequired,
    hideDropdown: React.PropTypes.func.isRequired,
    branchesForRepo: React.PropTypes.array.isRequired,
    currentBranch: React.PropTypes.string.isRequired,
  },

  getInitialState() {
    return { branchFilter: '' };
  },

  componentDidMount() {
    this.refs.dropdown.refs[BRANCH_FILTER_INPUT].focus();
  },

  _closeBranchDropdown(e) {
    // don't close if filter text box was clicked
    let shouldClose = true;
    if (e && $(e.target).closest('.' + BRANCH_FILTER).length !== 0) {
      shouldClose = false;
    }
    if (shouldClose) {
      this.props.hideDropdown();
    }
  },

  _setBranchFilter() {
    const newFilter = this.refs.dropdown.refs[BRANCH_FILTER_INPUT].value;
    this.setState({ branchFilter: newFilter });
  },

  _renderBranchFilter() {
    return (
      <div className={BRANCH_FILTER}>
        <input type='text' ref={BRANCH_FILTER_INPUT} className={BRANCH_FILTER_INPUT}
          onInput={this._setBranchFilter}
          onChange={this._setBranchFilter}
          placeholder='Find or create a branch...'
        />
      </div>
    );
  },

  _onBranchSelected(branch, shouldCreateBranch) {
    this.props.setBranch(branch, shouldCreateBranch);
  },

  _getBranchesForRepo() {
    const self = this;
    const branchFilter = this.state.branchFilter;
    const filteredItems = this.props.branchesForRepo.filter(
      (item) => item.indexOf(branchFilter) > -1
    );
    // if the filter exists in our list, we will not prompt the user to create a branch with the
    // same name.
    const containsFilter = _.contains(filteredItems, branchFilter);
    const baseOutput = _.map(
      filteredItems,
      (item) => (
        <GitHubBranchListItem
          value={item}
          currentBranch={self.props.currentBranch}
          isCreateBranch={false}
          onSelected={self._onBranchSelected}
        />
      ));
    let output = [this._renderBranchFilter()].concat(baseOutput);
    if (branchFilter && !containsFilter) {
      // User may want to create a new branch. Show the create branch option.
      output = output.slice(0, 5);
      const createBranch = (<GitHubBranchListItem
        value={branchFilter}
        isCreateBranch
        onSelected={self._onBranchSelected}
        currentBranch={this.props.currentBranch}
      />);
      output.push(createBranch);
    }
    // note that we will not lose the "create branch" prompt if the list is too long, because
    // we already reduce the list to 5 elements in the if statement.
    return output.slice(0, 6);
  },

  render() {
    return (
      <div>
        <DropdownMenuView
          ref='dropdown'
          outsideClickHandler={this._closeBranchDropdown}
          getItems={this._getBranchesForRepo}
          handleClickInMenu
          classes={['github-branch-dropdown']}
        />
      </div>
    );
  },
});

module.exports = GitHubBranchDropdownView;
