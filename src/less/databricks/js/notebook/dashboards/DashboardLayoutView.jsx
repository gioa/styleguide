/* eslint react/prefer-es6-class: 0, func-names: 0 */

import $ from 'jquery';
import _ from 'underscore';
import React from 'react';
import ReactDOM from 'react-dom';
import '../../../lib/gridstack';

import DashboardViewConstants from '../../notebook/dashboards/DashboardViewConstants';
import DashboardViewModel from '../../notebook/dashboards/DashboardViewModel';
import DashboardElementView from '../../notebook/dashboards/DashboardElementView.jsx';
import { DashboardInputPanel } from '../../notebook/InputPanel/InputPanel.jsx';

/**
 * DashboardLayoutView contains many DashboardElementViews. It uses gridstack to manage their
 * layout(position, sizes) also handles drag-n-drop reordering and resizing. The component
 * internally mount DashboardElementView to gridstack nodes, and keeps track of all those DOM nodes
 * and react components through _elementsViewMap.
 *
 * This component is used in DashboardEditView where it enables editing the layout. But it is also
 * being used in DashboardPresentationView, in which it will be static layout.
 */
const DashboardLayoutView = React.createClass({

  propTypes: {
    dashboard: React.PropTypes.instanceOf(DashboardViewModel).isRequired,
    setContentLoading: React.PropTypes.func.isRequired,
    showInputWidgets: React.PropTypes.bool,
    static: React.PropTypes.bool,
    permissionLevel: React.PropTypes.string,
  },

  getDefaultProps() {
    return {
      static: false,
      showInputWidgets: true,
    };
  },

  // This component should never update through React, because GridStack uses jQuery UI to modify
  // DOM directly.
  shouldComponentUpdate() {
    return false;
  },

  componentDidMount() {
    this._initGridstack();
    this._renderGridstackNodes();

    // this event is triggered when dashboard model received position changes(delta updates from
    // server). Calling _updateElementViews will update element views through gridstack
    this.props.dashboard.on('elementsUpdated', this._updateElementViews, this);

    // re-initialize grid stack when dashboard layout option is changed
    this.props.dashboard.on(
      'change:width change:layoutOption', this._onDashboardSettingsChanged, this);
  },

  componentWillUnmount() {
    this.props.dashboard.off(null, null, this);
    this._removeAllElementViews();
  },

  _removeAllElementViews() {
    _.keys(this._elementsViewMap).forEach(this._removeElementView);
  },

  _onDashboardSettingsChanged() {
    // show spinner
    this.props.setContentLoading(true);

    // remove all element view, destroy gridstack instance
    this._removeAllElementViews();
    this._destroyGridstack();

    // defer rerender of gridstack, so that spinner can show up during re-render
    _.defer(function() {
      // re-initialize gridstack and rerender element views
      this._initGridstack();
      this._renderGridstackNodes(true);

      // hide spinner
      this.props.setContentLoading(false);
    }.bind(this));
  },

  _updateElementViews() {
    const elementsMap = this.props.dashboard.getElementsMap();

    // remove deleted element views
    const removedElementGUIDs = _.filter(
      _.keys(this._elementsViewMap), function(guid) { return !_.has(elementsMap, guid); }
    );
    _.each(removedElementGUIDs, this._removeElementView);

    this._renderGridstackNodes();
  },

  _getGridstackOptions() {
    const dashboard = this.props.dashboard;
    // TODO(Chaoyu): PROD-7933 enable width options here after add extra css
    // ignore becase gridstack option names are not favored
    // jscs:disable
    return {
      resizable: {
        handles: 'se, sw',
      },
      animate: true,
      vertical_margin: DashboardViewConstants.CELL_VERTICAL_MARGIN,
      cell_height: dashboard.displayCellHeight(),
      width: DashboardViewConstants.NUMBER_OF_COLUMNS,
      static_grid: this.props.static,
      float: !dashboard.getLayoutOption('stack'),
    };
    // jscs:enable
  },

  _initGridstack() {
    if (!this.$el) {
      this.$el = $(ReactDOM.findDOMNode(this)).find('.grid-stack.dashboard-layout-view');
    }
    this.$el.gridstack(this._getGridstackOptions());
    this.$el.css('min-height', this.props.dashboard.getDashboardMinHeight() + 'px');
    this.grid = this.$el.data('gridstack');

    this.$el.on('resizestop', this._recordAndSaveLayoutChanges);
    this.$el.on('dragstop', this._recordAndSaveLayoutChanges);
  },

  _destroyGridstack() {
    this.$el.off('resizestop', this._recordAndSaveLayoutChanges);
    this.$el.off('dragstop', this._recordAndSaveLayoutChanges);
    this.$el.data('gridstack', null);
  },

  /**
   * a node object that Gridstack library can utilize
   * @typedef {object} GridstackNode
   * @property {string} guid
   * @property {number} x
   * @property {number} y
   * @property {number} width
   * @property {number} height
   * @property {DashboardElementModel} element
   */

  /**
   * @return {GridstackNode[]}
   */
  _getNodesForRendering() {
    return _.map(this.props.dashboard.getElements(), this._elementToNode);
  },

  /**
   * Generate a gridstack node object from a dashboard element model
   * @param {DashboardElementModel} el
   * @return {GridstackNode}
   */
  _elementToNode(el) {
    const position = el.get('position');
    return {
      guid: el.get('guid'),
      x: position ? position.x : undefined,
      y: position ? position.y : undefined,
      width: el.gridWidth(),
      height: el.gridHeight(),
      element: el,
    };
  },

  // a map that tracks all the rendered react views and their dom $el
  // it should only be modified through this._addElementView and this._removeElementView
  _elementsViewMap: {},

  // update positions, handles newly added element
  _renderGridstackNodes(shouldSaveLayout) {
    // GridStackUI.Utils.sort take 3 parameters (nodes, direction, width)
    const allNodes = GridStackUI.Utils.sort(
      this._getNodesForRendering(), 1, DashboardViewConstants.NUMBER_OF_COLUMNS);

    const hasNoPosNode = Boolean(_.find(allNodes, function(n) { return n.x === undefined; }));
    if (hasNoPosNode) {
      // Append nodes that has no position to the end, and sort them using command position
      this.gridStackNodes = this._sortNodesWithCommandPosition(allNodes);
    } else {
      this.gridStackNodes = allNodes;
    }

    _.each(this.gridStackNodes, this._updateOrAddElementView);

    // save layouts if shouldSaveLayout argument is true or new dashboard elements are rendered
    // for the first time
    if (shouldSaveLayout || hasNoPosNode) {
      this._saveCurrentLayout();
    }
  },

  /*
   * Sort odes that has no position using command position in notebook, and append them to the end
   *
   * @param allNodes {GridstackNode[]}
   * @return {GridstackNode[]}
   */
  _sortNodesWithCommandPosition(allNodes) {
    // get all nodes that has no position attribute
    const noPosNodes = _.filter(allNodes, function(n) { return n.x === undefined; });

    return allNodes
      .filter(function(n) { return n.x !== undefined; })
      .concat(_.sortBy(noPosNodes, function(n) {
        const command = n.element.getCommandModel();
        return command ? command.get('position') : Infinity;
      }));
  },

  /**
   * @param {GridstackNode} node
   */
  _updateOrAddElementView(node) {
    if (node.guid in this._elementsViewMap) {
      this._updateElementView(node);
    } else {
      this._addElementView(node);
    }
  },

  /**
   * @param {GridstackNode} node
   */
  _addElementView(node) {
    const $el = $('<div><div id="' + node.guid + '" class="grid-stack-item-content" /><div/>');
    const useAutoPosition = (node.x === undefined || node.y === undefined);

    // jscs:disable
    this.grid.add_widget($el, node.x, node.y, node.width, node.height, useAutoPosition);
    this.grid.min_width($el, 2);
    this.grid.min_height($el, 1);
    // jscs:enable

    const boundRemoveEl = this.removeElement.bind(this, node.guid);
    const view = ReactDOM.render(
      <DashboardElementView
        permissionLevel={this.props.permissionLevel}
        element={node.element}
        static={this.props.static}
        removeElement={boundRemoveEl}
      />,
      $el.find('.grid-stack-item-content')[0]);

    this._elementsViewMap[node.guid] = {
      guid: node.guid,
      $el: $el,
      view: view,
    };

    // For newly added element, update element height to match the content if needed
    if (useAutoPosition) {
      this._fixElementHeight(node);
    }
  },

  /**
   * @param {GridstackNode} node
   */
  _fixElementHeight(node) {
    const command = node.element.getCommandModel();
    const result = command.get('results');

    const cellHeight = node.element.dashboard().displayCellHeight();
    const cellMargin = DashboardViewConstants.CELL_VERTICAL_MARGIN;
    const defaultHeight = DashboardViewConstants.DEFAULT_ELEMENT_HEIGHT;

    // Markdown command does not scale based on the width/height passed in, when adding new
    // markdown cell to the layout, this function sets its height based on the rendered height
    if (command && command.isMarkdownCommand()) {
      // rendered height in pixels
      const renderHeight = this._elementsViewMap[node.guid].view.getContentHeight();
      this._resetElementHeight(node, renderHeight);
    }

    // Reset height for small table view
    if (result && result.type === 'table') {
      // table height = [length of data + 1(table header)] * lineHeight(26px) + table margin(6px)
      const tableHeight = ((result.data.length + 1) * 26) + 6;
      if (tableHeight < (defaultHeight * (cellHeight + cellMargin))) {
        this._resetElementHeight(node, tableHeight);
      }
    }

    // @TODO(chaoyu): PROD-8260 add support for sandboxHTML result
  },

  _resetElementHeight(node, renderHeight) {
    if (node.element.getOption('showTitle')) {
      renderHeight += DashboardViewConstants.ELEMENT_TITLE_HEIGHT;
    }
    const cellHeight = node.element.dashboard().displayCellHeight();
    const cellMargin = DashboardViewConstants.CELL_VERTICAL_MARGIN;

    // Calculate height(number of grid units) based on rendered height(px)
    let targetHeight = Math.floor(renderHeight / (cellHeight + cellMargin));
    const boxHeight = ((targetHeight * cellHeight) + ((targetHeight - 1) * cellMargin));
    if (boxHeight < renderHeight) {
      targetHeight++;
    }

    // apply new height to gridstack node
    node.height = targetHeight;
    this._updateElementView(node);
  },

  /**
   * @param {GridstackNode} node
   */
  _updateElementView(node) {
    const $el = this._elementsViewMap[node.guid].$el;
    const nodePos = $el.data('_gridstack_node');
    if (nodePos.x !== node.x ||
        nodePos.y !== node.y ||
        nodePos.width !== node.width ||
        nodePos.height !== node.height) {
      this.grid.update($el, node.x, node.y, node.width, node.height);
    }
  },

  // Unmount element view and remove the dom element
  _removeElementView(elementGUID) {
    const $el = this._elementsViewMap[elementGUID].$el;
    ReactDOM.unmountComponentAtNode($el.find('.grid-stack-item-content')[0]);
    // jscs:disable
    this.grid.remove_widget($el);
    // jscs:enable
    delete this._elementsViewMap[elementGUID];
  },

  /**
    @param object event - the DOM event that generated the changes.
    @param object changeObject - Encapsulates changes made to a gridstack element. Specifically,
     we watch the resizestop and dragstop events which modify the elements size and position.

  */
  _recordAndSaveLayoutChanges(event, changeObject) {
    this._recordLayoutChange(changeObject);
    this._saveCurrentLayout();
  },

  tags() {
    const tags = this.props.dashboard.tags();
    tags.source = 'DashboardLayoutView';
    return tags;
  },

  /**
    Record a change to and objects layout.
    @param object changeObject - A change object has different values depending on what is changed.
     If the location of the object is changed, it will have "position" and "originalPosition"
     objects containing positional information.
     If the size of the object is changed, it will have "size" and "originalSize" objects.
     If the size of an object was changed and this resulted in the element having a new position
     for its top-left corner, then both the position and size objects will be present.
  */
  _recordLayoutChange(changeObject) {
    const tags = this.tags();
    tags.eventType = 'layoutChange';

    if (changeObject.size &&
      !_.isEqual(changeObject.originalSize, changeObject.size)) {
      tags.property = 'size';
    } else if (changeObject.position &&
      !_.isEqual(changeObject.originalPosition, changeObject.position)) {
      tags.property = 'position';
    } else {
      // Something else changed that we do not track here.
      return;
    }

    window.recordEvent('dashboardElement', tags);
  },

  _saveCurrentLayout() {
    const dashboard = this.props.dashboard;

    _.each(_.values(this._elementsViewMap), function(element) {
      const pos = element.$el.data('_gridstack_node');
      dashboard.updateLocalElement(element.guid, {
        position: {
          x: pos.x,
          y: pos.y,
          width: pos.width,
          height: pos.height,
        },
      });
    });

    // save all local changes
    dashboard.syncLocalChanges();
  },

  removeElement(elementGUID) {
    this._removeElementView(elementGUID);
    this.props.dashboard.removeLocalElement(elementGUID);
    this._saveCurrentLayout();
  },

  // Instead of calling removeElement for each guid, we want to remove them all
  // before calling _saveCurrentLayout. This prevents strange jumping of elements.
  removeAllElementsAtOnce() {
    _.keys(this._elementsViewMap).forEach((guid) => {
      this._removeElementView(guid);
      this.props.dashboard.removeLocalElement(guid);
    });
    this.props.dashboard.syncLocalChanges();
  },

  addElement(commandGUID) {
    // delta updates will trigger the re-rendering, which will add the view for new element
    this.props.dashboard.addCommandElement(commandGUID);
  },


  render() {
    const runAll = () => { this.props.dashboard.notebook().runAll(); };
    const inputPanel = window.settings.enableNewInputWidgetUI && this.props.showInputWidgets ?
      (
        <DashboardInputPanel
          inputsMgr={this.props.dashboard.notebook().inputs}
          onApply={runAll}
        />
      )
      : null;

    return (
        <div>
          {inputPanel}
          <div className='grid-stack dashboard-layout-view'>
          </div>
        </div>
    );
  },
});

module.exports = DashboardLayoutView;
