export class NumberUtils {
  /**
   * @return {boolean} true iff the string value is integral and not in
   *   scientific notation and is decimal
   */
  static isSimpleInteger(n) {
    return !isNaN(n) && String(parseInt(n, 10)) === String(n);
  }
}
