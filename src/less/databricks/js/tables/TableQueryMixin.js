/* eslint consistent-return: 0 */

import _ from 'lodash';

import { DisplayTypeUtils } from '../notebook/commands/DisplayTypeUtils';

const TableQueryMixin = {
  // run command directly using default cluster
  // this is for querying table view
  runQuery(options) {
    options = options || {};
    const command = options.command || this.get('command');
    const bindings = options.bindings || this.get('bindings');
    const lang = 'sql';

    this.set({
      'state': 'running',
      'stages': [],
    });

    if (this.lastRPC && !this.lastRPC.completed) {
      this.lastRPC.cancel();
    }
    this.lastRPC = window.conn.wsClient.sendRPC('query', {
      data: {
        query: command,
        xColumns: this.get('xColumns'),
        yColumns: this.get('yColumns'),
        pivotColumns: this.get('pivotColumns'),
        pivotAggregation: this.get('pivotAggregation'),
        customPlotOptions: _.cloneDeep(this.get('customPlotOptions')),
        displayType: this.get('displayType'),
        language: lang,
        bindings: bindings,
      },
      success: _.bind(this.onQueryResult, this),
      error: _.bind(this.onQueryError, this),
    });
  },

  onQueryResult(result) {
    // the QueryHandler in the backend will return execution errors as html type results.
    if (result.type === 'html') {
      return this.onQueryError(result);
    }
    this.set({
      state: 'finished',
      running: false,
      displayType: DisplayTypeUtils.computeDisplayType(this.get('displayType'), result.type),
      results: result,
      error: null,
      arguments: result.arguments,
    });
  },

  onQueryError(error, rpc) {
    if (rpc && rpc.clientCancelled) {
      return;
    }
    this.set({
      state: 'error',
      error: error,
      displayType: 'html',
      running: false,
    });
  },

  hasError() {
    return this.get('state') === 'error';
  },

  /**
   * Returns error message if last fetch is in error state
   * @returns {String} error
   */
  getError() {
    const error = this.get('error');

    if (!this.hasError()) {
      return null;
    }

    if (typeof error === 'string') {
      return error;
    } else if (error && typeof error.data === 'string') {
      return error.data;
    }
    return null;
  },
};

module.exports = TableQueryMixin;
