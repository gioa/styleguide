/* eslint react/prefer-es6-class: 0, func-names: 0 */

import $ from 'jquery';
import _ from 'underscore';
import React from 'react';
import ClassNames from 'classnames';

import NavFunc from '../filetree/NavFunc.jsx';

import NotebookModel from '../notebook/NotebookModel';
import GitHubModalView from '../notebook/GitHubModalView.jsx';
import { GitHubUtils, GitHubLink } from '../notebook/GitHubUtils';

import Presence from '../presence/Presence';

import ReactDialogBox from '../ui_building_blocks/dialogs/ReactDialogBox.jsx';
import ReactModalUtils from '../ui_building_blocks/dialogs/ReactModalUtils';
import IconsForType from '../ui_building_blocks/icons/IconsForType';
import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

import { NameUtils } from '../user_info/NameUtils';

import { DateTimeFormats } from '../user_platform/DateTimeFormats';

const LOAD_INDICATOR_DELAY_MILLIS = 500;

const EVENT_GENERIC_CLICK = 'notebookHistoryClick';
const EVENT_SAVE = 'notebookHistorySave';
const EVENT_RESTORE = 'notebookHistoryRestore';

const HistoryPanelView = React.createClass({
  notebookLoadTimeout: null,
  notebookKeepaliveTimeout: null,
  ajaxRequest: null,

  propTypes: {
    hideHistoryCallback: React.PropTypes.func.isRequired,
    showNotebookCallback: React.PropTypes.func.isRequired,
    showLoadScreenCallback: React.PropTypes.func.isRequired,
    notebook: React.PropTypes.instanceOf(NotebookModel).isRequired,
    recordEvent: React.PropTypes.func, // used for testing
  },

  getInitialState() {
    return {
      loadStart: new Date().getTime(),
      history: null,
      previewEntryJson: null,
      isCommitting: false,
      isSyncing: false,
      syncOk: true,
      commitFailed: false,
    };
  },

  componentWillMount() {
    this.refreshHistory(true);
    // this is a good enough proxy for determining if the HistoryPanel was opened by a click.
    this._recordClick(EVENT_GENERIC_CLICK, -1);
  },

  componentWillUnmount() {
    clearTimeout(this.notebookLoadTimeout);
    clearTimeout(this.notebookKeepaliveTimeout);
    this.abortOutstandingRequests();
  },

  singletonAjax(endpoint, args) {
    this.abortOutstandingRequests();
    this.ajaxRequest = $.ajax(endpoint, args);
  },

  abortOutstandingRequests() {
    if (this.ajaxRequest !== null) {
      this.ajaxRequest.abort();
      this.ajaxRequest = null;
    }
  },

  ////////////////////////////////
  // Usage Logging
  ////////////////////////////////

  _recordEvent(event, extraTags) {
    const recordEvent = this.props.recordEvent ? this.props.recordEvent : window.recordEvent;
    if (recordEvent) {
      const gitHubLink = this.state.gitHubLinkInfo;
      const linkedToGitHub = _.isObject(gitHubLink) && !_.isEmpty(gitHubLink);
      const common = {
        nbLinkedToGitHub: linkedToGitHub,
        nbLinkedToGitHubEnterprise: linkedToGitHub && !_.isEmpty(gitHubLink.hostname),
      };
      if (this.state.nbExistsOnGitHub !== undefined) {
        common.nbExistsOnGitHub = this.state.nbExistsOnGitHub;
      }
      const tags = _.extend(common, extraTags);
      recordEvent(event, tags);
    }
  },

  _recordGitHubEvent(action, error, extraTags) {
    const common = { nbGitHubAction: action, nbGitHubError: error || this.state.gitHubError };
    const tags = _.extend(common, extraTags);
    this._recordEvent('notebookHistoryGitHub', tags);
  },

  /**
   * Record a click in the history panel. The position denotes how far back in history the user
   * clicked on. Special values are -1 for opening the panel, and -2 for opening the GitHub bar.
   * Modes are: EVENT_GENERIC_CLICK, EVENT_SAVE, and EVENT_RESTORE.
   */
  _recordClick(mode, position, entryJson) {
    const tags = { nbHistoryClickPosition: position };
    if (entryJson) {
      const entry = JSON.parse(entryJson);
      tags.nbRevisionType = this.getEntryType(entry);
      tags.nbRevisionAge = Date.now() - entry.timestamp;
    }
    this._recordEvent(mode, tags);
  },

  /**
   * Returns the type of the entry: autoSaved, manualSaved, gitHubImported, gitHubExported.
   * gitHubExported entries subsumes manualSaved entries, they additionally have a gitHash.
   */
  getEntryType(entry) {
    if (entry.gitHash !== '' && entry.hasFullSnapshot) {
      return 'gitHubExported';
    }
    if (entry.gitHash !== '') {
      return 'gitHubImported';
    }
    if (entry.description !== '') {
      return 'manualSaved';
    }
    return 'autoSaved';
  },

  ///////////////////////////////
  // History methods
  ///////////////////////////////

  refreshHistory(syncWithGitHub, afterGitHubSync) {
    const that = this;
    this.setState({ loadStart: new Date().getTime() });
    setTimeout(function() {
      that.forceUpdate();
    }, LOAD_INDICATOR_DELAY_MILLIS);
    $.ajax('/notebook/' + this.props.notebook.id + '/history', {
      type: 'GET',
      success(resp) {
        if (!that.isMounted()) {
          console.debug('Skipping history update when unmounted.');
          return;
        }
        const hist = _.sortBy(resp.history, function(s) { return -s.timestamp; });
        if (hist && hist.length > 0) {
          hist[0].isCurrent = true;
        }
        let hasGitHubCommit = false;
        hist.forEach(function(h) {
          h.disabled = (that.getHorizon() > 0 &&
            (new Date().getTime() - h.timestamp > 1000 * 60 * 60 * that.getHorizon()));
          if (h.gitHash) {
            hasGitHubCommit = true;
          }
        });
        window.notebookHistory = hist;
        const gitHubLink = _.isObject(resp.gitHubLink) ? new GitHubLink(resp.gitHubLink) : null;
        that.setState({
          gitHubLinkInfo: gitHubLink,
          history: hist,
          nbExistsOnGitHub: hasGitHubCommit,
        });
        let selectionOK = false;
        hist.forEach(function(h) {
          if (JSON.stringify(h) === that.state.previewEntryJson) {
            selectionOK = true;
          }
        });
        if (!selectionOK) {
          that.setState({ previewEntryJson: null });
          that.previewHistory();
        }
        if (gitHubLink && syncWithGitHub) {
          that.syncWithGitHub(hasGitHubCommit);
        }
        if (gitHubLink && !syncWithGitHub && afterGitHubSync && !hasGitHubCommit) {
          that.promptForInitialGitCommit();
        }
      },
      error(xhr, status, error) {
        that.setState({ error: (error || status) });
      },
    });
  },

  showNotebook(notebookId) {
    clearTimeout(this.notebookLoadTimeout);
    const that = this;
    window.conn.prefetchNode(notebookId, function() {
      const notebook = window.treeCollection.getNotebookModel(notebookId);
      if (notebook && notebook.loaded()) {
        that.props.showNotebookCallback(notebook);
      } else {
        if (notebook && notebook.numInterested() === 0) {
          notebook.registerInterest(that);
        }
        // Notebook hasn't been synced to the frontend yet, retry.
        that.notebookLoadTimeout = setTimeout(function() {
          that.showNotebook(notebookId);
        }, 250);
      }
    });
  },

  resetNotebook() {
    clearTimeout(this.notebookLoadTimeout);
    clearTimeout(this.notebookKeepaliveTimeout);
    this.props.showNotebookCallback(null);
  },

  pushHistory(e) {
    e.preventDefault();
    if (this.getHorizon() > 0) {
      ReactDialogBox.alert(Tooltip.getUpgradeElement('Github integration', false));
    } else {
      this.showGitHubModal('save');
    }
  },

  restoreHistory(e) {
    e.preventDefault();
    const entryJson = JSON.stringify($(e.target).data('entry'));
    const position = $(e.target).data('position');
    const that = this;
    ReactDialogBox.confirm({
      message: 'Are you sure you want to restore this revision? Unsaved changes will be lost.',
      confirm() {
        that._recordClick(EVENT_RESTORE, position, entryJson);
        that.props.showLoadScreenCallback();
        $.ajax('/notebook/' + that.props.notebook.id + '/history/restore', {
          type: 'POST',
          data: entryJson,
          success() {
            that.resetNotebook();
            that.props.hideHistoryCallback();
          },
          error(xhr, status, error) {
            ReactDialogBox.alert('Failed to restore revision: ' + (error || status));
          },
        });
      },
    });
  },

  getHorizon() {
    return (window.settings && window.settings.notebookRevisionVisibilityHorizon) || 0;
  },

  previewHistory(e) {
    const that = this;
    let entry;
    let position;
    if (e) {
      e.preventDefault();
      entry = $(e.currentTarget).data('entry');
      position = $(e.currentTarget).data('position');
    } else {
      entry = this.state.history && this.state.history[0];
      position = 0;
    }
    if (!entry || entry.disabled) {
      console.debug('Not showing preview - disabled or missing revision.');
      return;
    }
    const entryJson = JSON.stringify(entry);
    that._recordClick(EVENT_GENERIC_CLICK, position, entryJson);
    this.setState({ previewEntryJson: entryJson });
    this.props.showLoadScreenCallback();
    const endpoint = window.settings.enableNotebookHistoryDiffing ?
      '/preview/diff' : '/preview';
    this.singletonAjax('/notebook/' + this.props.notebook.id + '/history' + endpoint, {
      type: 'POST',
      data: entryJson,
      success(resp) {
        that.showNotebook(parseInt(resp.notebookId, 10));
        that.setupKeepaliveLoop(entryJson);
      },
      error(xhr, status, error) {
        if (error !== 'abort') {
          ReactDialogBox.alert('Failed to load preview: ' + (error || status));
        }
      },
    });
  },

  setupKeepaliveLoop(entryJson) {
    const that = this;
    clearTimeout(this.notebookKeepaliveTimeout);
    this.notebookKeepaliveTimeout = setTimeout(function() {
      $.ajax('/notebook/' + that.props.notebook.id + '/history/keepalive', {
        type: 'GET',
        data: { entry: entryJson },
        complete() {
          that.setupKeepaliveLoop(entryJson);
        },
      });
    }, 5000);
  },

  /** Shown when a notebook is linked to a file that doesn't exist yet on GitHub */
  promptForInitialGitCommit() {
    const message = 'The file you linked to does not exist on GitHub yet. Would you like to make ' +
      'a commit and save the current version?';
    this.showGitHubModal('save', message);
  },

  ///////////////////////////////
  // GitHub methods
  ///////////////////////////////

  showGitHubModal(mode, hintMessage) {
    const recordMode = (mode === 'save') ? EVENT_SAVE : EVENT_GENERIC_CLICK;
    const pos = (mode === 'save') ? 0 : -2;
    this._recordClick(recordMode, pos);
    if (this.getHorizon() > 0) {
      ReactDialogBox.alert(Tooltip.getUpgradeElement('Github integration', false));
    } else {
      const language = this.props.notebook.get('language');
      let ext;
      if (language === 'scala') {
        ext = '.scala';
      } else if (language === 'python') {
        ext = '.py';
      } else if (language === 'r') {
        ext = '.r';
      } else if (language === 'sql') {
        ext = '.sql';
      } else {
        ext = '.txt';
      }
      let notebookName = this.props.notebook.get('name');
      const notebookPath = NavFunc.getFullPath(this.props.notebook.get('id')).substring(1);
      if (notebookPath && notebookPath !== '??') {
        notebookName = notebookPath;
      }
      const gitLoad = (
        <GitHubModalView
          mode={mode}
          notebookName={notebookName + ext}
          notebookId={this.props.notebook.get('id')}
          linkCallback={this.linkToGitHub}
          unlinkCallback={this.unlinkFromGitHub}
          saveCallback={this._saveNotebook}
          branchInfo={this.state.branchInfo}
          rebaseBranch={this.rebaseBranch}
          gitHubLink={this.state.gitHubLinkInfo}
          hintMessage={hintMessage}
        />);
      ReactModalUtils.createModal(gitLoad);
    }
  },

  _resetGitHubState() {
    this.setState({
      gitHubError: null,
      syncOk: true,
      commitFailed: false,
      gitHubLinkInfo: null,
    });
  },

  linkToGitHub(gitHubInfo, shouldCreateBranch) {
    const that = this;
    const currentInfo = this.state.gitHubLinkInfo;
    if (GitHubUtils.shouldLink(currentInfo, gitHubInfo)) {
      let baseBranch = currentInfo ? currentInfo.branch : 'master';
      if (!shouldCreateBranch) {
        baseBranch = gitHubInfo.branch;
      }
      const extraTags = {
        nbGitHubBranchUse: gitHubInfo.branch !== 'master',
        nbGitHubBranchCreate: shouldCreateBranch || false,
      };
      this._recordGitHubEvent('link', '', extraTags);
      this._resetGitHubState();
      this.props.notebook.sendGitRPC(
        'gitHubLink',
        {
          hostname: gitHubInfo.hostname ? gitHubInfo.hostname : '',
          owner: gitHubInfo.owner,
          repo: gitHubInfo.repo,
          baseBranch: baseBranch,
          branch: gitHubInfo.branch,
          path: gitHubInfo.path,
        },
        function() {
          that.refreshHistory(true);
        },
        function(xhr, status, error) {
          const problem = error || status;
          ReactDialogBox.alert('Error linking with GitHub: ' + problem);
          that._recordGitHubEvent('linkError', problem);
        }
      );
    }
  },

  unlinkFromGitHub() {
    const that = this;
    this._recordGitHubEvent('unlink', '');
    ReactDialogBox.confirm({
      message: (
        'Are you sure you want to unlink from GitHub? ' +
        "This will remove imported git commits from this notebook's revision history."),
      confirm() {
        that._resetGitHubState();
        that.props.notebook.sendGitRPC('gitHubUnlink', null,
          function() {
            that.refreshHistory();
          },
          function(xhr, status, error) {
            const problem = error || status;
            ReactDialogBox.alert('Error unlinking with GitHub: ' + problem);
            this._recordGitHubEvent('unlinkError', problem);
          });
      },
    });
  },

  syncWithGitHub(hasGitHubCommit) {
    const that = this;
    this.setState({ isSyncing: true });
    this.props.notebook.sendGitRPC('gitHubSync', null, function() {
      that.gitHubSyncCompleted(true, null, hasGitHubCommit);
    }, function(xhr, status, error) {
      const errorMsg = error || status;
      that.gitHubSyncCompleted(false, 'Error while syncing GitHub history: ' + errorMsg,
        hasGitHubCommit);
    });
  },

  gitHubSyncCompleted(success, reason, hasGitHubCommit) {
    this.refreshHistory(false, success);
    this.setState({ isSyncing: false, syncOk: success, gitHubError: reason });
    this._recordGitHubEvent('sync');
    if (success && hasGitHubCommit) {
      const that = this;
      $.ajax('/notebook/' + that.props.notebook.id + '/git/refs/rebase', {
        type: 'GET',
        success(resp) {
          that.setState({ branchInfo: resp });
        },
        error(xhr, status, error) {
          const errorMsg = error || status;
          that.gitHubSyncCompleted(false, 'Failed while checking branch history: ' + errorMsg);
        },
      });
    }
  },

  saveToGitHub(commitMessage) {
    const that = this;
    this.props.notebook.sendGitRPC('gitHubSave', {
      message: commitMessage || '',
    }, function() {
      that.gitHubSaveCompleted(true);
    }, function(xhr, status, error) {
      const errorMsg = error || status;
      that.gitHubSaveCompleted(false, 'Error committing to GitHub: ' + errorMsg);
    });
    this.setState({ isCommitting: true });
  },

  saveToDatabaseOnly(commitMessage) {
    this.props.showLoadScreenCallback();
    const that = this;
    $.ajax('/notebook/' + that.props.notebook.id + '/history/save', {
      type: 'POST',
      data: JSON.stringify({ description: commitMessage }),
      success() {
        that.refreshHistory();
      },
      error(xhr, status, error) {
        ReactDialogBox.alert('Failed to save revision: ' + (error || status));
      },
    });
  },

  _saveNotebook(commitMessage, toGitHub) {
    if (toGitHub) {
      this.saveToGitHub(commitMessage);
    } else {
      this.saveToDatabaseOnly(commitMessage);
    }
  },

  // TODO(burak): Allow selection of repo and branch to user as UI permits
  rebaseBranch() {
    const that = this;
    const owner = this.state.branchInfo.parentOwner || this.state.gitHubLinkInfo.owner;
    const branch = this.state.branchInfo.parentBranch || 'master';
    this.props.notebook.sendGitRPC('gitHubRebase', {
      owner: owner,
      branch: branch,
    }, function() {
      that.gitHubSaveCompleted(true, null, 'rebase');
    }, function(xhr, status, error) {
      const errorMsg = error || status;
      that.gitHubSaveCompleted(false, 'Error rebasing branch: ' + errorMsg, 'rebase');
    });
    this.setState({ isCommitting: true });
  },

  gitHubSaveCompleted(success, reason, op) {
    if (success) {
      this.refreshHistory(true);
      this.setState({ commitFailed: false, isCommitting: false, gitHubError: null });
    } else {
      this.setState({ isCommitting: false, commitFailed: true, gitHubError: reason });
    }
    this._recordGitHubEvent(op || 'save');
  },

  ///////////////////////////////
  // Render methods
  ///////////////////////////////

  renderEntry(entry, position) {
    const entryJson = JSON.stringify(entry);
    let selected = (entryJson === this.state.previewEntryJson);
    if (this.state.previewEntryJson === null) {
      selected = entry.isCurrent;
    }
    const classes = {
      'history-preview': true,
      'history-preview-selected': selected,
      'history-preview-disabled': entry.disabled,
    };
    const saveNow = !entry.isCurrent ? null :
      (<a className='history-save-link' onClick={this.pushHistory} href='#'>Save now</a>);
    const unsavedChanges = entry.unsavedChanges ? null :
      (<span className='history-all-changes-saved'>All changes saved</span>);
    return (
      <div
        key={entry.timestamp}
        className={ClassNames(classes)}
        title={entry.disabled ?
          'Older revisions are only browsable at the Professional tier.' : null}
        data-description={entry.description}
        data-entry={entryJson}
        data-position={position}
        onClick={(selected || entry.disabled) ? null : this.previewHistory}
      >
        <span className='history-date-title'>
          {DateTimeFormats.formatTimestampNicely(entry.timestamp)}
        </span>
        <div>
          <div>
            {this.renderEntryAuthors(entry)}
            <span className='history-description' title={entry.description}>
              {entry.description}
            </span>
          </div>
          {entry.isCurrent ? (
             <div>
               {unsavedChanges}
               {saveNow}
             </div>) :
           <a className='history-restore-link'
             onClick={this.restoreHistory}
             data-description={entry.description}
             data-position={position}
             data-entry={entryJson}
             href=''
           >Restore this revision</a>}
        </div>
      </div>);
  },

  renderEntryAuthors(entry) {
    const authors = [];
    if (entry.authors) {
      entry.authors.forEach(function(author) {
        authors.push(
          <div key={author.userId} className='history-author-wrapper'>
            <div className='history-author-box'
              style={{ backgroundColor: Presence.colorScale(author.userId) }}
            />
            <span className='history-author-text'>
              {NameUtils.capitalizeAllNames(author.userFullname)}
            </span>
          </div>);
      });
    }
    if (entry.gitHash && this.state.gitHubLinkInfo) {
      const commitLink = this.state.gitHubLinkInfo.getGitHubLink(entry.gitHash);
      authors.push(
        <div key='__git_hash__' className='history-author-wrapper'>
          <a className='history-author-text pointer' href={commitLink} target='_blank'>
            {'Commit ' + entry.gitHash.substring(0, 10)}
          </a>
        </div>);
    }
    return authors;
  },

  _renderGitHubBase(message, button) {
    let error = this.state.gitHubError;
    if (error) {
      const unsetToken = error.indexOf('GitHub Token missing.');
      if (unsetToken > -1) {
        error = error + ' You may add/change your token in the Account Settings page, ' +
          'by clicking the user icon on the top right of the screen.';
      }
    }
    const githubModalLink = this.showGitHubModal.bind(this, 'link');
    return (
      <Tooltip id='gitStatusTooltip' text={error}>
        <div onClick={githubModalLink} className='git-button'>
          <span>
            <i className={'fa fa-' + IconsForType.github}></i>&nbsp;GitHub: {message} {button}
          </span>
        </div>
      </Tooltip>
    );
  },

  renderGitHubBar() {
    if (this.state.gitHubLinkInfo === undefined) {
      return this.renderGitHubEmpty();
    } else if (!this.state.gitHubLinkInfo) {
      return this.renderGitHubNotebookUnlinked();
    }
    if (this.state.isCommitting) {
      return this.renderGitHubCommitting();
    } else if (this.state.isSyncing) {
      return this.renderGitHubSyncing();
    }
    if (this.state.syncOk && !this.state.commitFailed) {
      return this.renderGitHubSynced();
    }
    return this.renderGitHubOperationFailed();
  },

  /** Rendered when the panel is first opened. Show nothing in order not to flicker. */
  renderGitHubEmpty() {
    return this._renderGitHubBase();
  },

  /** Rendered when the user has GitHub credentials, but the notebook is not linked to a repo. */
  renderGitHubNotebookUnlinked() {
    return this._renderGitHubBase('Not linked');
  },

  /** Rendered while syncing with GitHub history. */
  renderGitHubSyncing() {
    return this._renderGitHubBase('Syncing...');
  },

  /** Rendered when properly synced to GitHub. Means everything is okay. */
  renderGitHubSynced() {
    const statusButton =
      (<i className={'fa fa-' + IconsForType.success + ' history-git-success pull-right'}></i>);
    return this._renderGitHubBase('Synced', statusButton);
  },

  /** Rendered when failed to sync or commit to GitHub */
  renderGitHubOperationFailed() {
    const error = this.state.gitHubError;
    let unsetToken;
    if (GitHubUtils.isStringEntryValid(error)) {
      unsetToken = error.indexOf('GitHub Token missing.') > -1;
    }
    const status = unsetToken ? 'warning' : 'error';
    const icon = unsetToken ? IconsForType.warning : IconsForType.error;
    const syncStatus = (
      <i className={'fa fa-' + icon + ' state-message-icon pull-right history-git-' + status}></i>
    );
    if (unsetToken && !window.prefs.get('showGitHubTokenLink')) {
      window.prefs.set('showGitHubTokenLink', true);
      const message = 'You need to set your GitHub Api Token in order to use GitHub features.' +
       ' The token can be set in the Account Settings page.';
      ReactDialogBox.confirm({
        message: message,
        confirmButton: 'Account Settings',
        confirm() {
          window.router.navigate('setting/account/github', { trigger: true, replace: false });
        },
      });
    }
    return this._renderGitHubBase('Failed', syncStatus);
  },

  /** Rendered while committing to GitHub */
  renderGitHubCommitting() {
    return this._renderGitHubBase('Committing...');
  },

  renderGitHubStatusEntry() {
    if (this.state.history === null) {
      return null;
    }
    return (
      <div className='history-github-bar'>
        {this.renderGitHubBar()}
      </div>
    );
  },

  render() {
    const historyPanelClasses = {
      'history-panel-wrapper': true,
    };
    const history = [];
    if (this.state.history !== null) {
      for (const i in this.state.history) {
        if (this.state.history.hasOwnProperty(i)) {
          history.push(this.renderEntry(this.state.history[i], i));
        }
      }
    }
    const loadingSlow = (!this.state.error && this.state.history === null &&
      (new Date().getTime() - this.state.loadStart >= LOAD_INDICATOR_DELAY_MILLIS));

    const gitHubStatus = window.settings.enableNotebookGitVersioning ?
      this.renderGitHubStatusEntry() : null;

    return (
      <div className={ClassNames(historyPanelClasses)}>
        <div className='history-panel'>
          {gitHubStatus}
          {history}
          <div className='history-status-msg'>
            {loadingSlow ? 'Still loading...' : null}
            {this.state.error}
          </div>
        </div>
      </div>);
  },
});

module.exports = HistoryPanelView;
