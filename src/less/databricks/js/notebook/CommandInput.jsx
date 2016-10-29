/* eslint react/prefer-es6-class: 0 */

import React from 'react';
import ClassNames from 'classnames';

import WorkspacePermissions from '../acl/WorkspacePermissions';

import NotebookModel from '../notebook/NotebookModel';
import CodemirrorView from '../notebook/CodemirrorView.jsx';
import { CodemirrorPre } from '../notebook/CodemirrorPre.jsx';

const CommandInput = React.createClass({

  propTypes: {
    notebook: React.PropTypes.instanceOf(NotebookModel).isRequired,
    commandGuid: React.PropTypes.string.isRequired,
    notebookLanguage: React.PropTypes.string.isRequired,
    isLastCommand: React.PropTypes.bool.isRequired,
    isLocked: React.PropTypes.bool.isRequired,
    command: React.PropTypes.string.isRequired,
    diffPointers: React.PropTypes.object.isRequired, /* object of two lists, inserts and deletes */
    updateCommand: React.PropTypes.func.isRequired,
    updatePresenceCommand: React.PropTypes.func.isRequired,
    updateCursorPosition: React.PropTypes.func.isRequired,
    presenceMarks: React.PropTypes.array.isRequired,
    addCommandAbove: React.PropTypes.func.isRequired,
    addCommandBelow: React.PropTypes.func.isRequired,
    pasteCommandBelow: React.PropTypes.func.isRequired,
    copyCommand: React.PropTypes.func.isRequired,
    cutCommand: React.PropTypes.func.isRequired,
    removeCommand: React.PropTypes.func.isRequired,
    moveUp: React.PropTypes.func.isRequired,
    moveDown: React.PropTypes.func.isRequired,
    hide: React.PropTypes.bool.isRequired,
    collapsed: React.PropTypes.bool.isRequired,
    lastModifiedBy: React.PropTypes.string.isRequired,
    hasFocus: React.PropTypes.bool.isRequired,
    isEditing: React.PropTypes.bool.isRequired,
    permissionLevel: React.PropTypes.string,
    onTextSelected: React.PropTypes.func,
    showCommentMarks: React.PropTypes.bool,
    toggleCommentsPanel: React.PropTypes.func,
    isStatic: React.PropTypes.bool,
    commandState: React.PropTypes.string,
    onDoubleClick: React.PropTypes.func,
  },

  getDefaultProps() {
    return {
      permissionLevel: WorkspacePermissions.MANAGE,
    };
  },

  getInitialState() {
    return {
      useCodeMirrorPreview: this.shouldUsePreView(this.props),
    };
  },

  componentDidMount() {
    this.resetCodemirrorFocusState();
  },

  componentDidUpdate() {
    this.resetCodemirrorFocusState();
  },

  componentWillReceiveProps(nextProps) {
    if (this.state.useCodeMirrorPreview && !this.shouldUsePreView(nextProps)) {
      this.preToEditor();
    }
  },

  resetCodemirrorFocusState() {
    if (!this.codemirror) {
      return;
    }
    // focus editor when in editing state but codemirror does not have focus
    if (this.props.isEditing && !this.codemirror.hasFocus()) {
      this.codemirror.focusEditor();
    }
    // blur editor when not in editing state but cell still has focus, this can happen if user
    // press ESC while editing code, which switch notebook UI to selection mode
    if (!this.props.isEditing && this.codemirror.hasFocus()) {
      this.codemirror.blurEditor();
    }
  },

  // Switching from Pre to actual CodeMirror view
  preToEditor() {
    this.setState({ useCodeMirrorPreview: false });
  },

  onMouseOver() {
    if (!this.isReadOnly()) {
      this.preToEditor();
    }
  },

  /**
   * Get command to display, we compress command code when cell is minimized
   * @param {Object} props - Optional component props, by default use this.props
   * @returns {String}
   */
  getCommand(props) {
    props = props || this.props;
    if (props.collapsed) {
      return this.getCompressedCommand(props.command);
    }
    return props.command;
  },

  // Show this one line compressed command text in minimized mode
  getCompressedCommand(fullCommand) {
    const compressedCommand = fullCommand.replace(/\r?\n|\r/g, ' ');
    if (compressedCommand.length > 80) {
      return compressedCommand.substring(0, 80) + ' ...';
    }
    return compressedCommand + ' ...';
  },

  /**
   * decides wheather to use CodemirrorPre to render code block, based on component props
   * @param {Object} props - Optional component props, by default use this.props
   * @returns {Boolean}
   */
  shouldUsePreView(props) {
    props = props || this.props;

    if (props.hasFocus || props.isEditing) return false;

    const inserts = props.diffPointers.diffInserts;
    const deletes = props.diffPointers.diffDeletes;
    const hasCodeMirrorMarks = props.presenceMarks.length > 0 ||
       (inserts && inserts.length > 0) ||
       (deletes && deletes.length > 0);

    return !hasCodeMirrorMarks;
  },

  /**
   * Determine the readonly state of the code mirror.
   * Disable editing if locked, collapsed, or can't edit. This still permits a cursor, which
   * we remove using a style.
   * In all other cases we allow editing (true)
   */
  isReadOnly(props) {
    props = props || this.props;
    const canEdit = WorkspacePermissions.canEdit(props.permissionLevel);
    return props.isLocked ||
      props.collapsed ||
      !canEdit ||
      props.isShowingHistory ||
      props.hide ||
      props.isStatic;
  },

  // Focus the codemirror editor
  focusEditor() {
    if (this.codemirror) {
      this.codemirror.focusEditor();
    }
  },

  saveCommandText(text, forceUpdate) {
    if (forceUpdate || (text !== this.props.command && this.props.collapsed !== true)) {
      this.props.updateCommand({ command: text });
    }
  },

  getCodeMirrorOrPreView() {
    if (this.state.useCodeMirrorPreview) {
      return (
        <CodemirrorPre
          ref={(ref) => this.pre = ref}
          command={this.getCommand()}
          notebookLanguage={this.props.notebookLanguage}
        />
      );
    }
    return (
      <CodemirrorView
        ref={(ref) => this.codemirror = ref}
        {...this.props}
        command={this.getCommand()}
        isReadOnly={this.isReadOnly()}
        saveCommandText={this.saveCommandText}
      />
    );
  },

  render() {
    const classes = ClassNames({
      'command-input previousPrompt': true,
      'primaryPrompt': this.props.isLastCommand, // So that selenium can recognize the last prompt
    });

    const commandTextClassesDict = {
      'command-text': true,
      'command-text-edit': this.props.hasFocus,
      'hidden': this.props.hide && !this.props.collapsed,
    };
    commandTextClassesDict['command-text-' + this.props.commandState] = true;

    return (
      <div className={classes}
        onDoubleClick={this.props.onDoubleClick}
        onMouseOver={this.onMouseOver}
      >
        <div className={ClassNames(commandTextClassesDict)} >
          <span className='prompt'>&gt;&nbsp;</span>
          <div className='command-box wrappable'>
            {this.getCodeMirrorOrPreView()}
          </div>
        </div>
      </div>
    );
  },
});

module.exports = CommandInput;
