export class NodeNameValidators {
  static isValidName(name) {
    return (name.length > 0) && (name.indexOf('/') < 0);
  }
}
