const sqlRegex = /^\s*%sql(\s|$)/;
const markdownRegex = /^\s*%md(\s|$)/;
const runRegex = /^\s*%run(\s|$)/;
const codeModeRegex = /^\s*%(\w+)(\s|$)/;

export class CodeModeUtils {
  static getLanguageMimeType(language) {
    const mimePrefix = 'text/x-';
    let languageSuffix = language;

    if (language === 'sql') {
      languageSuffix = 'hiveql';
    } else if (language === 'r') {
      languageSuffix = 'rsrc';
    }

    return mimePrefix + languageSuffix;
  }

  static determineCodeMode(currentText, shellLanguage) {
    // TODO(tjh) add something for the %run syntax as well?
    // http://codemirror.net/doc/manual.html#modeapi
    if (markdownRegex.test(currentText)) {
      return CodeModeUtils.getLanguageMimeType('markdown');
    }

    const codeModeRegexResult = codeModeRegex.exec(currentText);
    if (codeModeRegexResult) {
      const language = codeModeRegexResult[1];
      if (language === 'scala' || language === 'python' || language === 'r' || language === 'sql') {
        return CodeModeUtils.getLanguageMimeType(language);
      }
    }

    if (shellLanguage === 'r') {
      return CodeModeUtils.getLanguageMimeType('r');
    }

    return CodeModeUtils.getLanguageMimeType(shellLanguage);
  }

  static doesTextStartWithCodeMode(currentText) {
    return (markdownRegex.test(currentText) ||
            runRegex.test(currentText) ||
            sqlRegex.test(currentText));
  }

  static determineCodeLang(currentText, shellLanguage) {
    if (markdownRegex.test(currentText)) {
      return shellLanguage;
    } else if (runRegex.test(currentText)) {
      return 'run';
    } else if (shellLanguage === 'sql' || sqlRegex.test(currentText)) {
      return 'sql';
      // The settings may not be defined in testing environment.
    } else if (shellLanguage === 'r') {
      return 'r';
    }
    return shellLanguage;
  }

  static changeCodeLang(text, shellLanguage, newLanguage) {
    const curLanguage = CodeModeUtils.determineCodeLang(text, shellLanguage);
    if (curLanguage !== newLanguage) {
      // Remove the language tag for the current language, if any (e.g. %sql)
      if (curLanguage === 'sql') {
        text = text.replace(sqlRegex, '');
      } else if (curLanguage === 'markdown') {
        text = text.replace(markdownRegex, '');
      } else if (curLanguage === 'run') {
        text = text.replace(runRegex, '');
      }
      // Add the language tag for the new language, if any
      if (newLanguage === 'sql') {
        text = '%sql ' + text;
      } else if (newLanguage === 'markdown') {
        text = '%md ' + text;
      } else if (newLanguage === 'run') {
        if (text.trim() === '') {
          text = '%run /path/to/notebook';
        } else {
          text = '%run ' + text;
        }
      }
    }
    return text;
  }

  static getCode(text) {
    if (markdownRegex.test(text)) {
      return text.replace(markdownRegex, '');
    } else if (sqlRegex.test(text)) {
      return text.replace(sqlRegex, '');
    }

    return text;
  }
}
