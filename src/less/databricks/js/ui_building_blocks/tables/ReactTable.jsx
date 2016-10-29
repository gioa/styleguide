import React from 'react';
import _ from 'lodash';

import FixedDataTable from 'fixed-data-table';

import { HeaderRenderers } from '../../ui_building_blocks/tables/ReactTableUtils.jsx';

const FDTTable = FixedDataTable.Table;
const FDTColumn = FixedDataTable.Column;

export class Table extends React.Component {
  buildProps() {
    let defaultProps = {
      ref: 'table',
      rowHeight: 26,
      headerHeight: 26,
      maxHeight: 50000,
      fixed: true,
    };
    if (this.props.rows) {
      _.assign(defaultProps, {
        rowGetter: (i) => [this.props.rows[i]],
        rowsCount: this.props.rows.length,
      });
    }
    if (this.props.isHeaderless) {
      defaultProps = _.assign(defaultProps, {
        headerHeight: 0,
      });
    }
    return _.assign(defaultProps, this.props);
  }

  render() {
    return (
      <div className={this.props.isHeaderless ? 'headerless-table' : undefined}>
        <FDTTable {...this.buildProps()}>
          {this.props.children}
        </FDTTable>
      </div>
    );
  }
}

Table.propTypes = {
  children: React.PropTypes.array.isRequired,
  rows: React.PropTypes.array,
  isHeaderless: React.PropTypes.bool,
};

/**
 * Column needs to extend FDTColumn because FDTTable has an invariant:
 * all its children need to be instances of FDTColumn. However, by extending
 * a specific component instead of React.Component, we cannot assign a ref
 * to an instance of Column.
 *    e.g. <Table><Column ref='col' /></Table>
 * While this code will still render, the 'col' ref will not actually exist on
 * the instance. As a workaround, we can access the wrapper Table with a ref,
 * and then access the Columns using tableRef.props.children.
 *
 * Note - this column never has its render() function called (this is specified
 * in the implementation of FixedDataTable.Column), keep this in mind if you are
 * trying to make a similar column component.
 */
export class Column extends FDTColumn {}

Column.defaultProps = {
  headerRenderer: HeaderRenderers.unsortableRenderer,
  headerClassName: 'header-cell',
  cellClassName: 'body-cell',
  dataKey: 0,
};

Column.propTypes = {
  headerRenderer: React.PropTypes.func,
  headerClassName: React.PropTypes.string,
  cellClassName: React.PropTypes.string,
  dataKey: React.PropTypes.number,
};
