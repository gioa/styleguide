
/** Utility methods around commands. */
export class CommandStateUtils {
  /** Is the command executing based on its state. */
  static isRunning(state) {
    return state === 'running' || state === 'streaming';
  }

  /**
   * Is the command cancelling based on its state. Since cancelling can be spelled with one or
   * two 'l's, we should prefer to use this method in order to avoid spelling bugs.
   */
  static isCancelling(state) {
    return state === 'cancelling';
  }

  /** Has the command stopped executing successfully. */
  static isFinished(state) {
    return state === 'finished';
  }

  /** Has the command stopped executing due to an error or cancellation. */
  static isFailed(state) {
    return state === 'error';
  }
}
