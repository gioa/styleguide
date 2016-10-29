/* eslint react/prefer-es6-class: 0, complexity: 0, react/no-is-mounted: 0, func-names: 0 */

/**
 * View for a single Notebook
 */

import $ from 'jquery';
import _ from 'lodash';

import React from 'react';
import ReactDOM from 'react-dom';
import ClassNames from 'classnames';

import WorkspacePermissions from '../acl/WorkspacePermissions';

import ClusterList from '../clusters/ClusterList';

import LocalUserPreference from '../local_storage/LocalUserPreference';

import AutoClusterAttach from '../notebook/AutoClusterAttach.jsx';
import CodeMirrorUtils from '../notebook/CodeMirrorUtils';
import CommentsPanelView from '../notebook/CommentsPanelView.jsx';
import CommandSelectionPopover from '../notebook/CommandSelectionPopover.jsx';
import ContextBarView from '../notebook/ContextBarView.jsx';
import HistoryPanelView from '../notebook/HistoryPanelView.jsx';
import NotebookConstants from '../notebook/NotebookConstants';
import NotebookModel from '../notebook/NotebookModel';
import NotebookUtilities from '../notebook/NotebookUtilities';
import ReactNotebookCommandListView from '../notebook/ReactNotebookCommandListView.jsx';
import ReactNotebookListenerMixin from '../notebook/ReactNotebookListenerMixin.jsx';

import { FetchErrorPanel } from '../notebook/FetchErrorPanel.jsx';
import { NotebookInputPanel } from '../notebook/InputPanel/InputPanel.jsx';
import { ScheduleSideMenuView } from './ScheduleSideMenuView.jsx';

import ReactModalUtils from '../ui_building_blocks/dialogs/ReactModalUtils';

const ReactNotebookView = React.createClass({

  propTypes: {
    notebook: React.PropTypes.instanceOf(NotebookModel).isRequired,
    clusters: React.PropTypes.instanceOf(ClusterList).isRequired,
    initialDisplayMode: React.PropTypes.string,
  },

  mixins: [ReactNotebookListenerMixin],

  // The display modes for a notebook:
  // - notebook
  // - resultsOnly
  getInitialState() {
    // TODO(Chaoyu): remove this local storage setting, display mode should be specified in url
    this.localPrefs = new LocalUserPreference(this.props.notebook.get('guid'));
    const currentMode = this.props.initialDisplayMode;

    return {
      notebookToRender: this.props.notebook,
      commandViewOffsets: {},
      displayMode: currentMode,
      showLoadScreen: false,
      visibleSideMenu: window.showHistoryByDefault ? 'historyPanel' : '',
      focusedCommandGuid: null,
      isEditing: false,
      inputPanelHeight: 0,
    };
  },

  setPreviewNotebook(previewNotebook) {
    const originalScrollPosition = $('#content').scrollTop();
    if (previewNotebook === null) {
      this.setState({ notebookToRender: this.props.notebook });
    } else {
      this.setState({ notebookToRender: previewNotebook });
    }
    this.setState({ showLoadScreen: false });
    $('#content').scrollTop(originalScrollPosition);
    setTimeout(function() {
      $('#content').scrollTop(originalScrollPosition);
    }, 0);
  },

  setInputpanelMargin() {
    if (this.refs.inputPanel) {
      const inputPanelHeight = this.refs.inputPanel.getDisplayHeight();
      if (inputPanelHeight !== this.state.inputPanelHeight) {
        this.setState({ 'inputPanelHeight': inputPanelHeight });
      }
    }
  },

  componentDidMount() {
    this.setInputpanelMargin();
    this.setNotebookEventsHandler(this.state.notebookToRender);
    $(document).on('keydown', this.documentKeydownHandler);
    $(window).on('resize', this.setInputpanelMargin);

    // use capturing to prevent codemirror onblur handler from setting the isEditing state before
    // onWindowBlur handler receives the event
    window.addEventListener('blur', this.onWindowBlur, true /* use capturing event */);
    window.addEventListener('focus', this.onWindowFocus);
    $('#content').on('scroll', this.onNotebookViewScroll);

    window.notebook = this.props.notebook;
  },

  componentWillUnmount() {
    this.unsetNotebookEventsHandler(this.state.notebookToRender);
    $(document).off('keydown', this.documentKeydownHandler);
    $(window).off('resize', this.setInputpanelMargin);
    window.removeEventListener('blur', this.onWindowBlur);
    window.removeEventListener('focus', this.onWindowFocus);
    $('#content').off('scroll', this.onNotebookViewScroll);
    this.tearDownContextBar();
    window.notebook = null;
  },

  componentWillUpdate(nextProps, nextState) {
    if (nextState.notebookToRender !== this.state.notebookToRender) {
      this.unsetNotebookEventsHandler(this.state.notebookToRender);
      this.setNotebookEventsHandler(nextState.notebookToRender);
    }
  },

  componentDidUpdate() {
    this.setInputpanelMargin();
  },

  tearDownContextBar() {
    $('#content').css('top', '0');

    const contextBar = $('#context-bar');
    contextBar.hide();

    ReactDOM.unmountComponentAtNode(contextBar[0]);
  },

  setNotebookEventsHandler(notebook) {
    notebook.on('update-focus-command', this.onUpdateFocusedCommand, this);
    notebook.on('editor-blur', this.onEditorBlur, this);
    notebook.on('navigate-up', this.onNavigateUp, this);
    notebook.on('navigate-down', this.onNavigateDown, this);
    notebook.on('run-command', this.onRunCommand, this);
    notebook.on('widgetValueChanged', this.onWidgetValueChanged, this);
  },

  unsetNotebookEventsHandler(notebook) {
    notebook.off(null, null, this);
  },

  // In onWindowBlur callback, save the guid of the cell that user is editing here. It will be
  // reset to null in onWindowFocus where the cursor focus state was resumed.
  lastEditingCommandGuid: null,

  onWindowFocus(e) {
    // ignore focus events whose target is not window
    if (e.target !== window) { return; }
    // on window focus, reset cursor if it's been set on window blur
    if (this.lastEditingCommandGuid) {
      this.state.notebookToRender.trigger('update-focus-command', {
        commandGuid: this.lastEditingCommandGuid,
        isEditing: true,
      });
      this.lastEditingCommandGuid = null;
    }
  },

  // key can be command guid or command id, see NotebookModel.getCommandIndex
  _getCommandRef(key) {
    const notebook = this.state.notebookToRender;
    const commandIndex = notebook.getCommandIndex(key);
    if (this.refs.commandList && this.refs.commandList.refs[commandIndex]) {
      return this.refs.commandList.refs[commandIndex];
    }
    return null;
  },

  // This callback is being used in capturing phase
  onWindowBlur() {
    // on window blur, remember the currently editing cell for resetting the cursor later
    if (this.state.isEditing && this.state.focusedCommandGuid) {
      const commandRef = this._getCommandRef(this.state.focusedCommandGuid);
      const inputNode = commandRef ? ReactDOM.findDOMNode(commandRef.refs.input) : null;
      if (inputNode && !NotebookUtilities.isOutOfView($(inputNode))) {
        this.lastEditingCommandGuid = this.state.focusedCommandGuid;
      }
    }
  },

  onNotebookViewScroll() {
    // PROD-10056: In case of using text search built in with browser, it triggers "blur" event
    // when pressing Ctrl-F, and scrolls the content into view when user press NEXT MATCH. In this
    // case if user click to gain focus of the page, it should not set focus back to last editing
    // command
    this.lastEditingCommandGuid = null;
  },

  documentKeydownHandler(event) {
    // don't do anything if there is active dialog
    // Some unit tests do not clean up the modal they created, thus adding a not-in-test check
    if (!window.jsTestMode && ReactModalUtils.hasActiveModal()) { return; }

    // only respond to events from top level dom
    if (event.target.tagName.toLowerCase() !== 'body') { return; }

    const notebook = this.state.notebookToRender;
    if (!this.state.focusedCommandGuid || this.state.isEditing) {
      return;
    }

    // shift-enter
    if (event.keyCode === 13 && event.shiftKey) {
      this.onShiftEnter();
      event.preventDefault();
      return;
    }

    // control-enter
    if (event.keyCode === 13 && event.ctrlKey) {
      notebook.trigger('run-command', {
        commandGuid: this.state.focusedCommandGuid,
      });
      event.preventDefault();
      return;
    }

    // enter
    if (event.keyCode === 13) {
      notebook.trigger('update-focus-command', {
        commandGuid: this.state.focusedCommandGuid,
        isEditing: true,
      });
      // prevent codemirror from inserting a new line to the command
      event.preventDefault();
    }

    // press up or k or p
    if (event.keyCode === 38 || event.keyCode === 75 || event.keyCode === 80) {
      notebook.trigger('navigate-up', {
        commandGuid: this.state.focusedCommandGuid,
      });
      event.preventDefault();
    }

    // press down or f or n
    if (event.keyCode === 40 || event.keyCode === 74 || event.keyCode === 78) {
      notebook.trigger('navigate-down', {
        commandGuid: this.state.focusedCommandGuid,
      });
      event.preventDefault();
    }
  },

  onUpdateFocusedCommand({ commandGuid, isEditing }) {
    // if isEditing is not set, use current isEditing state
    isEditing = isEditing !== null ? isEditing : this.state.isEditing;

    this.setState({
      focusedCommandGuid: commandGuid,
      isEditing: isEditing,
    });
  },

  onEditorBlur({ commandGuid }) {
    if (commandGuid !== this.state.focusedCommandGuid) { return; }
    this.state.notebookToRender.trigger('update-focus-command', {
      commandGuid: commandGuid,
      isEditing: false,
    });
  },

  onNavigateUp({ commandGuid }) {
    if (commandGuid !== this.state.focusedCommandGuid) { return; }
    const notebook = this.state.notebookToRender;
    const commands = this.state.notebookToRender.getTopLevelCommands();
    const curCommand = _.find(commands, (cmd) => cmd.get('guid') === commandGuid);
    const curIndex = commands.indexOf(curCommand);
    if (curIndex <= 0) {
      return;
    }
    const targetCommand = commands[curIndex - 1];
    const startEditing = this.state.isEditing &&
      !targetCommand.isMarkdownCommand() &&
      !targetCommand.get('hideCommandCode') &&
      !targetCommand.get('collapsed');
    notebook.trigger('update-focus-command', {
      commandGuid: targetCommand.get('guid'),
      isEditing: startEditing,
    });
  },

  onNavigateDown({ commandGuid, insertCommand }) {
    if (commandGuid !== this.state.focusedCommandGuid) { return; }
    const notebook = this.state.notebookToRender;
    const commands = notebook.getTopLevelCommands();
    const curCommand = _.find(commands, (cmd) => cmd.get('guid') === commandGuid);
    const curIndex = commands.indexOf(curCommand);
    const targetIndex = curIndex + 1;
    if (targetIndex < notebook.getTopLevelCommands().length) {
      const targetCommand = commands[targetIndex];
      const startEditing = this.state.isEditing &&
        !targetCommand.isMarkdownCommand() &&
        !targetCommand.get('hideCommandCode') &&
        !targetCommand.get('collapsed');
      notebook.trigger('update-focus-command', {
        commandGuid: targetCommand.get('guid'),
        isEditing: startEditing,
      });
    } else if (insertCommand) {
      notebook.addCommand('', notebook.getMaxPosition() + 1, false, () => {
        const notebookToRender = this.state.notebookToRender;
        const topLevelCommands = notebookToRender.getTopLevelCommands();
        const lastCommand = topLevelCommands[topLevelCommands.length - 1];
        notebookToRender.trigger('update-focus-command', {
          commandGuid: lastCommand.get('guid'),
          isEditing: true,
        });
      });
    }
  },

  onShiftEnter() {
    const notebook = this.state.notebookToRender;
    const commandGuid = this.state.focusedCommandGuid;
    const command = notebook.getCommand(commandGuid);
    const cmdIndex = notebook.getCommandIndex(commandGuid);
    const isLastCommand = cmdIndex === (notebook.getTopLevelCommands().length - 1);
    if (isLastCommand && command.get('command') === '') {
      // if last cell is empty, only start editing the command
      notebook.trigger('update-focus-command', {
        commandGuid: commandGuid,
        isEditing: true,
      });
    } else {
      notebook.trigger('run-command', {
        commandGuid: commandGuid,
        callback: (wasCommandRun) => {
          if (wasCommandRun) {
            notebook.trigger('navigate-down', {
              commandGuid: commandGuid,
              insertCommand: notebook.canEdit(),
            });
          }
        },
      });
    }
  },

  onRunCommand({ commandGuid, options, callback }) {
    if (!this.refs.commandList) {
      console.error('runCommand only available when used in ReactNotebookView');
      return;
    }
    const cmdIndex = this.state.notebookToRender.getCommandIndex(commandGuid);
    const cmdView = this.refs.commandList.refs[cmdIndex];
    if (cmdIndex !== -1 && cmdView) {
      cmdView.runCommand(options, callback);
    }
  },

  onWidgetValueChanged({ autoRunOption, changedArgs }) {
    switch (autoRunOption) {
      case NotebookConstants.AUTO_RUN_ALL:
        this.state.notebookToRender.runAll();
        break;
      case NotebookConstants.AUTO_RUN_ACCESSED_COMMAND:
        this.state.notebookToRender.runByAccessedArgs(changedArgs);
        break;
      default:
        // no-op
        return;
    }
  },

  showRunCommandError(errors) {
    // @NOTE(jengler) 2015-11-18: The notebook will return a list of all errors, however, we will
    // only show one. Other than not have a UX design for how to display multiple errors, there is
    // no reason for this.
    const firstError = errors.errorType[0];
    if (window.settings.allowRunOnPendingClusters &&
      firstError === NotebookConstants.state.NO_CLUSTER_ATTACHED &&
      WorkspacePermissions.canEdit(this.getPermissionLevel())) {
        // TODO(ekl) advance to next command automatically
      AutoClusterAttach.promptForClusterAttach(
          firstError,
          errors.commandId,
          this.props.clusters,
          this.props.notebook,
          this.refs.contextBar);
    } else {
      this.refs.contextBar.showRunCommandHighlight(firstError);
    }
  },

  onNotebookMessage(message) {
    if (message.type === NotebookConstants.message.RUN_ERROR) {
      this.showRunCommandError(message.data);
    }
  },

  showPopover(cm) {
    if (this.isMounted() && this.refs.selectionPopover) {
      this.refs.selectionPopover.showPopover(cm);
    }
  },

  newLocalComment() {
    if (!this.selectionInfo) {
      return;
    }

    const commandNUID = this.selectionInfo.command.get('nuid');
    const reference = {
      referenceType: 'commandFragment',
      selection: this.selectionInfo.selection,
      range: this.selectionInfo.range,
    };

    this.setState({ visibleSideMenu: 'commentsPanel' }, function() {
      const newComment = this.props.notebook.newLocalComment(commandNUID, reference);

      // set new comment to active
      this.refs.commentsPanel.setActiveComment(newComment.get('guid'));

      // focus on new comment input box
      // timeout for the re-render which computes position of comments
      setTimeout(function() {
        $('.comment-' + newComment.get('guid') + ' textarea').focus();
      }, 100);
    });
  },

  getCommandViewOffsets() {
    const commandListView = this.refs.commandList;
    if (commandListView && commandListView.isMounted()) {
      return commandListView.getCommandViewOffsets();
    }
    return {};
  },

  getActiveCommentCommandNUID(comments) {
    if (!this.refs.commentsPanel) {
      return -1; // no active comment
    }

    const activeCommentGUID = this.refs.commentsPanel.getActiveCommentGUID();
    const comment = _.find(comments, function(someComment) {
      return someComment.get('guid') === activeCommentGUID;
    }, this);

    return comment && comment.get('commandNUID');
  },

  onActiveCommentChanges() {
    // on active comment changes, rerender to show the border for active commenting command
    _.defer(function() {
      this.forceUpdate();
    }.bind(this));
  },

  showLoadScreen() {
    this.setState({ showLoadScreen: true });
  },

  hideLoadScreen() {
    this.setState({ showLoadScreen: false });
  },

  onTextSelected(command, cm, options) {
    options = options || {};
    if (!CodeMirrorUtils.somethingNonEmptySelected(cm)) {
      return; // return if nothing is selected
    }

    this.selectionInfo = {
      command: command,
      range: {
        from: cm.getCursor('from'),
        to: cm.getCursor('to'),
      },
      selection: cm.getSelection(),
    };

    if (options.showPopover) {
      this.showPopover(cm);
    }

    if (options.createComment) {
      this.newLocalComment();
    }
  },

  renderNotebook(options) {
    options = options || {};
    const resultsOnly = options.resultsOnly;
    const notebook = this.state.notebookToRender;
    const comments = notebook.getComments();
    const activeCommentCommandNUID = this.getActiveCommentCommandNUID(comments);


    const commandListView = (
      <ReactNotebookCommandListView
        ref='commandList'
        notebook={notebook}
        isLocked={this.isHistoryPanelVisible() ? true : undefined}
        permissionLevel={this.getPermissionLevel()}
        resultsOnly={resultsOnly}
        showLoadScreen={this.state.showLoadScreen}
        onTextSelected={this.onTextSelected}
        showCommentsPanel={this.isCommentsPanelVisible()}
        toggleCommentsPanel={this.toggleCommentsPanel}
        activeCommentCommandNUID={activeCommentCommandNUID}
        focusedCommandGuid={this.state.focusedCommandGuid}
        isEditing={this.state.isEditing}
        showCommandRunTime
        showCommandRunUser
        showCommandClusterName
      />);

    const inputPanel = window.settings.enableNewInputWidgetUI ?
      <NotebookInputPanel ref='inputPanel' inputsMgr={notebook.inputs} /> : null;

    const classes = {
      'new-notebook': true,
      'overallContainer': true,
      'results-only': resultsOnly,
      'comments-panel-on': this.isCommentsPanelVisible(),
    };

    return (
      <div className='notebook-view'>
        {inputPanel}
        <div className={ClassNames(classes)}
          style={{ 'margin-top': this.state.inputPanelHeight + 'px' }}
        >
          <div className='sessionPane'></div>
          {commandListView}
          <div className='notebook-footer'></div>
        </div>
        {this.renderSideMenu(
          this.state.visibleSideMenu,
          this.getPermissionLevel(),
          notebook,
          comments)}
      </div>
    );
  },

  renderCurrentDisplayMode() {
    if (this.state.displayMode === 'resultsOnly') {
      return this.renderNotebook({ resultsOnly: true });
    }
    // displayMode === "Notebook"
    return this.renderNotebook({ resultsOnly: false });
  },

  /**
   * Toggle the currently visible sidemenu
   *
   * @param  {string} sideMenu The sidemenu being toggled
   *
   * @return {none}
   */
  toggleSideMenu(sideMenu) {
    window.recordEvent('sideMenuToggle', {
      'nbPrevSideMenu': this.state.visibleSideMenu,
      'nbCurrSideMenu': sideMenu,
    });

    // If the history panel is visible, then that means we are about to hide it
    // We need to be sure to clear the preview notebook so the notebook to render
    // is reset to the current notebook.
    if (this.isHistoryPanelVisible()) {
      this.setPreviewNotebook(null);
    }

    if (this.state.visibleSideMenu === sideMenu) {
      this.setState({ visibleSideMenu: '' });
    } else {
      this.setState({ visibleSideMenu: sideMenu });
    }
  },

  /**
   * Helper for determining if history panel is currently visible.
   * @return {Boolean} True iff the history panel is visible.
   */
  isHistoryPanelVisible() {
    return this.state.visibleSideMenu === 'historyPanel';
  },

  /**
   * Toggle function for history panel. Responsible for updating the
   * window.showHistoryByDefault setting.
   *
   * @return {none}
   */
  toggleHistory() {
    // Flip the showHistoryByDefault in between changes.
    window.showHistoryByDefault = !this.isHistoryPanelVisible();

    this.toggleSideMenu('historyPanel');
  },

  /**
   * Helper for determining if comments panel is currently visible.
   * @return {Boolean} True iff the comments panel is visible.
   */
  isCommentsPanelVisible() {
    return this.state.visibleSideMenu === 'commentsPanel';
  },

  /**
   * Toggle function for comments panel.
   *
   * @return {none}
   */
  toggleCommentsPanel() {
    this.toggleSideMenu('commentsPanel');
  },

  /**
   * Render the sidemenu specified by visibleSideMenu with the provided permissions.
   *
   * @param  {string} visibleSideMenu The sidemenu to render
   * @param  {WorkspacePermission} permissionLevel The WorkspacePermission object
   * @param  {NotebookModel} notebook The notebook model for the current view.
   * @param  {CommandCollection} comments The comments for the notebook
   *
   * @return {ReactElement|null} The rendered react side menu or null if none matched
   */
  renderSideMenu(visibleSideMenu, permissionLevel, notebook, comments) {
    // New style which just uses one flag for all side menus.
    switch (visibleSideMenu) {
      case 'schedule':
        return (
          <ScheduleSideMenuView
            ref='scheduleSideMenu'
            notebook={notebook}
            metricName='notebook'
            jobSubView={this.state.displayMode}
          />
        );
      case 'commentsPanel':
        return (
          <CommentsPanelView
            ref='commentsPanel'
            comments={comments}
            showCommentsPanel={this.isCommentsPanelVisible()}
            getCommandViewOffsets={this.getCommandViewOffsets}
            onActiveCommentChanges={this.onActiveCommentChanges}
            userId={window.settings.userId}
          />
        );
      case 'historyPanel':
        return (
          <HistoryPanelView
            ref='historyPanel'
            showNotebookCallback={this.setPreviewNotebook}
            showLoadScreenCallback={this.showLoadScreen}
            hideHistoryCallback={this.toggleHistory}
            notebook={this.props.notebook}
          />
        );
      default:
        return null;
    }
  },

  render() {
    if (this.props.notebook.notebookFetchError()) {
      // show an error view if the initial notebook fetch fails (e.g., due to access denied)
      return <FetchErrorPanel error={this.props.notebook.notebookFetchError()} />;
    }

    const contentClasses = {
      'history-panel-on': this.isHistoryPanelVisible(),
      'new-notebook': true,
    };

    const toggleScheduleSideMenu = () => { this.toggleSideMenu('schedule'); };

    return (
      <div>
        <ContextBarView
          ref='contextBar'
          model={this.props.notebook}
          clusters={this.props.clusters}
          isExampleNotebook={this.props.notebook.get('isExample')}
          displayMode={this.state.displayMode}
          permissionLevel={this.getPermissionLevel()}
          showLoadScreenCallback={this.showLoadScreen}
          hideLoadScreenCallback={this.hideLoadScreen}
          showCommentsPanel={this.isCommentsPanelVisible()}
          toggleCommentsPanel={this.toggleCommentsPanel}
          toggleHistory={this.toggleHistory}
          showHistory={this.isHistoryPanelVisible()}
          currentDashboardId={this.state.currentDashboardId}
          toggleSchedule={toggleScheduleSideMenu}
          showSchedule={this.state.visibleSideMenu === 'schedule'}
        />
        <div id='content' className={ClassNames(contentClasses)}>
          {this.renderCurrentDisplayMode()}
          <CommandSelectionPopover
            ref='selectionPopover'
            createComment={this.newLocalComment}
          />
        </div>
      </div>
    );
  },
});

module.exports = ReactNotebookView;
