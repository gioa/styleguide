/* eslint react/prefer-es6-class: 0, react/no-is-mounted: 0 */

import _ from 'underscore';
import React from 'react';

import WorkspacePermissions from '../../acl/WorkspacePermissions';

import ConfigureDashboardElementDialog from './ConfigureDashboardElementDialog.jsx';
import DashboardElementModel from './DashboardElementModel.js';
import Scalar from './Scalar.jsx';

import CommandResult from '../../notebook/CommandResult.jsx';
import DashboardViewConstants from '../../notebook/dashboards/DashboardViewConstants.js';

import ReactDialogBox from '../../ui_building_blocks/dialogs/ReactDialogBox.jsx';
import ReactModalUtils from '../../ui_building_blocks/dialogs/ReactModalUtils.js';
import IconsForType from '../../ui_building_blocks/icons/IconsForType.js';

import { ResourceUrls } from '../../urls/ResourceUrls';

/**
 * A wrapper around CommandResult component that is used inside DashboardLayoutView
 */
const DashboardElementView = React.createClass({

  propTypes: {
    element: React.PropTypes.instanceOf(DashboardElementModel).isRequired,
    static: React.PropTypes.bool.isRequired,
    removeElement: React.PropTypes.func.isRequired,
    permissionLevel: React.PropTypes.string,
  },

  tags() {
    const tags = this.props.element.tags();
    tags.source = 'DashboardElementView';
    return tags;
  },

  componentDidMount() {
    const command = this.props.element.getCommandModel();
    const throttledUpdate = _.throttle(() => {
      if (this.isMounted()) {
        this.forceUpdate();
      }
    }, 200);
    // update view when command received result changes
    command.on('change', throttledUpdate);
    // update width/height upon resizing, and update options
    this.props.element.on('change', throttledUpdate);
  },

  _getCommandUrl() {
    const notebookId = this.props.element.notebook().id;
    const commandId = this.props.element.getCommandModel().id;
    return '#notebook/' + notebookId + '/command/' + commandId;
  },

  _runCommand(options) {
    const tags = this.tags();
    tags.eventType = 'dashboardElementRun';
    window.recordEvent('dashboardElement', tags);

    this.props.element.getCommandModel().runCommand(options);
  },

  _updateCommand(options) {
    this.props.element.getCommandModel().updateCommand(options);
  },

  _onClickGoToCommandFromError() {
    const tags = this.tags();
    tags.eventType = 'goToCommandFromError';
    tags.source = 'DashboardElementView';
    window.recordEvent('dashboardElement', tags);
  },

  _generateErrorMessage(showRunButton) {
    const ErrorComponent = React.createClass({
      propTypes: {
        showRunButton: React.PropTypes.bool.isRequired,
        commandUrl: React.PropTypes.string.isRequired,
      },
      render() {
        return (
          <div
            className={'command-error-notice' + (this.props.showRunButton ? ' has-run-button' : '')}
            ref='error'
          >
            <i className={'fa fa-' + IconsForType.error}></i>
            <span className='command-error-text'>Error running command. </span>
            <a
              href={this.props.commandUrl}
              className='error-notebook-nav'
              onClick={this._onClickGoToCommandFromError}
            >
              Go to command
              <i className={'fa fa-' + IconsForType.navigate}></i>
            </a>
          </div>
        );
      },
    });

    return (
      <ErrorComponent
        showRunButton={showRunButton}
        commandUrl={this._getCommandUrl()}
      />);
  },

  getContentHeight() {
    if (this.refs.commandResult) {
      return this.refs.commandResult.getContentHeight();
    }
    return null;
  },

  _generateDashboardElement() {
    const element = this.props.element;
    const command = element.getCommandModel();
    const titleHeight = this._showTitle() ? DashboardViewConstants.ELEMENT_TITLE_HEIGHT : 0;
    const numOfInputWidgets = _.keys(command.get('bindings') || {}).length;
    const inputWidgetsHeight = numOfInputWidgets * DashboardViewConstants.INPUT_WIDGET_HEIGHT;
    const displayHeight = element.displayHeight() - titleHeight - inputWidgetsHeight;
    const scale = element.getOptions().scale;
    const defaultScalar = DashboardViewConstants.SCALAR_BASE;
    const rescaledWidth = element.displayWidth() / Math.pow(defaultScalar, scale);

    return (
      <Scalar scale={scale}>
        <CommandResult
          ref='commandResult'
          {...command.attributes}
          tags={this.tags()}
          resizable={false}
          collapsed={false}
          width={rescaledWidth.toString()}
          height={displayHeight.toString()}
          hidePlotControls
          enablePointerEvents={this.props.static}
          enableLargeOutputWrapper={false}
          downloadable={false}
          autoCenterImg
          permissionLevel={this.props.permissionLevel}
          // @NOTE(jengler) 2015-11-23: Provides support for server side aggregation links.
          updateCommand={this._updateCommand}
          // @NOTE(jengler) 2015-11-23: Provides support for running command from input widget.
          runCommand={this._runCommand}
          autoScaleImg={element.getOption('autoScaleImg')}
          isComplexResult={command.isComplexResult()}
          isParamQuery={command.isParamQuery()}
        />
      </Scalar>
    );
  },

  shouldShowRunButton(options) {
    const canRun = WorkspacePermissions.canRun(this.props.permissionLevel);
    return options.showRunButton && canRun;
  },

  getRunButtonOrSpinner(command, options) {
    if (command.get('running')) {
      return (
        <div className='spinner-wrapper'>
          <img className='dashboard-element-spinner' title='Command is running..'
            src={ResourceUrls.getResourceUrl('img/spinner.svg')}
            />
        </div>
      );
    } else if (this.shouldShowRunButton(options)) {
      return (
        <span className='run-btn-wrapper'>
          <a title='Re-run the command' className='run-btn'>
            <i className={'fa fa-' + IconsForType.refresh} onClick={this._runCommand} />
          </a>
        </span>
      );
    }
    return null;
  },

  _showTitle() {
    const options = this.props.element.getOptions();
    return options.showTitle && !_.isEmpty(options.title);
  },

  render() {
    const command = this.props.element.getCommandModel();
    const options = this.props.element.getOptions();
    const title = (<h2 className={'dashboard-element-title ' + options.titleAlign}>
      {this.props.element.getOptions().title}</h2>);

    let content;
    if ((command.get('error') || command.get('errorSummary')) &&
      !command.get('results') &&
      !command.isMarkdownCommand()) {
      content = this._generateErrorMessage(options.showRunButton);
    } else {
      content = this._generateDashboardElement();
    }

    return (<div className='dashboard-element-wrapper'>
      <div className={'run-btn-title-wrapper' + (this._showTitle() ? ' show-title' : ' no-title')}>
        {this.getRunButtonOrSpinner(command, options)}
        {this._showTitle() ? title : null}
      </div>
      <ElementViewButtons
        {...this.props}
        commandUrl={this._getCommandUrl()}
        ref='elementViewButtons'
      />
      {content}
    </div>);
  },
});

const ElementViewButtons = React.createClass({

  propTypes: {
    element: React.PropTypes.instanceOf(DashboardElementModel).isRequired,
    static: React.PropTypes.bool.isRequired,
    removeElement: React.PropTypes.func.isRequired,
    commandUrl: React.PropTypes.string.isRequired,
  },

  tags() {
    const tags = this.props.element.tags();
    tags.source = 'DashboardElementView';
    return tags;
  },

  _openConfigureElementDialog() {
    const tags = this.tags();
    tags.eventType = 'openConfigureElementDialog';
    window.recordEvent('dashboardElement', tags);

    ReactModalUtils.createModal(
      <ConfigureDashboardElementDialog element={this.props.element} />
    );
  },

  _adjustScale(increase) {
    const tags = this.tags();
    tags.eventType = 'propertyChange';
    tags.property = 'scale';
    tags.propertyValue = increase ? 'increase' : 'decrease';
    window.recordEvent('dashboardElement', tags);

    const currentSetting = this.props.element.getOptions().scale;
    const increaseScale = currentSetting + 1;
    const decreaseScale = currentSetting - 1;

    this.props.element.updateOptions({ scale: increase ? increaseScale : decreaseScale });
  },

  _increaseScale() {
    this._adjustScale(true);
  },

  _decreaseScale() {
    this._adjustScale(false);
  },

  onRemoveBtnClick(event) {
    const tags = this.tags();
    tags.eventType = 'removeElement';
    window.recordEvent('dashboardElement', tags);

    // getModifierState is not available with an event from TestUtils.simulate!
    if (event && event.getModifierState && event.getModifierState('Shift')) {
      this.props.removeElement();
    } else {
      ReactDialogBox.confirm({
        messageHTML: 'Remove this element from current dashboard? (This will not delete the ' +
          "command from notebook)<p class='hint-msg'>Tip: bypass this dialog by holding the " +
          "'Shift' key when deleting an element.</p>",
        confirm: () => this.props.removeElement(),
      });
    }
  },

  recordGoToCommandButtonClicked() {
    const tags = this.tags();
    tags.eventType = 'goToCommand';
    tags.source = 'DashboardElementViewButtons';
    window.recordEvent('dashboardElement', tags);
  },

  render() {
    const element = this.props.element;
    const command = element.getCommandModel();
    const configureButton = (
      <button className='btn btn-mini left-btn configure-element'
        onClick={this._openConfigureElementDialog}
      >
        <i className={'fa fa-' + IconsForType.setting}></i>
      </button>
    );
    const goToCommandButton = (
      <a
        onClick={this.recordGoToCommandButtonClicked}
        href={this.props.commandUrl}
      >
        <button className='btn btn-mini go-to-command' title='Go to command'>
          <i className={'fa fa-' + IconsForType.navigate}></i>
        </button>
      </a>
    );
    const markdownScaleBtns = (
      <span>
        <button
          title='Increase text size'
          className='btn btn-mini left-btn increase-scale'
          onClick={this._increaseScale}
        >
          <i className={'fa fa-' + IconsForType.zoomLarge}></i>
        </button>
        <button
          title='Decrease text size'
          className='btn btn-mini left-btn decrease-scale'
          onClick={this._decreaseScale}
        >
          <i className={'fa fa-' + IconsForType.zoomSmall}></i>
        </button>
      </span>
    );

    if (this.props.static) {
      return null;
    }

    return (
      <div className='dashboard-element-btns'>
        {command.isMarkdownCommand() ? null : configureButton}
        {goToCommandButton}
        {command.isMarkdownCommand() ? markdownScaleBtns : null}
        <button
          title='Remove from dashboard view'
          className='btn btn-mini'
          onClick={this.onRemoveBtnClick}
        >
          <i className='fa fa-times'></i>
        </button>
      </div>
    );
  },
});

module.exports = DashboardElementView;
