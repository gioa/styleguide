/* eslint func-names: 0 */

/**
 * A view for input widgets. Adds drag / resize borders if options.editable is set to true.
 */

import $ from 'jquery';
import _ from 'underscore';

import WidgetView from './WidgetView';

import DeprecatedDialogBox from '../../ui_building_blocks/dialogs/DeprecatedDialogBox';

import { BrowserUtils } from '../../user_platform/BrowserUtils';

import editInputDialogTemplate from '../../templates/editInputDialog.html';
import comboBoxTemplate from '../../templates/comboBox.html';

const InputView = WidgetView.extend({
  initialize(options) {
    WidgetView.prototype.initialize.call(this, options);
    const _this = this;

    this.bindings = options.bindings;  // Bindings object for our Dashboard
    this.editable = options.editable;
    this.configurable = this.editable || this.model.get('configurable');

    // Propagate changes in bindings back to view
    this.listenTo(this.bindings, 'change:' + this.model.get('binding'),
                  this.bindingValueChanged);

    // Propagate changes in our model back to view
    this.listenTo(this.model, 'change', this.render);

    this.$el.addClass('widget-input');
    // TODO(someone): with scala and python arguments this regex-based logic does not work any more
    if (this.editable) {
      this.$el.droppable({
        tolerance: 'intersect',
        drop(event, ui) {
          // First, find the view of the widget we're dropping into this
          const allWidgets = _this.parent.widgetViews;
          let droppedWidget = null;
          for (let i = 0; i < allWidgets.length; i++) {
            if (allWidgets[i].el === ui.draggable[0]) {
              droppedWidget = allWidgets[i];
              break;
            }
          }
          // Check whether we have to merge a binding variable
          const myBinding = _this.model.get('binding');
          const itsBinding = droppedWidget.model.get('binding');
          if (itsBinding === myBinding) {
            DeprecatedDialogBox.confirm({
              message: 'Do you want to merge these input widgets?',
              confirmButton: 'Confirm and merge',
              cancelButton: 'Cancel',
              confirm() {
                droppedWidget.$el.fadeOut(250, function() {
                  droppedWidget.removeFromDashboard();
                });
              },
            });
          } else {
            DeprecatedDialogBox.alert('Cannot merge widgets with different bound variables.');
          }
        },
        over(event, ui) {
          $(ui.draggable).addClass('glow-drop');
          if ($(_this.$el).hasClass('glow-dep')) {
            $(_this.$el).addClass('had-glow-dep');
            $(_this.$el).removeClass('glow-dep');
          }
          $(_this.$el).addClass('glow-drop');
        },
        out() {
          $('.widget').removeClass('glow-drop');
          if ($(_this.$el).hasClass('had-glow-dep')) {
            $(_this.$el).addClass('glow-dep');
            $(_this.$el).removeClass('had-glow-dep');
          }
        },
      });
    }
  },

  events: {
    'change .input-box': 'onValueChanged',
    'keyup .input-box': 'onKeyUp',
    'click .dropdown-item': 'onDropdownItemClicked',
  },

  render() {
    const _this = this;
    this.contentArea.html('');
    let label = '';
    let paramName = '';
    if (this.model.has('label')) {
      label = this.model.get('label') + ': ';
      paramName = this.model.get('label');
    }
    const value = this.bindings.get(this.model.get('binding'));
    const controlType = this.model.get('controlType');
    if (controlType === 'text') {
      const p = $('<p>');
      const input = $('<input>');
      input.addClass('input-box');
      input.attr('type', 'text');
      input.attr('value', value);
      input.attr('data-name', paramName);
      p.text(label);
      p.append(input);
      this.contentArea.append(p);
      this.changeTextBoxFormatting();
    } else if (controlType === 'dropdown' || controlType === 'multiSelect') {
      let values = [value];
      if (controlType === 'multiSelect') {
        // value is really a comma-separated list of selected items; let's figure those
        values = value.split(',').map(function(x) { return x.trim(); });
      }
      const select = $('<select>', { class: 'input-box' });
      if (controlType === 'multiSelect') {
        select.attr('multiple', '');
      }
      this.model.get('choices').forEach(function(choice) {
        const option = $('<option>');
        option.attr('value', choice);
        option.prop('selected', _.contains(values, choice));
        option.text(choice);
        select.append(option);
      });
      const paragraph = $('<p>').text(label);
      if (controlType === 'dropdown') {
        // Add the control within the paragraph
        this.contentArea.append(paragraph);
        paragraph.append(select);
      } else {
        // Lay it out below the paragraph
        if (label !== '') {
          this.contentArea.append(paragraph);
        }
        this.contentArea.append(select);
      }
    } else if (controlType === 'comboBox') {
      const controls = $(comboBoxTemplate({
        label: label,
        value: value,
        choices: this.model.get('choices'),
      }));
      this.contentArea.append(controls);
      // Fix the position and z-index of the dropdown menu
      const menu = controls.find('.dropdown-menu');
      const inputBox = controls.find('.input-box');
      const button = controls.find('button');
      button.click(function() {
        _this.parent.$el.find('.widget').css('z-index', 10);
        _this.$el.css('z-index', 20);
        menu.css({
          left: (-inputBox.outerWidth()) + 'px',
          width: inputBox.outerWidth() + button.outerWidth(),
        });
      });
    }
    // Store the GUID as a data attribute for automated tests
    if (this.model.has('guid')) {
      _this.$el.attr('data-guid', _this.model.get('guid'));
    }
  },

  changeTextBoxFormatting() {
    if (this.model.get('globalConst') === true) {
      this.$('.input-box').addClass('globalConstiable');
    } else {
      this.$('.input-box').removeClass('globalConstiable');
    }
  },

  getInput() {
    let value = this.$('.input-box').val();
    if (_.isArray(value)) {
      // For multi-selects, val() can be an array, but all our code expects variables
      // to be strings
      value = value.join(', ');
    }
    if (value === null) {
      // For multi-selects, val() can also be null to say nothing is chosen
      value = '';
    }
    return value;
  },

  /**
   * Submit the query for execution to the backend (via model update).
   */
  submitQuery() {
    const key = this.model.get('binding');
    const newValue = this.getInput();
    const oldValue = this.bindings.get(key);
    if (oldValue === newValue) {
      this.bindings.trigger('change:' + key);
      this.bindings.trigger('change');
    } else {
      this.bindings.set(key, newValue);
    }
    this.bindings.trigger('submitBindings');
  },

  /**
   * Save the change into Bindings model without submit a query.
   */
  saveChange() {
    const change = {};
    change[this.model.get('binding')] = this.getInput();
    this.bindings.set(change, { silent: true });
  },

  /**
   * This is triggered by any "change" to the input. We filter out comboBox and text
   * since for those they are handled by onKeyUp.
   */
  onValueChanged() {
    const controlType = this.model.get('controlType');
    if (controlType !== 'text' && controlType !== 'comboBox') {
      this.submitQuery();
    } else {
      // save the changes but don't run the command immediately
      this.saveChange();
    }
  },

  /**
   * This is triggered by any key up. We submit a query if the user explicitly press
   * enter on text fields or combo boxes.
   */
  onKeyUp(e) {
    const controlType = this.model.get('controlType');
    if (controlType === 'text' || controlType === 'comboBox') {
      if (e.keyCode === 13) {
        this.submitQuery();
      }
    }
  },

  bindingValueChanged() {
    let newValue = this.bindings.get(this.model.get('binding')) || '';
    if (this.model.get('controlType') === 'multiSelect') {
      // val() needs to be an array, so turn the comma-separated string into one
      newValue = newValue.split(',').map(function(x) { return x.trim(); });
    }
    this.$('.input-box').val(newValue);
  },

  onDropdownItemClicked(e) {
    e.preventDefault();
    const newValue = $(e.target).text();
    this.$('.input-box').val(newValue);
    this.submitQuery();
  },

  showEditDialog() {
    const _this = this;
    const dialog = $(editInputDialogTemplate({
      mode: 'edit',
      guid: this.model.get('guid') || BrowserUtils.generateGUID(),
      label: this.model.get('label') || '',
      binding: this.model.get('binding') || '',
      controlType: this.model.get('controlType') || 'text',
      choices: this.model.get('choices') || [],
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
    });  // Delete from DOM when hidden
    dialog.modal('show');

    dialog.find('.save-button').on('click', function(e) {
      e.preventDefault();
      const newLabel = dialog.find('.input-label').val() || null;
      const newBinding = dialog.find('.input-binding').val() || '';
      const newType = dialog.find('.input-control-type').val();
      let newChoices = dialog.find('.input-choices').val().split(',')
          .map(function(x) { return x.trim(); });
      if (newType === 'text') {
        newChoices = [];
      }

      const oldBinding = _this.model.get('binding');
      if (newBinding !== oldBinding) {
        // Stop listening to changes on the old binding, and use the new one instead
        _this.stopListening(_this.bindings, 'change:' + oldBinding);
        _this.listenTo(_this.bindings, 'change:' + newBinding, _this.bindingValueChanged);
        _this.bindingValueChanged();
      }

      _this.model.set({
        label: newLabel,
        binding: newBinding,
        controlType: newType,
        choices: newChoices,
      });

      dialog.modal('hide');
      dialog.remove();
      $('.modal-backdrop').remove();
    });
  },
});

module.exports = InputView;
