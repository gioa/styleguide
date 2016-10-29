/**
 * Adds performance metrics (size and time to complete) to all ajax requests
 * excluding those on the blacklist. Request urls are blacklisted if they are
 * made repeatedly and often, to avoid spamming the logs.
 * @param {jquery object} target: Ajax requests on this object will be logged.
 */
const blacklist = ['/applications', '/health'];
export function enableRequestPerfMetrics(target) {
  target.ajaxSend(function saveTimeStarted(e, xhr, opts) {
    if (blacklist.indexOf(opts.url) !== -1) {
      return;
    }
    xhr.timeStarted = Date.now();
  });
  target.ajaxComplete(function recordAjaxRequestEvent(e, xhr, opts) {
    if (blacklist.indexOf(opts.url) !== -1) {
      return;
    }
    window.recordEvent('ajaxRequest', {
      requestTime: Date.now() - xhr.timeStarted,
      requestSize: xhr.getResponseHeader('Content-Length'),
    });
  });
}
