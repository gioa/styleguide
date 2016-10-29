import $ from 'jquery';

export class MacUtils {
  static isMac() {
    return (/Mac/.test(navigator.platform)); // Same test used in CodeMirror
  }

  /**
   * PROD-3679: prevent swiping the touchpad left/right from navigating history in Mac browsers.
   * Mac OS X makes scrolls past the left or right of the page navigate back or forward, but this
   * is problematic in applications that have horizontally scrollable tables, etc. We suppress
   * this by tracking when the last mousewheel occurred and navigating back to the old location
   * if it's recent. See http://micho.biz/post/64853900698/mac-osx-lions-scroll-breaks-the-web.
   */
  static disableMacHistoryScroll() {
    if (this.isMac()) {
      const longAgo = new Date(2013, 5, 31);
      // Remember when we last scrolled with mousewheel
      let lastScrollTime = longAgo;
      let lastHash = window.location.hash;
      $(window).on('mousewheel wheel', function wheelHandler() {
        lastScrollTime = Date.now();
        lastHash = window.location.hash;
      });
      // Clear it on clicks and key presses (e.g. if we actively clicked a button)
      $(window).on('click keydown keyup', function clickHandler() {
        lastScrollTime = longAgo;
      });
      // Suppress hashchange events if we scrolled too recently
      $(window).on('hashchange', function hashChangeHandler() {
        if (Date.now() - lastScrollTime < 500 && window.location.hash !== lastHash) {
          window.location.hash = lastHash;
        }
      });
    }
  }
}
