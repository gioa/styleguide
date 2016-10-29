/* eslint react/prefer-es6-class: 0, max-depth: 0 */

import React from 'react';
import $ from 'jquery';
import _ from 'lodash';

import GitHubBranchDropdownView from '../notebook/GitHubBranchDropdownView.jsx';
import { GitHubUtils } from '../notebook/GitHubUtils';

import ReactModal from '../ui_building_blocks/dialogs/ReactModal.jsx';
import ReactModalUtils from '../ui_building_blocks/dialogs/ReactModalUtils';
import IconsForType from '../ui_building_blocks/icons/IconsForType';
import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

function GitHubHeader({ mode }) {
  let message;
  switch (mode) {
    case 'link':
      message = 'GitHub Preferences';
      break;
    case 'save':
      message = 'Save Notebook Revision';
      break;
    default:
      // Do nothing
  }

  return (
    <h3>{message}</h3>
  );
}

GitHubHeader.propTypes = {
  mode: React.PropTypes.string.isRequired,
};

/**
 * The flesh of the GitHubModal. Shows the current state of whether the notebook is linked to
 * GitHub or not, and allows the user to change the state, and then save it. There are 4
 * settable options:
 *  a) Whether the notebook is linked or not linked to GitHub (`isVersionControlled`).
 *     This selection is done through radio buttons. Changes to the radio buttons
 *     call `setVersionControl`.
 *  b) The GitHub URL for this notebook. In the form of `https://github.com/databricks/universe`.
 *     Changes to this textbox call `setFile`. The current value is stored inside `gitHubUrl`.
 *  c) The branch for this notebook for the repo provided in the GitHub url. The branch selector
 *     is a button that renders the GitHubBranchDropdownView. Changes will be passed on to
 *     `setBranch`. The current branch is stored in `gitBranch`.
 *  d) The path for the notebook inside the repository. Changes to the textbox call `setPath`,
 *     and the current value is stored inside `pathInput`. The path textbox is pre-populated with
 *     the path of the notebook in the "Workspace". In addition, the path can sometimes be parsed
 *     from the GitHub URL, which will also auto update this textbox.
 *
 * Other parameters are:
 *  - branchesForRepo: The branches that exist for the given repo. The repo information is parsed
 *                     in the main class, therefore, the list of branches are fetched in the main
 *                     class and are passed here.
 *  - createPRLink: A function that generates the URL for opening a Pull Request against master
 *                  branch on GitHub. This function should return null if the current branch is
 *                  already master.
 *  - branchFetchError: (Optional) Any error we may have come across during branch fetching,
 *                      e.g. missing token, repo doesn't exist, etc...
 *  - branchInfo: An object containing information regarding: whether the current branch can be
 *                rebased, and the corresponding parent repository and branch it can be rebased on.
 *  - rebaseBranch: Rebase the current branch on the parent repo's default branch. This function
 *                  should be able to take a repo owner (as in "databricks" in databricks/universe)
 *                  and the branch to rebase on.
 */
const GitHubBody = React.createClass({

  propTypes: {
    setFile: React.PropTypes.func.isRequired,
    setPath: React.PropTypes.func.isRequired,
    setBranch: React.PropTypes.func.isRequired,
    branchesForRepo: React.PropTypes.array.isRequired,
    branchInfo: React.PropTypes.object.isRequired,
    rebaseBranch: React.PropTypes.func.isRequired,
    branchFetchError: React.PropTypes.string,
    setVersionControl: React.PropTypes.func.isRequired,
    pathInput: React.PropTypes.string.isRequired,
    gitHubUrl: React.PropTypes.string.isRequired,
    gitBranch: React.PropTypes.string.isRequired,
    createPRLink: React.PropTypes.func.isRequired,
    isVersionControlled: React.PropTypes.bool.isRequired,
  },

  getInitialState() {
    return {};
  },

  _setFileName() {
    this.props.setFile(this.refs.fileLink.value);
  },

  _setPath() {
    this.props.setPath(this.refs.path.value);
  },

  componentDidMount() {
    if (this.refs.fileLink) {
      this.refs.fileLink.focus();
    }
  },

  _toggleVersionControl(set) {
    this.props.setVersionControl(set);
  },

  _renderLinkToggle() {
    const linkChecked = this.props.isVersionControlled ? 'checked' : undefined;
    const unlinkChecked = !this.props.isVersionControlled ? 'checked' : undefined;

    const boundTrue = this._toggleVersionControl.bind(this, true);
    const boundFalse = this._toggleVersionControl.bind(this, false);
    return (
      <div id='git-modal-status-container'>
        <label className='unclickable'>Status</label>
        <label htmlFor='git-link-radio'
          className='pointer git-modal-status git-modal-status-link'
        >
          <input type='radio' id='git-link-radio' name='link' value='link'
            defaultChecked={linkChecked}
            onChange={boundTrue}
          /> Link
        </label>
        <label htmlFor='git-unlink-radio'
          className='pointer git-modal-status git-modal-status-unlink'
        >
          <input type='radio' id='git-unlink-radio' name='link' value='unlink'
            defaultChecked={unlinkChecked}
            onChange={boundFalse}
          /> Unlink
        </label>
      </div>
    );
  },

  _renderPath(disabled) {
    return (
      <div>
        <label className='unclickable'>Path in GitHub Repo</label>
        <div>
          <input type='text' ref='path' disabled={disabled}
            className='github-input control-field github-input-path'
            onInput={this._setPath}
            onChange={this._setPath}
            value={this.props.pathInput}
          />
        </div>
      </div>
    );
  },

  _renderLink(disabled) {
    return (
      <div>
        <label className='unclickable'>Link</label>
        <div>
          <input type='text' ref='fileLink' disabled={disabled}
            className='github-input control-field github-input-link'
            onInput={this._setFileName}
            onChange={this._setFileName}
            value={this.props.gitHubUrl}
            placeholder={'Link of file on GitHub ' +
              '(e.g. https://github.com/example/repo/blob/master/README.md'}
          />
        </div>
      </div>
    );
  },

  _renderBranch(disabled) {
    const dropdown = this.state.showBranchDropdown ? (
      <GitHubBranchDropdownView
        setBranch={this.props.setBranch}
        hideDropdown={this._closeBranchDropdown}
        branchesForRepo={this.props.branchesForRepo}
        currentBranch={this.props.gitBranch}
      />) : null;
    const createPRLink = this.props.createPRLink();
    const branchInfo = this.props.branchInfo;
    const defaultBranch = GitHubUtils.getDefaultBranchString(branchInfo);
    const createPR = createPRLink && !disabled ? (
      <a href={createPRLink} className='pointer github-input-pr' target='_blank'
        title={'Create a Pull Request against ' + defaultBranch}
      >Create PR</a>) : null;
    const rebaseBranch = branchInfo && branchInfo.canRebase && !disabled ? (
      <a className='pointer github-input-rebase' onClick={this.props.rebaseBranch}
        title={'Rebase branch on ' + defaultBranch}
      >Rebase</a>) : null;
    const branchFetchError = this.props.branchFetchError;
    const branchFetchTooltip = branchFetchError ? (
      <Tooltip text={branchFetchError}>
        <i className={'git-branch-fetch-warn fa fa-' + IconsForType.warning}></i>
      </Tooltip>) : null;
    return (
      <div className='github-input-branch-div'>
        <label className='unclickable'>Branch</label>
        <span>
          <button className='btn github-input control-field github-input-branch'
            disabled={disabled} onClick={this._renderBranchDropdown}
          >
            <span className='pull-left'>{this.props.gitBranch}</span>
            <a className='pull-right'><i className='fa fa-caret-down'></i></a>
          </button>
          {branchFetchTooltip}
          {createPR}
          {rebaseBranch}
        </span>
        {dropdown}
      </div>
    );
  },

  _closeBranchDropdown() {
    this.setState({ showBranchDropdown: false });
  },

  _renderBranchDropdown() {
    this.setState({ showBranchDropdown: true });
  },

  render() {
    const disable = !this.props.isVersionControlled ? 'disabled' : undefined;
    return (
      <div className='multi-input-row modal-github-link'>
        {this._renderLinkToggle()}
        {this._renderLink(disable)}
        {window.settings.enableNotebookGitBranching ? this._renderBranch(disable) : null}
        {this._renderPath(disable)}
      </div>
    );
  },
});

function GitHubFooter({ confirmDisabled, confirm }) {
  const disable = confirmDisabled ? 'disable' : '';
  return (
    <div>
      <a data-dismiss='modal' className='btn cancel-button' tabIndex='2'>Close</a>
      <a data-dismiss='modal'
        className='btn btn-primary confirm-button'
        tabIndex='1'
        disabled={disable}
        onClick={confirm}
      >Save</a>
    </div>
  );
}

GitHubFooter.propTypes = {
  confirmDisabled: React.PropTypes.bool.isRequired,
  confirm: React.PropTypes.func.isRequired,
};

const GIT_HOSTNAME = 'git-hostname';
const GIT_OWNER = 'git-owner';
const GIT_REPO = 'git-repo';

const GitHubModalView = React.createClass({

  propTypes: {
    mode: React.PropTypes.string.isRequired,
    notebookName: React.PropTypes.string,
    notebookId: React.PropTypes.number,
    linkCallback: React.PropTypes.func,
    unlinkCallback: React.PropTypes.func,
    saveCallback: React.PropTypes.func,
    branchInfo: React.PropTypes.object,
    rebaseBranch: React.PropTypes.func,
    gitHubLink: React.PropTypes.object,
    hintMessage: React.PropTypes.string,
  },

  getInitialState() {
    const hostname = window.prefs.get(GIT_HOSTNAME) ? window.prefs.get(GIT_HOSTNAME) : '';
    const owner = window.prefs.get(GIT_OWNER) ? window.prefs.get(GIT_OWNER) : '';
    const repo = window.prefs.get(GIT_REPO) ? window.prefs.get(GIT_REPO) : '';
    let path = 'notebooks/' + this.props.notebookName;
    const gitHubLink = this.props.gitHubLink;
    const gitRepo = gitHubLink || (owner && repo) ?
      GitHubUtils.getRepoURL(gitHubLink, hostname, owner, repo) : '';
    let branch;
    if (gitHubLink) {
      path = gitHubLink.path;
      branch = gitHubLink.branch ? gitHubLink.branch : 'master';
      this.fetchGitHubBranches(gitHubLink.hostname, gitHubLink.owner, gitHubLink.repo);
    } else if (owner && repo) {
      // the link doesn't exist, but we have a repo from the local preferences, therefore
      // we should also fetch branches
      this.fetchGitHubBranches(hostname, owner, repo);
    }
    const isValidGitLink = GitHubUtils.isValidGitHubLink(gitHubLink);
    return {
      gitHubUrl: gitRepo,
      gitHubLink: gitHubLink,
      gitBranchList: ['master'],
      notebookPath: path,
      branch: branch || 'master',
      message: '',
      isVersionControlled: isValidGitLink,
      toGitHub: isValidGitLink && this.props.mode === 'save',
    };
  },

  // Wait a bit for the user to stop typing in order to not make too many GitHub API requests.
  _checkAndFetchBranches: _.debounce((oldLink, nextLink) => {
    if (GitHubUtils.shouldFetchBranches(oldLink, nextLink)) {
      this.fetchGitHubBranches(nextLink.hostname, nextLink.owner, nextLink.repo);
    }
  }, 1000),

  componentWillUpdate(nextProps, nextState) {
    // fetch the new branch list if the repo and/or owner for the GitHub link change
    const oldLink = this.state.gitHubLink;
    const nextLink = nextState.gitHubLink;
    this._checkAndFetchBranches(oldLink, nextLink);
  },

  setGitHubLink(value) {
    this.setState({ gitHubUrl: value });
    const link = GitHubUtils.parseGitHubData(value);
    if (this.props.mode === 'link' && _.isObject(link) && link.path) {
      this.setState({
        notebookPath: link.path,
        gitHubLink: link,
        branch: link.branch ? link.branch : this.state.branch,
      });
    }
  },

  setMessage() {
    this.setState({
      message: this.refs.message.value,
    });
  },

  setGitHubCheckbox(value) {
    this.setState({
      toGitHub: value,
    });
  },

  setPath(value) {
    this.setState({
      notebookPath: value,
    });
  },

  setBranch(value, shouldCreateBranch) {
    this.setState({
      branch: value,
      shouldCreateBranch: shouldCreateBranch,
    });
  },

  setVersionControl(value) {
    this.setState({
      isVersionControlled: value,
    });
  },

  // the callback here can be either a commit, link, or save token command.
  teardownAndCallback() {
    ReactModalUtils.destroyModal();
    if (this.props.mode === 'save') {
      if (this.state.isVersionControlled) {
        this.props.saveCallback(this.state.message.trim(), this.state.toGitHub);
      } else {
        this.props.saveCallback(this.state.message.trim(), this.state.toGitHub);
      }
    } else if (this.props.mode === 'link') {
      if (this.state.isVersionControlled) {
        const gitInfo = GitHubUtils.parseGitHubData(this.state.gitHubUrl);
        if (_.isObject(gitInfo)) {
          window.prefs.set(GIT_REPO, gitInfo.repo);
          window.prefs.set(GIT_OWNER, gitInfo.owner);
          if (GitHubUtils.isValidHostname(gitInfo.hostname)) {
            // if the hostname is not valid (null), the user used github.com. Since that's the
            // default, we don't need to set the hostname
            window.prefs.set(GIT_HOSTNAME, gitInfo.hostname);
          } else {
            window.prefs.set(GIT_HOSTNAME, undefined);
          }
          gitInfo.withPath(this.state.notebookPath.trim());
          gitInfo.withBranch(this.state.branch);
        }
        this.props.linkCallback(gitInfo, this.state.shouldCreateBranch);
      } else {
        this.props.unlinkCallback();
      }
    }
  },

  rebaseBranch() {
    ReactModalUtils.destroyModal();
    // TODO(burak): make base fork and branch selectable
    this.props.rebaseBranch();
  },

  isMessageValid(message) {
    message = message || '';
    return message.length <= 1000;
  },

  areAllEntriesValid() {
    if (this.props.mode === 'link') {
      const gitHubUrl = this.state.gitHubUrl;
      const nbPath = this.state.notebookPath;
      const gitLink = GitHubUtils.parseGitHubData(gitHubUrl);
      if (_.isObject(gitLink)) { // and not null
        gitLink.withPath(nbPath);
      }
      return GitHubUtils.isValidGitHubLink(gitLink);
    }
    if (this.props.mode === 'save') {
      return this.isMessageValid(this.state.message);
    }
    return false;
  },

  checkboxClick() {
    this.setState({ toGitHub: this.refs.cb.checked });
  },

  createPRLink() {
    return GitHubUtils.createPRURL(this.props.gitHubLink, this.props.branchInfo);
  },

  fetchGitHubBranches(hostname, owner, repo) {
    if (window.settings && window.settings.enableNotebookGitBranching) {
      const that = this;
      const basePayload = { owner: owner, repo: repo };
      if (GitHubUtils.isValidHostname(hostname)) {
        // if hostname is not valid, we will use the default in the backend
        basePayload.hostname = hostname;
      }
      const payload = $.param(basePayload);
      $.ajax('/notebook/' + that.props.notebookId + '/git/refs?' + payload, {
        type: 'GET',
        success(resp) {
          that.setState({ gitBranchList: resp.branchList, branchFetchError: null });
        },
        error(xhr, status, error) {
          const errorMsg = error || status;
          const errorLog = 'Error while listing GitHub repo branches: ' + errorMsg;
          console.error(errorLog);
          that.setState({ branchFetchError: errorLog });
        },
      });
    }
  },

  renderWithMessage() {
    let checkBox;
    if (this.state.isVersionControlled && this.props.hintMessage === undefined) {
      const checkBoxMessage = !this.state.isVersionControlled ? 'Link and commit to GitHub' :
        'Also commit to GitHub';
      const checked = this.state.toGitHub ? 'checked' : null;
      checkBox = (
        <label style={{ marginTop: '5px' }}>
          <input
            type='checkbox'
            ref='cb'
            id='toGitHubCb'
            style={{ marginTop: '0px' }}
            onClick={this.checkboxClick}
            defaultChecked={checked}
          />
          {checkBoxMessage}
        </label>
      );
    }
    const hintMessage = this.props.hintMessage ?
      (<div style={{ marginBottom: '5px' }}>{this.props.hintMessage}</div>) : null;

    return (
      <div style={{ marginBottom: '10px' }}>
        {hintMessage}
        <textarea ref='message' className='prompt-input git-textarea'
          onInput={this.setMessage}
          onChange={this.setMessage}
          placeholder='Revision description (optional, at most 1000 chars)'
        />
        {checkBox}
      </div>
    );
  },

  renderGitHub() {
    return (
      <GitHubBody
        setFile={this.setGitHubLink}
        setPath={this.setPath}
        setBranch={this.setBranch}
        branchesForRepo={this.state.gitBranchList}
        branchInfo={this.props.branchInfo}
        rebaseBranch={this.rebaseBranch}
        branchFetchError={this.state.branchFetchError}
        setVersionControl={this.setVersionControl}
        pathInput={this.state.notebookPath}
        gitHubUrl={this.state.gitHubUrl}
        gitBranch={this.state.branch}
        createPRLink={this.createPRLink}
        isVersionControlled={this.state.isVersionControlled}
      />
    );
  },

  render() {
    const header = <GitHubHeader mode={this.props.mode} />;

    let body;
    if (this.props.mode === 'save') {
      body = this.renderWithMessage();
    } else if (this.props.mode === 'link') {
      body = this.renderGitHub();
    }

    const footer = (<GitHubFooter
      confirmDisabled={!this.areAllEntriesValid()}
      confirm={this.teardownAndCallback}
    />);

    return (
      <ReactModal
        modalName='github-load'
        header={header}
        body={body}
        footer={footer}
      />
    );
  },
});

module.exports = GitHubModalView;
