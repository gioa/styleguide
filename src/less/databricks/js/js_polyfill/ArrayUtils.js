/**
 * Core set of utility functions
 *
 */
import _ from 'lodash';

export class ArrayUtils {
  /**
   * Get the value in the array values that has the largest fun(value).
   *
   * @param values {array} an array
   * @param fun {function} a function from array element that returns a number
   */
  static argmax(values, fun) {
    let max = null;
    let argmax = null;
    for (let i = 0; i < values.length; i += 1) {
      const val = fun(values[i]);
      if (_.isNull(max) || val > max) {
        max = val;
        argmax = values[i];
      }
    }
    return argmax;
  }
}
