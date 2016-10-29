export class UrlValidators {
  /**
   * Simple regex to validate url
   * Matches http://something and https://something
   */
  static validateUrl(text) {
    return text && text.match(/^https?:\/\/.+$/) !== null;
  }
}
