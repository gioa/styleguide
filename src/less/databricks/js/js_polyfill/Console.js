/**
 * Polyfill for window.console until we remove usage of it. Needed
 * for IE 9/10 support. See PROD-9855.
 *
 */
const NOOP = () => {};

export class Console {
  static polyfillWindow(win) {
    if (!win.console) {
      win.console = {};
    }

    win.console.log = win.console.log || NOOP;
    win.console.debug = win.console.debug || win.console.log;
    win.console.warn = win.console.warn || win.console.log;
    win.console.error = win.console.error || win.console.log;
    win.console.info = win.console.info || win.console.log;
  }
}
