/* eslint no-var: 0 */

/**
 * A common class for all widgets that render data. Can display different types of views
 * (tables, charts, etc) and optionally let the user customize them.
 */

import _ from 'lodash';

import WorkspacePermissions from '../../acl/WorkspacePermissions';

import Widget from '../../notebook/Widget';
import { DisplayTypeUtils } from '../../notebook/commands/DisplayTypeUtils';

import HiveSchema from '../../tables/HiveSchema';

var DataWidget = Widget.extend({
  initialize() {
    Widget.prototype.initialize.call(this);
    this.setIfMissing('label', null);
    this.setIfMissing('type', 'data');
    this.setIfMissing('schema', []);
    // isJsonSchema will not be set in persisted object prior to the schema change from Hive type to
    // Json types.
    this.setIfMissing('isJsonSchema', false);
    this.setIfMissing('data', []);
    this.setIfMissing('aggSchema', []);  // describes pre-aggregated data for pivoting
    this.setIfMissing('aggData', []);
    this.setIfMissing('state', 'running');
    this.setIfMissing('error', null);
    this.setIfMissing('displayType', 'table');
    this.setIfMissing('resultType', null);
    this.setIfMissing('running', true);
    this.setIfMissing('language', 'sql');
    this.setIfMissing('customizable', true);   // Can the user change the view type?
    this.setIfMissing('dbfsResultPath', null);

    // Whether the result set contains more than the number of rows we can display (1000).
    this.setIfMissing('dataOverflowed', false);
    this.setIfMissing('aggDataOverflowed', false);
    this.setIfMissing('aggError', '');

    // If these are set, plot specific columns instead of automatically deciding what to plot
    this.setIfMissing('xColumns', null);
    this.setIfMissing('yColumns', null);
    this.setIfMissing('pivotColumns', null);
    this.setIfMissing('pivotAggregation', null);
    this.setIfMissing('customPlotOptions', {});
    this.setIfMissing('resizable', true);
    this.setIfMissing('hideRunCommands', true);

    this.setIfMissing('permissionLevel', WorkspacePermissions.MANAGE);
  },

  _parseSchema(schema) {
    var isJson = this.get('isJsonSchema');
    return (schema || []).map((x) => {
      var type;
      if (isJson) {
        type = HiveSchema.parseJson(JSON.parse(x.type));
      } else {
        type = HiveSchema.parse(x.type);
      }
      return {
        name: x.name,
        type: type,
        metadata: x.metadata ? JSON.parse(x.metadata) : {},
      };
    });
  },

  /**
   * Get the parsed result schema as a HiveSchema type.
   */
  getParsedSchema() {
    return this._parseSchema(this.get('schema'));
  },

  /**
   * Get the parsed result schema as a HiveSchema type.
   */
  getParsedAggregatedSchema() {
    return this._parseSchema(this.get('aggSchema'));
  },

  /**
   * When saving this object to the server, omit some fields that represent local properties.
   * It might not be ideal that we have these as local properties but that's just the way things
   * are for now.
   */
  toJSON(options) {
    return _.omit(Widget.prototype.toJSON.call(this, options),
      ['data', 'schema', 'isJsonSchema', 'aggData', 'aggSchema', 'state', 'running', 'error',
       'dbfsResultPath', 'permissionLevel']);
  },

  /**
   * Submit this widget's query directly to the backend "query" service with new parameters.
   * This is one way to update the widget's contents -- another way is to change "data" directly.
   */
  submitQuery(bindingValues) {
    if (!this.has('query')) {
      return;
    }
    bindingValues = bindingValues || {};
    var query = this.get('query');
    var lang = this.get('language');

    this.set('running', true);
    if (this.lastRPC && !this.lastRPC.completed) {
      this.lastRPC.cancel();
    }
    var _this = this;
    this.lastRPC = window.conn.wsClient.sendRPC('query', {
      data: {
        query: query,
        xColumns: this.get('xColumns'),
        yColumns: this.get('yColumns'),
        pivotColumns: this.get('pivotColumns'),
        pivotAggregation: this.get('pivotAggregation'),
        customPlotOptions: _.cloneDeep(this.get('customPlotOptions')),
        displayType: this.get('displayType'),
        language: lang,
        bindings: bindingValues,
      },
      success: _.bind(_this.onResult, this),
      error: _.bind(_this.onError, this),
    });
  },

  onResult(result) {
    this.set({
      state: 'finished',
      displayType: DisplayTypeUtils.computeDisplayType(this.get('displayType'), result.type),
      resultType: result.type,
      error: null,
      schema: result.schema,
      isJsonSchema: result.isJsonSchema,
      data: result.data,
      arguments: result.arguments,
      dataOverflowed: result.overflow,
      aggSchema: result.aggSchema,
      aggData: result.aggData,
      aggDataOverflowed: result.aggOverflow,
      aggError: result.aggError,
      aggSeriesLimitReached: result.aggSeriesLimitReached,
      aggType: result.aggType,
      running: false,
      dbfsResultPath: result.dbfsResultPath,
    });
  },

  onError(error, rpc) {
    if (rpc.clientCancelled) {
      return;
    }
    this.set({
      state: 'error',
      data: error,
      resultType: 'html',
      displayType: 'html',
      schema: null,
      aggData: null,
      aggSchema: null,
      running: false,
    });
  },
});

module.exports = DataWidget;
