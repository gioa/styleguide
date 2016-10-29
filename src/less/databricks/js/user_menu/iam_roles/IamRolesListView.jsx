import $ from 'jquery';
import _ from 'lodash';
import React from 'react';

import { AddButton } from '../../ui_building_blocks/buttons/AddButton.jsx';
import { FilterInput } from '../../ui_building_blocks/tables/FilterInput.jsx';
import { Table, Column } from '../../ui_building_blocks/tables/ReactTable.jsx';
import {
  HeaderRenderers,
  CellRenderers } from '../../ui_building_blocks/tables/ReactTableUtils.jsx';
import { TruncatedList } from '../../ui_building_blocks/text/TruncatedList.jsx';

import { IamRolesUtils } from './IamRolesUtils.jsx';

// Sorting constants
// Should be sorted by ARN initially
const INITIAL_SORTED_COL = 1;

// This constant is comprised of:
//   = (sidebar width) + (page padding)
//   = (sidebar width) + 2 * (tab pane padding) + (right hand side margin)
//   = 76 + (2 * 8) + 6
//   = 98
const PADDING = 98;

// TODO(dli): remove this after we are done hooking together IAM roles
const NOOP = () => {};

export class IamRolesListView extends React.Component {
  constructor(props) {
    super(props);

    // Cell renderers
    this.nameCellRenderer = CellRenderers.getLinkCellRenderer(
      (row) => IamRolesUtils.getIamRoleUrl(row.arn),
      (row) => IamRolesUtils.parseIamRoleName(row.arn));
    this.arnCellRenderer = this.cellRendererBuilder(
      (row) => (
        <span
          className='hide-wrap'
          title={row.arn}
        >{row.arn}</span>)
    );
    this.accessCellRenderer = this.cellRendererBuilder(
      (row) => (
        <TruncatedList
          list={row.thoseWithAccess.groups.concat(row.thoseWithAccess.individuals)}
          className='access-cell'
        />)
    );
    this.actionsCellRenderer = this.cellRendererBuilder(
      CellRenderers.getActionsCellRenderer(
        {
          deleteFunc: this.props.deleteFunc,
        },
        'delete-btn',
      ),
      true
    );

    this.state = {
      // Sort by ARN by default
      sortedCol: INITIAL_SORTED_COL,
      // Width is initially set to a guess of how wide the content pane is because
      // the DOM element we want the width of doesn't exist yet. When it is available,
      // we update the width and set widthHasUpdated to true.
      width: $(window).width() - PADDING,
    };
  }

  cellRendererBuilder(innerRenderer, centered) {
    return CellRenderers.getClickableRowCell(NOOP, innerRenderer, centered);
  }

  componentDidMount() {
    _.debounce(
      () => this.setState({
        width: $('.react-tabs-panel')[0].clientWidth,
        widthHasUpdated: true,
      }));
  }

  getHeaderRenderer(sortFunc, colIdx) {
    return HeaderRenderers.getSortableRenderer(
      (dir) => {
        sortFunc(dir);
        this.setState({ sortedCol: colIdx });
      },
      this.state.sortedCol === colIdx,
      colIdx === INITIAL_SORTED_COL,
    );
  }

  /**
   * The name column is guaranteed to need less space than the ARN column (because
   * the ARN contains the name) and the access column can conceivably be very long
   * because it is a list of names, so make the later two columns twice as wide as
   * the name column. Give the action column the recommended width stated in
   * ReactTableUtils, 90px.
   */
  getColumnWidths() {
    // Using recommended actions column width from ReactTableUtils
    const actionColWidth = 90;
    // These widths should all be whole numbers to prevent some flaky rendering issues
    // with the table. We round down since these only constrain the wider columns,
    // so invariantly, name.width >= arn.width / 2.
    const widthUnit = Math.floor((this.state.width - actionColWidth) / 5);
    const doubleWidth = widthUnit * 2;
    return {
      name: this.state.width - (doubleWidth * 2) - actionColWidth,
      arn: doubleWidth,
      access: doubleWidth,
      actions: actionColWidth,
    };
  }

  render() {
    const colWidths = this.getColumnWidths();
    return (
      <div className='row-fluid'>
        <div className='table-preamble'>
          <AddButton
            href='#setting/accounts/iamRoles/new'
            label='IAM Role'
          />
          <FilterInput onChange={this.props.filterFunc} />
        </div>
        <Table
          ref='table'
          rows={this.props.rows}
          width={this.state.width}
        >
          <Column
            label='Name'
            width={colWidths.name}
            cellRenderer={this.nameCellRenderer}
            headerRenderer={this.getHeaderRenderer(this.props.nameSortFunc, 0)}
          />
          <Column
            label='Instance Profile ARN'
            width={colWidths.arn}
            cellRenderer={this.arnCellRenderer}
            headerRenderer={this.getHeaderRenderer(this.props.arnSortFunc, 1)}
          />
          <Column
            label='Who has Access'
            width={colWidths.access}
            cellRenderer={this.accessCellRenderer}
            headerRenderer={this.getHeaderRenderer(this.props.accessSortFunc, 2)}
          />
          <Column
            label='Actions'
            width={colWidths.actions}
            cellRenderer={this.actionsCellRenderer}
            headerRenderer={HeaderRenderers.centeredUnsortableRenderer}
          />
        </Table>
      </div>
    );
  }
}

IamRolesListView.propTypes = {
  rows: React.PropTypes.array.isRequired,
  nameSortFunc: React.PropTypes.func.isRequired,
  arnSortFunc: React.PropTypes.func.isRequired,
  accessSortFunc: React.PropTypes.func.isRequired,
  deleteFunc: React.PropTypes.func.isRequired,
  filterFunc: React.PropTypes.func.isRequired,
};
