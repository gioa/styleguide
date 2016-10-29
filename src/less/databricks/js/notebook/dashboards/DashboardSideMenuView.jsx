/* eslint react/prefer-es6-class: 0 */

import React from 'react';

import DashboardViewConstants from '../../notebook/dashboards/DashboardViewConstants';
import DashboardViewModel from '../../notebook/dashboards/DashboardViewModel';
import SelectionInput from '../../notebook/dashboards/SelectionInput.jsx';
import ButtonBar from '../../notebook/ButtonBar.jsx';

import DeprecatedDialogBox from '../../ui_building_blocks/dialogs/DeprecatedDialogBox';
import InlineEditableText from '../../ui_building_blocks/text/InlineEditableText.jsx';
import { Tooltip } from '../../ui_building_blocks/Tooltip.jsx';

/**
 * DashboardSideMenuView - side menu for configuring dashboard options and dashboard elements
 */
function DashboardSideMenuView(props) {
  return (<div className='side-menu dashboard-side-menu'>
    <DashboardTitle {...props} />
    <DashboardControls {...props} />
    <DashboardConfigs {...props} />
    <DashboardRemoveElementsBtn {...props} />
    <DashboardDeleteBtn {...props} />
  </div>);
}

DashboardSideMenuView.propTypes = {
  dashboard: React.PropTypes.instanceOf(DashboardViewModel).isRequired,
  removeAllElements: React.PropTypes.func,
};

const DashboardTitle = React.createClass({
  propTypes: {
    dashboard: React.PropTypes.instanceOf(DashboardViewModel).isRequired,
  },

  tags() {
    const tags = this.props.dashboard.tags();
    tags.source = 'DashboardTitle';
    return tags;
  },

  componentDidMount() {
    if (this.props.dashboard.get('title') === 'Untitled') {
      this.refs.title.startEditing();
      this.refs.titleTooltip.showTooltip();
    }
  },

  _updateTitle(newTitle, callback) {
    this.props.dashboard.setDashboardTitle(newTitle, callback);
  },

  _onTitleClicked() {
    const tags = this.tags();
    tags.eventType = 'editTitle';
    window.recordEvent('dashboard', tags);

    this.refs.title.startEditing();
  },

  render() {
    const title = this.props.dashboard.get('title');
    const notebook = this.props.dashboard.notebook();

    const note = (<p>
      {"View of notebook: "}
      <a href={'#notebook/' + notebook.id}
        className='notebook-title'
      >{notebook.get('name')}</a></p>);

    return (
      <div className='dashboard-settings-title'>
        <Tooltip text='Your dashboard view is untitled! Please enter a title here.'
          toggleOnHover={false} ref='titleTooltip'
        >
          <InlineEditableText
            ref='title'
            initialText={title}
            updateText={this._updateTitle}
            className='dashboard-title'
            maxLength={DashboardViewConstants.MAX_DASHBOARD_TITLE_LENGTH}
          >
            <h1 onClick={this._onTitleClicked}>{title}</h1>
          </InlineEditableText>
        </Tooltip>
        {note}
      </div>);
  },
});

const DashboardControls = React.createClass({
  propTypes: {
    dashboard: React.PropTypes.instanceOf(DashboardViewModel).isRequired,
  },

  recordClickPresent() {
    const tags = this.tags();
    tags.eventType = 'presentDashboard';
    window.recordEvent('dashboard', tags);
  },

  tags() {
    const tags = this.props.dashboard.tags();
    tags.source = 'DashboardSideMenuView';
    return tags;
  },

  render() {
    return (<div className='dashboard-controls'>
      <a className='btn'
        onClick={this.recordClickPresent}
        href={this.props.dashboard.getPresentViewRoute()}
      >
        <i className='fa fa-play' /> Present Dashboard
      </a>
    </div>);
  },
});

const DashboardConfigs = React.createClass({
  propTypes: {
    dashboard: React.PropTypes.instanceOf(DashboardViewModel).isRequired,
  },

  tags() {
    const tags = this.props.dashboard.tags();
    tags.source = 'DashboardSideMenuView';
    return tags;
  },

  onStackOptionChange(value, callback) {
    const tags = this.tags();
    tags.eventType = 'propertyChange';
    tags.property = 'stack';
    tags.propertyValue = value;
    window.recordEvent('dashboard', tags);

    this.props.dashboard.setLayoutOption({ stack: value }, callback);
  },

  onWidthSettingChange(width, callback) {
    const tags = this.tags();
    tags.eventType = 'propertyChange';
    tags.property = 'width';
    tags.propertyValue = width;
    window.recordEvent('dashboard', tags);

    width = parseInt(width, 10);
    this.props.dashboard.setDashboardWidth(width, callback);
  },

  render() {
    const dashboard = this.props.dashboard;

    return (
      <div className='dashboard-configs'>
        <ButtonBar
          className='dashboard-config-item layout-stack-option'
          label='Layout option'
          buttons={{ Stack: true, Float: false }}
          defaultActiveBtnKey={dashboard.getLayoutOption('stack') ? 'Stack' : 'Float'}
          onChange={this.onStackOptionChange}
        />
        <SelectionInput
          className='dashboard-config-item'
          label='Dashboard width'
          defaultValue={dashboard.get('width') + 'px'}
          options={DashboardViewConstants.WIDTH_OPTIONS.map((o) => o + 'px')}
          onChange={this.onWidthSettingChange}
        />
      </div>);
  },
});

const DashboardRemoveElementsBtn = React.createClass({
  propTypes: {
    dashboard: React.PropTypes.instanceOf(DashboardViewModel).isRequired,
    removeAllElements: React.PropTypes.func,
  },

  tags() {
    const tags = this.props.dashboard.tags();
    tags.source = 'DashboardRemoveElementsBtn';
    return tags;
  },

  _removeAllElements() {
    const tags = this.tags();
    tags.eventType = 'removeAllElements';
    window.recordEvent('dashboard', tags);

    this.props.removeAllElements();
  },

  removeElements() {
    DeprecatedDialogBox.confirm({
      message: 'This operation will remove all graphs from this dashboard. The graphs can be' +
        ' added again from the notebook. Continue?',
      confirm: this._removeAllElements,
    });
  },

  render() {
    return (<div className='dashboard-remove-all-btn'>
      <a onClick={this.removeElements} className='btn'>
        <i className='fa fa-eraser' /> Remove all graphs
      </a>
    </div>);
  },
});

const DashboardDeleteBtn = React.createClass({
  propTypes: {
    dashboard: React.PropTypes.instanceOf(DashboardViewModel).isRequired,
  },

  tags() {
    const tags = this.props.dashboard.tags();
    tags.source = 'DashboardDeleteBtn';
    return tags;
  },

  _deleteDashboardView() {
    const tags = this.tags();
    tags.eventType = 'delete';
    window.recordEvent('dashboard', tags);

    const dashboard = this.props.dashboard;
    const notebookId = dashboard.notebook().id;
    dashboard.deleteDashboardView(() => {
      window.router.navigate('#notebook/' + notebookId, { trigger: true });
    });
  },

  deleteDashboardView() {
    DeprecatedDialogBox.confirm({
      message: 'This operation will delete the current dashboard view. No change will be made to' +
        ' the graphs in notebook. Continue?',
      confirm: this._deleteDashboardView,
    });
  },

  render() {
    return (<div className='dashboard-delete-btn'>
      <a onClick={this.deleteDashboardView} className='btn btn-danger'>
        <i className='fa fa-trash-o' /> Delete this dashboard
      </a>
    </div>);
  },
});

module.exports = DashboardSideMenuView;
