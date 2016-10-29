export class ObjectUtils {
  /**
   * Handles Arrays and Objects and the 6 JS primative object types: Boolean,
   *   Null, Undefined, Number, String, and Symbol (introduced in es6)
   * @param {any} obj: the object to check for containing a string
   * @param {string} s: string representation of value that may appear in obj
   * @param {int} limitDepthTo: optional arg to limit recursion depth. If set, it
   *   will not recurse beyound the stated depth. If not set, it will recurse
   *   to the full depth of the object. We use the tree-height definition of depth,
   *   so a single layer object has depth 0.
   */
  static deepIncludesString(obj, s, limitDepthTo) {
    if (obj === undefined || obj === null || limitDepthTo === -1) {
      return false;
    }
    if (typeof obj === 'object') {
      const newDepth = limitDepthTo !== undefined ? (limitDepthTo - 1) : undefined;
      if (Array.isArray(obj)) {
        // obj is an array
        return obj.some((elem) => ObjectUtils.deepIncludesString(elem, s, newDepth));
      }
      // obj is an object
      let key;
      for (key in obj) {
        if (!obj.hasOwnProperty(key)) {
          continue;
        }
        if (ObjectUtils.deepIncludesString(obj[key], s, newDepth)) {
          return true;
        }
      }
      return false;
    }
    return obj.toString().indexOf(s) !== -1;
  }
}
