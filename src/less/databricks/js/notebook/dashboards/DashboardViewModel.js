/* eslint prefer-rest-params: 0, func-names: 0 */

import _ from 'underscore';
import Backbone from 'backbone';

import BackboneRpcMixin from '../../notebook/BackboneRpcMixin';
import NotebookUtilities from '../../notebook/NotebookUtilities';
import DashboardElementModel from '../../notebook/dashboards/DashboardElementModel';
import DashboardViewConstants from '../../notebook/dashboards/DashboardViewConstants';

/**
 * DashboardViewModel describes a dashboard view of a notebook, including its id, name, and layout
 * options. It also contains a list of elements(DashboardElementModel), each of the element stores
 * their own position and a elementNUID pointing to a notebook command.
 */
const DashboardViewModel = Backbone.Model.extend({

  // A Map from element.guid to DashboardElement model
  // These models are used for rendering the View, and View can only modify these data models
  // Dashboard.elements field will only be updated from server side.
  _elementsMap: {},

  populateElements(callback) {
    this.addCommandElements(this.notebook().plottableCommandNUIDs(), callback);
  },

  initialize() {
    this._deletedElementGUIDs = [];
    this._changedElementsMap = {};

    // Create element models based on elements field
    this._elementsMap = {};
    _.each(this.get('elements'), function(elt) {
      this._elementsMap[elt.guid] = (new DashboardElementModel(elt)).set('dashboard', this);
    }, this);

    // update element models when received delta updates from server
    this.listenTo(this, 'change:elements', this._updateElements);
  },

  // this methods should only be used for handling delta updates from server side
  _updateElements() {
    const newElementsMap = {};
    _.each(this.get('elements'), function(elt) {
      if (this._elementsMap[elt.guid]) {
        newElementsMap[elt.guid] = this._elementsMap[elt.guid].set(elt);
      } else {
        newElementsMap[elt.guid] = (new DashboardElementModel(elt)).set('dashboard', this);
      }
    }, this);
    this._elementsMap = newElementsMap;
    // layout view listens to this event to update elements' positions
    this.trigger('elementsUpdated');
  },

  notebook() {
    return this.get('parent');
  },

  isEmpty() {
    return this.getElements().length === 0;
  },

  _dashboardRpc(method, attrs, options) {
    options = options || {};
    if (!options.error) {
      options.error = NotebookUtilities.handleRpcError;
    }

    attrs = _.extend({
      updates: {},
      removedElements: [],
      newElements: [],
      changedElements: [],
    }, attrs);

    if (!options.url) {
      options.url = '/notebook/' + this.notebook().id + '/dashboard/' + this.id;
    }

    this.rpc(method, attrs, options);
  },

  deleteDashboardView(callback) {
    this._dashboardRpc('removeDashboardView', {}, { success: callback });
  },

  getElementsMap() {
    return this._elementsMap;
  },

  getElements() {
    return _.values(this._elementsMap);
  },

  // e.g. element.setLayoutOption({stack: false}, render)
  setLayoutOption(newOptions, callback) {
    this._updateDashboard({
      layoutOption: _.defaults(newOptions, this.get('layoutOption')),
    }, callback);
  },

  getLayoutOption(optionKey) {
    return this.get('layoutOption')[optionKey];
  },

  setDashboardWidth(width, callback) {
    if (!_.contains(DashboardViewConstants.WIDTH_OPTIONS, width)) {
      throw new Error("Can't set dashboard width to: " + width);
    }
    this._updateDashboard({ width: width }, callback);
  },

  setDashboardTitle(title, callback) {
    if (this.get('title') !== title) {
      this._updateDashboard({ title: title }, callback);
    }
  },

  _updateDashboard(updates, callback) {
    this._dashboardRpc('updateDashboardView', {
      updates: updates,
    }, { success: callback });
  },

  hasCommandElement(commandNUID) {
    const dashboardElements = this.attributes.elements;
    let i;

    for (i = 0; i < dashboardElements.length; i++) {
      if (dashboardElements[i].elementNUID === commandNUID) {
        return true;
      }
    }

    return false;
  },

  // Adding one command to this dashboard
  addCommandElement(commandNUID, callback) {
    this.addCommandElements([commandNUID], callback);
  },

  // Add list of commands to this dashboard
  addCommandElements(commandNUIDs, callback) {
    this._dashboardRpc('updateDashboardView', {
      newElements: _.map(commandNUIDs, function(nuid) {
        return {
          elementType: 'command',
          elementNUID: nuid,
        };
      }),
    }, { success: callback });
  },

  /**
   * remove all elements in this dashboard that are pointing to given command
   */
  removeCommandElement(commandNUID, callback) {
    this.removeCommandElements([commandNUID], callback);
  },

  removeCommandElements(commandNUIDs, callback) {
    const dashboardElements = this.attributes.elements;
    const dashboardGUIDsToRemove = [];
    let i;
    let j;

    // find the dashboard elements that match the selected commands to be removed
    // (each dashboard element has a NUID that points to a notebook command)
    for (i = 0; i < dashboardElements.length; i++) {
      for (j = 0; j < commandNUIDs.length; j++) {
        if (dashboardElements[i].elementNUID === commandNUIDs[j]) {
          dashboardGUIDsToRemove.push(dashboardElements[i].guid);
        }
      }
    }

    this._dashboardRpc('updateDashboardView', {
      removedElements: dashboardGUIDsToRemove,
    }, { success: callback });
  },

  updateElementOptions(elementGUID, options, callback) {
    options = _.defaults(options, this._elementsMap[elementGUID].get('options'));
    this.updateLocalElement(elementGUID, { options: options });
    this.syncLocalChanges(callback);
  },

  _deletedElementGUIDs: [],
  _changedElementsMap: {},

  removeLocalElement(elementGUID) {
    delete this._elementsMap[elementGUID];
    this._deletedElementGUIDs.push(elementGUID);
  },

  updateLocalElement(elementGUID, updates) {
    this._elementsMap[elementGUID].set(updates);

    if (this._changedElementsMap[elementGUID]) {
      _.extend(this._changedElementsMap[elementGUID], updates);
    } else {
      this._changedElementsMap[elementGUID] = _.extend({ guid: elementGUID }, updates);
    }
  },

  hasLocalchanges() {
    return !_.isEmpty(this._deletedElementGUIDs) || !_.isEmpty(this._changedElementsMap);
  },

  syncLocalChanges(callback) {
    if (!this.hasLocalchanges()) {
      return;
    }

    this._dashboardRpc('updateDashboardView', {
      removedElements: this._deletedElementGUIDs,
      changedElements: _.values(this._changedElementsMap),
    }, {
      success: function() {
        this._deletedElementGUIDs = [];
        this._changedElementsMap = {};
        if (callback) {
          callback.apply(this, arguments);
        }
      }.bind(this),
    });
  },

  // render related methods:

  getDashboardViewRoute() {
    return '#notebook/' + this.notebook().id + '/dashboard/' + this.id;
  },

  getPresentViewRoute() {
    return this.getDashboardViewRoute() + '/present';
  },

  getDashboardWidth() {
    return this.get('width');
  },

  getDashboardMinHeight() {
    return this.getDashboardWidth() / DashboardViewConstants.DEFAULT_PAGE_RATIO;
  },

  displayColumnWidth() {
    return Math.floor(this.get('width') / DashboardViewConstants.NUMBER_OF_COLUMNS);
  },

  displayCellHeight() {
    return Math.floor(this.get('width') * DashboardViewConstants.CELL_HEIGHT_RATIO) -
      DashboardViewConstants.CELL_VERTICAL_MARGIN;
  },

  tags() {
    const tags = _.extend(this.notebook().tags(), {
      dashboardId: this.id,
      source: 'DashboardViewModel',
    });

    return tags;
  },
});

_.extend(DashboardViewModel.prototype, BackboneRpcMixin);

// TODO(Chaoyu): add dashboard view level access control
// _.extend(DashboardViewModel.prototype, AclModelMixin);
// For now, delegate all acls calls to parent notebook
_.extend(DashboardViewModel.prototype, {
  getName() {
    return this.notebook().get('name');
  },

  fetchPermissions(onSuccess) {
    return this.notebook().fetchPermissions(onSuccess);
  },

  fetchPermissionLevel(onSuccess) {
    return this.notebook().fetchPermissionLevel(onSuccess);
  },

  fetchWorkspaceAcl(onSuccess) {
    return this.notebook().fetchWorkspaceAcl(onSuccess);
  },

  getPermissionLevel() {
    return this.notebook().getPermissionLevel();
  },

  canView() {
    return this.notebook().canView();
  },

  canEdit() {
    return this.notebook().canEdit();
  },

  canManage() {
    return this.notebook().canManage();
  },
});

module.exports = DashboardViewModel;
