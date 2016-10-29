/* eslint complexity: 0, func-names: 0 */

/**
 * Dashboard representation of objects
 */

import _ from 'underscore';
import Backbone from 'backbone';

import AclModelMixin from '../../acl/AclModelMixin';
import WorkspacePermissions from '../../acl/WorkspacePermissions';

import InputWidget from '../../notebook/InputWidget';
import BaseQuery from '../../notebook/dashboards/BaseQuery';
import DataWidget from '../../notebook/dashboards/DataWidget';

const Dashboard = Backbone.Model.extend({
  initialize() {
    this.set('defaultBindings', this.get('defaultBindings') || {});
    this.set('title', this.get('title') || '');
    this.set('widgets', this.get('widgets') || []);
    this.set('width', this.get('width') || 'auto');
    this.set('lastRefreshTime', this.get('lastRefreshTime') || null);
    this.set('lastRefreshResult', this.get('lastRefreshResult') || null);
    this.set('curRefreshStatus', this.get('curRefreshStatus') || null);
    this.set('refreshInterval', this.get('refreshInterval') || 'manual');
    this.set('baseQueries', this.get('baseQueries') || []);
  },

  getName() {
    return this.get('title');
  },

  /**
   * Utility function to get the Y coordinate for adding a new widget below all the others
   */
  getNewWidgetY() {
    const maxY = _.max(this.get('widgets').map(function(w) {
      return parseInt(w.get('y'), 10) + parseInt(w.get('height'), 10);
    }));
    return (maxY === -Infinity ? 0 : maxY + 10);
  },

  /**
   * Parse a JSON response into a format that can be passed to set(). To support our nested
   * models, we automatically turn the widgets field into Widget models and the baseQueries
   * field into BaseQuery models.
   */
  parse(json) {
    if (json === '') {
      // TODO(someone): Backbone calls us with empty string sometimes, presumably on put(). Maybe
      // our server should return an empty JSON object ({}) instead?
      return '';
    }
    if ('widgets' in json) {
      json.widgets = json.widgets.map(function(w) {
        if (w.type === 'input') {
          return new InputWidget(w);
        }
        return new DataWidget(w);
      });
    }
    if ('baseQueries' in json) {
      json.baseQueries = json.baseQueries.map(function(q) {
        return new BaseQuery(q);
      });
    }
    return json;
  },

  /**
   * In our set() function, we merge widgets and base queries with the same GUID rather than
   * creating new model objects, so that their views can be updated nicely. This is a bit of a
   * workaround until we make widgets and base queries their own collections on the server.
   */
  set(attributes, a1, a2) {
    let i;
    let options = a1;

    // Deal with the set(key, value) form of set()
    if (typeof attributes === 'string') {
      const key = attributes;
      attributes = {};
      attributes[key] = a1;
      options = a2;
    }
    options = options || {};

    // Merge widgets by GUID
    if ('widgets' in attributes) {
      const curWidgets = this.get('widgets');
      const curWidgetsByGuid = {};
      if (curWidgets) {
        for (i = 0; i < curWidgets.length; i++) {
          curWidgetsByGuid[curWidgets[i].get('guid')] = curWidgets[i];
        }
      }
      const newWidgets = attributes.widgets;
      for (i = 0; i < newWidgets.length; i++) {
        const newWidget = newWidgets[i];
        const curWidget = curWidgetsByGuid[newWidget.get('guid')];
        if (curWidget) {
          curWidget.set(newWidget.toJSON(), { silent: true /* avoid update loops */});
          newWidgets[i] = curWidget;
        }
      }
    }

    // Merge base queries by GUID
    if ('baseQueries' in attributes) {
      const curQueries = this.get('baseQueries');
      const curQueriesByGuid = {};
      if (curQueries) {
        for (i = 0; i < curQueries.length; i++) {
          curQueriesByGuid[curQueries[i].get('guid')] = curQueries[i];
        }
      }
      const newQueries = attributes.baseQueries;
      for (i = 0; i < newQueries.length; i++) {
        const newQuery = newQueries[i];
        const curQuery = curQueriesByGuid[newQuery.get('guid')];
        if (curQuery) {
          curQuery.set(newQuery.toJSON());
          newQueries[i] = curQuery;
        }
      }
    }

    return Backbone.Model.prototype.set.call(this, attributes, options);
  },

  // the object type in the acl handler
  getAclObjectType() { return WorkspacePermissions.WORKSPACE_TYPE; },

  // the id of the object in the acl handler
  getAclObjectId() { return this.id; },
});

_.extend(Dashboard.prototype, AclModelMixin);

module.exports = Dashboard;
