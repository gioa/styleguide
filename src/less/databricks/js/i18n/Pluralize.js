export class Pluralize {
  /**
   * This is a very naive pluralization function. Eventually we'll need to
   * replace this with a NFA (non-deterministic finite state automata) for
   * correct pluralization of all morpheme structures.
   */
  static simplePluralize(n, s) {
    if (n === 1) {
      return s;
    }
    return s + 's';
  }
}
