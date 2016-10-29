/* eslint callback-return: 0, complexity: 0, max-lines: 0, func-names: 0 */

/**
 * Superclass Dashboard view
 */
import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';

import InputWidget from '../../notebook/InputWidget';

import BaseQuery from '../../notebook/dashboards/BaseQuery';
import BaseQueryView from '../../notebook/dashboards/BaseQueryView';
import Bindings from '../../notebook/dashboards/Bindings';
import DashboardConstants from '../../notebook/dashboards/DashboardConstants';
import DataView from '../../notebook/dashboards/DataView';
import DataWidget from '../../notebook/dashboards/DataWidget';
import InputView from '../../notebook/dashboards/InputView';
import NotebookUtilities from '../../notebook/NotebookUtilities';

import DeprecatedDialogBox from '../../ui_building_blocks/dialogs/DeprecatedDialogBox';

import { BrowserUtils } from '../../user_platform/BrowserUtils';

const dashboardRefreshControlsTemplate = require('../../templates/dashboardRefreshControls.html');
const dashboardToolboxTemplate = require('../../templates/dashboardToolbox.html');
const dashboardEditControlsTemplate = require('../../templates/dashboardEditControls.html');
const dashboardBaseQueriesTemplate = require('../../templates/dashboardBaseQueries.html');
const editViewDialogTemplate = require('../../templates/editViewDialog.html');
const editInputDialogTemplate = require('../../templates/editInputDialog.html');


const DashboardView = Backbone.View.extend({
  initialize(options) {
    this.editable = options.editable || false;
    this.autoSubmit = options.autoSubmit || false;
    this.publishMode = options.publishMode || false;
    this.editMode = options.editMode || false;
    this.parent = options.parent || null;
    this.viewClass = options.viewClass || null;
    this.isStatic = options.isStatic;
    this.isLocked = options.isLocked;
    // TODO(someone): get these from model
    this.gridAreaWidth = 800;
    this.gridAreaHeight = 600;
    this.widgetArea = null;
    // Will be set by getBindings()
    this.bindings = undefined;
    this.widgetViews = [];
    this.guidToWidgetView = {};
    this.baseQueryArea = null;
    this.baseQueryViews = [];
    this.guidToBaseQueryView = {};
    this.defaultBindings = options.bindings;
    this.clickToScrollTables = options.clickToScrollTables || false;
    // if both autoScaleImg and autoCenterImg are true, autoScale overrides
    // autoCenter by nature of css settings
    this.autoCenterImg = options.autoCenterImg || false;
    this.autoScaleImg = options.autoScaleImg || false;

    this.id = this.model.get('id');
    // Check that the tree collection installed globally is a backbone model
    if (window.treeCollection && window.treeCollection.get) {
      const treeModel = window.treeCollection.get(this.model.get('id'));
      if (treeModel && this.id) {
        this.name = treeModel.get('name');
      }
    }
    this.name = this.name || this.model.get('title');

    // Listen to changes in our widgets and base queries in order to add and remove views
    this.listenTo(this.model, 'change:widgets', this.widgetsChanged);
    this.listenTo(this.model, 'change:baseQueries', this.baseQueriesChanged);

    this.listenTo(
        this.model,
        'change:lastRefreshTime change:lastRefreshResult ' +
            'change:curRefreshStatus change:baseQueries',
        this.updateRefreshStatus);

    this.listenTo(this.model, 'change:refreshInterval', this.refreshIntervalChanged);

    this.listenTo(this.model, 'change:lastRefreshTime', this.refreshFinished);

    this.listenTo(this.model, 'change:baseQueries', this.showOrHideRefreshControls);

    this.listenTo(this.model, 'destroy remove', this.modelDestroyed);
  },

  events: {
    'click .edit-mode-button': 'toggleEditMode',
    'click .publish-button': 'launchPublishView',
    'click .base-queries-tab': 'openBaseQueriesTab',
    'click .widgets-tab': 'openWidgetsTab',
    'click .delete-button': 'onDeleteButton',
    'click .clone-button': 'onCloneButton',
    'click .add-button': 'fixAddMenu',
    'click .add-input': 'addInput',
    'click .add-view': 'addView',
    'change .size-box': 'changeSize',
    'click .add-base-query': 'addBaseQuery',
    'change .refresh-interval': 'changeRefreshIntervalDropdown',
    'change .custom-interval-value': 'changeCustomIntervalControls',
    'change .custom-interval-units': 'changeCustomIntervalControls',
    'click .refresh-now-button': 'triggerRefresh',
  },

  render() {
    let i;
    const _this = this;
    this.$el.html('');
    this.$el.addClass('dashboard');
    if (this.viewClass) {
      this.$el.addClass(this.viewClass);
    }

    const width = this.model.get('width');
    const dashboardArea = $('<div>').css({
      width: width === 'auto' ? 'auto' : width + 'px',
      position: 'relative',
      'margin-top': (this.editable ? '12px' : '0'),
    });
    this.$el.append(dashboardArea);

    // Create a div for the edit toolbox at the right
    if (this.editable) {
      const toolboxDiv = $(dashboardToolboxTemplate());
      dashboardArea.append(toolboxDiv);
    }

    // Add a title
    if ((this.publishMode || this.editable) && this.name.length > 0) {
      dashboardArea.append($('<h2>').text(this.name));
    }

    // Create edit controls at the top and the base queries area
    if (this.editable) {
      this.editControlsArea = $(dashboardEditControlsTemplate());
      dashboardArea.append(this.editControlsArea);
      this.coordinatesBox = this.editControlsArea.find('.coordinates-box');

      this.baseQueryArea = $(dashboardBaseQueriesTemplate(this.model.toJSON()));
      dashboardArea.append(this.baseQueryArea);
      this.baseQueryArea.hide();
      this.refreshIntervalChanged(); // Fix the controls on the base query area

      const queriesDiv = this.baseQueryArea.find('.queries');
      queriesDiv.sortable({
        update(event, ui) { _this.baseQueriesReordered(ui.item); },
        delay: 100,
      });

      const baseQueries = this.model.get('baseQueries');
      for (i = 0; i < baseQueries.length; i++) {
        this.addBaseQueryView(baseQueries[i]);
      }
    }

    this.widgetArea = $('<div>');

    if (this.editable) {
      this.widgetArea.css({
        'top': '0px',
        'left': '0px',
        'width': DashboardConstants.EDIT_MAX_BORDER_WIDTH + 'px',
        'height': DashboardConstants.EDIT_MAX_BORDER_HEIGHT + 'px',
        'background-color': 'white',
        'padding': '0px',
        'position': 'relative',
      });
      _this.updateGrid(_this.gridAreaWidth, _this.gridAreaHeight);
    }
    dashboardArea.append(this.widgetArea);

    const widgets = this.model.get('widgets');
    for (i = 0; i < widgets.length; i++) {
      this.addWidgetView(widgets[i]);
    }

    // Create a special div for the refresh controls
    this.refreshControlsArea = $(dashboardRefreshControlsTemplate());
    this.refreshControlsArea.css({ position: 'absolute', left: 0, top: 0 });
    dashboardArea.append(this.refreshControlsArea);
    this.updateRefreshStatus();

    // Delay updating the height because jQuery doesn't find the controls' positions immediately
    setTimeout(_.bind(this.updateHeight, this), 0);

    if (this.publishMode) {
      this.$('.dashboard-toolbox').hide();
    }

    this.showOrHideRefreshControls();

    if (this.editable) {
      // Make sure we start in the "off" state for editing; this call is necessary to hide some
      // of the drag handle controls that JQuery.resizable and draggable add.
      this.changeEditMode(this.editMode);
    }
  },

  getTotalHeight() {
    return _.reduce(this.widgetViews.map(function(v) {
      return v.getCurrentHeight();
    }), function(x, y) { return x + y; });
  },

  isRefreshable() {
    return this.editable;
    // TODO(someone): should also check for user permissions
  },

  /**
   * Sync with server if we made a change to the model or the widgets.
   */
  modelChanged() {
    if (this.model.collection && this.model.collection.url) {
      this.model.save(null, { error(model, xhr) {
        NotebookUtilities.handleRpcError(xhr, null, null, {
          confirmButton: 'OK',
          confirm() {
            window.location.href = '/';
          },
        });
      } });
    }
  },

  modelDestroyed() {
  },

  widgetsChanged() {
    // We need to join the new widgets against the old ones and do the following:
    // - If a new widget was added, create a view and update guidToWidget
    // - If an old widget was removed, delete its view.
    // Note that for changed widgets we do nothing because Dashboard will update their old model.
    const newWidgets = this.model.get('widgets');
    const guidToNewWidget = {};
    let i;

    for (i = 0; i < newWidgets.length; i++) {
      guidToNewWidget[newWidgets[i].get('guid')] = newWidgets[i];
    }
    const newWidgetViews = [];
    let guid;
    for (i = 0; i < this.widgetViews.length; i++) {
      guid = this.widgetViews[i].model.get('guid');
      if (guid in guidToNewWidget) {
        newWidgetViews.push(this.widgetViews[i]);
      } else {
        this.widgetViews[i].remove();
        if ((this.widgetViews[i].model instanceof InputWidget) &&
          (this.widgetViews[i].model.get('notebookNative')) && (this.parent)) {
          this.parent.parent.removeInputView(guid);
        }
      }
    }
    for (i = 0; i < newWidgets.length; i++) {
      guid = newWidgets[i].get('guid');
      if (!(guid in this.guidToWidgetView)) {
        // We have to create a new view for this widget
        const view = this.createWidgetView(newWidgets[i]);
        newWidgetViews.push(view);
        if ((view instanceof InputView) && (view.model.get('notebookNative')) && (this.parent)) {
          this.parent.parent.addInputView(view);
        }
        this.widgetArea.append(view.el);
      }
    }
    this.widgetViews = newWidgetViews;
    this.guidToWidgetView = {};
    for (i = 0; i < newWidgetViews.length; i++) {
      guid = newWidgetViews[i].model.get('guid');
      this.guidToWidgetView[guid] = newWidgetViews[i];
    }
    this.changeEditMode(this.editMode); // Show or hide edit mode controls
    this.updateHeight();
  },

  // The bindings are usually set using the model values that are saved right before, and there is
  // a lag in the propagation. We lazily create the bindings to go around this lag.
  // TODO(?) Investigate why the model does not get set before initialization.
  getBindings() {
    if (this.bindings === undefined) {
      const defaultBindings = this.model.get('defaultBindings') || {};
      this.bindings = this.defaultBindings || new Bindings(defaultBindings);
    }
    return this.bindings;
  },

  createWidgetView(widget) {
    const constructors = {
      'input': InputView,
      'data': DataView,
    };
    const Constructor = constructors[widget.get('type')];
    const view = new Constructor({
      model: widget,
      parent: this,
      bindings: this.getBindings(),
      editable: this.editable,
      autoSubmit: this.autoSubmit,
      clickToScrollTables: this.clickToScrollTables,
      isStatic: this.isStatic,
      isLocked: this.isLocked,
      autoCenterImg: this.autoCenterImg,
      autoScaleImg: this.autoScaleImg,
    });

    if (this.editable) {
      view.$el.css('z-index', '10');
    }
    view.render();

    if (view.model.get('displayType') === 'image') {
      view.$el.find('div.results').css({
        'height': 'inherit', // allow auto resize image
      });
    }

    return view;
  },

  /**
   * Create a new widget view and immediately add it
   */
  addWidgetView(widget) {
    const view = this.createWidgetView(widget);
    if ((view instanceof InputView) && (view.model.get('notebookNative')) && (this.parent)) {
      this.parent.parent.addInputView(view);
    }
    this.widgetViews.push(view);
    this.guidToWidgetView[widget.get('guid')] = view;
    this.widgetArea.append(view.el);
  },

  updateHeight() {
    if (!this.editable) {
      return;
    }
    const allWidgets = this.widgetViews;
    let lowestWidget = 0;
    for (let i = 0; i < allWidgets.length; i++) {
      const bottom = allWidgets[i].$el.position().top + allWidgets[i].$el.height();
      if (bottom > lowestWidget) {
        lowestWidget = bottom;
      }
    }
    const bottomPadding = this.editable ? 100 : 0;
    this.widgetArea.height(Math.max(this.gridAreaHeight, lowestWidget) + bottomPadding);
    this.refreshControlsArea.css('top', (lowestWidget + 65) + 'px');
  },

  // create/update and show grid lines
  updateGrid(width, height) {
    let line;
    const gridStep = DashboardConstants.GRID_STEP;
    const widget = this.widgetArea;

    width = parseInt(width, 10);
    width -= width % gridStep;
    height = parseInt(height, 10);
    height -= height % gridStep;

    // update widget area height and width
    widget.css({ width: width, height: height });

    // remove old grid lines
    this.$('.hline').remove();
    this.$('.vline').remove();

    // draw horizontal grid lines
    for (let y = 0; y < height + gridStep; y += gridStep) {
      line = $('<div/>', { class: 'hline' });
      widget.append(line);
      line.css({
        'left': '0px',
        'top': y + 'px',
        'width': width + 'px',
        'height': '0px',
        'position': 'absolute',
      });
    }

    // draw vertical grid lines
    for (let x = 0; x < width + gridStep; x += gridStep) {
      line = $('<div/>', { class: 'vline' });
      widget.append(line);
      line.css({
        'left': x + 'px',
        'top': '0px',
        'width': '0px',
        'height': height + 'px',
        'position': 'absolute',
      });
    }

    // TODO(someone): save these to model
    this.gridAreaWidth = width;
    this.gridAreaHeight = height;
  },

  toggleEditMode(e) {
    e.preventDefault();
    this.changeEditMode(!this.editMode);
  },

  launchPublishView(e) {
    e.preventDefault();
    window.open(document.location.href + '/publish', '_blank');
  },

  openBaseQueriesTab(e) {
    e.preventDefault();
    this.editControlsArea.find('li').removeClass('active');
    this.editControlsArea.find('.base-queries-tab').closest('li').addClass('active');
    this.editControlsArea.find('.widget-edit-controls').hide();
    this.widgetArea.hide();
    this.baseQueryArea.show();
  },

  openWidgetsTab(e) {
    e.preventDefault();
    this.editControlsArea.find('li').removeClass('active');
    this.editControlsArea.find('.widgets-tab').closest('li').addClass('active');
    this.editControlsArea.find('.widget-edit-controls').show();
    this.widgetArea.show();
    this.baseQueryArea.hide();
  },

  onDeleteButton(e) {
    e.preventDefault();
    const self = this;
    const message = 'Are you sure you want to remove this dashboard (' +
        this.name + '? This cannot be undone.';
    DeprecatedDialogBox.confirm({
      message: message,
      confirmButton: 'Remove Dashboard',
      confirm() {
        self.model.destroy();  // Doesn't work without a server
        window.router.navigate('', { trigger: true });
        console.log('activeView:', window.activeView);
      },
    });
  },

  changeSize() {
    const sel = this.$('.size-box').find(':selected').text();
    const w = sel.slice(0, sel.indexOf('x'));
    const h = sel.slice(sel.indexOf('x') + 1);
    this.updateGrid(w, h);
    // TODO(someone): sync size with server
  },

  // Show or hide the edit controls, such as drag handles, on all widgets
  changeEditMode(newMode) {
    this.editMode = newMode;
    if (newMode) {
      this.$('.hline').show();
      this.$('.vline').show();
      this.$('.widget')
        .resizable('enable')
        .draggable('enable')
        .addClass('editable');
      this.$('.ui-resizable-handle').show();
      this.$('.edit-mode-button').addClass('active');
      this.coordinatesBox.text('');
      this.editControlsArea.show();
      // Reopen the base queries tab if we were in it before
      if (this.editControlsArea.find('.base-queries-tab').closest('li').hasClass('active')) {
        this.widgetArea.hide();
        this.baseQueryArea.show();
      }
    } else {
      this.$('.hline').hide();
      this.$('.vline').hide();
      this.$('.widget')
        .resizable('disable')
        .draggable('disable')
        .removeClass('ui-state-disabled')
        .removeClass('editable');
      this.$('.ui-resizable-handle').hide();
      this.$('.edit-mode-button').removeClass('active');
      this.$('.widget').removeClass('glow');
      this.$('.widget').removeClass('glow-drag');
      this.$('.widget').removeClass('glow-dep');
      this.editControlsArea.hide();
      this.widgetArea.show(); // In case we were in the base-queries tab
      this.baseQueryArea.hide();

      // To enable overflow: hidden on data widgets.
      // This should not be set on all .results in CSS, because it will get applied in shells
      // and that will adversely affect rendering of plot option buttons.
      this.$('.results').css({
        height: '100%',
        width: '100%',
      });
    }
    this.showOrHideRefreshControls();
  },

  fixAddMenu(e) {
    // Position the menu right under our button
    const element = $(e.target).closest('a');
    const elementPos = element.position();
    const addMenu = this.$('.dropdown-menu');
    addMenu.css('top', elementPos.top + element.height() + 6);
    addMenu.css('left', elementPos.left);
  },

  addView(e) {
    e.preventDefault();
    const _this = this;
    const guid = BrowserUtils.generateGUID();
    const dialog = $(editViewDialogTemplate({
      guid: guid,
      language: 'sql',
      mode: 'create',
      label: '',
      query: '',
    }));
    dialog.on('hidden', function() {
      $('.modal-backdrop').remove();
      dialog.remove();
    }); // Delete from DOM when hidden
    dialog.modal('show');
    dialog.find('.save-button').on('click', function(event) {
      event.preventDefault();

      const newLabel = dialog.find('.input-label').val() || null;
      const newQuery = dialog.find('.input-query').val() || '';
      const queryLanguage = dialog.find('.language-select').val() || 'SQL';
      const displayType = NotebookUtilities.getDisplayType(newQuery);

      const widget = new DataWidget({
        guid: guid,
        label: newLabel || null,
        query: newQuery,
        language: queryLanguage,
        x: 0,
        y: _this.model.getNewWidgetY(),
        width: 660,
        height: 250,
        customizable: true,
        displayType: displayType,
        downloadable: NotebookUtilities.isDownloadable(displayType),
      });

      const widgets = _this.model.get('widgets').concat([widget]);
      _this.model.set('widgets', widgets);
      _this.modelChanged();   // This will save the widget to the server and cause us to render it

      dialog.modal('hide');
      dialog.remove();
      $('.modal-backdrop').remove();
    });
  },

  addInput(e) {
    e.preventDefault();
    const _this = this;
    // Come up with a unique name for it
    const existingNames = {};
    let i;

    this.model.get('widgets').forEach(function(w) {
      existingNames[w.get('label')] = true;
    });
    const guid = BrowserUtils.generateGUID();

    const dialog = $(editInputDialogTemplate({
      guid: guid,
      mode: 'create',
      label: 'Input ' + i,
      binding: 'const' + i,
      controlType: 'text',
      choices: [],
    }));

    // Show the "choices" text box only when we have a control type with choices
    const updateChoicesControl = function() {
      if (dialog.find('.input-control-type').val() === 'text') {
        dialog.find('.choices-area').hide();
      } else {
        dialog.find('.choices-area').show();
      }
    };
    updateChoicesControl();
    dialog.find('.input-control-type').change(updateChoicesControl);

    dialog.on('hidden', function() {
      dialog.remove();
      $('.modal-backdrop').remove();
    }); // Delete from DOM when hidden
    dialog.modal('show');
    dialog.find('.save-button').on('click', function(event) {
      event.preventDefault();

      const newLabel = dialog.find('.input-label').val() || null;
      const newBinding = dialog.find('.input-binding').val() || '';
      const newType = dialog.find('.input-control-type').val();
      let newChoices = dialog.find('.input-choices').val().split(',')
        .map(function(x) { return x.trim(); });
      if (newType === 'text') {
        newChoices = [];
      }

      const widget = new InputWidget({
        guid: guid,
        label: newLabel,
        binding: newBinding,
        controlType: newType,
        choices: newChoices,
        x: 0,
        y: _this.model.getNewWidgetY(),
        width: 660,
        height: (newType === 'multiSelect' ? 120 : 40),
      });

      const widgets = _this.model.get('widgets').concat([widget]);
      _this.model.set('widgets', widgets);
      _this.modelChanged(); // This will save the widget to the server and cause us to render it

      dialog.modal('hide');
      dialog.remove();
      $('.modal-backdrop').remove();
    });
  },

  /**
   * Create a new base query view and immediately add it
   */
  addBaseQueryView(baseQuery) {
    const view = this.createBaseQueryView(baseQuery);
    this.baseQueryViews.push(view);
    this.guidToBaseQueryView[baseQuery.get('guid')] = view;
    this.baseQueryArea.find('.queries').append(view.el);
  },

  /**
   * Return, but don't immediately add, a base query view
   */
  createBaseQueryView(baseQuery) {
    const view = new BaseQueryView({
      model: baseQuery,
      parent: this,
      bindings: this.getBindings(),
    });
    view.render();
    return view;
  },

  baseQueriesChanged() {
    // We need to join the new queries against the old ones and do the following:
    // - If a new query was added, create a view and update guidToBaseQueryView
    // - If an old query was removed, delete its view.
    // In addition, we make sure that the order of views matches the order of queries in the
    // array. Note that for changed queries we do nothing because Dashboard will update
    // their old model.
    const newBaseQueries = this.model.get('baseQueries');
    const guidToNewBaseQuery = {};
    let i;
    for (i = 0; i < newBaseQueries.length; i++) {
      guidToNewBaseQuery[newBaseQueries[i].get('guid')] = newBaseQueries[i];
    }
    const newBaseQueryViews = [];
    let guid;
    // Update or delete existing views
    for (i = 0; i < this.baseQueryViews.length; i++) {
      guid = this.baseQueryViews[i].model.get('guid');
      if (guid in guidToNewBaseQuery) {
        newBaseQueryViews.push(this.baseQueryViews[i]);
      } else {
        this.baseQueryViews[i].remove();
      }
    }
    // Add views for new queries
    for (i = 0; i < newBaseQueries.length; i++) {
      guid = newBaseQueries[i].get('guid');
      if (!(guid in this.guidToBaseQueryView)) {
        const view = this.createBaseQueryView(newBaseQueries[i]);
        newBaseQueryViews.push(view);
        this.baseQueryArea.find('.queries').append(view.el);
      }
    }
    this.baseQueryViews = newBaseQueryViews;
    // Update the GUID mapping
    this.guidToBaseQueryView = {};
    for (i = 0; i < newBaseQueryViews.length; i++) {
      guid = newBaseQueryViews[i].model.get('guid');
      this.guidToBaseQueryView[guid] = newBaseQueryViews[i];
    }
    // Fix the order of DOM elements
    const parentDiv = this.baseQueryArea.find('.queries');
    for (i = 0; i < newBaseQueries.length; i++) {
      guid = newBaseQueries[i].get('guid');
      this.guidToBaseQueryView[guid].$el.appendTo(parentDiv);
    }
  },

  baseQueriesReordered(itemMoved) {
    // We need to reshuffle our model's baseQueries field to match the DOM. For now we'll do this
    // with a quadratic-time algorithm where we figure out which query each element belongs to.
    const domElements = this.baseQueryArea.find('.queries').children().toArray();
    console.log('domElements:', domElements);
    const newModels = new Array(domElements.length);
    for (let i = 0; i < domElements.length; i++) {
      for (let j = 0; this.baseQueryViews.length; j++) {
        if (this.baseQueryViews[j].el === domElements[i]) {
          newModels[i] = this.baseQueryViews[j].model;
          break;
        }
      }
    }
    this.model.set('baseQueries', newModels);
    this.modelChanged();
    itemMoved.find('textarea').focus();
  },

  addBaseQuery() {
    const newQuery = new BaseQuery();
    const queries = this.model.get('baseQueries').concat([newQuery]);
    this.model.set('baseQueries', queries);
    this.modelChanged(); // This will save the widget to the server and cause us to render it
    this.baseQueryArea.find('textarea:last').focus();
  },

  updateRefreshStatus() {
    let refreshText = 'Never';
    let error = false;
    let inProgress = false;

    const refreshResult = this.model.get('lastRefreshResult');
    if (refreshResult === 'success') {
      refreshText = this.model.get('lastRefreshTime');
    } else if (refreshResult) {
      // The last refresh was an error; show its text
      refreshText = refreshResult;
      error = true;
    }

    // If a refresh is in progress, show that
    if (this.model.get('curRefreshStatus')) {
      refreshText = 'In progress, last: ' + refreshText;
      inProgress = true;
    }

    // Updates the last-refresh text on both the dashboard UI and the base queries tab
    this.$('.last-refresh')
      .text(refreshText)
      .toggleClass('error', error)
      .toggleClass('in-progress', inProgress);
  },

  refreshIntervalChanged() {
    if (this.baseQueryArea) {
      const value = this.model.get('refreshInterval');
      const select = this.$('.refresh-interval');
      if (value === 'manual') {
        select.val('manual');
        this.$('.custom-interval-controls').hide();
      } else if (select.val() === 'custom' || !_.contains(['1h', '3h', '6h', '24h'], value)) {
        // show it as a custom value
        this.$('.custom-interval-controls').show();
        const number = value.slice(0, value.length - 1);
        const units = value.slice(value.length - 1);
        this.$('.custom-interval-value').val(number);
        this.$('.custom-interval-units').val(units);
        this.$('.refresh-interval').val('custom');
      } else {
        select.val(value);
        this.$('.custom-interval-controls').hide();
      }
    }
  },

  changeRefreshIntervalDropdown() {
    let newInterval = this.baseQueryArea.find('.refresh-interval').val();
    if (newInterval === 'custom') {
      this.$('.custom-interval').show();
      if (this.model.get('refreshInterval') === 'manual') {
        newInterval = '1h';
        this.$('.custom-interval-value').val(1);
        this.$('.custom-interval-units').val('h');
      } else {
        // Update the custom interval controls based on the current value in the model
        newInterval = this.model.get('refreshInterval');
        this.refreshIntervalChanged();
      }
    } else {
      this.$('.custom-interval').hide();
    }
    this.model.set({ refreshInterval: newInterval });
    this.model.save({ refreshInterval: newInterval }, { patch: true });
  },

  changeCustomIntervalControls() {
    const newInterval =
      this.$('.custom-interval-value').val() + this.$('.custom-interval-units').val();
    this.model.set({ refreshInterval: newInterval });
    this.model.save({ refreshInterval: newInterval }, { patch: true });
  },

  showOrHideRefreshControls() {
    if (this.isRefreshable()) {
      this.$('.refresh-button').css('display', 'inline-block');
      this.$('.schedule-controls').show();
      this.$('.refresh-controls').show();
    } else {
      this.$('.refresh-button').css('display', 'none');
      this.$('.schedule-controls').hide();
      this.$('.refresh-controls').hide();
    }
    if (this.editMode) {
      this.$('.refresh-controls').hide();
    }
  },

  triggerRefresh(e) {
    e.preventDefault();
    const callback = function() {
      $.ajax('/dashboardRuns/' + this.model.get('id'), {
        type: 'PUT',
        contentType: 'application/json; charset=UTF-8',
        data: {},
      });
    }.bind(this);
    if (this.model.get('curRefreshStatus')) {
      DeprecatedDialogBox.confirm({
        message: 'A refresh is already in progress (status: ' +
                 this.model.get('curRefreshStatus') + '); cancel it to do a new one?',
        confirm: callback,
      });
    } else {
      callback();
    }
  },

  refreshFinished() {
    if (this.model.get('lastRefreshResult') === 'success') {
      console.log('Dashboard data refreshed, updating data views');
      for (let i = 0; i < this.widgetViews.length; i++) {
        const view = this.widgetViews[i];
        if (view instanceof DataView) {
          view.submitQuery();
        }
      }
    }
  },

  onCloneButton(e) {
    e.preventDefault();
    const self = this;
    DeprecatedDialogBox.prompt({
      message: 'What is the name for the new dashboard',
      confirmButton: 'Clone Dashboard',
      confirm(newName) {
        const json = self.model.toJSON();
        delete json.id; // So that the server assigns it a new one
        json.name = newName;
        json.title = newName;
        window.treeCollection.create(json, {
          wait: true,
          success(model) {
            window.router.navigate('dashboard/' + model.get('id'), { trigger: true });
          },
        });
      },
    });
  },
});

module.exports = DashboardView;
