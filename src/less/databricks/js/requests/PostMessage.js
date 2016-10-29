import _ from 'lodash';

/**
 * Container for all valid types of post messges we accept.
 * @type {Object}
 */
export const POST_MESSAGE_TYPE = {
  RESIZE_EVENT: 'frameResizeEvent',
  SIZED_EVENT: 'frameSizedEvent',
  JS_ERROR: 'frameJsError',
};

/**
 * Helper class for dealing with postMessages.
 */
export class PostMessage {
  /**
   * Check if the event comes from a sandboxed iframe in the provided document. This requires that
   * the event's origin be null and that its source window is the contentWindow of an iframe in
   * the document.
   * @see {@link http://www.html5rocks.com/en/tutorials/security/sandboxed-iframes/}
   *
   * @param  {MessageEvent}  event  The post event message
   * @param  {HTMLDocument}  document The document for the event.
   *
   * @return {Boolean}       True iff the event is considered to have come from a sandboxed iframe
   *                              in the provided document.
   */
  static isEventFromSandboxedIframe(event, document) {
    if (event.origin !== 'null') {
      return false;
    }

    const iframes = document.getElementsByTagName('iframe');
    const eventSource = event.source;

    for (let i = 0; i < iframes.length; i++) {
      if (eventSource === iframes[i].contentWindow) {
        return true;
      }
    }

    return false;
  }

  /**
   * Is the post message event from an origin we consider valid. This means it came from our window
   * or from a domain whose origin matches the current windows.
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage}
   *
   * @param  {MessageEvent}  event  The post event message
   * @param  {HTMLWindow}  window   The window for the event.
   *
   * @return {Boolean}     True iff the event is considered to have come from a valid window/frame.
   */
  static isValidPostMessageOrigin(event, window) {
    // For Chrome, the origin property is in the event.originalEvent object.
    const origin = event.origin || event.originalEvent.origin;
    const isInternalDomain = window.location.origin === origin;

    // We allow the events if the source is our own page or if the domain origin is our origin.
    if (event.source === window || isInternalDomain) {
      return true;
    }
    console.error('PostMessage Origin Violation');
    return false;
  }

  /**
   * Is the post message data valid. Simple sanity check just to make sure it has correct format
   * and message type.
   *
   * @param  {object}  data The data object from MessageEvent
   * @return {Boolean}      True iff the data is an object and its type is defined
   *                             in POST_MESSAGE_TYPE.
   */
  static isValidPostMessageData(data) {
    return _.isObject(data) &&
      typeof data.type === 'string' &&
      _.values(POST_MESSAGE_TYPE).indexOf(data.type) >= 0;
  }
}
