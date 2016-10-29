/* eslint react/prefer-es6-class: 0, consistent-return: 0, func-names: 0 */

import $ from 'jquery';
import _ from 'lodash';
import React from 'react';
import ClassNames from 'classnames';

import WorkspacePermissions from '../acl/WorkspacePermissions';

import CodeMirrorKeywords from '../notebook/CodeMirrorKeywords';
import CodeMirrorUtils from '../notebook/CodeMirrorUtils';
import CommandParserUtils from '../notebook/CommandParserUtils';
import NotebookModel from '../notebook/NotebookModel';
import { CodeModeUtils } from '../notebook/CodeModeUtils.js';

import { BrowserUtils } from '../user_platform/BrowserUtils';

// Watch out: codemirror does some magic when loaded. Put all dependencies before.
const CodeMirror = require('../../lib/codemirror/lib/codemirror');
require('../../lib/codemirror/mode/sql/sql'); // codemirror-sql
require('../../lib/codemirror/mode/clike/clike'); // codemirror-scala
require('../../lib/codemirror/addon/runmode/runmode'); // codemirror-runmode
require('../../lib/codemirror/mode/r/r'); // codemirror-r
require('../../lib/codemirror/mode/python/python'); // codemirror-python
require('../../lib/codemirror/mode/xml/xml'); // codemirror-xml
require('../../lib/codemirror/mode/markdown/markdown'); // codemirror-markdown
require('../../lib/codemirror/addon/hint/show-hint'); // codemirror-hint
require('../../lib/codemirror/addon/hint/sql-hint'); // codemirror-sql-hint
require('../../lib/codemirror/addon/edit/matchbrackets'); // codemirror-matchbrackets
require('../../lib/codemirror/addon/edit/closebrackets'); // codemirror-closebrackets
require('../../lib/codemirror/addon/comment/comment'); // codemirror-closebrackets

const CodemirrorView = React.createClass({

  propTypes: {
    notebook: React.PropTypes.instanceOf(NotebookModel).isRequired,
    commandGuid: React.PropTypes.string.isRequired,
    notebookLanguage: React.PropTypes.string.isRequired,
    command: React.PropTypes.string.isRequired,
    saveCommandText: React.PropTypes.func.isRequired,
    collapsed: React.PropTypes.bool.isRequired,
    diffPointers: React.PropTypes.object.isRequired,
    hide: React.PropTypes.bool.isRequired,
    presenceMarks: React.PropTypes.array.isRequired,
    isLocked: React.PropTypes.bool.isRequired,
    moveUp: React.PropTypes.func.isRequired,
    moveDown: React.PropTypes.func.isRequired,
    addCommandAbove: React.PropTypes.func.isRequired,
    addCommandBelow: React.PropTypes.func.isRequired,
    pasteCommandBelow: React.PropTypes.func.isRequired,
    copyCommand: React.PropTypes.func.isRequired,
    cutCommand: React.PropTypes.func.isRequired,
    removeCommand: React.PropTypes.func.isRequired,
    isLastCommand: React.PropTypes.bool.isRequired,
    lastModifiedBy: React.PropTypes.string.isRequired,
    permissionLevel: React.PropTypes.string,
    onTextSelected: React.PropTypes.func,
    showCommentMarks: React.PropTypes.bool,
    toggleCommentsPanel: React.PropTypes.func,
    updateCursorPosition: React.PropTypes.func.isRequired,
    updatePresenceCommand: React.PropTypes.func.isRequired,
    comments: React.PropTypes.array,
    isReadOnly: React.PropTypes.bool.isRequired,
  },

  getDefaultProps() {
    return {
      permissionLevel: WorkspacePermissions.MANAGE,
    };
  },

  hasFocus() {
    return this.editor.hasFocus();
  },

  focusEditor() {
    this.editor.focus();
    this.resumeCursorPosition();
  },

  blurEditor() {
    CodeMirrorUtils.blur(this.editor);
  },

  saveCursorPosition() {
    this.cursorPosition = this.editor.getCursor();
  },

  resumeCursorPosition() {
    if (this.cursorPosition) {
      this.editor.setCursor(this.cursorPosition);
    }
  },

  updateCommandText(command) {
    this.saveCursorPosition();
    this.editor.setValue(command);
    this.resumeCursorPosition();
  },

  shouldComponentUpdate(nextProps) {
    const collapsedChanged = this.props.collapsed !== nextProps.collapsed;
    const hideChanged = this.props.hide !== nextProps.hide;
    // received new command changes made by other user
    const receivedCommandChanges = nextProps.command !== this.editor.getValue() &&
      nextProps.lastModifiedBy !== BrowserUtils.getBrowserTabId();

    if (receivedCommandChanges || hideChanged || collapsedChanged) {
      this.updateCommandText(nextProps.command);
    }

    // Update codemirror options
    this.editor.setOption('readOnly', nextProps.isReadOnly);

    const shouldUpdateMarks = collapsedChanged || hideChanged;

    if (shouldUpdateMarks || !_.isEqual(nextProps.presenceMarks, this.props.presenceMarks)) {
      this.updatePresenceMarks(nextProps.presenceMarks);
    }

    if (shouldUpdateMarks || !_.isEqual(nextProps.comments, this.props.comments) ||
        nextProps.showCommentMarks !== this.props.showCommentMarks) {
      this.updateCommentMarks(nextProps);
    }

    return false;
  },

  /** Run the current command or return false if this field is locked or no-run */
  runCommand(commandRunCallback) {
    // we throttle the call to save code changes while user is editing, thus we want to make sure
    // the newest code changes user made are saved before triggering run-command, we can skip this
    // in readOnly mode since user can not make changes in readOnly
    if (!this.props.isReadOnly) {
      this.props.saveCommandText(this.editor.getValue());
    }
    this.props.notebook.trigger('run-command', {
      commandGuid: this.props.commandGuid,
      callback: commandRunCallback,
    });
  },

  _runAndAddCommandBelowCallback(cm, didCommandRun) {
    // only create new cell if we can edit
    if (didCommandRun && this.canEdit()) {
      this.props.addCommandBelow();
    }
  },

  _runAndFocusNextCommandCallback(cm, didCommandRun) {
    if (this.props.isLastCommand && this.editor.getValue() === '') {
      return; // if last cell is empty, don't do navigate down
    }

    if (didCommandRun) {
      this._navigateDown(true);
    }
  },

  _navigateDown(insertCommand) {
    this.props.notebook.trigger('navigate-down', {
      commandGuid: this.props.commandGuid,
      // only create new cell if we can edit
      insertCommand: this.canEdit() && insertCommand,
    });
  },

  _navigateUp() {
    this.props.notebook.trigger('navigate-up', {
      commandGuid: this.props.commandGuid,
      insertCommand: this.canEdit(),
    });
  },

  canEdit() {
    return WorkspacePermissions.canEdit(this.props.permissionLevel);
  },

  canRun() {
    return WorkspacePermissions.canRun(this.props.permissionLevel);
  },

  toggleLineComment(cm) {
    const commandLanguage = CommandParserUtils.getLanguage(this.props.command);

    if (commandLanguage
      && commandLanguage !== this.props.notebookLanguage
      && CodeMirrorUtils.isModeControlLineSelected(cm)) {
      // We are toggling comments on a block that is inlined as another language (%sql, %md, etc).
      // If the line that specifies the control mode is selected then we want to change the
      // language back to the notebooks default language to that the comments are done as the
      // the native language. This prevents us from commenting out a control block, with the
      // the control blocks commenting scheme (which may not be compatible with the notebooks)
      // language.
      //  ex: Commenting out in a Python/R notebook:
      //     %sql select * from ...
      //  will produce
      //     # %sql select * from ...
      //  instead of using sql comments, eg "/* %sql select * from ... */"

      cm.setOption('mode', CodeModeUtils.getLanguageMimeType(this.props.notebookLanguage));
    }

    cm.execCommand('toggleComment');
  },

  getCodemirrorOptions() {
    const self = this;

    const up = function(cm) {
      // In a multiline and not at the top
      const currentPos = cm.getCursor();
      if ((cm.lineCount() > 1) && (currentPos.line !== 0)) {
        return CodeMirror.Pass;
      }
      // At the top line but not at the first char
      if ((currentPos.ch) !== 0) {
        cm.setCursor(0, 0);
        return;
      }

      // Jump to the previous item
      self._navigateUp();
    };

    const down = function(cm) {
      // In a multiline and not at the bottom
      const currentPos = cm.getCursor();
      if (currentPos.line !== (cm.lineCount() - 1)) {
        return CodeMirror.Pass;
      }
      // At the bottom line but not at the last char
      if ((cm.getLine(currentPos.line).length - 1) > currentPos.ch) {
        cm.setCursor(currentPos.line + 1);
        return;
      }

      // Jump to the next item
      self._navigateDown();
    };

    return {
      readOnly: self.props.isReadOnly,
      extraKeys: {
        'Shift-Enter'(cm) {
          // Returns false if notebook is detached and failed to run command
          self.runCommand(self._runAndFocusNextCommandCallback.bind(self, cm));
        },
        'Ctrl-Enter'() {
          self.runCommand();
        },
        'Alt-Enter'(cm) {
          self.runCommand(self._runAndAddCommandBelowCallback.bind(self, cm));
        },
        'Ctrl-Alt-P'() {
          if (self.canEdit()) {
            self.props.addCommandAbove();
          }
        },
        'Ctrl-Alt-N'() {
          if (self.canEdit()) {
            self.props.addCommandBelow();
          }
        },
        'Ctrl-Alt-Up'() {
          if (self.canEdit()) {
            self.props.moveUp({ skipFocusCommand: true });
          }
        },
        'Ctrl-Alt-Down'() {
          if (self.canEdit()) {
            self.props.moveDown({ skipFocusCommand: true });
          }
        },
        'Ctrl-Alt-M'(cm) {
          if (!self.canCreateComment()) {
            return;
          }

          if (cm.somethingSelected() && self.props.onTextSelected) {
            self.props.onTextSelected(cm, { createComment: true });
          } else if (self.props.toggleCommentsPanel) {
            self.props.toggleCommentsPanel();
          }
        },
        'Esc'(cm) {
          CodeMirrorUtils.blur(cm);
        },
        'Alt-Up'() {
          self._navigateUp();
        },
        'Alt-Down'() {
          self._navigateDown();
        },
        'Up': up,
        'Ctrl-P': up,
        'Down': down,
        'Ctrl-N': down,
        'Ctrl-Alt-V'() {
          self.props.pasteCommandBelow();
        },
        'Ctrl-Alt-C'() {
          self.props.copyCommand();
        },
        'Ctrl-Alt-X'() {
          self.props.cutCommand();
          self._navigateDown(true);
        },
        'Ctrl-Alt-D'() {
          self.props.removeCommand(null, { noConfim: true });
          self._navigateDown(true);
        },
        'Backspace'(cm) {
          const currentPos = cm.getCursor();
          if (cm.getLine(currentPos.line).trim() === '' &&
            cm.getLine(currentPos.line).length >= cm.getOption('indentUnit') &&
            cm.getLine(currentPos.line).length === currentPos.ch && !cm.somethingSelected()) {
            cm.execCommand('indentLess');
          } else {
            return CodeMirror.Pass;
          }
        },
        'Tab'(cm) {
          if (self.canEdit()) {
            // Defined in setupAutoComplete
            cm.execCommand('handleTabHit');
          }
        },
        'Shift-Tab': 'indentLess',
        'Ctrl-/': _.bind(self.toggleLineComment, self),
        'Cmd-/': _.bind(self.toggleLineComment, self),
      },
    };
  },

  updateMarks(editor) {
    const marks = editor.getAllMarks();
    _.each(marks, function(mark) {
      if (mark.comment) {
        const range = mark.find();
        const selection = editor.getRange(range.from, range.to);
        mark.comment.updateReferenceRange(range, selection);
      }
    });
  },

  canCreateComment() {
    return window.settings && window.settings.enableReactNotebookComments &&
      !this.props.isLocked && !this.props.collapsed;
  },

  componentDidMount() {
    this.throttleUpdateMark = _.throttle(this.updateMarks, 1000);

    // limit saveCommandText at maximum frequence of once per second
    this.saveCommandText = _.throttle((text) => {
      this.props.saveCommandText(text);
    }, 1000);

    CodeMirrorUtils.setupAutoCompleteAndTabHandling();

    this.editor = CodeMirror.fromTextArea(
      this.refs.textarea,
      CodeMirrorUtils.defaultOptions(this.getCodemirrorOptions())
    );

    CodeMirrorKeywords.initializeKeywords(this.editor);

    this.editor.setValue(this.props.command);
    this.editor.clearHistory(); // initial setValue shouldn't go to editing history

    // This flag is used to distinguish onblur event triggered by right click(contextmenu)
    // and other onblur events. For onblur event triggered by contextmenu we don't deselect
    // the selected text.
    this.momentAfterContextmenu = false;
    this.editor.on('contextmenu', () => {
      this.momentAfterContextmenu = true;
      _.delay(() => {
        this.momentAfterContextmenu = false;
      }, 20);
    });

    this.editor.on('blur', () => {
      _.delay(() => {
        // only clear selection for onblur events not triggered by right click
        if (this.editor && this.editor.somethingSelected() && !this.momentAfterContextmenu) {
          this.editor.setSelection({ line: 0, ch: 0 }); // clear current selection
        }
      }, 10);
      this.props.saveCommandText(this.editor.getValue());
      this.props.notebook.trigger('editor-blur', {
        commandGuid: this.props.commandGuid,
      });
    });

    this.editor.on('focus', () => {
      this.props.updatePresenceCommand();

      this.props.notebook.trigger('update-focus-command', {
        commandGuid: this.props.commandGuid,
        isEditing: !this.props.isReadOnly,
      });

      // register current editor - for selenium test
      window.cm = this.editor;
    });

    this.editor.on('cursorActivity', _.throttle((cm) => {
      const from = cm.getCursor('from');
      const to = cm.getCursor('to');

      if (this.canCreateComment() && cm.somethingSelected() && this.props.onTextSelected) {
        this.props.onTextSelected(cm, { showPopover: true });
      }

      if (!this.props.isReadOnly) {
        // update user cursor position to presence backend if not read only
        this.props.updateCursorPosition(from, to);

        // update new comment mark range to comment reference in the backend
        this.throttleUpdateMark(this.editor);
      }
    }, 300));

    this.editor.on('change', () => {
      this.saveCommandText(this.editor.getValue());
      CodeMirrorUtils.determineMode(this.editor, null, this.props.notebookLanguage);
    });

    const ExcludedAutoCompleteTriggerKeys = {
      '9': 'tab',
      '13': 'enter',
      '16': 'shift',
      '17': 'ctrl',
      '18': 'alt',
      '27': 'escape',
      '33': 'pageup',
      '34': 'pagedown',
      '35': 'end',
      '36': 'home',
      '37': 'left',
      '38': 'up',
      '39': 'right',
      '40': 'down',
      '45': 'insert',
      '46': 'delete',
    };

    this.editor.on('keyup', (cm, event) => {
      if (window.settings.enableAutoCompleteAsYouType.indexOf(this.props.notebookLanguage) >= 0 &&
          !ExcludedAutoCompleteTriggerKeys[(event.keyCode || event.which).toString()]) {
        cm.execCommand('triggerAutoCompleteAsYouType');
      }
    });

    CodeMirrorUtils.determineMode(this.editor, null, this.props.notebookLanguage);

    // prevent elements outside of codeMirror from receiving keystroke events
    $(this.editor.getWrapperElement()).on('keydown', function(e) {
      e.stopPropagation();
    });

    // initialize presence marks and comment marks
    this.updatePresenceMarks(this.props.presenceMarks);
    this.updateCommentMarks(this.props);
    this.updateDiffMarks();
  },

  updatePresenceMarks(marks) {
    // Clear out all marks first.
    _.each(this.marks, function(mark) {
      mark.clear();
    });
    this.marks = [];

    _.each(marks, function(mark) {
      // When someone selects text via double click, the cursorEnd is on the beginning of the
      // next line. This looks funny, so we adjust the cursorEnd to be on the prev line.
      if (mark.cursorEnd.ch === 0 && mark.cursorEnd.line > mark.cursorStart.line) {
        mark.cursorEnd.line -= 1;
        mark.cursorEnd.ch = 9999;
      }
      this.marks.push(this.editor.setBookmark(mark.cursorEnd, {
        widget: $(
          "<span style='border-color: " +
          mark.bgColor +
          "' title='" + _.capitalize(mark.userName) +
          "' class='bookmark'><span style='background-color: " + mark.bgColor +
          "' class='bookmark-user'></span></span>")[0],
      }));
      if (JSON.stringify(mark.cursorEnd) !== JSON.stringify(mark.cursorStart)) {
        const colorId = mark.bgColor.substring(1);
        const colorClass = 'highlight-' + colorId;
        this.marks.push(this.editor.markText(mark.cursorStart, mark.cursorEnd, {
          className: colorClass,
          title: _.capitalize(mark.userName),
          shared: true,
        }));
        CodeMirrorUtils.addColorClassIfMissing(mark.bgColor, colorClass);
      }
    }, this);
  },

  updateCommentMarks(props) {
    _.each(this.commentMarks, function(mark) {
      mark.clear();
    });
    this.commentMarks = [];

    const invisible = !props.showCommentMarks || props.collapsed;

    _.each(props.comments, function(comment) {
      comment.set('editor', this.editor);
      const reference = comment.get('commentReference');
      if (reference.referenceType !== 'commandFragment') {
        return;
      }

      const range = reference.range;
      if (range.to.ch === 0 && range.to.line > range.from.line) {
        range.to.line -= 1;
        range.to.ch = 9999;
      }
      const markClasses = {
        'comment-mark': true,
        'hidden-mark': invisible,
      };
      markClasses['comment-mark-' + comment.get('guid')] = true;
      const mark = this.editor.markText(range.from, range.to, {
        className: ClassNames(markClasses),
        comment: comment,
      });
      this.commentMarks.push(mark);
      comment.mark = mark;
    }, this);
  },

  updateDiffMarks() {
    const self = this;
    if (this.props.diffPointers && this.props.diffPointers.diffInserts) {
      _.each(this.props.diffPointers.diffInserts, function(range) {
        const start = { line: range.lineStart, ch: range.chStart };
        const end = { line: range.lineEnd, ch: range.chEnd };
        self.editor.markText(start, end, {
          className: 'diff-insert',
        });
      });
    }
    if (this.props.diffPointers && this.props.diffPointers.diffDeletes) {
      _.each(this.props.diffPointers.diffDeletes, function(range) {
        const start = { line: range.lineStart, ch: range.chStart };
        const end = { line: range.lineEnd, ch: range.chEnd };
        self.editor.markText(start, end, {
          className: 'diff-delete',
        });
      });
    }
  },

  render() {
    return (
      <textarea
        className='command-box-textarea codeeditor'
        ref='textarea'
        tabIndex='1'
        spellCheck='false'
      >
      </textarea>
    );
  },
});

module.exports = CodemirrorView;
