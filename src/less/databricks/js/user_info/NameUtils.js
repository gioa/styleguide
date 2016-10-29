import _ from 'lodash';

export class NameUtils {
  /**
   * Capitalize all the tokenized words in a string, ignoring emails
   */
  static capitalizeAllNames(text) {
    return text.split(' ').map((word) => {
      if (word.indexOf('@') >= 0) {
        return word;
      }
      return _.capitalize(word);
    }).join(' ');
  }
}
