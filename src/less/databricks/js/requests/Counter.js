import $ from 'jquery';

export class Counter {
  /**
   * Increments counter by name, creating it if necessary. These show in the debug UI if enabled.
   */
  static incrementCounter(name, amount) {
    if (Counter.counters[name] === undefined) {
      Counter.counters[name] = 0;
    }
    Counter.counters[name] += amount || 1;
    if (window.settings.showDebugCounters) {
      const msgs = [];
      for (const key in this.counters) {
        if (this.counters.hasOwnProperty(key)) {
          msgs.push(key + ': ' + this.counters[key]);
        }
      }
      $('#debugCounters').text(msgs.join(', '));
    }
  }
}

// Default set of global debug counters
Counter.counters = {
  'xhr': 0,   /* ajax requests */
  'ws': 0,    /* websocket events */
  'bytes': 0,  /* websocket bytes transmitted */
};
