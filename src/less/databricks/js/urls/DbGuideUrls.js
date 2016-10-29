import { StaticNotebookUrls } from '../static/StaticNotebookUrls';

export class DbGuideUrls {
  /**
   * Transforms workspace link to point to static db guide if specified in settings.
   */
  static getDbGuideUrl(url) {
    if (!window.settings.useStaticGuide) {
      return url;
    }
    const path = url.substring('#workspace/'.length);
    const relPath = path.substring(path.indexOf('/') + 1);
    const externalUrl = window.settings.databricksGuideStaticUrl +
      '/index.html#' + relPath + '.html';
    if (window.settings.useFramedStaticNotebooks) {
      return StaticNotebookUrls.getFramedStaticNotebookUrl(externalUrl);
    }
    return externalUrl;
  }
}
