/* eslint callback-return: 0, consistent-return: 0, func-names: 0 */

/**
 * Core set of utility functions for CodeMirror Editor
 */

import $ from 'jquery';
import _ from 'underscore';
import d3 from 'd3';

import CodeMirror from '../../lib/codemirror/lib/codemirror';

import { CodeModeUtils } from '../notebook/CodeModeUtils';

const CodeMirrorUtils = {};

CodeMirrorUtils.defaultOptions = function(extraOptions) {
  return _.extend({
    mode: 'text/x-hiveql',
    lineWrapping: true,
    theme: 'eclipse-focus',
    matchBrackets: true,
    autoCloseBrackets: !(window.prefs && window.prefs.get('disableSmartQuotes')),
    undoDepth: 10000,
  }, extraOptions);
};

function defaultLongestCommonPrefix(cpl) {
  // Have to do this in a slightly more inefficient way (e.g., checking all elements)
  // because we're now doing case sensitive matching and keyword entry
  let common;
  const comp0 = cpl[0];
  const c0 = comp0.text;
  let maxlength = false;
  let mismatch = false;
  for (let i = 0; i < c0.length; i++) {
    for (let j = 1; j < cpl.length; j++) {
      if (c0.charAt(i) !== cpl[j].text.charAt(i)) {
        mismatch = true;
        break;
      } else if (i === (cpl[j].text.length - 1)) {
        maxlength = true;
      }
    }
    if (mismatch) {
      if (i === 0) {
        break;
      } else {
        common = c0.substr(0, i);
        break;
      }
    } else if ((i === (c0.length - 1)) || maxlength) {
      common = c0.substr(0, i + 1);
      break;
    }
  }
  return common;
}

/**
 * Event handler for Tab being pressed on CodeMirror while completion is active; fills in a
 * single result if there is only one, or the longest common prefix of the results if they
 * have a common prefix.
 *
 * @param cm - CodeMirror instance
 * @param obj - Data passed from CodeMirror completion function holding all the matches
 */
CodeMirrorUtils.longestCommonPrefix = function(cm, obj) {
  const cpl = obj.data.list;
  if (cpl.length === 1) {
    obj.pick();
    return;
  }
  const common = defaultLongestCommonPrefix(cpl);
  if (common !== undefined) {
    cm.replaceRange(common, cpl[0].from, cpl[0].to);
  }
};

/**
 * Wrapper class for incorporating multiple different sources of information into the
 * completion list provided to show-hint
 */
CodeMirrorUtils.MultiHint = function() {
  this.completeSource = [];
  this.completeCallback = undefined;
  this.pendingRequests = 0;
  this.pendingResults = null;
};

/**
 * Designed to aggregate the response from a source, and trigger the actual show-hint callback
 * if it is the final one.  Also performs de-duplication of results
 *
 * @param obj an object of the form {list, from, to} where list is a list of strings and
 * from and to are indices within the line to substitute
 * @param options if given, options.itemClassName is added as the className on completion
 * DOM elements in CodeMirror to allow styling them
 * @return a list of CodeMirror-ready {text, from, to, [className]} completion results
 */
CodeMirrorUtils.MultiHint.prototype.gatherSource = function(obj, options) {
  const from = obj.from;
  const to = obj.to;

  this.pendingRequests = this.pendingRequests - 1;
  if (!this.pendingResults) {
    this.pendingResults = {
      list: [],
      from: from,
      to: to,
    };
  }

  const knownCompletions = _.map(this.pendingResults.list, function(x) {
    return x.text.toLowerCase();
  });

  for (const word in obj.list) {
    if (!obj.list.hasOwnProperty(word)) {
      continue;
    }
    const tmp = {};
    tmp.text = obj.list[word];
    if (knownCompletions.indexOf(tmp.text.toLowerCase()) !== -1) {
      continue;
    }
    tmp.from = from;
    tmp.to = to;
    if (options && options.itemClassName) {
      tmp.className = options.itemClassName;
    }
    this.pendingResults.list.push(tmp);
  }

  if (this.pendingRequests === 0) {
    this.completeCallback(this.pendingResults);
    this.pendingResults = undefined;
  }
};

/**
 * Function for cycling through the various result choices
 */
CodeMirrorUtils.MultiHint.prototype.complete = function(cm, finishCompleteCallback, options) {
  this.completeCallback = finishCompleteCallback;
  this.pendingRequests = this.completeSource.length;
  for (let i = 0; i < this.completeSource.length; i++) {
    this.completeSource[i](cm, _.bind(this.gatherSource, this), options);
  }
  return;
};

/**
 * Return the text that should be displayed in the autocomplete dropdown for the given completion
 * @param completion An instance of [[ExecutionMessages.CompletionItem]]
 */
CodeMirrorUtils.getDisplayText = function(completion) {
  return completion.displayText ? completion.displayText : completion.text;
};

/**
 * Set up autocomplete and tab key handling globally on CodeMirror instances.
 * This creates the function CodeMirror.commands.handleTabHit, which should be registered
 * as the listener for tab keystrokes on each CodeMirror, and which will either indent text
 * or call autocomplete based on what is selected. Completion will happen through a callback
 * to the webapp if the CodeMirror is in a notebook currently attached to a cluster, or
 * through local completion (words in the current notebook and SQL table names) if not.
 */
CodeMirrorUtils.setupAutoCompleteAndTabHandling = function() {
  // Set up a MultiHint object used for local completion
  const completeSearchKeywords = function(cm, finishCompleteCallback, options) {
    const webappHinter = CodeMirror.hint.webapp;
    if (!webappHinter) {
      finishCompleteCallback({}, options);
    } else {
      finishCompleteCallback(webappHinter(cm, options), options);
    }
  };
  const multiHint = new CodeMirrorUtils.MultiHint();
  multiHint.completeSource.push(completeSearchKeywords);

  // Auto-complete using local data (words in current notebook and table names)
  const completeFromLocal = function(cm, callback, options) {
    multiHint.complete(cm, callback, options);
  };

  // Auto-complete using server (for connected Python and Scala notebooks)
  const completeFromServer = function(notebookId, language, cm, callback) {
    const cur = cm.getCursor();
    const line = cm.getLine(cur.line);
    const cursorPosition = cur.ch;

    // Cancel any server-based autocompletion request currently in progress
    if (CodeMirrorUtils._autoCompleteRequest) {
      CodeMirrorUtils._autoCompleteRequest.cancel();
      CodeMirrorUtils._autoCompleteRequest = null;
    }

    CodeMirrorUtils._autoCompleteRequest = window.conn.wsClient.sendRPC('autoComplete', {
      data: {
        notebookId: notebookId,
        language: language,
        line: line,
        cursorPosition: cursorPosition,
      },
      success(result) {
        CodeMirrorUtils._autoCompleteRequest = null;
        // Check that cursor is still in the same place, since request may have taken a while
        const newCur = cm.getCursor();
        const newLine = cm.getLine(newCur.line);
        if (cm.hasFocus() && newCur.line === cur.line && newCur.ch === cur.ch &&
            newLine === line) {
          const from = CodeMirror.Pos(cur.line, cursorPosition - result.text.length);
          const to = CodeMirror.Pos(cur.line, cursorPosition);
          result.matches.sort(function(a, b) {
            // If the response defines a displayText field, compare on that. Otherwise compare on
            // the text field
            const aKey = CodeMirrorUtils.getDisplayText(a);
            const bKey = CodeMirrorUtils.getDisplayText(b);
            return aKey.toLowerCase().localeCompare(bKey.toLowerCase());
          });
          callback({
            list: result.matches.map(function(s) {
              return {
                text: s.text,
                displayText: CodeMirrorUtils.getDisplayText(s),
                from: from,
                to: to };
            }),
            from: from,
            to: to,
          });
        } else {
          callback({
            list: [],
            from: 0,
            to: 0,
          });
        }
      },
      error(error) {
        console.log('AutoComplete RPC was unsuccessful', error);
        CodeMirrorUtils._autoCompleteRequest = null;
        callback({
          list: [],
          from: 0,
          to: 0,
        });
      },
    });
  };

  const doComplete = function(cm, callback, options) {
    if (!window.settings.enableServerAutoComplete) {
      completeFromLocal(cm, callback, options);
      return;
    }

    const view = window.activeView;
    let isNotebook;
    let attached;
    let notebookId;
    let notebookLanguage;
    let mode;

    if (view.props && view.props.notebook) {
      // This is a ReactNotebookView
      isNotebook = true;
      attached = view.props.notebook.isAttached();
      notebookId = view.props.notebook.get('id');
      notebookLanguage = view.props.notebook.get('language');
      mode = CodeModeUtils.determineCodeMode(cm.getValue(), notebookLanguage);
    } else if (view.viewRoute && (/^shell\//).test(view.viewRoute)) {
      // This is a ShellSessionView
      isNotebook = true;
      attached = view.isAttached();
      notebookId = view.id;
      notebookLanguage = view.language;
      mode = CodeModeUtils.determineCodeMode(cm.getValue(), notebookLanguage);
    }

    if (isNotebook &&
        (mode === 'text/x-python' || mode === 'text/x-scala' || mode === 'text/x-rsrc')) {
      if (attached) {
        completeFromServer(notebookId, notebookLanguage, cm, callback);
      } else {
        // If the notebook is detached, gray out completions to show we're not using server
        const options2 = _.clone(options);
        options2.itemClassName = 'CodeMirror-hint-grayed-out';
        completeFromLocal(cm, callback, options2);
      }
    } else {
      // For SQL and Markdown, complete with local data
      completeFromLocal(cm, callback, options);
    }
  };

  CodeMirror.commands.triggerAutoCompleteAsYouType = function(cm) {
    // If something is selected, ignore
    if (cm.somethingSelected()) {
      return;
    }
    // If at beginning of line (and no text entered), or prev char is not ok, then ignore
    const curPos = cm.getCursor();
    const beforeCursor = cm.getRange({ line: curPos.line, ch: 0 }, curPos);
    const lastChar = beforeCursor.length > 0 && beforeCursor[beforeCursor.length - 1];
    const blacklistChars = [' ', '{', '[', ':', '\\', '"', "'"];
    if (beforeCursor.trim() === '' || blacklistChars.indexOf(lastChar) >= 0) {
      return;
    }
    // Show the completion box
    if (!cm.state.completionActive) {
      CodeMirror.showHint(cm, doComplete, {
        completeSingle: false,  /* not desired for autocomplete as you type */
        async: true,
        extraKeys: {
          'Tab': CodeMirrorUtils.longestCommonPrefix,
          // Emacs key bindings for moving up/down in hint popup.
          'Ctrl-P': 'Up',
          'Ctrl-N': 'Down',
        },
      });
    }
  };

  CodeMirror.commands.handleTabHit = function(cm) {
    // If something is selected, just indent
    if (cm.somethingSelected()) {
      CodeMirror.commands.indentMore(cm);
      return;
    }

    // If at beginning of line (and no text entered) then just indent
    const curPos = cm.getCursor();
    const beforeCursor = cm.getRange({ line: curPos.line, ch: 0 }, curPos);
    if (beforeCursor.trim() === '') {
      CodeMirror.commands.indentMore(cm);
      return;
    }

    // Show the completion box
    if (!cm.state.completionActive) {
      CodeMirror.showHint(cm, doComplete, {
        completeSingle: true,
        async: true,
        extraKeys: {
          'Tab': CodeMirrorUtils.longestCommonPrefix,
          // Emacs key bindings for moving up/down in hint popup.
          'Ctrl-P': 'Up',
          'Ctrl-N': 'Down',
        },
      });
    }
  };
};

/**
 * Determine the CodeMirror edit mode to set in a given CodeMirror editor object (cm)
 * or for a given command string (if cm is null).
 *
 * @param cm CodeMirror object, if any
 * @param command command string, if cm is null
 * @param shellLanguage language of the shell the command is in
 * @returns A CodeMirror MIME type string, e.g. text/x-hiveql
 */
CodeMirrorUtils.determineMode = function(cm, command, shellLanguage) {
  let currentText;
  if (cm === null) {
    currentText = command;
  } else {
    currentText = cm.getValue();
  }
  const mode = CodeModeUtils.determineCodeMode(currentText, shellLanguage);
  if (cm === null) {
    return mode;
  }
  cm.setOption('mode', mode);
};

/**
 * The version of CodeMirror we are using don't support triggering blur manually
 * this is a workaround to blur the focus on a codemirror edit area
 * the cursor in this CodeMirror editor will go away after calling this function
 */
CodeMirrorUtils.blur = function(cm) {
  cm.setOption('readOnly', 'nocursor');
  cm.setOption('readOnly', false);
};

/**
 * Compare two given position object returned by getCursor method
 */
CodeMirrorUtils.comparePos = function(p1, p2) {
  if (p1.line !== p2.line) {
    return p1.line - p2.line;
  }
  return p1.ch - p2.ch;
};

/**
 * Compare two given range object returned by getCursor('from')/getCursor('to')
 */
CodeMirrorUtils.compareRange = function(r1, r2) {
  if (this.comparePos(r1.from, r2.from) !== 0) {
    return this.comparePos(r1.from, r2.from);
  }
  return this.comparePos(r1.to, r2.to);
};

CodeMirrorUtils.somethingNonEmptySelected = function(cm) {
  return cm.somethingSelected() && cm.getSelection().replace(/\s+/g, '') !== '';
};

CodeMirrorUtils.isModeControlLineSelected = function(cm) {
  const selectedText = cm.getSelection();
  const firstSelectedLineText = cm.getLine(this.getFirstLineSelected(cm));
  return (CodeModeUtils.doesTextStartWithCodeMode(firstSelectedLineText) ||
    CodeModeUtils.doesTextStartWithCodeMode(selectedText));
};

CodeMirrorUtils.getFirstLineSelected = function(cm) {
  const ranges = cm.listSelections();
  return ranges[0].from().line;
};

/**
 * Hack to initialize css classes for dynamically generated colors.
 */
CodeMirrorUtils.addedColorClasses = {};
CodeMirrorUtils.addColorClassIfMissing = function(baseColor, colorClass) {
  if (!this.addedColorClasses[colorClass]) {
    const hsl = d3.rgb(baseColor).hsl();
    const h = parseInt(hsl.h, 10);
    const s = parseInt(hsl.s * 100, 10) + '%';
    const l = parseInt(hsl.l * 100, 10) + '%';
    const rule = '.' + colorClass + '{ background-color: hsla(' + h + ', ' + s + ', ' + l +
                 ', 0.3); }';
    $('<style>')
      .prop('type', 'text/css')
      .html(rule)
      .appendTo('head');
  }
  this.addedColorClasses[colorClass] = true;
};

module.exports = CodeMirrorUtils;
