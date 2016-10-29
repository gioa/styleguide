import React from 'react';

import { AwsTagListViewConstants } from './AwsTagListViewConstants';

import { Table, Column } from '../../ui_building_blocks/tables/ReactTable.jsx';
import { HeaderRenderers } from '../../ui_building_blocks/tables/ReactTableUtils.jsx';

// Fake column id to handle the case where none of the columns are sorted
const UNSORTED = -1;

export class UneditableAwsTagListView extends React.Component {
  constructor(props) {
    super(props);

    // es6 binds
    this.rowGetter = this.rowGetter.bind(this);

    // Initial state
    this.state = {
      sortedCol: UNSORTED,
    };

    // Cell renderers
    this.keyCellRenderer = (row) => <span>{row.key}</span>;
    this.valueCellRenderer = (row) => <span>{row.value}</span>;
  }

  getHeaderRenderer(sortFunc, colIdx) {
    return HeaderRenderers.getSortableRenderer(
      // sortFunc
      (dir) => {
        sortFunc(dir);
        this.setState({ sortedCol: colIdx });
      },
      // isSorted
      this.state.sortedCol === colIdx
    );
  }

  rowGetter(rowIdx) {
    const key = this.props.rowOrder[rowIdx];
    return [this.props.rows[key]];
  }

  render() {
    let renderedTable = <div>None</div>;
    if (this.props.rowOrder.length > 0) {
      const tableWidth = AwsTagListViewConstants.KEY_COL_WIDTH
                       + AwsTagListViewConstants.VALUE_COL_WIDTH;
      renderedTable = (
        <Table
          rowGetter={this.rowGetter}
          rowsCount={this.props.rowOrder.length}
          width={tableWidth}
        >
          <Column
            label='Key'
            width={AwsTagListViewConstants.KEY_COL_WIDTH}
            cellRenderer={this.keyCellRenderer}
            headerRenderer={this.getHeaderRenderer(this.props.keySortFunc, 0)}
            headerClassName='bordered-header-cell'
            cellClassName='bordered-body-cell'
          />
          <Column
            label='Value'
            width={AwsTagListViewConstants.VALUE_COL_WIDTH}
            cellRenderer={this.valueCellRenderer}
            headerRenderer={this.getHeaderRenderer(this.props.valueSortFunc, 1)}
          />
        </Table>
      );
    }

    return (
      <div>
        <div className='cluster-create-label'>
          Tags
        </div>
        {renderedTable}
      </div>
    );
  }
}

UneditableAwsTagListView.propTypes = {
  /**
   * Expected rows should look like:
   * {
   *   someId: {
   *     key: str
   *     value: str
   *     id: someId
   *   },
   * }
   * Critically, see that someId appears twice, both (1) mapping to the row object
   * and (2) available on the row object, which all the renderers and handlers receive.
   */
  rows: React.PropTypes.object.isRequired,
  rowOrder: React.PropTypes.arrayOf(React.PropTypes.number).isRequired,
  keySortFunc: React.PropTypes.func.isRequired,
  valueSortFunc: React.PropTypes.func.isRequired,
};
