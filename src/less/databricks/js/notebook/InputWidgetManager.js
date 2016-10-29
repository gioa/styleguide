/* eslint consistent-return: 0, func-names: 0 */

import _ from 'underscore';

// InputWidgetManager provides APIs for NotebookModel to manager input widgets
export default function InputWidgetManager(notebook) {
  const _inputWidgetRpc = function(method, attrs, options) {
    options = options || {};
    options.url = notebook.url() + '/inputwidget';
    notebook._notebookRpc(method, attrs, options);
  };

  this.notebookGuid = function() {
    return notebook.get('guid');
  };

  this.isEmpty = function() {
    const inputWidgets = this.getAllInputWidgets();
    return !inputWidgets || _.keys(inputWidgets).length === 0;
  };

  this.getAllInputWidgets = function() {
    return notebook.get('inputWidgets');
  };

  this.getAllInputWidgetsList = function() {
    const widgets = _.values(notebook.get('inputWidgets'));
    return _.sortBy(widgets, (widget) => {
      const widgetInfo = widget && widget.widgetInfo;
      return widgetInfo && (widgetInfo.label ? widgetInfo.label : widgetInfo.name);
    });
  };

  this.addInputWidget = function(widgetInfo) {
    _inputWidgetRpc('addInputWidget', { widgetInfo: widgetInfo });
  };

  this.setInputValue = function(argName, value, options) {
    options = options || {};
    if (value === undefined || value === null) {
      console.error('InputMgr:setInputValue with invalid value.');
      return;
    }
    const triggerWdigetSet = () => {
      if (!options.silent) {
        notebook.trigger('widgetValueChanged', {
          autoRunOption: options.autoRunOption,
          changedArgs: options.changedArgs,
        });
      }
    };
    const widget = this.getAllInputWidgets()[argName];
    if (!widget || widget.currentValue === value) {
      // skip saving widget value if widget does not exist or nothing has changed
      triggerWdigetSet();
      return;
    }
    const changes = { argName: argName, value: value };
    _inputWidgetRpc('setInputValue', changes, {
      success: triggerWdigetSet,
    });
  };

  this.updateInputWidget = function(argName, widgetInfo) {
    _inputWidgetRpc('updateInputWidget', {
      argName: argName,
      widgetInfo: widgetInfo,
    });
  };

  this.removeInputWidget = function(argName) {
    _inputWidgetRpc('removeInputWidget', { argName: argName });
  };

  this.newTextInputWidget = function(argName, defaultValue, options) {
    options = options || {};
    return {
      widgetType: 'text',
      name: argName,
      defaultValue: defaultValue,
      label: options.label,
      options: {
        widgetType: 'text',
        validationRegex: options.validationRegex,
      },
    };
  };

  this.newDropdownInputWidget = function(argName, defaultValue, choices, options) {
    options = options || {};

    if (_.isString(choices)) {
      choices = choices.split(';');
    }

    if (!_.isArray(choices) || choices.length < 1) {
      console.error('invalid choice input');
      // TODO(Chaoyu): show warning to user
      return;
    }

    return {
      widgetType: 'dropdown',
      name: argName,
      defaultValue: defaultValue,
      label: options.label,
      options: {
        widgetType: 'dropdown',
        choices: choices,
      },
    };
  };
}
