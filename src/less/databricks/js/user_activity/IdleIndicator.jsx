import $ from 'jquery';

/**
 * Helper to detect when a user has been idle (no mouse or keystroke activity)
 *
 * TODO(jeffpang): mark activity properly when within an iframe.
 */
export class IdleIndicator {

  /**
   * Start detection of user idleness.
   *
   * @param onIdle {function} called when the user has been idle for idleTimeout. After this
   *   callback fires, you must start() the idle indicator again to register another callback.
   *   If the callback is null, nothing is called on timeout.
   * @param idleTimeout timeout in seconds
   */
  start(onIdle, idleTimeout) {
    this._onIdleCallback = onIdle;
    this._idleTimeoutMillis = idleTimeout * 1000;
    this._markActivity = this.markActivity.bind(this);
    $(document).on('mousemove', this._markActivity);
    $(document).on('mousedown', this._markActivity);
    $(document).on('keypress', this._markActivity);
    this.markActivity();
    // install the initial timeout callback
    this._onTimeout();
  }

  /** Stop detection of user idleness */
  stop() {
    $(document).off('mousemove', this._markActivity);
    $(document).off('mousedown', this._markActivity);
    $(document).off('keypress', this._markActivity);
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  /**
   * Mark that the user is active right now. e.g., use this if you want to mark a user is active
   * even if they haven't make a keystroke or mouse movement.
   */
  markActivity() {
    this._lastActiveTimeMillis = Date.now();
  }

  /** The amount of time the user has been idle in milliseconds */
  idleTimeMillis() {
    return Date.now() - this._lastActiveTimeMillis;
  }

  _onTimeout() {
    if (!this._onIdleCallback) {
      return;
    }
    const idleTimeMillis = this.idleTimeMillis();
    if (idleTimeMillis >= this._idleTimeoutMillis) {
      // user was idle for long enough, call the callback
      this._onIdleCallback();
    } else {
      // user was active in the last timeout interval, reset the timeout to check
      this._timer = setTimeout(
        this._onTimeout.bind(this),
        this._idleTimeoutMillis - idleTimeMillis);
    }
  }
}

IdleIndicator.default = new IdleIndicator();
