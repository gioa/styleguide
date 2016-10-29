import React from 'react';

import { AwsTagListViewConstants } from './AwsTagListViewConstants';
import { ClusterTagsConstants, ClusterTagsFallbackConstants } from './ClusterTagsConstants';

import { Table, Column } from '../../ui_building_blocks/tables/ReactTable.jsx';
import {
  HeaderRenderers,
  CellRenderers } from '../../ui_building_blocks/tables/ReactTableUtils.jsx';
import { TableRowAdder } from '../../ui_building_blocks/tables/TableRowAdder.jsx';

// Fake column id to handle the case where none of the columns are sorted
const UNSORTED = -1;

const NOOP = () => {};

export class EditableAwsTagListView extends React.Component {
  constructor(props) {
    super(props);

    // es6 binds
    this.rowGetter = this.rowGetter.bind(this);
    this.renderKeyTooltipText = this.renderKeyTooltipText.bind(this);
    this.renderValueTooltipText = this.renderValueTooltipText.bind(this);

    // Initial state
    this.state = {
      sortedCol: UNSORTED,
    };

    // The maximum number of AWS tags allowed
    const maxCustomTags = (window.settings && window.settings.maxCustomTags) ||
      ClusterTagsFallbackConstants.maxCustomTags;
    const numReservedTags = ClusterTagsConstants.defaultTagIds.length;
    this.MAX_TAGS =
      this.props.enableUserVisibleDefaultTags ? maxCustomTags + numReservedTags : maxCustomTags;
  }

  getHeaderRenderer(sortFunc, colIdx) {
    return HeaderRenderers.getSortableRenderer(
      // sortFunc
      (dir) => {
        sortFunc(dir);
        this.setState({ sortedCol: colIdx });
      },
      // isSorted
      this.state.sortedCol === colIdx,
      // initiallySorted
      false,
      // className
      'header-cell extra-padded-header-cell'
    );
  }

  rowGetter(rowIdx) {
    const key = this.props.rowOrder[rowIdx];
    return [this.props.rows[key]];
  }

  renderKeyTooltipText() {
    return (
      <div>
        Keys must:
        <ul>
          <li>Contain {this.props.minKeyLength}-{this.props.maxKeyLength} characters</li>
          <li>{AwsTagListViewConstants.ALLOWABLE_CHARS_MSG}</li>
          <li>{AwsTagListViewConstants.NO_AWS_PREFIX_MSG}</li>
          <li>{AwsTagListViewConstants.NO_KEY_DUPLICATE_MSG}</li>
        </ul>
      </div>
    );
  }

  renderValueTooltipText() {
    return (
      <div>
        Values must:
        <ul>
          <li>Contain {this.props.minValueLength}-{this.props.maxValueLength} characters</li>
          <li>{AwsTagListViewConstants.ALLOWABLE_CHARS_MSG}</li>
          <li>{AwsTagListViewConstants.NO_AWS_PREFIX_MSG}</li>
        </ul>
      </div>
    );
  }

  getActionsCellRenderer() {
    return (row) => {
      if (!row.isEditable) {
        return null;
      }

      const innerActionsCellRenderer = CellRenderers.getActionsCellRenderer({
        deleteFunc: this.props.deleteFunc,
      }, 'delete-btn');
      return (
        <center>
          {innerActionsCellRenderer(row)}
        </center>
      );
    };
  }

  getKeyCellRenderer() {
    return (row) => {
      if (!row.isEditable) {
        return <span className='uneditable-aws-tag'>{row.key}</span>;
      }

      const innerCellRenderer = CellRenderers.getTextInputCellRenderer(
        (cellRow) => cellRow.key, // valueGetter
        (cellRow) => !cellRow.keyInvalid, // validInputGetter
        {
          onInput: this.props.keyOnChangeHandler,
          onBlur: this.props.keyOnBlurHandler,
          onKeyDown: this.props.keyKeyDownHandler,
        }
      );
      const moreProps = {
        attachToBody: true,
        toggleOnHover: false,
        ref: (ref) => this.keyCellRendererTooltip = ref,
      };
      return CellRenderers.getTooltipCellRenderer(
        innerCellRenderer,
        this.renderKeyTooltipText,
        moreProps
      )(row);
    };
  }

  getValueCellRenderer() {
    return (row) => {
      if (!row.isEditable) {
        return <span className='uneditable-aws-tag'>{row.value}</span>;
      }

      const innerCellRenderer = CellRenderers.getTextInputCellRenderer(
        (cellRow) => cellRow.value, // valueGetter
        (cellRow) => !cellRow.valueInvalid, // validInputGetter
        {
          onInput: this.props.valueOnChangeHandler,
          onBlur: this.props.valueOnBlurHandler,
          onKeyDown: this.props.valueKeyDownHandler,
        }
      );
      const moreProps = {
        attachToBody: true,
        toggleOnHover: false,
        ref: (ref) => this.valueCellRendererTooltip = ref,
      };
      return CellRenderers.getTooltipCellRenderer(
        innerCellRenderer,
        this.renderValueTooltipText,
        moreProps
      )(row);
    };
  }

  showKeyTooltip() {
    this.keyCellRendererTooltip.showTooltip();
  }

  hideKeyTooltip() {
    this.keyCellRendererTooltip.hideTooltip();
  }

  showValueTooltip() {
    this.valueCellRendererTooltip.showTooltip();
  }

  hideValueTooltip() {
    this.valueCellRendererTooltip.hideTooltip();
  }

  render() {
    const tableWidth = AwsTagListViewConstants.KEY_COL_WIDTH
                     + AwsTagListViewConstants.VALUE_COL_WIDTH
                     + AwsTagListViewConstants.ACTIONS_COL_WIDTH;
    const addTagHeader = (
      <div className='cluster-create-label'>
          Add Tag
      </div>
    );
    const reachedMaxTags = this.props.rowOrder.length === this.MAX_TAGS;
    return (
      <div className='aws-tags-list'>
        <div className='reg-font-label'>
          The tags below are automatically added to clusters for Amazon tracking purposes.{' '}
          <a
            href='http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/Using_Tags.html'
            target='blank'
            rel='noopener noreferrer'
          >
            Learn more
          </a>
        </div>
        <div className='cluster-create-label'>
          Tags
        </div>
        <Table
          ref='table'
          rowGetter={this.rowGetter}
          rowsCount={this.props.rowOrder.length}
          width={tableWidth}
          rowHeight={36}
        >
          <Column
            label='Key'
            width={AwsTagListViewConstants.KEY_COL_WIDTH}
            cellRenderer={this.getKeyCellRenderer()}
            headerRenderer={this.getHeaderRenderer(this.props.keySortFunc, 0)}
          />
          <Column
            label='Value'
            width={AwsTagListViewConstants.VALUE_COL_WIDTH}
            cellRenderer={this.getValueCellRenderer()}
            headerRenderer={this.getHeaderRenderer(this.props.valueSortFunc, 1)}
          />
          <Column
            label='Actions'
            width={AwsTagListViewConstants.ACTIONS_COL_WIDTH}
            cellRenderer={this.getActionsCellRenderer()}
            headerRenderer={NOOP}
          />
        </Table>
        <TableRowAdder
          header={addTagHeader}
          onAddValidRow={this.props.addTagFunc}
          inputPropertiesList={[
            {
              id: 'key',
              key: 'key',
              validator: this.props.keyInputValidator,
              tooltipTextRenderer: this.renderKeyTooltipText,
              invalidMsg: 'Invalid key',
              trimTrailingLeadingWhitespace: true,
            },
            {
              id: 'value',
              key: 'value',
              validator: this.props.valueInputValidator,
              tooltipTextRenderer: this.renderValueTooltipText,
              invalidMsg: 'Invalid value',
              trimTrailingLeadingWhitespace: true,
            },
          ]}
          disabled={reachedMaxTags}
        />
        <span className='adder-row-meta-message'>
          {reachedMaxTags ? AwsTagListViewConstants.REACHED_MAX_TAGS_TEXT : null}
        </span>
      </div>
    );
  }
}

EditableAwsTagListView.propTypes = {
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
  addTagFunc: React.PropTypes.func.isRequired,
  deleteFunc: React.PropTypes.func.isRequired,
  keyInputValidator: React.PropTypes.func.isRequired,
  keyOnChangeHandler: React.PropTypes.func.isRequired,
  keyOnBlurHandler: React.PropTypes.func.isRequired,
  keyKeyDownHandler: React.PropTypes.func.isRequired,
  valueKeyDownHandler: React.PropTypes.func.isRequired,
  keySortFunc: React.PropTypes.func.isRequired,
  valueInputValidator: React.PropTypes.func.isRequired,
  valueOnChangeHandler: React.PropTypes.func.isRequired,
  valueOnBlurHandler: React.PropTypes.func.isRequired,
  valueSortFunc: React.PropTypes.func.isRequired,
  minKeyLength: React.PropTypes.number.isRequired,
  maxKeyLength: React.PropTypes.number.isRequired,
  minValueLength: React.PropTypes.number.isRequired,
  maxValueLength: React.PropTypes.number.isRequired,
  enableUserVisibleDefaultTags: React.PropTypes.bool,
};
