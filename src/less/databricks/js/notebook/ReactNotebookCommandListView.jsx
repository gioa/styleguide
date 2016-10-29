/* eslint react/prefer-es6-class: 0, consistent-return: 0, func-names: 0 */

import $ from 'jquery';
import _ from 'underscore';
import React from 'react';
import ReactDOM from 'react-dom';
import ClassNames from 'classnames';

import WorkspacePermissions from '../acl/WorkspacePermissions';

import Clipboard from '../notebook/Clipboard';
import NotebookModel from '../notebook/NotebookModel';
import CommandDivider from '../notebook/CommandDivider.jsx';
import ReactNotebookCommandView from '../notebook/ReactNotebookCommandView.jsx';
import KeyboardShortcutsView from '../notebook/KeyboardShortcutsView.jsx';

import Presence from '../presence/Presence';

import ReactModalUtils from '../ui_building_blocks/dialogs/ReactModalUtils';

import { ResourceUrls } from '../urls/ResourceUrls';

import { MobileUtils } from '../user_platform/MobileUtils';

/**
 * props:
 *   notebook - the NotebookModel of the notebook
 *   resultsOnly - true iff we should display the results only view
 *   isLocked - true iff the notebook is locked
 *   isStatic - true iff this is a static notebook
 *   showLastDivider - show the divider after th last command in the notebook
 *   showSubmitHint - show the "Shift-enter to submit" hint at the bottom of the page
 *   commandIdToScroll - id of the command to scroll down to after page has loaded
 */
const ReactNotebookCommandListView = React.createClass({

  propTypes: {
    notebook: React.PropTypes.instanceOf(NotebookModel).isRequired,
    resultsOnly: React.PropTypes.bool,
    permissionLevel: React.PropTypes.string,
    isLocked: React.PropTypes.bool,
    isStatic: React.PropTypes.bool,
    showLoadScreen: React.PropTypes.bool,
    showLastDivider: React.PropTypes.bool,
    showSubmitHint: React.PropTypes.bool,
    onTextSelected: React.PropTypes.func,
    showCommentsPanel: React.PropTypes.bool,
    toggleCommentsPanel: React.PropTypes.func,
    commandIdToScroll: React.PropTypes.number,
    activeCommentCommandNUID: React.PropTypes.number,
    focusedCommandGuid: React.PropTypes.string,
    isEditing: React.PropTypes.bool,
    showCommandRunTime: React.PropTypes.bool,
    showCommandRunUser: React.PropTypes.bool,
    showCommandClusterName: React.PropTypes.bool,
  },

  getDefaultProps() {
    return {
      resultsOnly: false,
      permissionLevel: WorkspacePermissions.MANAGE,
      showLastDivider: true,
      showSubmitHint: true,
      focusedCommandGuid: null,
      isEditing: false,
    };
  },

  getInitialState() {
    return {
      mobile: MobileUtils.isMobile(),
      // used to show spinner (when true) while page is loading before scrolling
      // down to a specific command
      waitingToScroll: false,
    };
  },

  // So that incremental rendering of revision previews do not mess with the original scroll
  // position, we maintain a belief of the end height of the fully rendered notebook. Scroll
  // position is preserved by inserting a spacer that takes up the remaining un-rendered space
  // during incremental rendering.
  currentHeightBelief: 0,
  lastRenderWasIncremental: false,
  calculateSpacerHeight(isIncrementalRender) {
    const currentHeight =
      $('#content').prop('scrollHeight') - $('.contentSpacer').prop('scrollHeight');
    if (isIncrementalRender && currentHeight < this.currentHeightBelief) {
      return (this.currentHeightBelief - currentHeight) + 'px';
    }
    if (!isIncrementalRender || currentHeight > this.currentHeightBelief) {
      this.currentHeightBelief = currentHeight;
    }
    return '0px';
  },

  componentWillUpdate(nextProps) {
    if (nextProps.notebook !== this.props.notebook) {
      // Resets incremental rendering state. Large notebooks get slow without this.
      this.commandsToRenderMap = {};
      _.each(nextProps.notebook.getCommands(), function(cmd) {
        this.commandsToRenderMap[cmd.get('id')] = false;
      }, this);
    }

    // If focused command changed, scroll that command into view
    if (nextProps.focusedCommandGuid &&
        !nextProps.isEditing &&
        (nextProps.focusedCommandGuid !== this.props.focusedCommandGuid)) {
      const cIndex = nextProps.notebook.getCommandIndex(nextProps.focusedCommandGuid);
      if (this.refs[cIndex]) {
        this.refs[cIndex].scrollCommandIntoView();
      }
    }
  },

  componentDidUpdate(prevProps) {
    $('.contentSpacer').css('height', this.calculateSpacerHeight(this.lastRenderWasIncremental));
    if (prevProps.notebook !== this.props.notebook) {
      this.loadMoreCommandsToRender();  // start loading commands for rendering
    }
  },

  focusCommand(commandIndex) {
    const command = this.props.notebook.getTopLevelCommands()[commandIndex];
    if (command) {
      this.props.notebook.trigger('update-focus-command', {
        commandGuid: command.get('guid'),
        isEditing: true,
      });
    }
  },

  moveCommandUp(commandIndex, options) {
    options = options || {};
    if (commandIndex > 0) {
      const prevCommand = this.refs[commandIndex - 1];
      const thisCommand = this.refs[commandIndex];
      this.swapCommandPositions(thisCommand.props.command, prevCommand.props.command);
      if (!options.skipFocusCommand) {
        _.defer(_.partial(this.focusCommand, commandIndex - 1));
      }
    }
  },

  moveCommandDown(commandIndex, options) {
    options = options || {};
    if (!this.refs[commandIndex].props.isLastCommand) {
      const thisCommand = this.refs[commandIndex];
      const nextCommand = this.refs[commandIndex + 1];
      this.swapCommandPositions(thisCommand.props.command, nextCommand.props.command);
      if (!options.skipFocusCommand) {
        _.defer(_.partial(this.focusCommand, commandIndex + 1));
      }
    }
  },

  swapCommandPositions(command1, command2) {
    Presence.pushHistory('Rearranged commands');
    const pos1 = command1.get('position');
    const pos2 = command2.get('position');
    command1.updateCommand({ position: pos2 });
    command2.updateCommand({ position: pos1 });
  },

  getInsertPositionAbove(commandIndex) {
    if (commandIndex > _.size(this.refs) - 1) {
      return this.props.notebook.getMaxPosition() + 1;
    }
    const thisCommandPosition =
      this.refs[commandIndex].props.command.get('position');
    const prevCommandPosition =
      commandIndex === 0 ? 0 : this.refs[commandIndex - 1].props.command.get('position');
    return prevCommandPosition + ((thisCommandPosition - prevCommandPosition) / 2);
  },

  getInsertPositionBelow(commandIndex) {
    if (commandIndex < 0) {
      return this.getInsertPositionAbove(0);
    }
    const thisCommand = this.refs[commandIndex];
    const thisCommandPosition = thisCommand.props.command.get('position');
    const nextCommandPosition = thisCommand.props.isLastCommand ?
      thisCommandPosition + 2 : this.refs[commandIndex + 1].props.command.get('position');
    return thisCommandPosition + ((nextCommandPosition - thisCommandPosition) / 2);
  },

  pasteCommandAbove(commandIndex) {
    const insertPosition = this.getInsertPositionAbove(commandIndex);
    this.pasteCommand(insertPosition, commandIndex);
  },

  pasteCommandBelow(commandIndex) {
    const insertPosition = this.getInsertPositionBelow(commandIndex);
    this.pasteCommand(insertPosition, commandIndex + 1);
  },

  pasteCommand(insertPosition, insertIndex) {
    const cmdAttrs = Clipboard.getCommand();
    if (cmdAttrs && insertPosition) {
      this.props.notebook.pasteCommand(
        cmdAttrs, insertPosition, _.partial(this.focusCommand, insertIndex));
    }
  },

  addCommandAbove(commandIndex) {
    const insertPosition = this.getInsertPositionAbove(commandIndex);
    this.props.notebook.addCommand(
      '', insertPosition, false, _.partial(this.focusCommand, commandIndex));
  },

  addCommandBelow(commandIndex) {
    const insertPosition = this.getInsertPositionBelow(commandIndex);
    this.props.notebook.addCommand(
      '', insertPosition, false, _.partial(this.focusCommand, commandIndex + 1));
  },

  // Incrementaly render commandViews
  getCommandsToRender() {
    if (!this.commandsToRenderMap) { // haven't been initialized
      return this.props.notebook.getTopLevelCommands();
    }

    return _.filter(this.props.notebook.getTopLevelCommands(), function(cmd) {
      // render the command if it's not in the map(new commands added after initial load)
      // or the value in commandsToRenderMap is true
      return this.commandsToRenderMap[cmd.get('id')] !== false;
    }, this);
  },

  // TODO(lauren/chaoyu) once the notebook func in the router is refactored to remove
  // the old dashboard parameters, pass in this prop instead of doing this
  getCommandIdToScroll() {
    const baseUrl = '#notebook/' + this.props.notebook.id + '/command/';
    if (window.location.hash.indexOf('/command') < 0) {
      return false;
    }
    return window.location.hash.replace(new RegExp(baseUrl), '');
  },

  scrollToCommand() {
    // TODO(lauren/chaoyu) once the notebook func in the router is refactored to remove
    // the old dashboard parameters, pass in this prop and remove || this.getCommandIdToScroll()
    const commandId = this.props.commandIdToScroll || this.getCommandIdToScroll();
    const index = commandId ? this.props.notebook.getCommandIndex(parseInt(commandId, 10)) : null;
    const command = ReactDOM.findDOMNode(this.refs[index]);

    if (!commandId) {
      return false;
    }

    // don't scroll unless command is actually found
    if (commandId && index < 0) {
      this.setState({ waitingToScroll: false });
      return false;
    }

    if (command) {
      this.setState({ waitingToScroll: false });
      this.focusCommand(index);
      this.refs[index].refs[commandId].highlight();
    }
  },

  loadMoreCommandsToRender() {
    let size = 5; // number of commands to render in each load

    _.each(this.props.notebook.getCommandIds(), function(cmdId) {
      if (!this.commandsToRenderMap[cmdId] && size > 0) {
        size--;
        this.commandsToRenderMap[cmdId] = true;
      }
    }, this);

    this.forceUpdate();

    // load more commands if there are any
    if (size <= 0) {
      _.defer(this.loadMoreCommandsToRender, 500);
    } else {
      // wait until all commands are loaded to avoid any erratic jumps while
      // the height of commands is still rendering (e.g. for images or iframes)
      _.defer(this.scrollToCommand, 500);
    }
  },

  // This method gets called when command collection is ready for first render
  initializeCommandsToRender() {
    if (this.commandsToRenderMap) { // already initialized
      return;
    }

    this.commandsToRenderMap = {};
    _.each(this.props.notebook.getCommandIds(), function(id) {
      this.commandsToRenderMap[id] = false; // skip all commands rendering
    }, this);
    this.loadMoreCommandsToRender(); // start loading commands for rendering

    this.focusFirstCommandIfNotFromSearch();
  },

  focusFirstCommandIfNotFromSearch() {
    // Focus the first command, unless we opened this notebook from a search result
    // TODO(jeffpang): would be nice not to use a global variable to detect coming from search
    const fromSearchResult = window.fileBrowserView && window.fileBrowserView.searchPanelOpen;
    if (!fromSearchResult) {
      // focus on the first command, start editing if it's not a markdown command
      const firstCmd = this.props.notebook.getTopLevelCommands()[0];
      if (firstCmd) {
        // only start editing first cell if it's not collapsed and not a markdown cell
        const startEditing = !firstCmd.isMarkdownCommand() && !firstCmd.get('collapsed');
        this.props.notebook.trigger('update-focus-command', {
          commandGuid: firstCmd.get('guid'),
          isEditing: startEditing,
        });
      }
    }
  },

  componentWillMount() {
    // start incremental rendering if the commandCollection is already populated, otherwise wait
    // util commandCollection add/reset event
    if (this.props.notebook.commandCollection().length > 0) {
      this.initializeCommandsToRender();
    } else {
      // listen to the initial load of command collection
      this.props.notebook.commandCollection()
        .once('add reset', this.initializeCommandsToRender, this);
    }

    // show a spinner if we will be scrolling to a specific command
    // TODO(lauren/chaoyu) once the notebook func in the router is refactored to remove
    // the old dashboard parameters, remove the || this.getCommandIdToScroll()
    if (this.props.commandIdToScroll || this.getCommandIdToScroll()) {
      this.setState({ waitingToScroll: true });
    }
  },

  componentWillUnmount() {
    // @NOTE(jengler) 2016-04-07: Under the hood, the command collection is async, so it is possible
    // that the once() callback could happend after unload. Must make sure to turn off our listener
    // to prevent exceptions.
    this.props.notebook.commandCollection().off(null, null, this);
  },

  commandViewOffsetsMap: {},
  getCommandViewOffsets() {
    _.each(this.props.notebook.getTopLevelCommands(), function(command, index) {
      const commandView = this.refs[index];
      if (!commandView || !commandView.isMounted()) {
        return;
      }
      const $el = $(ReactDOM.findDOMNode(commandView));
      const offset = $el.offset();
      offset.top += $el.scrollParent().scrollTop();
      this.commandViewOffsetsMap[command.get('nuid')] = offset.top;
    }, this);
    return this.commandViewOffsetsMap;
  },

  /**
   * Return a partial function that runs func with the first argument being the index of
   * the given commandId. The index is discovered at the time the function is run, so the
   * function will be called with the correct index even if the index of the command changes.
   *
   * @param func {function} function to create a partial function from
   * @param cmdKey {any} the command ID or GUID of the command model
   * @returns {function} a partial function
   */
  partialWithCommandIndex(func, cmdKey) {
    const self = this;
    return function(...args) {
      const index = self.props.notebook.getCommandIndex(cmdKey);
      if (index >= 0) {
        const boundFunc = _.partial(func, index);
        boundFunc.apply(self, args);
      }
    };
  },

  handleShortcutsClick() {
    window.recordEvent('shortcutsViewed', {
      clickOrigin: 'notebookBottomShortcutsLink',
    });

    ReactModalUtils.createModal(
      <KeyboardShortcutsView
        style={{ left: 0 }}
        defaultCloseIcon
        defaultOpenState
      />
    );
  },

  render() {
    const topLevelCommands = this.props.notebook.getTopLevelCommands();
    const subCommandMap = this.props.notebook.getSubCommandMap();
    const maxPos = this.props.notebook.getMaxPosition();
    const isEmptyNotebook = topLevelCommands.length === 0;
    const isLocked = this.props.isLocked === undefined ? false : this.props.isLocked;

    const commandsToRender = this.getCommandsToRender();
    this.lastRenderWasIncremental = commandsToRender.length !== topLevelCommands.length;

    const commandViews = _.flatten(
      commandsToRender.map(function(command, index, commands) {
        const guid = command.get('guid');
        const commandId = command.get('id');
        const key = guid || commandId;
        const isFirstCommand = index === 0;
        const isLastCommand = (index + 1) === commands.length;
        const prevCommandPosition = index > 0 ? commands[index - 1].get('position') : 0;
        const divider = (
          <CommandDivider
            key={key + '-divider'}
            notebook={this.props.notebook}
            insertCommand={_.partial(this.addCommandAbove, index)}
            pasteCommand={_.partial(this.pasteCommandAbove, index)}
            prevCommandPosition={prevCommandPosition}
            nextCommandPosition={command.get('position')}
          />
        );

        const hasFocus = (this.props.focusedCommandGuid === guid);
        const commandView = (
          <ReactNotebookCommandView
            key={key}
            index={index}
            ref={index}
            commandGuid={guid}
            permissionLevel={this.props.permissionLevel}
            pasteCommandBelow={this.partialWithCommandIndex(this.pasteCommandBelow, key)}
            pasteCommandAbove={this.partialWithCommandIndex(this.pasteCommandAbove, key)}
            addCommandAbove={this.partialWithCommandIndex(this.addCommandAbove, key)}
            addCommandBelow={this.partialWithCommandIndex(this.addCommandBelow, key)}
            moveUp={this.partialWithCommandIndex(this.moveCommandUp, key)}
            moveDown={this.partialWithCommandIndex(this.moveCommandDown, key)}
            isLocked={isLocked}
            isStatic={this.props.isStatic}
            isFirstCommand={isFirstCommand}
            isLastCommand={isLastCommand}
            command={command}
            showCommentMarks={this.props.showCommentsPanel}
            toggleCommentsPanel={this.props.toggleCommentsPanel}
            isCommenting={this.props.activeCommentCommandNUID !== undefined &&
              command.get('nuid') === this.props.activeCommentCommandNUID}
            subCommands={subCommandMap[guid] || []}
            notebook={this.props.notebook}
            resultsOnly={this.props.resultsOnly}
            mobile={this.state.mobile}
            onTextSelected={this.props.onTextSelected}
            hasFocus={hasFocus}
            isEditing={hasFocus && this.props.isEditing}
            showCommandRunTime={this.props.showCommandRunTime}
            showCommandRunUser={this.props.showCommandRunUser}
            showCommandClusterName={this.props.showCommandClusterName}
          />
        );
        return this.props.resultsOnly ? [commandView] : [divider, commandView];
      }, this));

    const lastDivider = !this.props.showLastDivider ? null : (
      <CommandDivider
        key={"last-command-divider"}
        isEmptyNotebook={isEmptyNotebook}
        notebook={this.props.notebook}
        insertCommand={_.partial(this.addCommandBelow, topLevelCommands.length - 1)}
        pasteCommand={_.partial(this.pasteCommandBelow, topLevelCommands.length - 1)}
        prevCommandPosition={maxPos}
        nextCommandPosition={maxPos + 1}
      />
    );

    const canRun = WorkspacePermissions.canRun(this.props.permissionLevel);
    const canEdit = WorkspacePermissions.canEdit(this.props.permissionLevel);

    const shortCutsLink = canEdit ?
      <a className='shortcuts-link' title='View keyboard shortcuts'
        onClick={this.handleShortcutsClick}
      >shortcuts</a> : null;
    const submitHint = !this.props.showSubmitHint || isLocked || isEmptyNotebook || !canRun ? null :
      (<div className='submit-hint'>
        Shift+Enter to run &nbsp;&nbsp;&nbsp;
        {shortCutsLink}
       </div>);

    const classes = ClassNames({
      'shell-top': true,
      'new-notebook': true,
      'notebook-loading': this.props.showLoadScreen || this.state.waitingToScroll,
      'locked': isLocked,
      'no-edit': !canEdit,
      'no-run': !canRun,
      'static-notebook': this.props.isStatic,
    });

    // Takes up space for cells that have not yet been rendered.
    const spacerStyle = {
      background: window.settings.notebookLoadingBackground,
      height: '0px', /* updated in componentDidUpdate */
    };
    const spacer = <div className='contentSpacer' style={spacerStyle}></div>;

    return (
      <div className={classes}>
        <img className='load-spinner' src={ResourceUrls.getResourceUrl('img/spinner.svg')} />
        { commandViews }
        { this.props.resultsOnly ? null : lastDivider }
        { this.props.resultsOnly ? null : submitHint }
        { spacer }
      </div>
    );
  },
});

module.exports = ReactNotebookCommandListView;
