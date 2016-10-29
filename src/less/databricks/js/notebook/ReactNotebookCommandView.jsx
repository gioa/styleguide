/* eslint react/prefer-es6-class: 0, complexity: 0, react/no-is-mounted: 0, consistent-return: 0,
max-lines: 0, func-names: 0 */

import $ from 'jquery';
import _ from 'lodash';
import React from 'react';
import ReactDOM from 'react-dom';
import ClassNames from 'classnames';

import WorkspacePermissions from '../acl/WorkspacePermissions';

import Clipboard from '../notebook/Clipboard';
import CommandParserUtils from '../notebook/CommandParserUtils';
import CodeMirrorKeywords from '../notebook/CodeMirrorKeywords';
import CodeMirrorUtils from '../notebook/CodeMirrorUtils';
import { CodeModeUtils } from '../notebook/CodeModeUtils';
import CommandInput from '../notebook/CommandInput.jsx';
import CommandResult from '../notebook/CommandResult.jsx';
import CommandSpinner from '../notebook/CommandSpinner.jsx';
import CommandStats from '../notebook/CommandStats.jsx';
import { CommandStateUtils } from '../notebook/CommandUtils';
import DataWidget from '../notebook/dashboards/DataWidget';
import ExportUtility from '../notebook/ExportUtility';
import InputWidget from '../notebook/InputWidget';
import RichCommandError from '../notebook/RichCommandError.jsx';
import SubCommandResults from '../notebook/SubCommandResults.jsx';
import NotebookCommandModel from '../notebook/NotebookCommandModel';
import NotebookConstants from '../notebook/NotebookConstants.js';
import NotebookModel from '../notebook/NotebookModel';
import NotebookUtilities from '../notebook/NotebookUtilities';
import StreamStatusView from '../notebook/StreamStatusView.jsx';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';
import DropdownMenuView from '../ui_building_blocks/dropdowns/DropdownMenuView.jsx';
import IconsForType from '../ui_building_blocks/icons/IconsForType';
import Highlight from '../ui_building_blocks/highlight/Highlight.jsx';
import InlineEditableText from '../ui_building_blocks/text/InlineEditableText.jsx';

const CommandButtons = React.createClass({

  propTypes: {
    index: React.PropTypes.number.isRequired,
    resultsOnly: React.PropTypes.bool.isRequired,
    isLocked: React.PropTypes.bool.isRequired,
    isFirstCommand: React.PropTypes.bool.isRequired,
    isLastCommand: React.PropTypes.bool.isRequired,
    removeFunc: React.PropTypes.func.isRequired,
    collapseFunc: React.PropTypes.func.isRequired,
    isCollapsed: React.PropTypes.bool.isRequired,
    copyCommand: React.PropTypes.func.isRequired,
    cutCommand: React.PropTypes.func.isRequired,
    exportCommand: React.PropTypes.func.isRequired,
    pasteCommandAbove: React.PropTypes.func.isRequired,
    pasteCommandBelow: React.PropTypes.func.isRequired,
    addCommandAbove: React.PropTypes.func.isRequired,
    addCommandBelow: React.PropTypes.func.isRequired,
    moveUp: React.PropTypes.func.isRequired,
    moveDown: React.PropTypes.func.isRequired,
    getLanguage: React.PropTypes.func.isRequired,
    runCommand: React.PropTypes.func.isRequired,
    permissionLevel: React.PropTypes.string,
    exportToDashboardFunc: React.PropTypes.func,
    dashboardViewModels: React.PropTypes.array,
    command: React.PropTypes.instanceOf(NotebookCommandModel),
    mobile: React.PropTypes.bool,
    isStatic: React.PropTypes.bool,
  },

  getDefaultProps() {
    return {
      permissionLevel: WorkspacePermissions.MANAGE,
    };
  },

  getInitialState() {
    return { menuVisible: false };
  },

  toggleMenu() {
    this.setState({ menuVisible: !this.state.menuVisible });
  },

  toggleDashboardMenu() {
    this.setState({ dashboardMenuVisible: !this.state.dashboardMenuVisible });
  },

  tags() {
    const tags = this.props.command.tags();
    tags.source = 'CommandButtons';
    return tags;
  },

  toggleCommandResultInDashboard(dashboard, event) {
    if (event.target.type !== 'checkbox') { return; }

    let tags = this.tags();
    tags = _.extend(dashboard.tags(), tags);

    if (event.target.checked) {
      tags.eventType = 'addCommand';
      dashboard.addCommandElement(this.props.command.attributes.nuid);
    } else {
      tags.eventType = 'removeCommand';
      dashboard.removeCommandElement(this.props.command.attributes.nuid);
    }

    window.recordEvent('dashboard', tags);
  },

  openDashboardView(dashboardId) {
    const notebookId = this.props.command.notebook().id;

    window.recordEvent('dashboard', {
      eventType: 'open',
      notebookId: notebookId,
      dashboardId: dashboardId,
      source: 'command-dashboard-list-dashboard-view-nav-link',
    });

    window.router.navigate('#notebook/' + notebookId +
      '/dashboard/' + dashboardId, { trigger: true });
  },

  addNewDashboardView() {
    const notebookId = this.props.command.notebook().id;

    window.recordEvent('dashboard', {
      eventType: 'create',
      notebookId: notebookId,
      source: 'command-dashboard-list-new-dashboard-link',
    });

    this.setState({ dashboardMenuVisible: false });
    const command = this.props.command;
    command.notebook().createNewDashboardView(
      function(res) {
        window.open('#notebook/' + command.notebook().id +
          '/dashboard/' + res.dashboardId, '_blank');
      },
      null,
      [command.get('nuid')]
    );
  },

  getDashboardMenuItems() {
    if (!window.settings.enableNewDashboardViews) {
      return;
    }

    const canEdit = WorkspacePermissions.canEdit(this.props.permissionLevel);

    const self = this;
    const dashboards = this.props.dashboardViewModels;
    const dropdownTitle = (<div className='heading dashboard-list-title'>
      {canEdit ? 'Show in Dashboard View:' : 'Shown in Dashboard View:'}
    </div>);
    const dropdownElements = [];
    const createDashboardCheckbox = function(dashboard) {
      const commandClickHandler = self.toggleCommandResultInDashboard.bind(self, dashboard);
      const dashboardClickHandler = self.openDashboardView.bind(self, dashboard.id);
      const attrs = dashboard.attributes;
      dropdownElements.push(
        <a className='dashboard-list-item'>
          <div key={dashboard.get('guid')} className='element-toggle-input'
            onClick={commandClickHandler}
          >
            <input
              type='checkbox'
              disabled={!canEdit}
              className='dashboard-checkbox'
              title={'Add command result to Dashboard ' + attrs.title}
              id={'dashboard-view-input-' + attrs.id}
              defaultChecked={dashboard.hasCommandElement(self.props.command.attributes.nuid)}
            >
              <label
                htmlFor={'dashboard-view-input-' + attrs.id}
                title={'Add command result to Dashboard ' + attrs.title}
              >
                {attrs.title}
              </label>
            </input>
          </div>
          <div className='dashboard-view-nav-link'
            onClick={dashboardClickHandler}
          >
            <i className={'fa fa-fw fa-' + IconsForType.navigate}
              title={'Go to Dashboard ' + attrs.title}
            ></i>
          </div>
        </a>
      );
    };

    dashboards.forEach(createDashboardCheckbox);

    if (dropdownElements.length > 0) {
      dropdownElements.unshift(dropdownTitle);
    }

    if (canEdit) {
      if (dropdownElements.length > 0) {
        dropdownElements.push(<p role='separator' className='divider' ></p>);
      }

      // add link to create new dashboard view
      const newDashboardLink = (
        <a className='new-dashboard-link' onClick={this.addNewDashboardView}>
          <i className={'fa fa-' + IconsForType.create}></i>
          Add to New Dashboard
        </a>
      );
      dropdownElements.push(newDashboardLink);
    }

    return dropdownElements;
  },

  // the dashboard-button-{index} class is so we only toggle the menu when clicking this
  // cell's dashboard button (otherwise it would trigger for any cell's dashboard button)
  renderDashboardMenu() {
    return (
      <DropdownMenuView
        outsideClickHandler={this.toggleDashboardMenu}
        ignoreClickClasses={['dashboard-button-' + this.props.index]}
        handleClickInMenu={false}
        getItems={this.getDashboardMenuItems}
        classes={['command-dashboard-menu', 'right']}
      />);
  },

  getMenuEditItems() {
    const canEdit = WorkspacePermissions.canEdit(this.props.permissionLevel);
    const copyCell = (
      <a
        className='copy-item'
        title='Copy this cell'
        onClick={this.props.copyCommand}
      >
        <i className='fa fa-copy fa-fw'></i>
        <span>Copy Cell</span>
      </a>);
    const cutCell = canEdit ? (
      <a className='cut-item'
        title='Cut this cell'
        onClick={this.props.cutCommand}
      >
        <i className='fa fa-cut fa-fw'></i>
        <span>Cut Cell</span>
      </a>) : null;
    const exportCell = window.settings.enableStaticNotebooks ? (
      <a className='export-item'
        title='Export this cell'
        onClick={this.props.exportCommand}
      >
        <i className='fa fa-download fa-fw'></i>
        <span>Export Cell</span>
      </a>) : null;
    const pasteAbove = canEdit && !Clipboard.isEmpty() ? (
      <a className='paste-above-item'
        title='Paste a cell above'
        onClick={this.props.pasteCommandAbove}
      >
        <i className='fa fa-paste fa-fw'></i>
        <span>Paste Above</span>
      </a>) : null;
    const pasteBelow = canEdit && !Clipboard.isEmpty() ? (
      <a className='paste-below-item'
        title='Paste a cell below'
        onClick={this.props.pasteCommandBelow}
      >
        <i className='fa fa-paste fa-fw'></i>
        <span>Paste Below</span>
      </a>) : null;
    return [
      copyCell,
      cutCell,
      exportCell,
      pasteAbove,
      pasteBelow,
    ];
  },

  getMenuAddItems() {
    const above = (
      <a className='add-above-item'
        title='Add a cell above'
        onClick={this.props.addCommandAbove}
      >
        <i className='fa fa-toggle-up fa-fw'></i>
        <span>Add Cell Above</span>
      </a>);
    const below = (
      <a className='add-below-item'
        title='Add a cell below'
        onClick={this.props.addCommandBelow}
      >
        <i className='fa fa-toggle-down fa-fw'></i>
        <span>Add Cell Below</span>
      </a>);
    return [
      above,
      below,
    ];
  },

  getMenuMoveItems() {
    const canEdit = WorkspacePermissions.canEdit(this.props.permissionLevel);
    const up = canEdit && !this.props.isFirstCommand ? (
      <a className='move-up-item'
        title='Move cell up one'
        onClick={this.props.moveUp}
      >
        <i className='fa fa-long-arrow-up fa-fw'></i>
        <span>Move Up</span>
      </a>) : null;
    const down = canEdit && !this.props.isLastCommand ? (
      <a className='move-down-item'
        title='Move cell down one'
        onClick={this.props.moveDown}
      >
        <i className='fa fa-long-arrow-down fa-fw'></i>
        <span>Move Down</span>
      </a>) : null;
    return _.filter([
      up,
      down,
    ], function(e) { return e !== null; });
  },

  getMenuItems() {
    const canEdit = WorkspacePermissions.canEdit(this.props.permissionLevel);
    const editItems = this.getMenuEditItems();
    const addItems = canEdit ? this.getMenuAddItems() : [];
    const moveItems = this.getMenuMoveItems();
    const viewItems = canEdit ? this.getCommandMenuViewItems() : [];

    return editItems
      .concat(addItems.length > 0 ? <hr /> : null)
      .concat(addItems)
      .concat(moveItems.length > 0 ? (<hr />) : null)
      .concat(moveItems)
      .concat(viewItems.length > 0 ? (<hr />) : null)
      .concat(viewItems);
  },

  _toggleCommandField(key) {
    const command = this.props.command;
    const changes = {};
    changes[key] = !command.get(key);
    command.updateCommand(changes);
  },

  _toggleTitleVisible() {
    this._toggleCommandField('showCommandTitle');
  },

  _toggleCodeVisible() {
    this._toggleCommandField('hideCommandCode');
  },

  _toggleResultVisible() {
    this._toggleCommandField('hideCommandResult');
  },

  getCommandMenuViewItems() {
    const command = this.props.command;
    const showOrHideCommandTitle = (
      <a className='show-or-hide-title'
        title={command.get('showCommandTitle') ? 'Hide Command Title' : 'Show Command Title'}
        onClick={this._toggleTitleVisible}
      >
        <i className='fa fa-header fa-fw'></i>
        <span>{command.get('showCommandTitle') ? 'Hide Title' : 'Show Title'}</span>
      </a>);

    const showOrHideCommandCode = (
      <a className='show-or-hide-code'
        title={command.get('hideCommandCode') ? 'Show Code' : 'Hide Code'}
        onClick={this._toggleCodeVisible}
      >
        <i className='fa fa-code fa-fw'></i>
        <span>{command.get('hideCommandCode') ? 'Show Code' : 'Hide Code'}</span>
      </a>);

    const showOrHideCommandResult = (
      <a className='show-or-hide-result'
        title={command.get('hideCommandResult') ? 'Show Result' : 'Hide Result'}
        onClick={this._toggleResultVisible}
      >
        <i className='fa fa-file-code-o fa-fw'></i>
        <span>{command.get('hideCommandResult') ? 'Show Result' : 'Hide Result'}</span>
      </a>);

    return [showOrHideCommandTitle, showOrHideCommandCode, showOrHideCommandResult];
  },

  // the edit-button-{index} class is so we only toggle the menu when clicked on this
  // cell's edit button (otherwise it would trigger for any cell's edit button)
  renderMenu() {
    return (<DropdownMenuView
      outsideClickHandler={this.toggleMenu}
      ignoreClickClasses={['edit-button-' + this.props.index]}
      handleClickInMenu
      getItems={this.getMenuItems}
      classes={['command-edit-menu', 'right']}
    />);
  },

  runCommand() {
    this.props.runCommand();
  },

  render() {
    const canRun = WorkspacePermissions.canRun(this.props.permissionLevel);
    const canEdit = WorkspacePermissions.canEdit(this.props.permissionLevel);

    const showNewDashboardMenu = canEdit && this.props.command.isComplexResult() &&
      window.settings.enableNewDashboardViews &&
      !this.props.command.attributes.isExample;

    const classes = ClassNames({
      'command-buttons': true,
      'menu-visible': this.state.menuVisible,
      'dashboard-menu-visible': this.state.dashboardMenuVisible,
    });

    const command = this.props.command;

    return (
      <div className={classes}>
        {canRun && !command.isMarkdownCommand() && !this.props.isStatic ?
          <a className={"run-command-button command-button"} onClick={this.runCommand}
            title='Run Cell'
          >
            <i className={"fa fa-fw fa-play"}></i>
          </a> : null}

        {showNewDashboardMenu ?
          <a className={'dashboard-button dashboard-button-' + this.props.index + ' command-button'}
            onClick={this.toggleDashboardMenu}
            title='Show in Dashboard Menu'
          >
            <i className='fa fa-bar-chart fa-fw'></i>
          </a> : null}

        {showNewDashboardMenu && this.state.dashboardMenuVisible ?
          this.renderDashboardMenu() : null}

        {this.props.resultsOnly ? null :
          <a className={'edit-button edit-button-' + this.props.index + ' command-button'}
            onClick={this.toggleMenu}
            title={"Edit Menu"}
          >
            <i className={"fa fa-fw fa-chevron-down"}></i>
          </a>}

        {this.state.menuVisible ? this.renderMenu() : null}

        {canEdit ?
          <a className='toggle-collapse-button command-button'
            onClick={this.props.collapseFunc}
            title={this.props.isCollapsed ? 'Maximize' : 'Minimize'}
          >
            <i className={this.props.isCollapsed ? 'fa fa-fw fa-plus' : 'fa fa-fw fa-minus'}></i>
          </a> : null}

        {canEdit && !this.props.resultsOnly ?
          <a className='remove-button command-button'
            onClick={this.props.removeFunc}
            title='Delete'
          >
            <i className='fa fa-fw fa-remove'></i>
          </a> : null}
      </div>
    );
  },
});

const ReactNotebookCommandView = React.createClass({

  propTypes: {
    commandGuid: React.PropTypes.string.isRequired,
    command: React.PropTypes.instanceOf(NotebookCommandModel).isRequired,
    notebook: React.PropTypes.instanceOf(NotebookModel).isRequired,
    permissionLevel: React.PropTypes.string,
    subCommands: React.PropTypes.array,
    isLocked: React.PropTypes.bool,
    isFirstCommand: React.PropTypes.bool,
    isLastCommand: React.PropTypes.bool,
    pasteCommandAbove: React.PropTypes.func.isRequired,
    pasteCommandBelow: React.PropTypes.func.isRequired,
    addCommandAbove: React.PropTypes.func.isRequired,
    addCommandBelow: React.PropTypes.func.isRequired,
    moveUp: React.PropTypes.func.isRequired,
    moveDown: React.PropTypes.func.isRequired,
    index: React.PropTypes.number.isRequired,
    resultsOnly: React.PropTypes.bool.isRequired,
    showCommentMarks: React.PropTypes.bool,
    toggleCommentsPanel: React.PropTypes.func,
    isCommenting: React.PropTypes.bool,
    onTextSelected: React.PropTypes.func,
    isStatic: React.PropTypes.bool,
    hasFocus: React.PropTypes.bool,
    isEditing: React.PropTypes.bool,
    mobile: React.PropTypes.bool,
    showCommandRunTime: React.PropTypes.bool,
    showCommandRunUser: React.PropTypes.bool,
    showCommandClusterName: React.PropTypes.bool,
  },

  // Add the prop name to stateProps list if changes of that prop should trigger re-render
  stateProps: [
    'permissionLevel',
    'isLocked',
    'resultsOnly',
    'subCommands',
    'showCommentMarks',
    'isCommenting',
    'isFirstCommand',
    'isLastCommand',
    'hasFocus',
    'isEditing',
  ],

  // return true if any prop in stateProps list has changed, compareing this.props to nextProps
  hasStatePropsChanged(nextProps) {
    const propsChangedList = _.map(this.stateProps, function(attr) {
      return !_.isEqual(this.props[attr], nextProps[attr]);
    }, this);
    return _.reduce(propsChangedList, function(c0, c1) { return c0 || c1; }, false);
  },

  // Local version of the last command model we saw. Used by shouldComponentUpdate to cheaply tell
  // when a model has been updated
  commandLocalVersion: 1,

  // Local versions of the last subcommand models, used in the same way as the
  // commandLocalVersion.
  subCommandLocalVersions: [],

  updateSubCommandVersions(props) {
    const currentLocalVersions = _.map(props.subCommands, function(cmd) {
      return cmd.get('localVersion');
    });
    this.subCommandLocalVersions = currentLocalVersions;
  },

  hasSubCommandsChanged(nextProps) {
    const oldSubCommands = this.subCommandLocalVersions;
    this.updateSubCommandVersions(nextProps);
    const subCommandsChanged = !_.isEqual(this.subCommandLocalVersions, oldSubCommands);
    return subCommandsChanged;
  },

  componentWillMount() {
    // Before initial load, initialize the the current versions of the models.
    this.commandLocalVersion = this.props.command.get('localVersion');
    this.updateSubCommandVersions(this.props);
  },

  shouldComponentUpdate(nextProps, nextState) {
    // Keep track of the model's "localVersion", this way we can cheaply tell if the model has
    // been updated since the last render. If it has changed, we should trigger a re-render cycle.
    const currentLocalVersion = this.props.command.get('localVersion');
    const commandChanged = currentLocalVersion !== this.commandLocalVersion;
    this.commandLocalVersion = currentLocalVersion;

    // Perform the same localVersion check for each sub-command
    const subCommandsChanged = this.hasSubCommandsChanged(nextProps);

    if (commandChanged || subCommandsChanged) {
      return true;
    } else if (this.hasStatePropsChanged(nextProps)) {
      // Check if any props we care about (listed in stateProps) have changed
      return true;
    } else if (!_.isEqual(this.state, nextState)) {
      // Check if our "state" has changed
      return true;
    }
    return false;
  },

  // Ask the CommandInput to focus
  focusEditor(scrollIntoView) {
    if (this.refs.input) {
      this.refs.input.focusEditor();
    }

    // TODO(Chaoyu): This is called when we add a new command to the bottom of a notebook via
    // Shift-Enter, this will scroll the new command into view, but when run results of previous
    // command comes back, the page will scroll again which may make current command not visible
    // again.
    if (scrollIntoView) {
      this.scrollCommandIntoView();
    }
  },

  scrollCommandIntoView() {
    if (this.isMounted()) {
      const command = ReactDOM.findDOMNode(this);
      const input = ReactDOM.findDOMNode(this.refs.input);
      if (NotebookUtilities.isOutOfView($(input))) {
        command.scrollIntoView(true);
      }
    }
  },

  getDefaultProps() {
    return {
      permissionLevel: WorkspacePermissions.MANAGE,
      isLocked: false,
      subCommands: [],
    };
  },

  componentDidMount() {
    this.addToAutoCompleteList();
  },

  /** Add this command's content to the autocomplete list for its current language */
  addToAutoCompleteList() {
    const command = this.props.command;
    const notebook = this.props.notebook;
    if (command.get('command')) {
      CodeMirrorKeywords.addPrevCommandString(command.get('command'),
        CodeMirrorUtils.determineMode(null, command.get('command'), notebook.get('language')));
    }
  },

  getInitialState() {
    return {
      dragging: false,
    };
  },

  toggleCollapse() {
    const currentCollapseState = this.props.command.get('collapsed');
    this.props.command.updateCommand({ collapsed: !currentCollapseState });
  },

  remove(e, options) {
    if (e) { e.preventDefault(); }
    if (this.props.isLocked) {
      DeprecatedDialogBox.alert('This cell is locked or still executing.');
      return;
    }
    // Animate the view closing before removing it
    const self = this;

    const remove = function() {
      $(ReactDOM.findDOMNode(self)).slideUp(250, function() {
        self.props.command.removeCommand();
      });
    };

    // getModifierState is not available with an event from TestUtils.simulate!
    if (e && e.getModifierState && e.getModifierState('Shift')) {
      remove();
    } else if (options && options.noConfim === true) {
      remove();
    } else {
      DeprecatedDialogBox.confirm({
        messageHTML: "Are you sure you want to delete this command?<p class='hint-msg'>" +
        "Tip: bypass this dialog by holding the 'Shift' key when deleting a command.</p>",
        confirm: remove,
      });
    }
  },

  onMouseDown(e) {
    if ($(e.target).is('.move-command-btn') ||
        $(e.target).parent().is('.move-command-btn')) {
      this.setState({ dragging: true });
    }
  },

  onMouseUp() {
    this.setState({ dragging: false });
  },

  onDragStart(e) {
    if (!this.state.dragging) {
      e.preventDefault();
    }
    e.nativeEvent.dataTransfer.setData('Text', e.target.innerHTML);
    e.nativeEvent.dataTransfer.effectAllowed = 'none';
    this.props.notebook.registerDraggingCommand(this.props.command);
  },

  onDragEnd() {
    this.setState({ dragging: false });
    this.props.notebook.saveDropPosition();
  },

  copyCommand() {
    Clipboard.putCommand(this.props.command.attributes, 'copy');
  },

  cutCommand() {
    const self = this;
    Clipboard.putCommand(this.props.command.attributes, 'cut');
    $(ReactDOM.findDOMNode(self)).slideUp(250, function() {
      self.props.command.removeCommand();
    });
  },

  exportCommand() {
    const eu = new ExportUtility();
    eu.exportCell(this.props.command, this.props.notebook);
  },

  setLanguage(newLang) {
    const curLang = this.getLanguage();
    if (curLang !== newLang) {
      if (curLang === 'markdown') {
        this.props.notebook.trigger('update-focus-command', {
          commandGuid: this.props.commandGuid,
          isEditing: true,
        });
      }
      const curText = this.props.command.get('command');
      const newText = CodeModeUtils.changeCodeLang(
        curText, this.props.notebook.get('language'), newLang);
      this.props.command.updateCommand({ command: newText });
    }
  },

  getLanguage() {
    return CodeModeUtils.determineCodeLang(
      this.props.command.get('command'),
      this.props.notebook.get('language'));
  },

  isMarkdown() {
    return this.props.command.isMarkdownCommand();
  },

  _addToDashboard(dashboard) {
    // Clone the widgets array to make sure we are not doing in-place updates.
    // Otherwise Backbone's change event listener is not going to be triggered.
    const widgets = dashboard.get('widgets').slice(0);
    let curY = dashboard.getNewWidgetY();

    const targetModel = this.props.command;

    // Strip %sql out of our command
    const command = targetModel.get('command').replace(/^\s*%sql(\s+|$)/, '');

    const curWidth = targetModel.get('width');
    const curHeight = targetModel.get('height');
    const displayType = targetModel.get('displayType');

    const defaultWidth = 660;
    const defaultHeight = 250;
    const results = targetModel.get('results');

    // If there are some parameters to this query, add input widgets for them.
    // Do not rely on the return type being param-query
    // The local bindings, that will be used as default to fill the new widget.
    const lang = CodeModeUtils.determineCodeLang(
      this.props.command.get('command'),
      this.props.notebook.get('language'));

    const currentBindings = targetModel.get('bindings');
    const argsList = [];

    window.recordEvent('exportToDashboard', {});

    argsList.forEach(function(v) {
      widgets.push(new InputWidget({
        label: 'Value of ' + v,
        binding: v,
        x: 0,
        y: curY,
        width: 660,
        height: 40,
      }));
      curY += 40;
    });

    // Add a data widget
    widgets.push(new DataWidget({
      query: command,
      language: lang,
      displayType: displayType,
      resultType: targetModel.get('resultType'),
      xColumns: targetModel.get('xColumns'),
      yColumns: targetModel.get('yColumns'),
      pivotColumns: targetModel.get('pivotColumns'),
      pivotAggregation: targetModel.get('pivotAggregation'),
      customPlotOptions: _.cloneDeep(targetModel.get('customPlotOptions')),
      x: 0,
      y: curY,
      width: curWidth === 'auto' ? defaultWidth : curWidth,
      height: curHeight === 'auto' ? defaultHeight : curHeight,
      downloadable: results ? NotebookUtilities.isDownloadable(results.type) : false,
      customizable: true,
      hideRunCommands: !WorkspacePermissions.canRun(this.props.permissionLevel),
    }));
    // Update the default bindings for this dashboard.
    const newDefaultBindings = {};
    // currentBindings overwrites the existing bindings.
    $.extend(newDefaultBindings, dashboard.get('defaultBindings') || {}, currentBindings);
    const changes = {
      'widgets': widgets,
      'defaultBindings': newDefaultBindings,
    };
    dashboard.set(changes);
    // This will only happen for dashboards on the server so it's OK to save
    dashboard.save(changes, { patch: true, error(model, xhr) {
      NotebookUtilities.handleRpcError(xhr, null, null, {
        confirmButton: 'OK',
        confirm: undefined,
        showCancel: false,
      });
    } });
  },

  // When the history panel is open, we will hide markdown in order to show the diffs (checked
  // through isLocked) if there is a diff to show. Otherwise, we'll just display the markdown.
  shouldShowMarkdownDiff() {
    const command = this.props.command;
    return this.props.isLocked &&
      (!_.isEmpty(command.get('diffInserts')) || !_.isEmpty(command.get('diffDeletes')));
  },

  // When presenting markdown, command view will hide commandInput, only show commandResult, which
  // will render the markdown. When editing a markdown, command result will be hidden.
  isPresentingMarkdown() {
    if (!this.isMarkdown() || this.shouldShowMarkdownDiff()) {
      return false;
    }

    const canEdit = WorkspacePermissions.canEdit(this.props.permissionLevel);
    if (!canEdit) {
      return true;
    }

    const isCommenting = this.props.isCommenting;
    if (this.props.isEditing || isCommenting) {
      return false;
    }

    return true;
  },

  /**
   * If this command is a markdown, start editing the markdown source
   */
  onDoubleClickMarkdown() {
    const canEdit = WorkspacePermissions.canEdit(this.props.permissionLevel);
    if (!this.isMarkdown() ||
      !canEdit ||
      this.props.isLocked ||
      this.props.resultsOnly) {
      return;
    }

    this.props.notebook.trigger('update-focus-command', {
      commandGuid: this.props.commandGuid,
      isEditing: true,
    });
  },

  tags() {
    return {
      commandLanguage: CommandParserUtils.getLanguage(this.props.command.get('command')),
      notebookLanguage: this.props.notebook.get('language'),
      isParamQuery: this.props.command.isParamQuery(),
    };
  },

  // Execution time threshold (in ms) to require a confirmation prior to canceling a query.
  _cancelQueryConfirmationThreshold: 2 * 60 * 1000,

  cancelQuery(event) {
    event.preventDefault();

    const cancelCommand = _.bind(function() {
      window.recordEvent('cancelSingleCommand', this.tags());
      this.props.command.cancelCommand();
    }, this);

    const now = window.conn.wsClient.serverTime();
    const submitTime = this.props.command.get('submitTime');
    const executeTime = now - submitTime;

    // We check for submitTime == 0 in case the command has not yet been initialized fully.
    if (!event.shiftKey && executeTime > this._cancelQueryConfirmationThreshold
        && submitTime !== 0) {
      // Use yes/no instead of confirm/cancel to avoid confusion.
      DeprecatedDialogBox.confirm({
        message: 'Are you sure you want to cancel this query?',
        confirm: cancelCommand,
        confirmButton: 'Yes',
        cancelButton: 'No',
      });
    } else {
      cancelCommand();
    }
  },

  runCommand(options, commandRunCallback) {
    options = options || {};
    // @TODO(jengler) 2015-11-16: This should not be necessary since we should not even show the
    // ability to run commands when the user does not have run permission. Investigate if this can
    // be removed.
    const canRun = WorkspacePermissions.canRun(this.props.permissionLevel);
    if (!canRun || this.props.isLocked) {
      if (commandRunCallback) {
        commandRunCallback(false);
      }
      return;
    }

    if (this.props.command.isMarkdownCommand()) {
      if (options.command) {
        this.props.command.updateCommand({ command: options.command });
      }
      if (commandRunCallback) {
        commandRunCallback(true);
      }
      return;
    }

    const command = this.props.command;
    const self = this;
    const run = function() {
      self.addToAutoCompleteList();
      const wasCommandRun = self.props.notebook.runCommand(command, options);
      if (commandRunCallback) {
        commandRunCallback(wasCommandRun);
      }
    };
    const commandState = this.props.command.get('state');
    if (CommandStateUtils.isRunning(commandState)) {
      DeprecatedDialogBox.confirm({
        message: ('Do you want to cancel the current execution and re-run the command?'),
        confirmButton: 'Yes',
        cancelButton: 'No',
        confirm: run,
      });
    } else {
      run();
    }
  },

  /**
   * Stream Updates are in the form of a Map[String, List[StreamState]] in the backend. The key
   * is the name of the stream, and the list contains its historical state.
   * We can generate graphs based on the historical state, but we're not going to do that now.
   * We simply get the latest entry of the list, and then show the offset of the sources and sink.
   */
  renderStreams(streamStates) {
    if (!_.isObject(streamStates) || _.isEmpty(streamStates) ||
        this.props.command.get('collapsed') || this.props.command.get('hideCommandResult')) {
      return null;
    }
    const streams = _.map(Object.keys(streamStates), function(streamName) {
      const stream = streamStates[streamName];
      const latest = stream[stream.length - 1];
      return (<StreamStatusView streamState={latest} key={streamName} />);
    });

    return (<div>{streams}</div>);
  },

  renderWorkflowProgress(workflows) {
    if (!workflows || workflows.length === 0) {
      return null;
    }
    const workflowLinks = _.map(workflows, function(workflow) {
      return (<li key={workflow.jobId}>
        <a href={'#job/' + workflow.jobId + '/run/1'}>Notebook job #{workflow.jobId}</a>
      </li>);
    });
    return <ul className='workflows'>{workflowLinks}</ul>;
  },

  onTextSelected(cm, options) {
    if (this.props.onTextSelected) {
      this.props.onTextSelected(this.props.command, cm, options);
    }
  },

  _updateTitle(newTitle, callback) {
    this.props.command.updateCommand({ commandTitle: newTitle }, null, { success: callback });
  },

  _getCommandTitle() {
    const command = this.props.command;
    if (!command.get('showCommandTitle')) {
      return null;
    }

    const canEdit = WorkspacePermissions.canEdit(this.props.permissionLevel);
    const allowEditTitle = canEdit &&
      !this.props.isStatic && !this.props.resultsOnly && !this.props.isLocked;

    return (<InlineEditableText
      allowEmpty
      initialText={command.getTitle()}
      updateText={this._updateTitle}
      className='notebook-command-title'
      allowEdit={allowEditTitle}
      showSaveAndEditBtn={false}
      maxLength={NotebookConstants.MAX_COMMAND_TITLE_LENGTH}
    />);
  },

  onClickCommandResult() {
    this.props.notebook.trigger('update-focus-command', {
      commandGuid: this.props.commandGuid,
    });
  },

  render() {
    const canRun = WorkspacePermissions.canRun(this.props.permissionLevel);
    const canEdit = WorkspacePermissions.canEdit(this.props.permissionLevel);
    const isCollapsed = !this.props.isEditing && this.props.command.get('collapsed');

    const command = this.props.command;
    const notebook = this.props.notebook;
    const hasSubCommands = this.props.subCommands.length > 0;
    const subCommandViews = this.props.subCommands.map(function(subCommand) {
      return (
        <div>
          {this.renderStreams(subCommand.get('streamStates'))}
          <SubCommandResults
            key={subCommand.get('guid')}
            model={subCommand}
            tags={this.tags()}
          />
        </div>);
    }, this);

    const diffs = {
      diffInserts: command.get('diffInserts'),
      diffDeletes: command.get('diffDeletes'),
    };

    const commandClasses = {
      'new-notebook': true,
      'command': true,
      'mainCommand': true,
      'dragging': this.state.dragging,
      'command-active': this.props.hasFocus && !this.props.isStatic,
      'is-editing': this.props.isEditing,
      'commenting': this.props.isCommenting,
      'locked': this.props.isLocked,
      'collapsed': isCollapsed,
      'no-edit': !canEdit,
      'no-run': !canRun,
      'results-only': this.props.resultsOnly,
    };
    commandClasses['command-' + command.get('state')] = true;
    commandClasses['cellIndex-' + this.props.index] = true;
    commandClasses['cell-' + notebook.get('id') + '-' + command.get('id')] = true;

    const isPresentingMarkdown = this.isPresentingMarkdown();

    // Result is collapsed if this command is collapsed or we are presenting markdown cell
    const isResultCollapsed = isCollapsed ||
      (this.isMarkdown() && !isPresentingMarkdown) ||
      (!this.isMarkdown() && command.get('hideCommandResult'));

    const hideCommandStats = this.props.resultsOnly || this.isMarkdown() || this.props.isStatic ||
      command.get('hideCommandCode') || command.get('hideCommandResult') ||
      command.get('collapsed');

    const hideCommandInput = !this.props.isEditing && !this.props.isCommenting && (
      (command.get('showCommandTitle') && command.get('collapsed')) ||
      command.get('hideCommandCode')
    );

    if (this.props.resultsOnly === true && this.props.command.get('collapsed') === true) {
      return null;
    }

    const commandButtons = (
      <CommandButtons
        index={this.props.index}
        resultsOnly={this.props.resultsOnly}
        permissionLevel={this.props.permissionLevel}
        notebookLanguage={notebook.get('language')}
        getLanguage={this.getLanguage}
        isLocked={this.props.isLocked}
        isFirstCommand={this.props.isFirstCommand}
        isLastCommand={this.props.isLastCommand}
        runCommand={this.runCommand}
        removeFunc={this.remove}
        collapseFunc={this.toggleCollapse}
        isCollapsed={isCollapsed}
        setLanguage={this.setLanguage}
        copyCommand={this.copyCommand}
        cutCommand={this.cutCommand}
        exportCommand={this.exportCommand}
        pasteCommandAbove={this.props.pasteCommandAbove}
        pasteCommandBelow={this.props.pasteCommandBelow}
        addCommandAbove={this.props.addCommandAbove}
        addCommandBelow={this.props.addCommandBelow}
        moveUp={this.props.moveUp}
        moveDown={this.props.moveDown}
        mobile={this.props.mobile}
        exportToDashboardFunc={this._addToDashboard}
        dashboardViewModels={notebook.getDashboardViewModels()}
        command={command}
      />);

    const boundUpdateCommand = command.updateCommand.bind(command);
    const boundUpdatePresence = command.updatePresenceCommand.bind(command);
    const boundUpdateCursor = command.updateCursorPosition.bind(command);
    const commandInput = (
      <CommandInput
        ref='input'
        notebook={this.props.notebook}
        commandGuid={this.props.commandGuid}
        permissionLevel={this.props.permissionLevel}
        notebookLanguage={notebook.get('language')}
        isLastCommand={this.props.isLastCommand}
        isLocked={this.props.isLocked}
        isStatic={this.props.isStatic}
        updateCommand={boundUpdateCommand}
        updatePresenceCommand={boundUpdatePresence}
        updateCursorPosition={boundUpdateCursor}
        presenceMarks={command.get('presenceMarks')}
        comments={command.getComments()}
        showCommentMarks={this.props.showCommentMarks}
        toggleCommentsPanel={this.props.toggleCommentsPanel}
        addCommandAbove={this.props.addCommandAbove}
        addCommandBelow={this.props.addCommandBelow}
        pasteCommandBelow={this.props.pasteCommandBelow}
        copyCommand={this.copyCommand}
        cutCommand={this.cutCommand}
        removeCommand={this.remove}
        moveUp={this.props.moveUp}
        moveDown={this.props.moveDown}
        command={command.get('command')}
        diffPointers={diffs}
        commandState={command.get('state')}
        collapsed={isCollapsed}
        onDoubleClick={command.get('collapsed') ? this.toggleCollapse : null}
        lastModifiedBy={command.get('lastModifiedBy') || ''}
        hide={isPresentingMarkdown || this.props.resultsOnly || hideCommandInput}
        hasFocus={this.props.hasFocus}
        isEditing={this.props.isEditing}
        onTextSelected={this.onTextSelected}
      />);

    const commandResults = (
      <div className='results-and-comments'
        onDoubleClick={this.onDoubleClickMarkdown}
      >
        <div className='command-result-wrapper'>
          <div className='command-result'
            onClick={this.onClickCommandResult}
          >
            <CommandSpinner
              ref='spinner'
              cancelQuery={this.cancelQuery}
              state={command.get('state')}
              stages={command.get('stages')}
              showCancel={!notebook.isRunning() && canRun}
              collapsed={isResultCollapsed || hideCommandInput}
              clusterId={command.get('clusterId')}
              sparkCtxId={command.get('sparkCtxId')}
              hasSubCommands={hasSubCommands}
            />
            {this.renderWorkflowProgress(command.get('workflows'))}
            {this.renderStreams(command.get('streamStates'))}
            <CommandResult
              ref='result'
              {...command.attributes}
              permissionLevel={this.props.permissionLevel}
              isStatic={this.props.isStatic}
              isLocked={this.props.isLocked}
              collapsed={isResultCollapsed}
              isChild={false}
              tags={this.tags()}
              updateCommand={boundUpdateCommand}
              runCommand={this.runCommand}
              commandModel={command}
              isComplexResult={command.isComplexResult()}
              isParamQuery={command.isParamQuery()}
            />
            {this.isMarkdown() ? null :
             <RichCommandError
               parentCollapsed={this.props.command.get('collapsed')}
               state={command.get('state')}
               errorSummary={command.get('errorSummary') || ''}
               error={command.get('error') || ''}
               ref='richError'
             />}
            <CommandStats
              ref='stats'
              {...command.attributes}
              hidden={hideCommandStats}
              showCommandRunTime={this.props.showCommandRunTime}
              showCommandRunUser={this.props.showCommandRunUser}
              showCommandClusterName={this.props.showCommandClusterName}
            />
          </div>
        </div>
        <div style={{ clear: 'both' }}></div>
      </div>);

    return (
      <Highlight ref={command.id} duration={1800} withTooltip={false} smallAnimate>
        <div
          className={ClassNames(commandClasses)}
          draggable='true'
          onMouseDown={this.onMouseDown}
          onMouseUp={this.onMouseUp}
          onDragStart={this.onDragStart}
          onDragEnd={this.onDragEnd}
        >
          <div className='command-comments-wrapper'></div>
          <a className='move-command-btn'><i className='fa fa-sort' /></a>
          {this.props.isStatic ? null : commandButtons}
          {this._getCommandTitle()}
          {commandInput}
          {commandResults}
          {this.props.command.get('collapsed') ? null : subCommandViews}
        </div>
      </Highlight>);
  },
});

module.exports = ReactNotebookCommandView;
