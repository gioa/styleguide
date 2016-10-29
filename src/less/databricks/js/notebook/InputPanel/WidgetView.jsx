/* eslint react/prefer-es6-class: 0 */

import React from 'react';

import InputWidgetManager from '../InputWidgetManager.js';

import TextInputWidget from './TextInputWidget.jsx';
import DropdownInputWidget from './DropdownInputWidget.jsx';
import MultiSelectInputWidget from './MultiSelectInputWidget.jsx';
import ComboboxInputWidget from './ComboboxInputWidget.jsx';
import NotebookConstants from '../NotebookConstants';

const WidgetView = React.createClass({
  propTypes: {
    inputsMgr: React.PropTypes.instanceOf(InputWidgetManager).isRequired,
    argName: React.PropTypes.string.isRequired,
    widget: React.PropTypes.object.isRequired,
    autoRunOption: React.PropTypes.oneOf(NotebookConstants.AUTO_RUN_ALL_OPTIONS),
  },

  /**
   * Render a widget based on the widget type provided.
   * The props for this class are provided as the props for the new widget.
   *
   * @param { string } widgetType The type of widget to render.
   * @return {(TextInputWidget|DropdownInputWidget|null)} Null if unrecognized widget type
   */
  renderWidgetView(widgetType) {
    switch (widgetType) {
      case 'text':
        return <TextInputWidget {...this.props} />;
      case 'dropdown':
        return <DropdownInputWidget {...this.props} />;
      case 'multiselect':
        return <MultiSelectInputWidget {...this.props} />;
      case 'combobox':
        return <ComboboxInputWidget {...this.props} />;
      default:
        console.error('unknown widget type');
        return null;
    }
  },

  render() {
    const id = 'widget-div-' + this.props.argName;
    return (
      <div
        className='input-widget-view'
        id={id}
        key={id}
        data-widget-name={this.props.argName}
        data-widget-type={this.props.widget.widgetInfo.widgetType}
      >
        {this.renderWidgetView(this.props.widget.widgetInfo.widgetType)}
      </div>
    );
  },
});

module.exports = WidgetView;
