import _ from 'underscore';

export class TimingUtils {
  /**
   * Required Options are:
   *   condition: Function used to determine if we are ready to execute the success callback.
   *   interval: time in ms to wait between attempts.
   *   maxAttempts: Maximum number of attempts to check the condition
   * Optional:
   *   success: Function called upon successful condition.
   *   error: Function called upon error.
   * }
   */
  static retryUntil(options) {
    if (options.condition()) {
      if (options.success) {
        options.success();
      }
    } else if (options.maxAttempts > 0) {
      // Don't want to modify the input options
      const newOptions = _.clone(options);
      newOptions.maxAttempts -= 1;
      _.delay(TimingUtils.retryUntil, options.interval, newOptions);
    } else if (options.error) {
      options.error();
    }
  }
}
