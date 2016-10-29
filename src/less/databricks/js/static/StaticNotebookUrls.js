export class StaticNotebookUrls {
  /**
   * Given a URL to a static notebook, get the relative url to show that static
   * notebook in a frame within the #content pane.
   */
  static getFramedStaticNotebookUrl(url) {
    return '#externalnotebook/' + encodeURIComponent(url);
  }
}
