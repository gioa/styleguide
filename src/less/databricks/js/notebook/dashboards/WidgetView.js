/* eslint complexity: 0, max-depth: 0, func-names: 0 */

/**
 * A common superclass for widgets that handles resizing and dragging code and manages the controls
 * for those. Child classes should just add content to this.contentArea and will automatically get
 * this functionality. In addition, they can also implement showEditDialog() to allow editing.
 */

import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';

import DashboardConstants from '../../notebook/dashboards/DashboardConstants';
import NotebookUtilities from '../../notebook/NotebookUtilities';

import DeprecatedDialogBox from '../../ui_building_blocks/dialogs/DeprecatedDialogBox';

const WidgetView = Backbone.View.extend({
  initialize(options) {
    this.options = options || {};
    const _this = this;
    this.editable = this.options.editable;
    this.configurable = this.model.has('configurable') ? this.model.get('configurable') : false;
    this.parent = this.options.parent;

    this.resizable = this.model.get('resizable');
    this.customizable = this.model.get('customizable');

    this.$el.addClass('widget');
    if (this.editable) {
      this.$el.addClass('movable');
    }
    this.$el.css({
      left: this.model.get('x') + 'px',
      top: this.model.get('y') + 'px',
      width: NotebookUtilities.fixLength(this.model.get('width')),
      height: NotebookUtilities.fixLength(this.model.get('height')),
    });

    // Make the object draggable and resizable
    if (this.editable) {
      // account for borders used to resize a widget
      const step = DashboardConstants.GRID_STEP;
      this.$el.draggable({ grid: [step, step], stack: '.widget' });
      this.$el.resizable({
        grid: step,
        handles: 'all',
        minWidth: 140,
        minHeight: 30,
      });

      // Utility function to update the parent's coordinate box when our element moves
      const updateCoordinateBox = function(element) {
        _this.parent.coordinatesBox.text(
          Math.round(element.position().left) + ', ' +
            Math.round(element.position().top) + ', ' +
            Math.round(element.width()) + 'x' +
            Math.round(element.height()));
      };

      this.$el.click(function() {
        if (_this.parent.editMode) {
          _this.select();
          _this.bringWidgetOnTop();
          updateCoordinateBox(_this.$el);
        }
      });

      // intercept the resize and drag events
      this.$el.on('resizestart', function(event, ui) {
        _this.select();
        _this.bringWidgetOnTop();
        _this.parent.$el.addClass('resize-active');
        updateCoordinateBox(ui.element);
      });

      this.$el.on('resize', function(event, ui) {
        updateCoordinateBox(ui.element);
        _this.parent.updateHeight();
      });

      this.$el.on('resizestop', function(event, ui) {
        updateCoordinateBox(ui.element);
        _this.model.set({
          width: ui.element.width(),
          height: ui.element.height(),
          x: ui.helper.position().left,
          y: ui.helper.position().top,
        });
        _this.parent.$el.removeClass('resize-active');
        _this.render();  // To resize charts, etc
      });

      this.$el.on('dragstart', function() {
        _this.select();
        _this.parent.$el.addClass('drag-active');
      });

      this.$el.on('dragstop', function(event, ui) {
        _this.parent.$('.widget').removeClass('glow-drop');
        _this.select();
        updateCoordinateBox(ui.helper);
        _this.model.set({
          x: ui.helper.position().left,
          y: ui.helper.position().top,
        });
        _this.parent.$el.removeClass('drag-active');
      });

      this.$el.on('drag', function(event, ui) {
        if (!ui) {
          return;  // Not in edit mode - let the browser handle drags as normal.
        }
        updateCoordinateBox(ui.helper);
        _this.parent.updateHeight();
      });
    } else if (this.resizable) {
      // If it is not editable make the object resizable

      // account for borders used to resize a widget
      this.$el.resizable({
        handles: 'se',
        minWidth: 140,
        minHeight: 30,
        maxWidth: this.customizable ? this.parent.$el.width() : this.model.get('maxChartWidth'),
      });

      // intercept resize events
      this.$el.on('resizestart', function() {
        _this.select();
        _this.$el.resizable({
          maxWidth: _this.customizable ? _this.parent.$el.width() :
            _this.model.get('maxChartWidth'),
        });
      });

      this.$el.on('resizestop', function(event, ui) {
        _this.model.set({
          width: ui.element.width(),
          height: ui.element.height(),
        });
        _this.deselect();
        _this.parent.modelChanged();
        _this.render();  // To generate chart with new size
      });
    }

    // For configurable and editable widgets add edit and remove button
    if (this.configurable || this.editable) {
      // Add controls at the top left
      const editControls = $('<div class="widget-controls"></div>');
      const wrapper = $('<span class="wrapper"></div>');
      editControls.append(wrapper);
      const editButton = $(
        '<a class="edit-button" title="Edit" href="#"><i class="fa fa-pencil"></i></a>');
      editButton.on('click', _.bind(this.onEdit, this));
      wrapper.append(editButton);
      if (this.editable) {
        const removeButton = $(
          '<a class="remove-button" title="Delete" href="#"><i class="fa fa-remove"></i></a>'
        );
        removeButton.on('click', _.bind(this.onRemove, this));
        wrapper.append(removeButton);
      }
      this.$el.append(editControls);
    }

    this.contentArea = $('<div>').attr('class', 'widget-content');
    this.$el.append(this.contentArea);

    // Update our style when our coordinates change (if a change is pushed from the server)
    this.listenTo(this.model, 'change:x change:y change:width change:height',
                  this.coordinatesChanged);

    // Listen to changes to resizable and update the widget
    this.listenTo(this.model, 'change:resizable', this.resizabilityChanged);

    // As a huge hack, we'll save the whole dashboard whenever we have a change() event
    this.listenTo(this.model, 'change', this.modelChanged);

    _.defer(function() { _this.curHeight = _this.$el.height(); });
  },

  // If resizable is set to false, remembers current width and height and sets them to auto
  // If resizable is set to true, resets old width and height
  resizabilityChanged() {
    // If this is an editable widget (e.g. in a dashboard) do nothing
    if (this.editable) {
      return;
    }
    this.resizable = this.model.get('resizable');
    const _this = this;

    if (_this.resizable === true) {
      if (_this.oldWidth && _this.oldHeight) {
        this.model.set({
          width: _this.oldWidth,
          height: _this.oldHeight,
        });
      }

      // account for borders used to resize a widget
      _this.$el.resizable({
        handles: 'se',
        minWidth: 140,
        minHeight: 30,
        maxWidth: this.customizable ? this.parent.$el.width() : this.model.get('maxChartWidth'),
      });

      // intercept resize events
      _this.$el.on('resizestart', function() {
        _this.select();
        _this.$el.resizable({
          maxWidth: _this.customizable ? _this.parent.$el.width() :
            _this.model.get('maxChartWidth'),
        });
      });

      _this.$el.on('resizestop', function(event, ui) {
        _this.model.set({
          width: ui.element.width(),
          height: ui.element.height(),
        });
        _this.deselect();
      });
    } else {
      _this.$el.resizable('destroy');
      _this.oldWidth = _this.model.get('width');
      _this.oldHeight = _this.model.get('height');
      _this.model.set({
        width: 'auto',
        height: 'auto',
      });
    }
  },

  getCurrentHeight() {
    return this.curHeight;
  },

  modelChanged() {
    // Fire a change event on the parent later, because otherwise we get a cycle of us calling
    // modelChanged() and it calling set() on us with new values before this change event is
    // done. Also, ignore changes if only "local" attributes for the chart state have changed.
    const _this = this;
    if (this.model.changedAttributes()) {
      const changed = _.keys(this.model.changedAttributes());
      if (_.difference(changed, ['data', 'schema', 'state', 'running', 'error']).length > 0) {
        setTimeout(function() {
          _this.parent.modelChanged();
        }, 0);
      }
    }
  },

  coordinatesChanged() {
    this.$el.css({
      left: this.model.get('x') + 'px',
      top: this.model.get('y') + 'px',
      width: NotebookUtilities.fixLength(this.model.get('width')),
      height: NotebookUtilities.fixLength(this.model.get('height')),
    });
    this.parent.updateHeight();
  },

  select() {
    this.parent.$('.widget').removeClass('glow');
    this.parent.$('.widget').removeClass('glow-dep');
    this.$el.addClass('glow');
    const depWidget = this.getDependentWidgets();
    for (let i = 0; i < depWidget.length; i++) {
      depWidget[i].$el.addClass('glow-dep');
    }
  },

  deselect() {
    this.parent.$('.widget').removeClass('glow');
    this.parent.$('.widget').removeClass('glow-dep');
    this.$el.removeClass('glow');
    const depWidget = this.getDependentWidgets();
    for (let i = 0; i < depWidget.length; i++) {
      depWidget[i].$el.removeClass('glow-dep');
    }
  },

  onRemove(e) {
    e.preventDefault();
    const self = this;
    if (e.shiftKey) {
      self.removeFromDashboard();
    } else {
      DeprecatedDialogBox.confirm({
        message: 'Are you sure you want to remove this widget?',
        confirmButton: 'Remove Widget',
        confirm() { self.removeFromDashboard(); },
      });
    }
  },

  removeFromDashboard() {
    console.log('removeFromDashboard');
    const dashboard = this.parent.model;
    dashboard.set('widgets', _.without(dashboard.get('widgets'), this.model));
    this.model.destroy();
    this.parent.widgetViews = _.without(this.parent.widgetViews, this);
    delete this.parent.guidToWidgetView[this.model.get('guid')];
    this.parent.modelChanged();
    this.remove();
  },

  onEdit(e) {
    e.preventDefault();
    if (this.showEditDialog !== undefined) {
      this.showEditDialog();
    }
  },

  // bring widget on top by updating the z-index:
  // (1) if all sibling widgets have the same z-index,
  //     increment this widget's z-index
  // (2) if sibling widgets have different z-indexes,
  //     set this widget's z-index to max among all
  //     z-indexes, and decrement the z-indexes of its
  //     siblings with higher z-indexes
  bringWidgetOnTop() {
    const allWidgets = this.parent.widgetViews;
    let maxZindex = 0;
    let minZindex = -1000;
    let i;

    let zindex;
    for (i = 0; i < allWidgets.length; i++) {
      zindex = parseInt(allWidgets[i].$el.css('z-index'), 10);
      if (zindex > maxZindex) {
        maxZindex = zindex;
      } else {
        minZindex = zindex;
      }
    }
    if (minZindex === maxZindex) {
      // all widgets have same z-index
      this.$el.css('z-index', parseInt(maxZindex + 1, 10));
      // console.log("AFTER (1) = " + this.$el.css("z-index"));
    } else {
      // widgets have different z-indexes
      const thisZindex = parseInt(this.$el.css('z-index'), 10);
      for (i = 0; i < allWidgets.length; i++) {
        zindex = parseInt(allWidgets[i].$el.css('z-index'), 10);
        if (thisZindex < zindex) {
          // decrement the z-indexes of widgets with z-indexes
          // higher than the one of this widget
          allWidgets[i].$el.css('z-index', parseInt(zindex - 1, 10));
        }
      }

      this.$el.css('z-index', maxZindex);
      // console.log("AFTER (2) = " + this.$el.css("z-index"));
    }
  },

  getDependentWidgets() {
    const allWidgets = this.parent.widgetViews;

    const depWidgets = [];
    let binding = '';
    let query = '';
    let i;
    let widget;
    let argNames;

    if (this.model.get('type') === 'input') {
      binding = this.model.get('binding');

      for (i = 0; i < allWidgets.length; i++) {
        widget = allWidgets[i];
        if (widget !== this) {
          if (widget.model.get('type') === 'input') {
            if (binding === widget.model.get('binding')) {
              depWidgets.push(widget);
            }
          } else {
            query = widget.model.get('query');
            argNames = widget.model.has('arguments') ?
              _.keys(widget.model.get('arguments')) : {};
            console.log('compare ' + binding, ' to ', query);
            if ((typeof query !== 'undefined') && (typeof binding !== 'undefined') &&
                (_.contains(argNames, binding))) {
              depWidgets.push(widget);
            }
          }
        }
      }
    } else {
      query = this.model.get('query');
      argNames = this.model.has('arguments') ? _.keys(this.model.get('arguments')) : {};
      for (i = 0; i < allWidgets.length; i++) {
        widget = allWidgets[i];
        if (widget.model.get('type') === 'input') {
          binding = widget.model.get('binding');
          if (widget !== this) {
            console.log('compare ' + binding, ' to ', query);
            if ((typeof query !== 'undefined') && (typeof binding !== 'undefined') &&
                (_.contains(argNames, binding))) {
              depWidgets.push(widget);
            }
          }
        }
      }
    }
    return depWidgets;
  },
});

module.exports = WidgetView;
