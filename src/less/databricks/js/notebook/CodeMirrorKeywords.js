/* eslint complexity: 0, func-names: 0 */

/**
 * Wrapper class for all the keywords (including table names and column names).  Provides commands
 * for adding in new keywords dynamically
 */

const CodeMirror = require('../../lib/codemirror/lib/codemirror');
require('../../lib/codemirror/mode/sql/sql'); // codemirror-sql
require('../../lib/codemirror/mode/clike/clike'); // codemirror-scala
require('../../lib/codemirror/mode/r/r'); // codemirror-r
require('../../lib/codemirror/mode/python/python'); // codemirror-python

const CodeMirrorKeywords = {};

CodeMirrorKeywords.TableNames = {};
CodeMirrorKeywords.ColumnNames = {};
CodeMirrorKeywords.PrevCommandsSQL = {};
CodeMirrorKeywords.PrevCommandsScala = {};
CodeMirrorKeywords.PrevCommandsPython = {};
CodeMirrorKeywords.PrevCommandsR = {};

// Just default to Hive and Scala keywords for now - no need for anything dynamic currently
CodeMirrorKeywords.initializeKeywords = function() {
  CodeMirrorKeywords.SQLKeywords = CodeMirror.resolveMode('text/x-hiveql').keywords;
  CodeMirrorKeywords.ScalaKeywords = CodeMirror.resolveMode('text/x-scala').keywords;
  // NOTE(matei): these last two lines don't actually work; it doesn't seem to be possible to
  // get the keywords for these modes out of the CodeMirror modules.
  CodeMirrorKeywords.PythonKeywords = CodeMirror.resolveMode('text/x-python').keywords;
  CodeMirrorKeywords.RKeywords = CodeMirror.resolveMode('text/x-rsrc').keywords;
};

function hasOwnPropertyCI(obj, prop) {
  for (const l in obj) {
    if (obj.hasOwnProperty(l)) {
      if (l.toLowerCase() === prop.toLowerCase()) {
        return true;
      }
    }
  }
  return false;
}

CodeMirrorKeywords.addKeyword = function(wordlist) {
  for (let word in wordlist) {
    if (Array.isArray(wordlist)) {
      word = wordlist[word];
    }

    CodeMirrorKeywords.SQLKeywords[word] = true;
  }
};

CodeMirrorKeywords.addTable = function(wordlist) {
  for (let word in wordlist) {
    if (Array.isArray(wordlist)) {
      word = wordlist[word];
    }

    delete CodeMirrorKeywords.PrevCommandsSQL[word];
    delete CodeMirrorKeywords.PrevCommandsScala[word];
    delete CodeMirrorKeywords.PrevCommandsPython[word];
    delete CodeMirrorKeywords.PrevCommandsR[word];
    CodeMirrorKeywords.TableNames[word] = true;
  }
};

CodeMirrorKeywords.populateTable = function() {
  const TableCollection = window.tableList;
  const tableName = [];
  TableCollection.forEach(function(file) {
    tableName.push(file.get('name'));
  });
  CodeMirrorKeywords.addTable(tableName);
};

CodeMirrorKeywords.addColumn = function(wordlist) {
  for (let word in wordlist) {
    if (Array.isArray(wordlist)) {
      word = wordlist[word];
    }
    CodeMirrorKeywords.ColumnNames[word] = true;
  }
};

CodeMirrorKeywords.addPrevCommands = function(wordlist, mode) {
  for (let word in wordlist) {
    if (Array.isArray(wordlist)) {
      word = wordlist[word];
    }
    if ((hasOwnPropertyCI(CodeMirrorKeywords.TableNames, word)) ||
        (hasOwnPropertyCI(CodeMirrorKeywords.ColumnNames, word))) {
      return;
    }
    if (mode === 'text/x-hiveql') {
      if (!(hasOwnPropertyCI(CodeMirrorKeywords.SQLKeywords, word))) {
        CodeMirrorKeywords.PrevCommandsSQL[word] = true;
      }
    } else if (mode === 'text/x-scala') {
      if (!(hasOwnPropertyCI(CodeMirrorKeywords.ScalaKeywords, word))) {
        CodeMirrorKeywords.PrevCommandsScala[word] = true;
      }
    } else if (mode === 'text/x-python') {
      if (!(hasOwnPropertyCI(CodeMirrorKeywords.PythonKeywords, word))) {
        CodeMirrorKeywords.PrevCommandsPython[word] = true;
      }
    } else if (mode === 'text/x-rsrc') {
      if (!(hasOwnPropertyCI(CodeMirrorKeywords.RKeywords, word))) {
        CodeMirrorKeywords.PrevCommandsR[word] = true;
      }
    }
  }
};

/**
 * Parse out an existing shell command for keywords that should be kept in history
 *
 * Rules:
 * ** Command has to be multiple characters
 * ** Can't be a special character - e.g., *,%,$
 * ** Has to start with _, or a-z
 */
CodeMirrorKeywords.addPrevCommandString = function(command, mode) {
  const commandNames = command.match(/[a-z_]([a-z0-9_]*)/gi);
  CodeMirrorKeywords.addPrevCommands(commandNames, mode);
};

function match(string, word, caseSensitive) {
  const len = string.length;
  const sub = word.substr(0, len);
  if (caseSensitive) {
    return string === sub;
  }
  return string.toUpperCase() === sub.toUpperCase();
}

function addMatches(result, search, wordlist, formatter, resultHash, caseSensitive) {
  for (let word in wordlist) {
    if (!wordlist.hasOwnProperty(word)) {
      continue;
    }
    if (Array.isArray(wordlist)) {
      word = wordlist[word];
    }
    if (resultHash[formatter(word)] === true) {
      continue;
    }
    if (match(search, word, caseSensitive)) {
      result.push(formatter(word));
      resultHash[formatter(word)] = true;
    }
  }
}

function getKeywords(mode) {
  if (mode === 'text/x-hiveql') {
    return CodeMirrorKeywords.SQLKeywords;
  } else if (mode === 'text/x-scala') {
    return CodeMirrorKeywords.ScalaKeywords;
  } else if (mode === 'text/x-rsrc') {
    return CodeMirrorKeywords.RKeywords;
  }
  return CodeMirrorKeywords.PythonKeywords;
}

function getPrevCommand(mode) {
  if (mode === 'text/x-hiveql') {
    return CodeMirrorKeywords.PrevCommandsSQL;
  } else if (mode === 'text/x-scala') {
    return CodeMirrorKeywords.PrevCommandsScala;
  } else if (mode === 'text/x-rsrc') {
    return CodeMirrorKeywords.RKeywords;
  }
  return CodeMirrorKeywords.PrevCommandsPython;
}

function webappHint(editor) {
  const cur = editor.getCursor();
  const token = editor.getTokenAt(cur);
  const result = [];
  const resultHash = {};
  const search = token.string.trim();

  addMatches(result, search, getKeywords(editor.doc.modeOption),
             function(w) { return w; }, resultHash, false);

  CodeMirrorKeywords.populateTable();

  addMatches(result, search, CodeMirrorKeywords.TableNames,
             function(w) { return w; }, resultHash, false);

  addMatches(result, search, CodeMirrorKeywords.ColumnNames,
             function(w) { return w; }, resultHash, false);

  // Make matches for previous commands case sensitive
  addMatches(result, search, getPrevCommand(editor.doc.modeOption),
             function(w) { return w; }, resultHash, true);

  return {
    list: result,
    from: CodeMirror.Pos(cur.line, token.start),
    to: CodeMirror.Pos(cur.line, token.end),
  };
}

CodeMirror.registerHelper('hint', 'webapp', webappHint);

module.exports = CodeMirrorKeywords;
