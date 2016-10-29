import $ from 'jquery';

export class StringRenderers {
  static htmlEscape(text) {
    return $('<div/>').text(text).html();
  }

  static renderString(obj, maxLength) {
    if (typeof obj !== 'string') {
      obj = JSON.stringify(obj);
    }
    // JSON.stringify(undefined) returns undefined instead of a string
    // return empty string if obj is undefined
    if (obj === undefined) {
      return '';
    }
    let res = obj;
    if (maxLength && res.length > maxLength) {
      res = res.substring(0, maxLength) + '...';
    }
    return StringRenderers.htmlEscape(res);
  }
}
