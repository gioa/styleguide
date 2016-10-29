import $ from 'jquery';
import React from 'react';

import IconsForType from '../ui_building_blocks/icons/IconsForType';
import { Table, Column } from '../ui_building_blocks/tables/ReactTable.jsx';
import { HeaderRenderers, CellRenderers } from '../ui_building_blocks/tables/ReactTableUtils.jsx';

import { TimingUtils } from '../js_polyfill/TimingUtils';

const UNSORTED = -1;
// This corresponds approximately to the width of the sidebar; it's used for setting the width of
// the table upon initialization, when the client width may not yet be available.
const PADDING = 92;

const ERROR_ICON = <i className={'fa fa-' + IconsForType.error} />;
const WARNING_ICON = <i className={'fa fa-' + IconsForType.warning} />;

export class ClusterDetailsLibrariesListView extends React.Component {
  constructor(props) {
    super(props);

    this.widthSuccessFunction = this.widthSuccessFunction.bind(this);

    this.state = {
      sortedCol: UNSORTED,
      width: Math.min(0, $(window).width() - PADDING),
      widthHasBeenSet: false,
    };
  }

  componentWillMount() {
    this.setWidth();
  }

  getHeaderRenderer(sortFunc, colIdx) {
    return HeaderRenderers.getSortableRenderer(
      (dir) => {
        sortFunc(dir);
        this.setState({ sortedCol: colIdx });
      },
      this.state.sortedCol === colIdx
    );
  }

  isNameSorted() {
    return this.state.sortedCol === 0;
  }

  shouldShowWarningIcon(clusterStatus) {
    return clusterStatus === 'unloading' || clusterStatus === 'deleted';
  }

  shouldShowErrorIcon(clusterStatus) {
    return clusterStatus === 'error';
  }

  widthSuccessCondition() {
    return $('.react-tabs-panel').length > 0;
  }

  widthSuccessFunction() {
    this.setState({ width: $('.react-tabs-panel')[0].clientWidth, widthHasBeenSet: true });
  }

  // Used to set the width of the table once the client width is available.
  setWidth() {
    if (!this.state.widthHasBeenSet) {
      TimingUtils.retryUntil({
        condition: this.widthSuccessCondition,
        interval: 10,
        maxAttempts: 100,
        success: this.widthSuccessFunction,
      });
    }
  }

  render() {
    const iconCellRenderer = CellRenderers.getIconCellRenderer(
      (row) => { // iconGetter
        const clusterStatus = row[1].clusterStatus;
        if (this.shouldShowWarningIcon(clusterStatus)) {
          return WARNING_ICON;
        }
        if (this.shouldShowErrorIcon(clusterStatus)) {
          return ERROR_ICON;
        }
        return null;
      },
      (row) => row[1].formattedStatus, // textGetter
      (row) => {
        const clusterStatus = row[1].clusterStatus;
        return this.shouldShowErrorIcon(clusterStatus) ? ' error' : '';
      }
    );
    return (
      <Table
        ref='table'
        rows={this.props.rows}
        width={this.state.width}
        rowHeight={50}
      >
        <Column
          label={'Name'}
          width={this.state.width / 4}
          cellRenderer={CellRenderers.getLinkCellRenderer(
            (row) => this.props.nameLinkPrefix + row[0].id,
            (row) => row[0].name,
            (row) => row[0].disabled)}
          headerRenderer={this.getHeaderRenderer(this.props.nameSortFunc, 0)}
          headerClassName='header-cell name-header-cell'
        />
        <Column
          label={'Status'}
          width={this.state.width / 4}
          cellRenderer={CellRenderers.getTooltipCellRenderer(
            iconCellRenderer, // cellRenderer
            (row) => row[1].errorMessage, // textGetter
            { // moreProps
              attachToBody: true,
              hoverDelayMillis: 0,
            }
          )}
          headerRenderer={this.getHeaderRenderer(this.props.statusSortFunc, 1)}
          headerClassName='header-cell library-status-header-cell'
        />
        <Column
          label={'Location'}
          width={this.state.width / 2}
          cellRenderer={CellRenderers.get2dArrayStringRenderer(2)}
          headerRenderer={this.getHeaderRenderer(this.props.pathSortFunc, 2)}
          headerClassName='header-cell location-header-cell'
        />
      </Table>
    );
  }
}

ClusterDetailsLibrariesListView.propTypes = {
  rows: React.PropTypes.array.isRequired,
  nameLinkPrefix: React.PropTypes.string.isRequired,
  nameSortFunc: React.PropTypes.func.isRequired,
  statusSortFunc: React.PropTypes.func.isRequired,
  pathSortFunc: React.PropTypes.func.isRequired,
};
