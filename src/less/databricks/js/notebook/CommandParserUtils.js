/** A collection of utility methods for parsing notebooks' commands.
 *
 * This is a subset of the glorious CommandParser (now deprecated).
 */

const CommandParserUtils = {};

CommandParserUtils.sqlRegex = /^\s*%sql(\s+|$)/;

CommandParserUtils.markdownRegex = /^\s*%md(\s+|$)/;

CommandParserUtils.getLanguage = function getLanguage(text) {
  if (this.sqlRegex.test(text)) {
    return 'sql';
  } else if (this.markdownRegex.test(text)) {
    return 'markdown';
  }
  return this.language;
};

module.exports = CommandParserUtils;
