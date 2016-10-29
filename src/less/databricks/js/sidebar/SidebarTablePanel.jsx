/* eslint react/prefer-es6-class: 0, react/no-did-update-set-state: 0, react/no-is-mounted: 0 */

import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';
import ClassNames from 'classnames';
import React from 'react';
import ReactDOM from 'react-dom';

import CollectionDeltaReceiver from '../delta_receiver/CollectionDeltaReceiver';

import NavFunc from '../filetree/NavFunc.jsx';

import SidebarPanelElement from '../sidebar/SidebarPanelElement.jsx';
import { SidebarPanelFilter } from '../sidebar/SidebarPanelFilter.jsx';

import ReactDialogBox from '../ui_building_blocks/dialogs/ReactDialogBox.jsx';
import DropdownMenuView from '../ui_building_blocks/dropdowns/DropdownMenuView.jsx';

const WAITING_FOR_TABLES_LIST = 'Waiting for tables list...';
const DROPDOWN_MENU = 'dropdownMenu';

const SidebarTablePanel = React.createClass({

  propTypes: {
    tables: React.PropTypes.instanceOf(CollectionDeltaReceiver).isRequired,
    depth: React.PropTypes.number,
  },

  getDefaultProps() {
    return {
      depth: 1,
    };
  },

  getInitialState() {
    return {
      // menuShowing is null, or an object describing the dropdown menu currently showing. The
      // object contains fields "model", which is the table model associated with the dropdown, and
      // "position", which is the position that the dropdown was rendered at.
      menuShowing: null,
      filterQuery: '',
      // whether or not the dropdown menu is rendered above the element
      above: false,
      // height of the dropdown element
      dropdownHeight: 0,
    };
  },

  showMenu(model) {
    const position = this.refs[model.get('name')].getMenuOffset();
    this.setState({
      menuShowing: {
        model: model,
        position: position,
      },
    });
  },

  hideMenu() {
    this.setState({
      menuShowing: null,
      above: false,
      dropdownHeight: 0,
    });
  },

  isShowingMenuFor(elem) {
    return this.state.menuShowing && this.state.menuShowing.model === elem;
  },

  toggleMenu(elem) {
    if (this.isShowingMenuFor(elem)) {
      this.hideMenu();
    } else {
      this.showMenu(elem);
    }
  },

  componentDidUpdate() {
    if (this.state.menuShowing && !this.state.above) {
      const height = this._getHeight();

      // dropdown menu has gone off screen
      if (this.state.menuShowing.position.top + (height + 29) > window.innerHeight) {
        // DO NOT REPLICATE THIS! setState should not be used in componentDidUpdate
        // since it may cause infinite recursion. In this case, the we set above: true
        // which causes the first if statement in this function to be false, so it's safe.
        // If you are absolutely sure you need to use setState in componentDidUpdate,
        // please ask Denise or Austin first!
        this.setState({
          above: true,
          dropdownHeight: height,
        });
      }
    }
  },

  componentDidMount() {
    const throttledForceUpdate = _.throttle(() => {
      if (this.isMounted()) {
        this.forceUpdate();
      }
    }, 1000);
    this.props.tables.on('reset add remove change', throttledForceUpdate, this);
    this._refresh();
  },

  componentWillUnmount() {
    this.props.tables.off(null, null, this);
  },

  _refresh() {
    $.ajax('/tables/refresh', {
      error: (xhr, status, error) => {
        console.warn('Error refreshing tables: ' + (error || status));
      },
    });
  },

  _getHeight() {
    return $(ReactDOM.findDOMNode(this.refs[DROPDOWN_MENU])).height();
  },

  deleteTable(tableModel) {
    const callback = function callback() {
      tableModel.set({ icon: 'spinner fa fa-spin' });
      window.conn.wsClient.sendRPC('query', {
        data: {
          bindings: {},
          language: 'sql',
          query: 'drop table `' + tableModel.get('name') + '`',
        },
      });
      if (Backbone.history.getFragment() === tableModel.get('viewRoute')) {
        window.router.navigate('', { trigger: true });
      }
    };
    NavFunc.deleteNode(tableModel.get('id'), tableModel, 0, callback);
  },

  renderErrorElement(tablesError) {
    if (tablesError !== null) {
      // PROD-5907: display a nicer error message if there are no running clusters
      let message = tablesError;
      const url = '#setting/clusters';
      if (message === 'No default cluster set') {
        const clusters = window.clusterList;
        if (clusters.attachableClusters().length === 0) {
          message = 'You need to create a cluster to access tables';
        } else {
          message = 'Set a default cluster to access tables';
        }
      }
      const icon = message === WAITING_FOR_TABLES_LIST ?
        'spinner fa fa-spin' : 'exclamation-circle';
      return (
        <SidebarPanelElement
          id={"--table-error"}
          name={message}
          url={url}
          display={"multiline"}
          icon={icon}
        />
      );
    }
    return null;
  },

  confirmAction(tableName, action) {
    // Because the underlying model may have been replaced while we were busy
    // clicking OK, we need to try to find the updated model for this table.
    const curModel = this.props.tables.models.filter((m) => m.get('name') === tableName);
    curModel.forEach((model) => model.save({ 'action': action }, { patch: true }));
  },

  onClickMenuItem(tableName, prompt, confirmText, action, evt) {
    if (evt) {
      evt.preventDefault();
    }
    ReactDialogBox.confirm({
      message: prompt,
      confirmButton: confirmText,
      confirm: this.confirmAction.bind(this, tableName, action),
    });
  },

  addCacheMenuItem(text, tableName, action) {
    const prompt = 'Are you sure you want to ' + text.toLowerCase() + ' ' + tableName + '?';
    const confirmText = 'Confirm and ' + text;
    const boundOnClick = this.onClickMenuItem.bind(this, tableName, prompt, confirmText, action);
    return (
        <a data-name={text}
          onClick={boundOnClick}
        >
          {text}
        </a>);
  },

  getMenuItems(tableModel) {
    // Table specific menu options
    const tableName = tableModel.get('name');
    const menuItems = [];

    if (tableModel.get('hasError') === true) {
      const msg = 'Error message';
      const errOnClick = this.onClickMenuItem.bind(
        this, msg, tableModel.get('comments'), 'OK', 'cancel');
      menuItems.push(
        <a data-name={msg}
          onClick={errOnClick}
        >
          {msg}
        </a>);
    }

    // Do not show cache/uncache menu if the table state is in progress.
    if (tableModel.get('progress') !== true) {
      if (tableModel.get('fractionCached') >= 0.995) {
        menuItems.push(this.addCacheMenuItem('Uncache', tableName, 'uncache'));
      } else if (tableModel.get('fractionCached') > 0) {
        menuItems.push(this.addCacheMenuItem('Re-cache', tableName, 'cache'));
        menuItems.push(this.addCacheMenuItem('Uncache', tableName, 'uncache'));
      } else if (tableModel.get('canCache') === true) {
        menuItems.push(this.addCacheMenuItem('Cache', tableName, 'cache'));
      }
    } else {
      const text = 'Cancel';
      const prompt = 'Are you sure you want to cancel caching ' + tableName + '?';
      const confirmText = 'Confirm';
      const action = 'cancel';
      const cancelOnClick = this.onClickMenuItem.bind(
        this, tableName, prompt, confirmText, action);
      menuItems.push(
        <a
          data-name={text}
          className={"sidebar-dropdown-link"}
          onClick={cancelOnClick}
        >
          {text}
        </a>
      );
    }
    const deleteOnClick = this.deleteTable.bind(null, tableModel);
    menuItems.push(
      <a
        data-name='Delete'
        className={"sidebar-dropdown-link"}
        onClick={deleteOnClick}
      >Delete
      </a>
    );
    return menuItems;
  },

  dropdownPosition(anchorPosition, above, dropdownHeight) {
    // The dropdown is positioned relative to the top-left corner of the menu arrow. We shift
    // so that the arrows align.
    return {
      position: 'fixed',
      top: above ? anchorPosition.top - (dropdownHeight + 13) : anchorPosition.top + 21,
      left: anchorPosition.left - 11,
    };
  },

  renderDropdown(model, anchorPosition, above, dropdownHeight) {
    const tableName = model.get('name');
    const getTheseMenuItems = this.getMenuItems.bind(this, model);
    const classes = {
      'filebrowser-context-menu': true,
      'table-dropdown': true,
      'above': above,
    };
    classes[`table-dropdown-${tableName}`] = true;
    return (
      <ul className={"table-panel-dropdown"}
        style={this.dropdownPosition(anchorPosition, above, dropdownHeight)}
      >
        <DropdownMenuView
          ref={DROPDOWN_MENU}
          getItems={getTheseMenuItems}
          classes={ClassNames(classes).split(' ')}
          outsideClickHandler={this.hideMenu}
          ignoreClickClasses={['sidebar-dropdown']}
        />
      </ul>
    );
  },

  getCachedPercent(tableAttr) {
    if (tableAttr.fractionCached && tableAttr.fractionCached > 0) {
      return Math.round(tableAttr.fractionCached * 100);
    }
    return 0;
  },

  onFilterChange(filterQuery) {
    this.setState({ filterQuery: filterQuery });
  },

  getFilteredTables() {
    return this.props.tables.filter((table) =>
      table.get('name').includes(this.state.filterQuery));
  },

  render() {
    const tableElements = [];
    tableElements.push(
      <SidebarPanelElement
        key='--create-table'
        id='--create-table'
        url='#create/table'
        name='Create Table'
        display='top-link'
        icon='plus'
      />);
    tableElements.push(this.renderErrorElement(window.tablesError));

    if (this.props.tables.length > 0) {
      tableElements.push(
        <SidebarPanelFilter onFilterChange={this.onFilterChange}
          placeholder='Search Tables'
        />);
    }

    this.getFilteredTables().forEach((elem) => {
      const tableAttr = elem.attributes;
      let nameHTML = null;
      const domAttributes = {};
      const cachedPercent = this.getCachedPercent(tableAttr);
      if (cachedPercent > 0) {
        let annotation = '';
        let cacheState = '';
        if (cachedPercent >= 100) {
          // The table is fully cached, due to replication could be greater than 100.
          annotation = String.fromCharCode(0x2713);
          cacheState = 'cached';
        } else if (cachedPercent > 0 || tableAttr.progress === true) {
          // If we are currently attempting to cache (progress = true), show in-progress
          annotation = cachedPercent + '%';
          cacheState = 'in-progress';
        }
        nameHTML = (
            <span>
              <span className='table-name'>{tableAttr.name}</span>
              <span className='table-cache'>{annotation}</span>
            </span>);
        domAttributes['data-cache-state'] = cacheState;
      }

      const boundToggleMenu = this.toggleMenu.bind(this, elem);
      tableElements.push(
        <SidebarPanelElement
          key={tableAttr.name}
          id={tableAttr.id}
          name={tableAttr.name}
          nameHTML={nameHTML}
          url={'#' + tableAttr.viewRoute}
          icon={"table"}
          hasMenu
          ref={tableAttr.name}
          onMenuClicked={boundToggleMenu}
          domAttributes={domAttributes}
        />);
    });

    return (
        <div className={'sidebar-panel filetree sidebar-panel-' + this.props.depth}>
          <div className='ft-panel ft-tables-panel' data-panel='Tables'>
            <ul>
              {tableElements}
            </ul>
          </div>
          {this.state.menuShowing ?
            this.renderDropdown(this.state.menuShowing.model, this.state.menuShowing.position,
              this.state.above, this.state.dropdownHeight) :
            null}
        </div>
    );
  },
});

module.exports = SidebarTablePanel;
