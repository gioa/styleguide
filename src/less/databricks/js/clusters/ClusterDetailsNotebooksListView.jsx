/* eslint consistent-return: 0 */

import $ from 'jquery';
import React from 'react';

import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';
import ReactDialogBox from '../ui_building_blocks/dialogs/ReactDialogBox.jsx';
import { Table, Column } from '../ui_building_blocks/tables/ReactTable.jsx';
import { HeaderRenderers, CellRenderers } from '../ui_building_blocks/tables/ReactTableUtils.jsx';

import { TimingUtils } from '../js_polyfill/TimingUtils';

const UNSORTED = -1;
const CHECKBOX = 0;
const NAME = 1;
const STATUS = 2;
const LAST_COMMAND = 3;
const LOCATION = 4;
// This corresponds approximately to the width of the sidebar; it's used for setting the width of
// the table upon initialization, when the client width may not yet be available.
const PADDING = 92;
const CHECKBOX_COLUMN_WIDTH = 28;

export class ClusterDetailsNotebooksListView extends React.Component {
  constructor(props) {
    super(props);

    this.widthSuccessFunction = this.widthSuccessFunction.bind(this);
    this.onClick = this.onClick.bind(this);
    this.showDetachErrorDialog = this.showDetachErrorDialog.bind(this);

    this.state = {
      sortedCol: UNSORTED,
      width: Math.min(0, $(window).width() - PADDING),
      widthHasBeenSet: false,
    };
  }

  componentWillMount() {
    this.setWidth();
  }

  getStatusCellRenderer() {
    return function statusCellRenderer(row) {
      if (row) {
        const statusIcon = (row[STATUS] === 'Running' ?
          <i className='fa fa-circle status-icon icon-green' /> :
          <i className='fa fa-circle status-icon icon-gray' />);
        return <span className='cluster-state-icon-cell'>{statusIcon} {row[STATUS]}</span>;
      }
    };
  }

  getCommandCellRenderer() {
    return (row) => {
      if (row) {
        const timeString = row[LAST_COMMAND].time === null ? 'Never' :
          new Date(row[LAST_COMMAND].time).toString();
        return (<div className='lastCommand'>
          {timeString}
          {' '}
          <br />
          <span className='user'>by {row[LAST_COMMAND].user}</span>
        </div>);
      }
    };
  }

  getHeaderRenderer(sortFunc, colIdx) {
    return HeaderRenderers.getSortableRenderer(
      (dir) => {
        sortFunc(dir, colIdx);
        this.setState({ sortedCol: colIdx });
      },
      this.state.sortedCol === colIdx
    );
  }

  isNameSorted() {
    return this.state.sortedCol === NAME;
  }

  widthSuccessFunction() {
    this.setState({ width: $('.react-tabs-panel')[0].clientWidth, widthHasBeenSet: true });
  }

  // Used to set the width of the table once the client width is available.
  setWidth() {
    if (!this.state.widthHasBeenSet) {
      TimingUtils.retryUntil({
        condition: () => $('.react-tabs-panel').length > 0,
        interval: 10,
        maxAttempts: 100,
        success: this.widthSuccessFunction,
      });
    }
  }

  notebooksSelected() {
    let i = 0;
    while (i < this.props.rows.length) {
      if (this.props.rows[i][0].checkboxChecked) {
        return true;
      }
      i++;
    }
    return false;
  }

  getButton() {
    if (this.notebooksSelected()) {
      const icon = this.props.detaching ? 'fa-spinner fa-spin' : 'fa-chain-broken';
      return (
        <button
          className='btn btn-default grey btn-detach-notebooks'
          onClick={this.onClick}
          disabled={this.props.detaching}
        >
          <i id='detach-notebooks' className={'fa ' + icon + ' fa-button-icon'}> </i>
          {'Detach'}
        </button>);
    }
    const customPosition = { contentLeft: '0px', width: '180px' };
    return (
      // don't set min width on this tooltip because it's small
      <Tooltip text='Select notebook to detach' customPosition={customPosition} setMinWidth={false}>
        <button
          className='btn btn-default grey btn-detach-notebooks'
          disabled={true}
          onClick={this.onClick}
        >
          <i id='detach-notebooks' className={'fa fa-chain-broken fa-button-icon'}> </i>
          {'Detach'}
        </button>
      </Tooltip>
    );
  }

  onClick() {
    const msg = 'Are you sure you want to detach all selected notebooks? ' +
      'This will clear computed variable values from all notebooks.';
    ReactDialogBox.confirm({
      message: msg,
      confirmButton: 'Confirm and Detach',
      confirm: this.props.detachNotebooks,
    });
  }

  showDetachErrorDialog() {
    ReactDialogBox.confirm({
      message: 'Oops! There was an error detaching notebooks. Please try again.',
      confirmButton: 'OK',
      confirm: this.props.clearError,
    });
  }

  render() {
    const evenColumnWidth = (this.state.width - CHECKBOX_COLUMN_WIDTH) / 4;
    return (
      <div>
        <div className='table-preamble'>
          {this.getButton()}
        </div>
        <Table
          ref='table'
          rows={this.props.rows}
          width={this.state.width}
          rowHeight={50}
        >
          <Column
            label={'Checkbox'}
            width={CHECKBOX_COLUMN_WIDTH}
            cellRenderer={CellRenderers.getCheckboxCellRenderer(
              this.props.onCheckboxClick,
              (row) => row[CHECKBOX].checkboxChecked,
              (row) => (this.props.detaching || !row[CHECKBOX].checkboxEnabled),
              'checkbox-for-table-column body-checkbox')}
            headerRenderer={HeaderRenderers.getCheckboxHeaderRenderer(
              this.props.onHeaderCheckboxClick,
              'checkbox-for-table-column header-checkbox')}
            headerClassName='header-cell checkbox-header-cell'
          />
          <Column
            label={'Name'}
            width={evenColumnWidth}
            cellRenderer={CellRenderers.getLinkCellRenderer(
              (row) => this.props.nameLinkPrefix + row[NAME].id, (row) => row[NAME].name)}
            headerRenderer={this.getHeaderRenderer(this.props.sortFunc, NAME)}
            headerClassName='header-cell name-header-cell'
          />
          <Column
            label={'Status'}
            width={evenColumnWidth}
            cellRenderer={this.getStatusCellRenderer()}
            headerRenderer={this.getHeaderRenderer(this.props.sortFunc, STATUS)}
            headerClassName='header-cell notebook-status-header-cell'
          />
          <Column
            label={'Last Command Run'}
            width={evenColumnWidth}
            cellRenderer={this.getCommandCellRenderer()}
            headerRenderer={this.getHeaderRenderer(this.props.sortFunc, LAST_COMMAND)}
            headerClassName='header-cell command-header-cell'
          />
          <Column
            label={'Location'}
            width={evenColumnWidth}
            cellRenderer={CellRenderers.get2dArrayStringRenderer(LOCATION)}
            headerRenderer={this.getHeaderRenderer(this.props.sortFunc, LOCATION)}
            headerClassName='header-cell location-header-cell'
          />
        </Table>
      </div>
    );
  }
}

ClusterDetailsNotebooksListView.propTypes = {
  rows: React.PropTypes.array.isRequired,
  nameLinkPrefix: React.PropTypes.string.isRequired,
  sortFunc: React.PropTypes.func.isRequired,
  onHeaderCheckboxClick: React.PropTypes.func.isRequired,
  onCheckboxClick: React.PropTypes.func.isRequired,
  detachNotebooks: React.PropTypes.func.isRequired,
  detaching: React.PropTypes.bool.isRequired,
  clearError: React.PropTypes.func.isRequired,
};
