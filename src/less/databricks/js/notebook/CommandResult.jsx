/* eslint react/prefer-es6-class: 0, func-names: 0 */

import $ from 'jquery';
import _ from 'lodash';
import React from 'react';
import ReactDOM from 'react-dom';
import Backbone from 'backbone';

import WorkspacePermissions from '../acl/WorkspacePermissions';

import CommandParserUtils from '../notebook/CommandParserUtils';
import { CommandStateUtils } from '../notebook/CommandUtils';
import DownloadManager from '../notebook/DownloadManager';
import InputWidget from '../notebook/InputWidget';
import NotebookUtilities from '../notebook/NotebookUtilities';

import DashboardView from '../notebook/commands/DashboardView';
import { DisplayTypeUtils } from '../notebook/commands/DisplayTypeUtils';
import LargeOutputWrapper from '../notebook/commands/LargeOutputWrapper.jsx';

import Bindings from '../notebook/dashboards/Bindings';
import Dashboard from '../notebook/dashboards/Dashboard';
import DataWidget from '../notebook/dashboards/DataWidget';

import ReactTree from '../visualizations/ReactTree.jsx';

const CommandResult = React.createClass({

  propTypes: {
    isChild: React.PropTypes.bool.isRequired,
    state: React.PropTypes.string.isRequired,
    command: React.PropTypes.string.isRequired,
    rerunning: React.PropTypes.bool.isRequired,
    displayType: React.PropTypes.string.isRequired,
    permissionLevel: React.PropTypes.string,
    resizable: React.PropTypes.bool,
    arguments: React.PropTypes.object,
    bindings: React.PropTypes.object,
    inputWidgets: React.PropTypes.object,
    customPlotOptions: React.PropTypes.object,
    pivotAggregation: React.PropTypes.string,
    results: React.PropTypes.object,
    pivotColumns: React.PropTypes.array,
    xColumns: React.PropTypes.array,
    yColumns: React.PropTypes.array,
    isStatic: React.PropTypes.bool,
    isLocked: React.PropTypes.bool,
    hidePlotControls: React.PropTypes.bool,
    enablePointerEvents: React.PropTypes.bool,
    downloadable: React.PropTypes.bool,
    autoScaleImg: React.PropTypes.bool,
    autoCenterImg: React.PropTypes.bool,

    // we use DashboardView to display complex results and input widgets
    isComplexResult: React.PropTypes.bool.isRequired,
    isParamQuery: React.PropTypes.bool.isRequired,
    collapsed: React.PropTypes.bool.isRequired,

    // height & width can be "auto" or a "number"
    width: React.PropTypes.string.isRequired,
    height: React.PropTypes.string.isRequired,

    // Additional styles to be applied on the widget div
    additionalStyles: React.PropTypes.object,

    enableLargeOutputWrapper: React.PropTypes.bool,
    hideInputWidgets: React.PropTypes.bool,

    // these props are not required in subCommands
    tags: React.PropTypes.object,
    updateCommand: React.PropTypes.func,
    runCommand: React.PropTypes.func,

    commandModel: React.PropTypes.object,
  },

  getDefaultProps() {
    const noOp = function() {};
    return {
      permissionLevel: WorkspacePermissions.MANAGE,
      resizable: true,
      enableLargeOutputWrapper: true,
      updateCommand: noOp,
      runCommand: noOp,
      additionalStyles: {},
      collapsed: false,
      isStatic: false,
      isLocked: false,
      isChild: false,
      tags: {},
      downloadable: true,
      hidePlotControls: false,
      hideInputWidgets: false,
      enablePointerEvents: true,
      // if both autoScaleImg and autoCenterImg are true, autoScale overrides
      // autoCenter by nature of css settings
      autoCenterImg: false,
      autoScaleImg: false,
      commandModel: null,
    };
  },

  // gets called when new props are received
  // if shouldComponentUpdate returns true, react will call CommandResult.render
  shouldComponentUpdate(nextProps) {
    if (nextProps.collapsed !== this.props.collapsed) {
      this.dataWidget = null;
      this.inputWidgets = [];
      this.dashboardView = null;
      return true;
    }

    if (this.isMarkdown() && nextProps.command !== this.props.command) {
      return true;
    }

    // Received new bindings, rerender to get input widgets
    const bindingsChanged = !_.isEqual(_.keys(nextProps.bindings), _.keys(this.props.bindings));
    // Input widgets settings changed, rerender to update input widgets
    const inputWidgetsChanged = !_.isEqual(nextProps.inputWidgets, this.props.inputWidgets);

    if (bindingsChanged || inputWidgetsChanged) {
      return true;
    }

    // if a dashboardView already exist, update it instead of re-render component
    if (nextProps.isComplexResult && this.dataWidget && this.dashboardView) {
      this.updateLocalBindings(nextProps);
      this.resetDataWidget(nextProps);
      return false;
    }

    const resultsChanged = !_.isEqual(nextProps.results, this.props.results);
    const stateChanged = nextProps.state !== this.props.state;
    const permissionChanged = nextProps.permissionLevel !== this.props.permissionLevel;

    return resultsChanged || stateChanged || permissionChanged;
  },

  tags() {
    return _.extend({
      displayType: this.dataWidget ? this.dataWidget.get('displayType') : null,
    }, this.props.tags);
  },

  runCommandWithLocalBindings() {
    this.props.runCommand({ bindings: this.localBindings.toJSON() });
  },

  isMarkdown() {
    return NotebookUtilities.getDisplayType(this.props.command) === 'markdown';
  },

  renderTree() {
    const results = this.props.results;
    const styles = this.props.additionalStyles || {};

    return (
      <div className='results' style={styles}>
        <ReactTree tabularData={results.data} />
      </div>);
  },

  render() {
    const state = this.props.state;
    if (state === 'finished' || CommandStateUtils.isRunning(state) || this.props.isParamQuery ||
      this.isMarkdown()) {
      const results = this.props.results;
      if (results && results.type === 'table' &&
        results.plotOptions &&
        results.plotOptions.displayType === 'tree') {
        return this.renderTree();
      }
      if (this.props.isComplexResult) {
        return this.renderComplexResult();
      }
      return this.renderSimpleResult();
    }
    this.dataWidget = null;
    this.dashboardView = null;
    return null;
  },

  renderSimpleResult() {
    const results = this.props.results;

    this.dataWidget = null;
    this.dashboardView = null;

    if (this.props.collapsed) {
      return null;
    }

    const styles = this.props.additionalStyles || {};

    if (results && results.type === 'table' && results.data.length === 0) {
      // Special case for SQL commands that return no results, like CREATE TABLE
      return (
        <div className='results command-result-simple' style={styles} >OK</div>
      );
    } else if (results && results.type === 'exit') {
      return (
        <div className='results' style={styles}>
          <pre>{'Notebook exited: ' + results.data}</pre>
        </div>
      );
    } else if (results && results.type === 'raw') {
      return (
        <div className='results' style={styles}><pre>{results.data}</pre></div>
      );
    } else if (results && results.type === 'html') {
      return (
      // LargeOutputWrapper should have only one child inside
      <LargeOutputWrapper
        resizeEnabled={this.props.resizable}
        enabled={this.props.enableLargeOutputWrapper}
      >
        <div
          className='results'
          style={styles}
          dangerouslySetInnerHTML={{ __html: results.data }}
        >
        </div>
      </LargeOutputWrapper>
    );
    }
    return null;
  },

  updateLocalBindings(nextProps) {
    if (this.localBindings) {
      this.localBindings.set(nextProps.bindings);
    }
  },

  localDisplayTypeChanged() {
    window.recordEvent('plotTypeChanged', this.tags());
    this.props.updateCommand({ displayType: this.dataWidget.get('displayType') });
  },

  getLocalPlotParams() {
    return this.dataWidget.pick([
      'xColumns', 'yColumns', 'pivotColumns', 'pivotAggregation', 'customPlotOptions',
    ]);
  },

  localPlotParamsChanged() {
    if (CommandStateUtils.isRunning(this.props.state)) {
      // Already running in another shell, wait for completion.
      return;
    }

    const newPlotParams = this.getLocalPlotParams();
    window.recordEvent('plotOptionsChanged', this.tags(), newPlotParams);

    if (this.dataWidget.get('dataOverflowed') === true) {
      this.plotOverAll();
    } else {
      this.props.updateCommand(newPlotParams);
    }
  },

  plotOverAll() {
    if (this.dataWidget.get('dataOverflowed') === true) {
      this.props.updateCommand(this.getLocalPlotParams());
      window.recordEvent('plotWithServerAggregation', this.tags());
      this.props.runCommand({ bindings: this.localBindings.toJSON() });
    }
  },

  triggerDownload(getExistingData, alwaysDownloadExistingData) {
    if (!this.props.commandModel) {
      console.error('CommandModel not defined');
      return;
    }
    const commandModel = this.props.commandModel;
    DownloadManager.download(
      alwaysDownloadExistingData,
      this.dataWidget.get('dbfsResultPath') !== null,
      getExistingData,
      commandModel.getResultDownloadURL.bind(commandModel),
      commandModel.runCommandAndSaveResults.bind(commandModel));
  },

  localSizeChanged() {
    // Update height and width only if this result is resizable
    if (this.props.resizable) {
      this.props.updateCommand({
        height: this.dataWidget.get('height'),
        width: this.dataWidget.get('width'),
      });
    }
  },

  localInputWidgetsChanged() {
    const hash = {};
    _.each(this.inputWidgets, function(widget) {
      const name = widget.get('binding');
      hash[name] = {
        controlType: widget.get('controlType'),
        choices: widget.get('choices'),
        label: widget.get('label'),
      };
    }, this);
    this.props.updateCommand({ inputWidgets: hash });
  },

  createInputWidgets(props) {
    this.inputWidgets = [];
    const widgets = props.inputWidgets ? props.inputWidgets : {};
    // set input widgets
    _.each(_.keys(this.props.bindings).sort(), function(bindingKey) {
      const controlType = widgets[bindingKey] ? widgets[bindingKey].controlType : 'text';
      const choices = widgets[bindingKey] ? widgets[bindingKey].choices : [];
      const label = widgets[bindingKey] ? widgets[bindingKey].label : bindingKey;
      this.inputWidgets.push(new InputWidget({
        configurable: true,
        controlType: controlType,
        choices: choices,
        label: label,
        binding: bindingKey,
      }));
    }, this);
  },

  createDataWidget(props) {
    const results = props.results;
    const resultType = results ? results.type : null;
    const query = this.props.command;

    this.dataWidget = new DataWidget({
      query: query,
      language: CommandParserUtils.getLanguage(query),
      running: props.rerunning,
      resultType: resultType,
      xColumns: props.xColumns,
      yColumns: props.yColumns,
      pivotColumns: props.pivotColumns,
      pivotAggregation: props.pivotAggregation,
      customPlotOptions: _.cloneDeep(props.customPlotOptions),
      width: props.width,
      height: props.height,
      resizable: props.resizable,
      downloadable: props.downloadable,
    });
  },

  updateDataWidget(nextProps) {
    // find and set changed props to dataWidget
    if (this.dataWidget) {
      const changedProps = _.filter([
        'xColumns',
        'yColumns',
        'pivotColumns',
        'pivotAggregation',
        'customPlotOptions',
        'height',
        'width',
        'displayType',
        'autoScaleImg',
      ], function(key) {
        return !_.isEqual(this.props[key], nextProps[key]);
      }, this);

      if (!_.isEmpty(changedProps)) {
        this.dataWidget.set(_.pick(nextProps, changedProps));
      }
    }
  },

  resetDataWidget(props) {
    const results = props.results;

    if (!this.dataWidget) {
      this.createDataWidget(props);
    } else {
      this.updateDataWidget(props);
    }

    // Since markdown is not submitted to backend, there will be no result.
    // We populate the Widget model to trick rest of code base.
    if (this.isMarkdown()) {
      this.dataWidget.set({
        downloadable: false,
        data: this.props.command,
        resultType: 'markdown',
        displayType: 'markdown',
      });
      return;
    }

    if (results) {
      const canEdit = WorkspacePermissions.canEdit(this.props.permissionLevel);
      const hidePlotControls = this.props.hidePlotControls || !canEdit;
      // Do not allow resizing for markdown and HTML
      this.dataWidget.set({
        state: 'finished',
        displayType: DisplayTypeUtils.computeDisplayType(
          props.displayType,
          results.type,
          results.plotOptions ? results.plotOptions.displayType : null),
        resultType: results.type,
        schema: results.schema,
        isJsonSchema: results.isJsonSchema,
        data: results.data,
        arguments: props.arguments,
        dataOverflowed: results.overflow,
        aggSchema: results.aggSchema,
        aggData: results.aggData,
        aggDataOverflowed: results.aggOverflow,
        aggError: results.aggError,
        aggType: results.aggType,
        aggSeriesLimitReached: results.aggSeriesLimitReached,
        downloadable: props.downloadable && NotebookUtilities.isDownloadable(results.type) &&
          !CommandStateUtils.isRunning(props.state),
        resizable: props.resizable && NotebookUtilities.isResizable(results.type),
        error: null,
        hidePlotControls: hidePlotControls,
        // Running from DataWidget(plot over all link) requires EDIT permission,
        // because doing server side aggregation requires updating plot options
        hideRunCommands: !canEdit,
        dbfsResultPath: results.dbfsResultPath,
        permissionLevel: this.props.permissionLevel,
      });
    } else {
      // TODO(Chaoyu): refactor dashboardView to hide itself in state Error
      this.dataWidget.set({
        state: 'error',
        error: props.error,
        arguments: props.arguments,
        data: null,
        schema: null,
        aggSchema: null,
        aggData: null,
        height: 'auto',
      });
    }
  },

  setupEventListener() {
    this.eventListener = this.eventListener || _.extend({}, Backbone.Events);
    this.eventListener.stopListening();

    this.eventListener.listenTo(
      this.localBindings, 'submitBindings', this.runCommandWithLocalBindings, this);

    this.eventListener.listenTo(
      this.dataWidget, 'change:displayType', this.localDisplayTypeChanged, this);

    // When listenTo multiple changes, Underscore.debounce helps to avoid multiple callbacks
    this.eventListener.listenTo(
      this.dataWidget, 'change:height change:width',
      _.debounce(this.localSizeChanged, 1), this);

    this.eventListener.listenTo(
      this.dataWidget, 'change:xColumns change:yColumns change:pivotColumns' +
                       'change:pivotAggregation change:customPlotOptions',
      _.debounce(this.localPlotParamsChanged, 1), this);

    this.eventListener.listenTo(this.dataWidget, 'plotOverAll', this.plotOverAll);
    this.eventListener.listenTo(this.dataWidget, 'triggerDownload', this.triggerDownload);

    _.each(this.inputWidgets, function(widget) {
      this.eventListener.listenTo(widget, 'change:controlType change:choices change:label',
        _.debounce(this.localInputWidgetsChanged, 1), this);
    }, this);
  },

  renderComplexResult() {
    const widgets = [];

    if (!this.props.hideInputWidgets) {
      // set input widgets
      this.createInputWidgets(this.props);
      _.each(this.inputWidgets, function(w) {
        widgets.push(w);
      });
    }
    this.localBindings = new Bindings(this.props.bindings);

    // set dataWidget
    this.resetDataWidget(this.props);
    widgets.push(this.dataWidget);

    // create dashboardView
    const dashboardModel = new Dashboard({
      widgets: widgets,
      originalBindings: this.props.bindings,
    });
    this.dashboardView = new DashboardView({
      model: dashboardModel,
      autoSubmit: false,
      bindings: this.localBindings,
      clickToScrollTables: true,
      isStatic: this.props.isStatic,
      isLocked: this.props.isLocked,
      autoCenterImg: this.props.autoCenterImg,
      autoScaleImg: this.props.autoScaleImg,
    });


    this.setupEventListener();
    // return empty div to contain dashboardView
    const displayStyle = { display: (this.props.collapsed ? 'none' : 'block') };
    _.extend(displayStyle, this.props.additionalStyles);
    let classes = 'results dashboard';
    if (!this.props.enablePointerEvents) {
      classes = 'results dashboard disable-pointer-events';
    }

    return (
      <div className={classes} style={displayStyle} />
    );
  },

  // render dashboardView inside CommandResult div after the component is mounted or re-rendered
  renderDashboardView() {
    if (this.props.isComplexResult && this.dashboardView) {
      $(ReactDOM.findDOMNode(this)).html(this.dashboardView.el);
      this.dashboardView.render();
    }
  },

  componentDidUpdate() {
    this.renderDashboardView(); // render dashboardview after react component re-render
  },

  componentDidMount() {
    this.renderDashboardView(); // render dashboardview after react initial render
  },

  getContentHeight() {
    if (this.props.isComplexResult) {
      return $(ReactDOM.findDOMNode(this)).find('.widget-content.dashboard > .results')
          .innerHeight();
    }
    return $(ReactDOM.findDOMNode(this)).innerHeight();
  },
});

module.exports = CommandResult;
