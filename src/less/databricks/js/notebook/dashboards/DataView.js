/* eslint no-var: 0, no-shadow: 0, no-mixed-operators: 0, import/newline-after-import: 0,
no-lonely-if: 0, complexity: 0, global-require: 0, max-lines: 0, func-names: 0 */

/**
 * A view for the general-purpose DataWidget. This does the following things:
 * - Renders a table, chart, etc based on the current displayType using the model's data
 * - Renders buttons to change the view type if the model has customizable=true and the
 *   data returned is plottable
 * - Adds drag and resize borders if the "editable" parameter is passed to this view's options
 * - Submits new queries automatically based on the parent dashboard's bindings if this view's
 *   autoSubmit option is set to true. In the future we'll want this to be false in shell sessions
 *   so that we don't have all clients viewing the same shell submit the same SQL query; in that
 *   case, we'll just change view.data once on the server and pass the new data to all clients
 *   through the standard delta mechanism for shell commands.
 *
 * Do not use this as an example for tables; it needs to be refactored to use
 * ReactTable's Table and Column. For now, see ClusterDetailsLibrariesList and
 * ClusterDetailsLibrariesListView.
 *
 * TODO(someone): Break displayType to plotTop and resultType: PROD-1181
 * DataView relies on displayType field in the model to tell type of DataWidget (markdown, image,
 * table, etc), and the type of plots on tables (barChart, lineChart, etc). This logic is confusing
 * and has been the source of several bugs.
 */
import $ from 'jquery';
import _ from 'lodash';
import React from 'react';
import ReactDOM from 'react-dom';

import WorkspacePermissions from '../../acl/WorkspacePermissions';

import { CodeModeUtils } from '../../notebook/CodeModeUtils';
import NotebookUtilities from '../../notebook/NotebookUtilities';

import { DisplayTypeUtils } from '../../notebook/commands/DisplayTypeUtils';
import LargeOutputWrapper from '../../notebook/commands/LargeOutputWrapper.jsx';
import Markdown from '../../notebook/commands/Markdown';

import Constants from '../../notebook/dashboards/DashboardConstants';
import Dashboard from '../../notebook/dashboards/Dashboard';
import DataWidget from '../../notebook/dashboards/DataWidget';
import WidgetView from '../../notebook/dashboards/WidgetView';

import { PostMessage, POST_MESSAGE_TYPE } from '../../requests/PostMessage';

import HiveSchema from '../../tables/HiveSchema';

import Nestify from '../../ui_building_blocks/Nestify';

import { ResourceUrls } from '../../urls/ResourceUrls';

import { BrowserUtils } from '../../user_platform/BrowserUtils';

import BarChart from '../../visualizations/BarChart';
import BoxPlot from '../../visualizations/BoxPlot';
import Chart from '../../visualizations/Chart';
import DomUtil from '../../visualizations/DomUtil';
import Histogram from '../../visualizations/Histogram';
import LineChart from '../../visualizations/LineChart';
import AreaChart from '../../visualizations/AreaChart';
import MapPlot from '../../visualizations/MapPlot';
import PieChart from '../../visualizations/PieChart';
import Pivot from '../../visualizations/Pivot';
import PlotControls from '../../visualizations/PlotControls';
import QuantilePlot from '../../visualizations/QuantilePlot';
import QQPlot from '../../visualizations/QQPlot';
import ROCPlot from '../../visualizations/ROCPlot';
import ScatterPlot from '../../visualizations/ScatterPlotMatrix';

import '../../../lib/jquery.floatThead-patched'; // jquery-floatThead

import customizeDialogueTemplate from '../../templates/customizeDialog.html';
import customPlotOptions from '../../templates/customPlotOptionsTemplate.html';
import downloadControlsTemplate from '../../templates/downloadControls.html';
import editViewDialogueTemplate from '../../templates/editViewDialog.html';
import iframeSandboxTemplate from '../../templates/iframeSandbox.html';
import plotControlsTemplate from '../../templates/plotControls.html';
import urlSandboxTemplate from '../../templates/urlSandbox.html';


function handleResizePostMessage(msg, fromSandboxedIframe) {
  var $frame = $(document.getElementById(msg.data.frameId));
  if (!$frame.hasClass('frameResizeEventReceived')) {
    $frame.addClass('frameResizeEventReceived');
    var $outerFrame = $frame.closest('.widget');
    if ($outerFrame.length === 0) {
      return;
    }
    if ($outerFrame[0].style.height === 'auto') {
      $frame.height(msg.data.height);
    } else {
      $frame.height(Math.min(msg.data.height, $outerFrame.height() - 25 /* padding */));
    }

    // @NOTE(jengler) 2016-02-22: For sandboxed iframes, they have no origin (specifically, it is
    // null and so invalid as a postMessage target). So we must send to "*". However, since we have
    // already validated that the postMessage came from one of our iframes it is safe to send it
    // back.
    const postMessageTarget = fromSandboxedIframe ? '*' : msg.origin;
    msg.source.postMessage({
      type: POST_MESSAGE_TYPE.SIZED_EVENT,
      frameWidth: $frame.width(),
      frameHeight: $frame.height(),
    }, postMessageTarget);
  }
}

// Global handler for iframe resize messages. Since the same-origin policy on iframes prevents
// us from inspecting their contents to determine their size, we must subscribe to events
// posted from within the frames to properly size them. See iframeSandbox.html for more details.
window.addEventListener('message', function(msg) {
  const fromSandboxedIframe = PostMessage.isEventFromSandboxedIframe(msg, document);
  if (fromSandboxedIframe || PostMessage.isValidPostMessageOrigin(msg, window)) {
    if (!PostMessage.isValidPostMessageData(msg.data)) {
      console.error('PostMessage Data Violation');
      return;
    }

    if (msg.data.type === POST_MESSAGE_TYPE.RESIZE_EVENT) {
      handleResizePostMessage(msg, fromSandboxedIframe);
    } else if (msg.data.type === POST_MESSAGE_TYPE.JS_ERROR) {
      $(document.getElementById(msg.data.frameId)).parent().text(msg.data.error);
    }
  }
});

var Dataview = WidgetView.extend({
  initialize(options) {
    WidgetView.prototype.initialize.call(this, options);

    this.bindings = options.bindings;  // Bindings object for our Dashboard
    this.autoSubmit = options.autoSubmit || false;
    this.editable = options.editable;
    this.parent = options.parent;
    this.customizable = this.model.get('customizable');
    this.resizable = this.model.get('resizable');
    this.autoCenterImg = options.autoCenterImg || false;
    this.autoScaleImg = options.autoScaleImg || false;
    this.usingAggData = false;
    this.isStatic = options.isStatic;
    this.isLocked = options.isLocked;

    this.listenTo(this.model, 'change:query', this.queryChanged);
    this.listenTo(this.model, 'change', this.render);
    this.lastDisplayType = null;
    this.lastCustomPlotOptions = null;
    this.resultDiv = $('<div>').addClass('results');
    this.chart = null;
    this.clickToScrollTables = options.clickToScrollTables || false;

    this.lastComplexView = this.model.get('displayType');
    if (this.lastComplexView === 'table') {
      this.lastComplexView = 'barChart';
    }

    if (this.autoSubmit === true && this.model.get('state') === 'running') {
      this.submitQuery();
    }
  },

  events: {
    'click .display-type-button': 'changeDisplayType',
    'click .replot-link': 'replotOverAllData',
    'click .customize-button': 'customizePlotData',
    'click .results-download': 'downloadData',
    'click .results-download-preview': 'downloadDataPreview',
    'focus .results-table': 'resultsTableFocused',
    'blur .results-table': 'resultsTableBlurred',
  },

  makeErrorLink(message, stackTrace) {
    console.error(message + ': ' + stackTrace);
    var error = $(
      "<span class='caught-error-message'>" + message + ': ' +
        '<a href=#>Report error.</a></span>');
    error.children('a').click(function(e) {
      if (e) {
        e.preventDefault();
      }
      window.oops(stackTrace);
    });
    return error;
  },

  render() {
    try {
      this.render0();
    } catch (ex) {
      this.contentArea.append(this.makeErrorLink('Error rendering output', ex.stack));
      window.recordEvent('renderingError', {
        error: 'Error rendering data view',
      }, ex.stack);
    }
  },

  render0() {
    // Add listeners on our bindings
    this.updateBindingListeners();

    // If the only changed attribute in the mode is the file do not render
    var changed = this.model.changedAttributes();
    if (changed !== false) {
      var changedKeys = _.keys(changed);
      if (_.isEqual(changedKeys, ['file']) || _.isEqual(changed, { running: true })) {
        return;
      }
    }

    // TODO(someone): Don't recreate the whole element after the first call to render()?
    this.contentArea.empty();
    this.contentArea.addClass('dashboard');
    // Store the GUID as a data attribute for automated tests
    if (this.model.has('guid')) {
      this.$el.attr('data-guid', this.model.get('guid'));
    }
    this.$el.css({
      width: NotebookUtilities.fixLength(this.model.get('width')),
      height: NotebookUtilities.fixLength(this.model.get('height')),
    });

    if (this.model.has('label')) {
      this.contentArea.append($('<p>').text(this.model.get('label') + ':'));
    }

    if (this.model.get('error') === null) {
      var displayType = this.model.get('displayType');
      var customPlotOptions = JSON.stringify(this.model.get('customPlotOptions'));
      if (displayType !== 'table') {
        this.lastComplexView = displayType;
      }
      this.contentArea.append(this.resultDiv);
      if (this.model.get('data') &&
          (displayType !== this.lastDisplayType ||
           customPlotOptions !== this.lastCustomPlotOptions ||
           displayType === 'table' ||
           displayType === 'pivotTable' ||
           displayType === 'markdown' ||
           displayType === 'html' ||
           displayType === 'htmlSandbox' ||
           displayType === 'image')) {
        if (NotebookUtilities.isResizable(displayType) === false) {
          this.model.set({ resizable: false });
        } else if (NotebookUtilities.isResizable(this.lastDisplayType) === false) {
          this.model.set({ resizable: true });
        }
        this.updateResultDiv();
        this.lastDisplayType = displayType;
        this.lastCustomPlotOptions = customPlotOptions;
      }
      if (this.showPlotOptions()) {
        var pc = this.createPlotControls();
        this.contentArea.append(pc);
      }

      var downloadable = !this.model.has('downloadable') || this.model.get('downloadable');
      if (downloadable) {
        var showFullDownloadOption = window.settings && window.settings.enableLargeResultDownload &&
          !this.isStatic &&
          !this.isLocked &&
          this.model.get('displayType') === 'table' &&
          this.model.get('dataOverflowed');
        var disableFullDownloadReason;
        if (!WorkspacePermissions.canRun(this.model.get('permissionLevel'))) {
          disableFullDownloadReason = 'You must have run permission on this notebook in order to ' +
            'download over ' + window.settings.displayRowLimit + ' rows.';
        }
        var dc = this.createDownloadControls(showFullDownloadOption, disableFullDownloadReason);
        this.contentArea.append(dc);
      }

      var result = null;
      if (this.chart) {
        this.removeUnusedKeys();
        result = this.getDataForPlotting();
      }
      var plotWarnings = [];
      var canUseAggData = this.canUsePreaggregatedData();
      var showingAggData = (this.model.get('dataOverflowed') === true &&
                            this.model.get('aggData') &&
                            this.model.get('aggData').length > 0 &&
                            this.matchingAggType(displayType) === this.model.get('aggType') &&
                            canUseAggData);
      if (showingAggData) {
        if (this.model.get('aggDataOverflowed')) {
          var aggRowsShown = this.model.get('aggData').length;
          plotWarnings.push('Showing the first ' + aggRowsShown + ' rows.');
        }
      } else if (this.model.get('dataOverflowed') && this.model.get('data') &&
                 this.model.get('data').length > 0) {
        var rowsShown = this.model.get('data').length;
        if (displayType === 'table') {
          plotWarnings.push('Showing the first ' + rowsShown + ' rows.');
        } else if (canUseAggData && !this.model.get('hideRunCommands')) {
          plotWarnings.push('Showing sample based on the first ' + rowsShown +
            " rows. <a href='#' class='replot-link'>Plot over all results.</a>" +
            "<span class='replot-text'>Apply plot options for full results.</span>");
        } else {
          plotWarnings.push('Showing sample based on the first ' + rowsShown + ' rows.');
        }
      }
      var aggError = this.model.get('aggError');
      if (aggError && canUseAggData) {
        plotWarnings.push(this.makeErrorLink('Error plotting over all results', aggError));
      }
      if ((showingAggData && this.model.get('aggSeriesLimitReached') === true) ||
          (!showingAggData && result && result.seriesLimitReached === true)) {
        plotWarnings.push('Only showing the first ten series.');
      }
      if (this.chart) {
        var chartDim = this.getPlottingArea(plotWarnings.length);
        var yCols = this.model.get('yColumns') || result.columns;
        var pivotCols = this.model.get('pivotColumns');
        try {
          this.chart.plot(result.data, result.key, result.columns,
                          chartDim.width, chartDim.height, {
                            yColumns: yCols,
                            pivotColumns: pivotCols,
                            usingAggData: this.usingAggData,
                          });

          // Reset model width to current chart width to align the resize handle (PROD-2085)
          if (this.model.get('width') === 'auto') {
            this.model.set({ width: this.chart.width });
          }
        } catch (ex) {
          plotWarnings.push(this.makeErrorLink('Error rendering plot', ex.stack));
          window.recordEvent('renderingError', {
            error: 'Error rendering plot',
          }, ex.stack);
        }
      }
      this.resultDiv.find('.plotWarning').remove();
      for (var i in plotWarnings) {
        if (plotWarnings.hasOwnProperty(i)) {
          this.resultDiv.append($('<p>').addClass('plotWarning').append(plotWarnings[i]));
        }
      }
    }
    this.model.trigger('rendered');
  },

  queryChanged() {
    // We have to update our listeners and submit a new query. Clear any variables representing
    // state about the old one. Note that we do the clear silently since the call to render()
    // for changing the query will be enough to re-render the view -- we don't want to do
    // another one.
    this.updateBindingListeners();
    this.chart = null;
    this.resultDiv = $('<div>').addClass('results');
    this.lastDisplayType = null;
    this.lastCustomPlotOptions = null;
    this.model.set({
      resultType: null,
      data: null,
      schema: null,
      state: 'running',
      running: true,
    }, { silent: true });
    if (this.autoSubmit) {
      this.submitQuery();
    }
  },

  updateBindingListeners() {
    // When our query changes, remove our listeners on old bindings and add new ones
    if (this.autoSubmit && this.model.has('arguments')) {
      this.stopListening(this.bindings);
      var _this = this;
      _.keys(this.model.get('arguments')).forEach(function(v) {
        _this.listenTo(_this.bindings, 'change:' + v, _this.submitQuery);
      });
    }
  },

  submitQuery() {
    this.model.submitQuery(this.bindings.toJSON());
  },

  showPlotOptions() {
    var displayType = this.model.get('displayType');
    return this.isPlottable() && !DisplayTypeUtils.isMLSpecificDisplayType(displayType) &&
      !this.model.get('hidePlotControls');
  },

  isPlottable() {
    if (this.customizable === false) {
      return false;
    }
    if (this.model.get('resultType') === 'table') {
      return true;
    }
    // Finally test whether we could auto-plot this table
    return this.model.getParsedSchema().some(function(x) {
      return NotebookUtilities.isNumeric(x.type);
    });
  },

  getPlottingArea(numOverflowMessages) {
    var plotHeight = this.model.get('height');
    if (numOverflowMessages && plotHeight && plotHeight !== 'auto') {
      plotHeight -= Constants.OVERFLOW_HEIGHT * numOverflowMessages;
    }
    if (!this.customizable && !this.resizable) {
      return {
        width: this.model.get('maxChartWidth'),
        height: (plotHeight || 230),
      };
    }
    var plotWidth = this.model.get('width');

    if (!this.editable && this.showPlotOptions()) {
      plotHeight -= Constants.OPTION_BUTTON_HEIGHT;
    }
    if (this.model.has('label')) {
      plotHeight -= parseInt(DomUtil.getCSSProperty(
        this.model.get('label'), { 'width': plotWidth }, 'height'), 10);
    }
    return {
      width: plotWidth,
      height: plotHeight,
    };
  },

  updateResultDiv() {
    var displayType = this.model.get('displayType');

    // we use a react component to render 'html' result type, here is to clean up the previous
    // rendered react component
    ReactDOM.unmountComponentAtNode(this.resultDiv[0]);

    // do not assume shellCommand contains figures upfront without validation (later)
    var resultsAndComments = $(this).parent('.results-and-comments');
    resultsAndComments.removeClass('figure-results-and-comments');

    // To avoid image flickering do not empty resultDiv if we are rendering an image update
    if (displayType !== 'image' || this.resultDiv.find('.figure').length === 0) {
      this.resultDiv.html('');
    } else {
      console.log('Keeping old resultDiv for smooth transition');
    }

    var schema = this.model.getParsedSchema();
    var data = this.model.get('data');

    if (displayType === 'table' || displayType === 'pivotTable') {
      if (!schema || !data) {
        return;
      }
      var columns = schema.map(function(x) { return x.name; });
      var maxHeight = this.getPlottingArea().height - 7; // Fixme: Hack to avoid jumping
      var tableDiv = $('<div>').addClass('results-table');
      tableDiv.css({ 'max-height': Math.max(maxHeight, 0) + 'px' });

      if (this.clickToScrollTables) {
        // Make us a focusable element so we can capture clicks
        tableDiv.attr('tabindex', '-1');
        tableDiv.addClass('noscroll');
      }

      var inner = $('<div>').addClass('inner');
      tableDiv.append(inner);

      inner.css({ 'max-height': Math.max(maxHeight, 0) + 'px' });

      if (displayType === 'pivotTable') {
        var pivoted = this.getDataForPlotting();
        inner.append(DomUtil.createTable(
          pivoted.data, [pivoted.key].concat(pivoted.columns)));
        inner.find('table').addClass('table-pivoted');
      } else {
        var types = schema.map(function(x) { return x.type; });
        inner.append(DomUtil.createTable(data, columns, types));
      }
      var table = inner.find('table');

      Nestify.enable(table, true);

      // Enable floating header on table
      table.floatThead({
        scrollContainer() {
          // Specify the wrapper, in this case it's .inner
          return inner;
        },
        zIndex: 1,
      });

      table.floatThead('reflow');

      // page break rules: avoiding page break on charts >> avoiding page break on commands
      resultsAndComments.addClass('figure-results-and-comments');

      this.resultDiv.append(tableDiv);
      this.chart = null;
    } else if (displayType === 'markdown') {
      var markdownDiv = $('<div>').addClass('markdown');
      var markdownRenderer = new Markdown(markdownDiv);
      markdownRenderer.render(CodeModeUtils.getCode(this.model.get('data')));
      this.resultDiv.append(markdownDiv);
    } else if (displayType === 'image') {
      if (!data || data.length === 0) {
        return;
      }
      var baseFiles = window.settings.files !== undefined ? window.settings.files : '';
      var fig = $('<div class="figure"></div>');
      if (this.autoCenterImg) {
        fig = $('<div class="figure auto-center-wrapper"></div>');
      }
      if (this.resultDiv.find('.figure').length > 0) {
        fig = this.resultDiv.find('.figure');
      } else {
        this.resultDiv.append(fig);
      }

      // page break rules: avoiding page break on charts >> avoiding page break on commands
      resultsAndComments.addClass('figure-results-and-comments');

      var classes = '';
      if (this.autoCenterImg) {
        classes = 'auto-center-img';
      }
      // css applied by autoScaleImg will negate css applied by autoCenterImg
      if (this.autoScaleImg || this.model.get('autoScaleImg')) {
        classes = 'auto-scale-img';
      }
      var image = $('<img class="' + classes + '"/>');

      // Pre-loading the image before inserting it into the DOM
      if (data.indexOf('data:image/png') === 0) {
        // data is a base64 encoded image URI
        image[0].src = data;
      } else {
        image[0].src = baseFiles + data;
      }
      image.load(function() {
        fig.html(image);
      });

      // Updating the model with a reference to the file location, to be able to
      // garbage collect the file when the widget is removed or replaced.
      // TODO(Hossein): Garbage collection of files may fail if for some reason the browser
      // fails to update the widget with the reference. We need to change this to clean
      // dashboard files automatically.
      var curFile = '';
      if (this.model.has('file')) {
        curFile = this.model.get('file');
      }
      if (curFile !== data) {
        // To avoid an extra render() call, make this model update silent
        this.model.set({ 'file': data }, { silent: true });
      }
    } else if (displayType === 'html') {
      var result =
        React.createElement(LargeOutputWrapper, { enabled: this.resizable },
          React.createElement('div', { dangerouslySetInnerHTML: { __html: data } })
        );

      result = ReactDOM.render(result, this.resultDiv[0]);

      _.defer(function() {
        result.checkSizeAndSetWrapper();
      });
    } else if (displayType === 'htmlSandbox') {
      if (data.indexOf('http') === 0) {
        this.resultDiv.html(urlSandboxTemplate({
          frameId: BrowserUtils.generateGUID(),
          htmlContent: data,
        }));
      } else {
        let origin = window.location.origin;
        // If the window location is null, then we are in a sandboxed iframe. So we have to
        // use global broadcast (*) for postMessages.
        if (origin === 'null' || origin === 'file://') origin = '*';

        this.resultDiv.html(iframeSandboxTemplate({
          frameId: BrowserUtils.generateGUID(),
          cssUrl: ResourceUrls.getResourceUrl('lib/css/bootstrap.min.css'),
          parentUri: origin,
          htmlContent: data,
        }));
      }
    } else {  // displayType is a chart
      var constructors = {
        barChart: BarChart,
        boxPlot: BoxPlot,
        histogram: Histogram,
        lineChart: LineChart,
        areaChart: AreaChart,
        mapPlot: MapPlot,
        pieChart: PieChart,
        qqPlot: QQPlot,
        ROC: ROCPlot,
        quantilePlot: QuantilePlot,
        scatterPlot: ScatterPlot,
      };
      var Constructor = constructors[displayType];
      this.chart = new Constructor(this.resultDiv[0], this.isStatic);
      var customOptions = this.model.has('customPlotOptions') ?
          this.model.get('customPlotOptions') : {};
      if (_.has(customOptions, displayType)) {
        this.chart.setOptions(customOptions[displayType]);
      } else {
        customOptions[displayType] = this.chart.getOptions();
        this.model.set(customOptions, { silent: true });
      }
      this.resultDiv.append(this.chart);
    }
  },

  /**
   * Remove keys which are being used as plot options whose names have changed
   */
  removeUnusedKeys() {
    ['xColumns', 'yColumns', 'pivotColumns'].forEach((columnName) => {
      const columns = this.model.get(columnName) || [];
      columns.forEach((column) => {
        if (column !== '<id>' && !_.findWhere(this.model.get('schema'), { name: column })) {
          const setObj = {};
          setObj[columnName] = _.without(columns, column);
          this.model.set(setObj);
        }
      });
    });
  },

  /**
   * Get a plottable version of the data based on its schema.
   * If xColumns and yColumns were set on this view, then use those columns for plotting,
   * otherwise automatically pick the columns.
   */
  getDataForPlotting() {
    var pivotData = null;

    if (!this.model.get('xColumns') &&
        !this.model.get('yColumns') &&
        !this.model.get('pivotColumns')) {
      pivotData = this.inferDataForPlotting();
    } else {
      pivotData = this.getPreChosenPlotData();
    }

    // Convert non-numeric values to zero
    pivotData.data.forEach(function(row) {
      for (var i = 0; i < row.length; i++) {
        if (typeof row[i] !== 'string' && !isFinite(row[i])) {
          row[i] = 0;
        }
      }
    });

    return pivotData;
  },

  /**
   * Format data for plotting based on our model's xColumns and yColumns settings.
   */
  getPreChosenPlotData() {
    // Add a special "<id>" field at the end of every row to allow plotting single-column tables
    var displayType = this.model.get('displayType');
    var aggData = this.model.get('aggData');
    var data;
    var schema;
    this.usingAggData = false;
    if (this.model.get('dataOverflowed') === true &&
        this.canUsePreaggregatedData() && aggData && aggData.length > 0 &&
        this.matchingAggType(displayType) === this.model.get('aggType')) {
      data = aggData;
      this.usingAggData = true;
      schema = this.model.getParsedAggregatedSchema();
    } else {
      data = this.addIndexField(this.model.get('data'));
      schema = this.model.getParsedSchema();
    }
    var xCols = this.model.get('xColumns');
    var yCols = this.model.get('yColumns');
    var pivotCols = this.model.get('pivotColumns');
    var pivotAggFunction = this.model.get('pivotAggregation') || 'sum';
    var localPivotAggFunction = pivotAggFunction;
    // If server has counted the data we should not count it again
    if (this.usingAggData && pivotAggFunction === 'count') {
      localPivotAggFunction = 'sum';
    }
    var aggFunc = Pivot[localPivotAggFunction];
    if (displayType === 'pivotTable') {
      const colNames = schema.concat([{ name: '<id>', metadata: {} }]);
      return Pivot.pivot(data, colNames, xCols, yCols, pivotCols, aggFunc);
    } else if (displayType === 'histogram' && this.usingAggData) {
      return { data: data, columns: yCols, key: xCols.join(', ') };
    }
    return this.chart.prepareData(
      data,
      schema,
      xCols,
      yCols,
      pivotCols,
      aggFunc);
  },

  /**
   * Add a special field representing the row ID at the end of each record in data
   */
  addIndexField(data) {
    var newData = new Array(data.length);
    for (var i = 0; i < data.length; i++) {
      newData[i] = data[i].concat([i]);
    }
    return newData;
  },

  inferColumnsForPlotting() {
    var schema = this.model.getParsedSchema();
    if (this.chart) {
      return this.chart.inferColumns(schema);
    }
    return Chart.prototype.inferColumns(schema);
  },

  /**
   * Infer which data to plot based on our schema.
   */
  inferDataForPlotting() {
    var data = this.addIndexField(this.model.get('data') || []);
    var displayType = this.model.get('displayType');
    var inferred;
    var pivotCols = [];
    var schema = this.model.getParsedSchema();
    var aggFunc = Pivot.sum;
    if (displayType === 'pivotTable') {
      const colNames = schema.concat([{ name: '<id>', metadata: {} }]);
      inferred = this.inferColumnsForPlotting();
      return Pivot.pivot(data,
                         colNames,
                         inferred.xColumns,
                         inferred.yColumns,
                         pivotCols,
                         aggFunc);
    }
    inferred = this.chart.inferColumns(schema);
    return this.chart.prepareData(data,
                                  schema,
                                  inferred.xColumns,
                                  inferred.yColumns,
                                  pivotCols,
                                  aggFunc);
  },

  createPlotControls() {
    var curType = this.model.get('displayType');
    if (!_.contains(PlotControls.complexPlotTypes, this.lastComplexView)) {
      this.lastComplexView = PlotControls.complexPlotTypes[0];
    }
    var controls = $(plotControlsTemplate({
      curType: curType,
      lastComplexView: this.lastComplexView,
      PlotControls: PlotControls,
    }));
    controls.find('a[data-type=' + curType + ']').addClass('active');
    var menuButton = controls.find('.btn-group');

    // Register click event to evaluate position of the menue relative to window
    menuButton.on('click', function() {
      var menu = controls.find('.dropdown-menu');
      var menuHeight = menu.height();
      var buttonHeight = menuButton.height();
      var curPos = menuButton.offset().top + 2 * buttonHeight;

      // If menu border is within 50 pixels of window bottom open it upward
      if (curPos + menuHeight >= window.innerHeight) {
        // Setting top property instead of using 'dropup' class, because dropup changes
        // the caret direction and there is no way to fix it if user, clicks away
        menu.css('top', (-buttonHeight / 2 - menuHeight - 4) + 'px');
      } else {
        menu.css('top', '100%');
      }
    });
    return controls;
  },

  createDownloadControls(showFullDownloadOption, disableFullDownloadReason) {
    var controls = $(downloadControlsTemplate({
      showFullDownloadOption: showFullDownloadOption,
      disableFullDownloadReason: disableFullDownloadReason,
    }));
    var menuButton = controls.find('.btn-group');

    // Register click event to evaluate position of the menue relative to window
    menuButton.on('click', function() {
      var menu = controls.find('.dropdown-menu');
      var menuHeight = menu.height();
      var buttonHeight = menuButton.height();
      var curPos = menuButton.offset().top + 2 * buttonHeight;

      // If menu border is within 50 pixels of window bottom open it upward
      if (curPos + menuHeight >= window.innerHeight) {
        // Setting top property instead of using 'dropup' class, because dropup changes
        // the caret direction and there is no way to fix it if user, clicks away
        menu.css('top', (-buttonHeight / 2 - menuHeight - 4) + 'px');
      } else {
        menu.css('top', '100%');
      }
    });
    return controls;
  },


  changeDisplayType(e) {
    e.preventDefault();
    var newType = $(e.target).closest('a').data('type');  // In case click was on the <i>
    if (newType !== this.model.get('displayType')) {
      var changes = { displayType: newType };

      if (this.model.get('width') !== 'auto' &&
          (newType === 'table' || newType === 'pivotTable')) {
        changes.width = 'auto';
      }
      this.model.set(changes);
      this.$('.active').removeClass('active');
      this.$('a[data-type=' + newType + ']').addClass('active');
    }
  },

  replotOverAllData(e) {
    e.preventDefault();
    var inferred = this.inferColumnsForPlotting();
    var xColumns = this.model.get('xColumns') || inferred.xColumns;
    var yColumns = this.model.get('yColumns') || inferred.yColumns;
    var pivotColumns = this.model.get('pivotColumns') || [];
    var pivotAggregation = this.model.get('pivotAggregation') || 'sum';
    var customOptions = this.model.get('customPlotOptions') || {};

    // @NOTE(jengler) 2015-11-23: Based on info from Chaoyu. These options will not always be
    // different. However, we do always want to generate the plotOverAll call. In order to make
    // sure we only generate one call, the set is silent and then the actual updating of the
    // graph based on the model updates is done by triggering "plotOverAll" below.
    this.model.set({
      xColumns: xColumns,
      yColumns: yColumns,
      pivotColumns: pivotColumns,
      pivotAggregation: pivotAggregation,
      customPlotOptions: _.cloneDeep(customOptions),
    }, { silent: true });

    this.model.trigger('plotOverAll');

    if (this.autoSubmit === true) {
      this.submitQuery();
    }
  },

  extractItems($list) {
    var items = [];
    $list.find('li').each(function() {
      var text = _.unescape($(this).data('name'));
      items.push(text);
    });
    return items;
  },

  customizePlotData(e) {
    e.preventDefault();

    var _this = this;
    var inferred = this.inferColumnsForPlotting();
    var xColumns = this.model.get('xColumns') || inferred.xColumns;
    var yColumns = this.model.get('yColumns') || inferred.yColumns;
    var pivotColumns = this.model.get('pivotColumns') || [];

    var allColumns = this.model.get('schema')
        .map(function(x) { return x.name; }).concat(['<id>']);
    var pivotAggregation = this.model.get('pivotAggregation') || 'sum';
    var displayType = this.model.get('displayType');


    var dialog = $(customizeDialogueTemplate({
      allColumns: allColumns,
      xColumns: xColumns,
      yColumns: yColumns,
      pivotColumns: pivotColumns,
      pivotAggregation: pivotAggregation,
      displayType: displayType,
      PlotControls: PlotControls,
    }));

    var updateCustomOptions = function(widget) {
      var displayType = widget.model.get('displayType');
      if (widget.chart) {
        var values = [];
        var newOptions = [];
        dialog.find('.custom-plot-options input').each(function() {
          if (this.type === 'text') {
            var text = _.unescape($(this).val().trim());
            values.push(text);
          } else if (this.type === 'checkbox') {
            values.push(this.checked);
          } else if (this.type === 'radio') {
            values.push(this.checked);
          }
        });
        var curOptions = widget.chart.getOptions();
        if (values.length === curOptions.length) {
          for (var i = 0; i < curOptions.length; i++) {
            newOptions.push({
              key: curOptions[i].key,
              value: values[i],
            });
          }
          widget.chart.setOptions(newOptions);
          var widgetCustomOptions = widget.model.get('customPlotOptions');
          widgetCustomOptions[displayType] = newOptions;
          widget.model.set(widgetCustomOptions, { silent: true });
          widget.render();
        }
      }
    };

    var displayPlotOptionControls = function(widget) {
      // Add custom plot controls
      if (widget.chart) {
        var optionsTemplate = dialog.find('.custom-plot-options');
        optionsTemplate.empty();
        _.each(widget.chart.getOptions(), function(o) {
          optionsTemplate.append(customPlotOptions({
            inputType: o.inputType || 'text',
            label: o.label,
            key: o.key,
            value: o.value,
          }));
        });
        var timeOut;
        optionsTemplate.find('.plot-options').on('keyup change input', function() {
          clearTimeout(timeOut);
          timeOut = setTimeout(function() {
            updateCustomOptions(widget);
          }, 500);
        });
      }
    };

    // Add a preview of the graph
    var previewDiv = dialog.find('.plot-preview');
    var dataWidget = new DataWidget({
      query: '',
      data: _this.model.get('data'),
      dataOverflowed: _this.model.get('dataOverflowed'),
      schema: _this.model.get('schema'),
      isJsonSchema: _this.model.get('isJsonSchema'),
      running: false,
      maxChartWidth: 480,
      height: 250,
      displayType: DisplayTypeUtils.computeDisplayType(this.model.get('displayType'),
                                              this.model.get('resultType')),
      resultType: _this.model.get('resultType'),
      xColumns: xColumns,
      yColumns: yColumns,
      pivotColumns: pivotColumns,
      pivotAggregation: pivotAggregation,
      customPlotOptions: _.cloneDeep(_this.model.get('customPlotOptions')),
      customizable: false,
      resizable: false,
      downloadable: false,
      hideRunCommands: _this.model.get('hideRunCommands'),
    });
    // TODO(cg): I have no idea why this works!
    var DashboardView = require('../../notebook/commands/DashboardView');
    var dashboardModel = new Dashboard({ widgets: [dataWidget] });
    var dashboardView = new DashboardView({
      model: dashboardModel,
      autoSubmit: false,
    });
    previewDiv.append(dashboardView.el);
    dashboardView.render();
    displayPlotOptionControls(dashboardView.widgetViews[0]);

    var updateValues = function() {
      xColumns = _this.extractItems(dialog.find('.dst-list-x'));
      yColumns = _this.extractItems(dialog.find('.dst-list-y'));
      pivotColumns = _this.extractItems(dialog.find('.dst-list-pivot'));
      pivotAggregation = dialog.find('.input-aggregation').val();
      displayType = dialog.find('.input-display-type').val();
    };

    var updatePreview = function() {
      updateValues();
      var curChart = dashboardView.widgetViews[0];
      dataWidget.set({
        xColumns: xColumns,
        yColumns: yColumns,
        pivotColumns: pivotColumns,
        pivotAggregation: pivotAggregation,
        displayType: displayType,
      });
      updateCustomOptions(curChart);
      displayPlotOptionControls(curChart);
    };

    // Make source items draggable
    dialog.find('.src-item').draggable({
      connectToSortable: '.dst-list',
      helper: 'clone',
      revert: 'invalid',
      revertDuration: 250,
      appendTo: '.customize-dialog-body',
    });

    // Make destination list items removable
    dialog.find('.dst-list-item').each(function() {
      var _thisItem = $(this);
      _thisItem.find('.closeButton').click(function() {
        _thisItem.remove();
        updatePreview();
      });
    });

    // Make destination lists sortable
    dialog.find('.dst-list').sortable({
      revert: 250,
      connectWith: '.dst-list',
      tolerance: 'pointer',
      stop(event, ui) {
        var cnt = 0;
        $(this).find('li').each(function() {
          if ($(this).text().trim() === ui.item.text().trim()) {
            cnt++;
            if (cnt === 2) {
              ui.item.remove();
            } else {
              if (!$(this).hasClass('dst-list-item')) {
                // We're adding a new item from the source list, so make it deletable
                $(this).attr('class', 'dst-list-item');
                var closeButton = $(
                  '<btn class="closeButton"><i class="fa fa-remove"></i></btn>');
                $(this).prepend(closeButton);
                var _thisItem = $(this);
                closeButton.click(function() {
                  _thisItem.remove();
                  updatePreview();
                });
              }
            }
          }
        });
        updatePreview();
      },
    });

    dialog.find('select').on('change', updatePreview);

    dialog.on('hidden', function() {
      dialog.remove();
      $('.modal-backdrop').remove();
    });  // Delete from DOM when hidden
    dialog.modal('show');

    dialog.find('.save-button').on('click', function(e) {
      e.preventDefault();
      updateValues();
      // Unset plotting attributes first to force a 'change' event upon set.
      _this.model.set(
        { xColumns: [], yColumns: [], pivotColumns: [], pivotAggregation: '' },
        { silent: true });
      _this.model.set({
        xColumns: xColumns,
        yColumns: yColumns,
        pivotColumns: pivotColumns,
        pivotAggregation: pivotAggregation,
        customPlotOptions: _.cloneDeep(dataWidget.get('customPlotOptions')),
        displayType: displayType,
      });
      updateCustomOptions(_this);

      dialog.modal('hide');
      $('.modal-backdrop').remove();

      if (_this.autoSubmit === true) {
        _this.submitQuery();
      }
    });
  },

  showEditDialog() {
    var _this = this;
    var dialog = $(editViewDialogueTemplate({
      mode: 'edit',
      language: this.model.get('language') || 'sql',
      guid: this.model.get('guid') || BrowserUtils.generateGUID(),
      label: this.model.get('label') || '',
      query: this.model.get('query') || '',
    }));
    dialog.on('hidden', function() {
      dialog.remove();
      $('.modal-backdrop').remove();
    });  // Delete from DOM when hidden
    dialog.modal('show');
    dialog.find('.save-button').on('click', function(e) {
      e.preventDefault();
      var newLabel = dialog.find('.input-label').val() || null;
      var newQuery = dialog.find('.input-query').val() || '';
      var newLanguage = dialog.find('.language-select').val();
      _this.model.set({
        label: newLabel,
        language: newLanguage,
        query: newQuery,
        resultType: null,
      });
      if (_this.autoSubmit) {
        _this.submitQuery();
      }
      dialog.modal('hide');
      dialog.remove();
      $('.modal-backdrop').remove();
    });
  },

  // Get the data that has been served to the browser already. This returns an object with fields
  // "columnNames" and "rows".
  getBrowserData() {
    if (this.model.get('displayType') !== 'table') {
      var data = this.getDataForPlotting();
      return {
        columnNames: [data.key].concat(data.columns),
        rows: data.data,
      };
    }

    // Try to apply Hive schemas to the rows to give complex structs field names
    var parsedSchema = this.model.getParsedSchema();
    var colNames = parsedSchema.map(function(x) { return x.name; });
    var rows = this.model.get('data').map(function(row) {
      var transformed = new Array(row.length);
      for (var i = 0; i < row.length; i++) {
        if (typeof row[i] === 'object' && parsedSchema[i].type) {
          transformed[i] = HiveSchema.apply(row[i], parsedSchema[i].type);
        } else {
          transformed[i] = row[i];
        }
      }
      return transformed;
    });
    return {
      columnNames: colNames,
      rows: rows,
    };
  },

  downloadDataPreview(e) {
    e.preventDefault();
    this.model.trigger('triggerDownload', this.getBrowserData.bind(this), true);
  },

  downloadData(e) {
    e.preventDefault();
    this.model.trigger('triggerDownload', this.getBrowserData.bind(this), false);
  },

  resultsTableFocused() {
    if (this.clickToScrollTables) {
      this.$('.results-table').removeClass('noscroll');
    }
  },

  resultsTableBlurred() {
    if (this.clickToScrollTables) {
      this.$('.results-table').addClass('noscroll');
    }
  },

  canUsePreaggregatedData() {
    var inferred = this.inferColumnsForPlotting();
    var xColumns = this.model.get('xColumns') || inferred.xColumns;
    var yColumns = this.model.get('yColumns') || inferred.yColumns;
    var pivotColumns = this.model.get('pivotColumns') || [];
    // Plots using the <id> field cannot take advantage of aggregated data.
    if (xColumns.concat(yColumns).concat(pivotColumns).indexOf('<id>') >= 0) {
      return false;
    }
    /**
     * The display types that can use preaggregated data. Keep this in sync with
     * VALID_AGG_DISPLAY_TYPES in ExecutionPlanner.scala.
     */
    return _.contains(
      ['barChart', 'lineChart', 'areaChart', 'pieChart', 'mapPlot', 'pivotTable', 'histogram'],
      this.model.get('displayType'));
  },

  /**
   * Returns the matching aggregation type based on displayType.
   * Currently types are: scalar (for pivoting), histogram, and empty for unsupported
   * @param displayType
   */
  matchingAggType(displayType) {
    var scalarAggType = 'scalar';
    var histAggType = 'histogram';
    var aggTypeMapping = {
      barChart: scalarAggType,
      lineChart: scalarAggType,
      areaChart: scalarAggType,
      pieChart: scalarAggType,
      mapPlot: scalarAggType,
      pivotTable: scalarAggType,
      histogram: histAggType,
    };

    if (_.contains(_.keys(aggTypeMapping), displayType)) {
      return aggTypeMapping[displayType];
    }
    return '';
  },
});

module.exports = Dataview;
