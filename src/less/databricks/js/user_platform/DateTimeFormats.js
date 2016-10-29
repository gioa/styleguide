import d3 from 'd3';

const DATE_FORMAT = d3.time.format('%Y-%m-%d %H:%M:%S');
const NICE_DATE_FORMAT = d3.time.format('%B %e, %I:%M %p');  // for notebook history

export class DateTimeFormats {
  static getTimeZone(date) {
    return (/\((.*)\)/).exec(date.toString())[1];
  }

  static formatDate(date) {
    return DATE_FORMAT(date);
  }

  static formatTimestamp(timestamp) {
    if (!timestamp) {
      return '';
    }
    const date = new Date(timestamp);
    return DateTimeFormats.formatDate(date) + ' ' + DateTimeFormats.getTimeZone(date);
  }

  static formatTimestampNicely(timestamp) {
    if (!timestamp) {
      return '';
    }
    const date = new Date(timestamp);
    return NICE_DATE_FORMAT(date).replace(' 0', ' ') + ' ' + DateTimeFormats.getTimeZone(date);
  }

  static formatDuration(seconds) {
    if (seconds < 60) {
      return seconds + 's';
    } else if (seconds < 3600) {
      return parseInt(seconds / 60, 10) + 'm ' + (seconds % 60) + 's';
    }
    return parseInt(seconds / 3600, 10) + 'h ' +
      parseInt(seconds % 3600 / 60, 10) + 'm ' + (seconds % 60) + 's';
  }
}
