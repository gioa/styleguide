export class ResourceUrls {
  /**
   * Given the filePath, get the full URL to that file. When running on the webapp, this will
   * will return "/filePath". When running in a static notebook, this will return
   * "https://cdn/version/filePath".
   */
  static getResourceUrl(filePath, isStaticNotebook) {
    // if the filename is already a URL, use it directly
    if (filePath.indexOf('http://') === 0 || filePath.indexOf('https://') === 0) {
      return filePath;
    }

    // in a javascript unit test
    if (window.jsTestMode) {
      return '../' + filePath;
    }

    isStaticNotebook = isStaticNotebook || (window.settings && window.settings.isStaticNotebook);

    // in the webapp
    if (!isStaticNotebook) {
      return '/' + filePath;
    }

    // in a static notebook or static cell
    if (!window.settings.staticNotebookResourceUrl) {
      throw new Error('in a static notebook but staticNotebookResourceUrl is undefined');
    }
    return window.settings.staticNotebookResourceUrl + filePath;
  }
}
