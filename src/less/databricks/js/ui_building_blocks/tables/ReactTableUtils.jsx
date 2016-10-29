import $ from 'jquery';

import React from 'react';

import { SortableHeaderCellLink } from '../../ui_building_blocks/tables/SortableHeaderCellLink.jsx';
import { Tooltip } from '../../ui_building_blocks/Tooltip.jsx';

/**
 * A set of functions (and constructors for functions) to pass into a Column element
 * for the headerRenderer prop.
 */
export class HeaderRenderers {
  /**
   * This function gets passed directly into a Column element.
   * @param {string} the value of the label prop given to this instance of Column
   * @return {element} <span> representation of the label
   */
  static unsortableRenderer(label) {
    return <span>{label}</span>;
  }

  /**
   * This function gets passed directly into a Column element.
   * @param {string} the value of the label prop given to this instance of Column
   * @return {element} <span> representation of the label
   */
  static centeredUnsortableRenderer(label) {
    return <center>{label}</center>;
  }

  /**
   * @param {function} sortFunc: callback that sorts the table rows
   * @param {boolean} isSorted: whether the table's rows are sorted by the values in
   *   this column (true) or another column (false)
   * @param {boolean} initiallySorted: whether this column is sorted on the initial
   *   render. This field is optional and defaults to false.
   * @param {string} className: class for a tag
   * @return {function} header renderer function to pass as a prop to Column
   */
  static getSortableRenderer(sortFunc, isSorted, initiallySorted, className) {
    return (label) =>
      <SortableHeaderCellLink
        label={label}
        sortFunc={sortFunc}
        isSorted={isSorted}
        initiallySorted={initiallySorted}
        className={className}
      />;
  }

  /**
   * @param {function} toggleBodyCheckboxes: function to be called when the header checkbox is
   * clicked
   * @param {string} className: class name of the checkbox
   * @returns {function} header renderer function to pass as a prop to Column
   */
  static getCheckboxHeaderRenderer(toggleBodyCheckboxes, className = 'checkbox-for-table-column') {
    return () => (
      <span>
        <input
          className={className}
          type='checkbox'
          onClick={toggleBodyCheckboxes}
        />
      </span>);
  }
}

/**
 * A set of functions (and constructors for functions) to pass into a Column element
 * for the cellRenderer prop.
 */
export class CellRenderers {
  /**
   * Assumes table's rows are stored as a 2d Array structured as:
   *   rows[rowIdx][colIdx] = cellContent
   * @param {int} colIdx: the index of the column to retrieve
   * @return {function} cell renderer function to pass as a prop to Column
   */
  static get2dArrayStringRenderer(colIdx) {
    return (row) => {
      if (row) {
        return <span>{row[colIdx]}</span>;
      }
      return null;
    };
  }

  /**
   * Get a cell renderer for Actions columns. Creates a link icon for each of the action
   *    handler functions that are provided (e.g. deleteFunc).
   * Recommended width for column: 90px;
   * @param {Object<string, function>} a dictionary mapping to click handlers for each action
   *   deleteFunc: a function to delete whatever object the row represents
   * @param {string} btnClassName optional css classname apply to the a tag
   * @return {function} cell renderer function to pass as a prop to Column
   */
  static getActionsCellRenderer({ deleteFunc }, btnClassName) {
    return (row) => {
      if (!row) {
        return null;
      }
      if (!deleteFunc) {
        return null;
      }
      const boundDelete = deleteFunc.bind(this, row);
      return (
        <span className='actions-cell'>
          <a onClick={boundDelete} className={btnClassName}>
            <i className='fa fa-times'></i>
          </a>
          {' '}
        </span>
      );
    };
  }

  /**
   * Get a cell renderer that makes the cell's region of the row clickable.
   * @param {function} onClick: the function to be called, without arguments
   * @param {function} contentGetter: a cell renderer (takes a row, returns a component)
   * @param {boolean} centered: whether the content of the cell should be centered
   * @return {function} cell renderer function to pass as a prop to Column
   */
  static getClickableRowCell(onClick, contentGetter, centered) {
    const clickHandler = (e) => {
      if ($(e.target).hasClass('clickable-row')) {
        onClick();
      }
    };
    const className = 'clickable-row' + (centered ? ' content-centered' : '');
    return (row) =>
      <div
        className={className}
        onClick={clickHandler}
      >
        {contentGetter(row)}
      </div>;
  }

  /**
   * Returns a function to render cells with icons. iconGetter gets the icon,
   * textGetter gets the text.
   * @param iconGettter: function to get the icon
   * @param textGetter: function to get the text
   * @param classesGetter: function to get the extra classes if any
   * @return {function} cell renderer function to pass as a prop to Column
   */
  static getIconCellRenderer(iconGetter, textGetter, classesGetter) {
    return (row) => {
      const icon = iconGetter(row);
      const classNames = classesGetter ? classesGetter(row) : '';
      return (
        <span className={'inline-block' + classNames}>
          {icon ? <span className='cell-icon-left-of-text'>{icon}</span> : null}
          {textGetter(row)}
        </span>
      );
    };
  }

  /**
   * Returns a function to render cells with tooltips. cellRenderer gets the actual content
   * @param cellRenderer: function to get the content of the tooltip
   * @param textGetter: function to get the tooltip text
   * @param moreProps: any additional props for Tooltip
   * @return {function} cell renderer function to pass as a prop to Column
   */
  static getTooltipCellRenderer(cellRenderer, textGetter, moreProps = {}) {
    return (row) => (
      <div className='tooltip-cell'>
        <Tooltip text={textGetter(row)} {...moreProps}>{cellRenderer(row)}</Tooltip>
      </div>
    );
  }

  /**
   * Returns a function to render links. Wrapping in a div improves handling
   * of long text values (truncates instead of wrapping).
   * @param {function} hrefGetter: takes a row object and returns the link href
   * @param {function} textGetter: takes a row object and returns the link text
   * @param {function} disabledGetter: function to get whether to disable a link or not
   * @param {boolean} openInNewTab: whether the link should open in a new tab
   * @return {function} cell renderer function to pass as a prop to Column
   */
  static getLinkCellRenderer(
    hrefGetter,
    textGetter,
    disabledGetter,
    openInNewTab
  ) {
    return (row) => {
      if (!row) {
        return null;
      }
      const disabled = disabledGetter ? disabledGetter(row) : false;
      return (
        <div>
          <a
            href={hrefGetter(row)}
            disabled={disabled}
            target={openInNewTab ? '_blank' : undefined}
          >{textGetter(row)}</a>
        </div>
      );
    };
  }

  /**
   * @param {function} onClick: function to be called when the checkbox is clicked
   * @param {function} isChecked: function to get whether the checkbox should be checked
   * @param {function} isDisabled: function to get whether the checkbox should be disabled
   * @param {string} className: optional class for the checkbox input
   * @returns {function} cell renderer function to pass as a prop to Column
   */
  static getCheckboxCellRenderer(
    onClick,
    isChecked,
    isDisabled,
    className = 'checkbox-for-table-column'
  ) {
    return (row) =>
      <span>
        <input
          className={className}
          type='checkbox'
          checked={isChecked(row)}
          disabled={isDisabled(row)}
          onClick={() => onClick(row)}
        />
      </span>;
  }

  /**
   * @param {function} valueGetter: takes a row object and returns a string value
   * @param {function} validInputGetter: takes a row object and returns a boolean for validity
   * @param {object} eventProps: props that need data binding:
   *      onInput: (<event {object}>, <row {object}>) => {},
   *      onBlur: (<event {object}>, <row {object}>) => {},
   *      onKeyDown: (<event {object}>, <row {object}>) => {},
   * @param {object} moreProps: any additional props for <input>, e.g. { className: 'some-class' }
   * @return {function} cell renderer with editable text contents
   */
  static getTextInputCellRenderer(
    valueGetter,
    validInputGetter,
    eventProps = {},
    moreProps = {}
  ) {
    return (row) => {
      let className = moreProps.className ? moreProps.className : 'full-width-of-cell';
      const isValid = !validInputGetter || validInputGetter(row);
      className = isValid ? className : className + ' invalid';

      const boundEventProps = {};
      Object.keys(eventProps).forEach((eventKey) => {
        const eventFunc = eventProps[eventKey];
        boundEventProps[eventKey] = (e) => eventFunc(e, row);
      });
      return <input
        type='text'
        className={className}
        value={valueGetter(row)}
        {...boundEventProps}
        {...moreProps}
      />;
    };
  }
}

/**
 * A set of functions (and constructors for functions) for comparing objects when
 * sorting.
 */
export class CompareTos {
  /**
   * @param {function} valueGetter: function to extract the value to be sorted
   *   from a row
   * @param {int} dir: ascending or descending
   *   (from js/ui_building_blocks/tables/SortDirections.js)
   * @return {function} compareTo function to sort values in given direction
   */
  static getSimpleCompareTo(valueGetter, dir) {
    return function compareTo(a, b) {
      if (valueGetter(a) < valueGetter(b)) {
        return -1 * dir;
      } else if (valueGetter(a) > valueGetter(b)) {
        return 1 * dir;
      }
      return 0;
    };
  }

  /**
   * We have some tables where each row contains a list of names, including both
   *   names of groups and names of individuals. We always want to sort groups
   *   ahead of individuals, and within those groups, we want to sort alphabetically.
   * @param {function} groupsListGetter: function that takes a row object and
   *   returns a List<string> of the names of its groups. This list is expected to be
   *   sorted in alphabetical order. (e.g. ['All users'])
   * @param {function} individualsListGetter: function that takes a row object and
   *   returns a List<string> of the names of its individuals. This list is expected
   *   to be sorted in alphabetical order.  (e.g. ['Bob', 'Rob'])
   * @return {function} compareTo function to sort values in given direction
   */
  static getNameListCompareTo(groupsListGetter, individualsListGetter, dir) {
    const simpleCompareTo = CompareTos.getSimpleCompareTo((x) => x, dir);
    return function nameListCompareTo(a, b) {
      if (groupsListGetter(a).length > 0 && groupsListGetter(b).length === 0) {
        // a has groups and b does not have groups
        // Rank a ahead of b
        return -1 * dir;
      } else if (groupsListGetter(a).length === 0 && groupsListGetter(b).length > 0) {
        // a does not have groups and b has groups
        // Rank b ahead of a
        return 1 * dir;
      } else if (groupsListGetter(a).length > 0 && groupsListGetter(b).length > 0) {
        // a and b both have groups
        // Rank alphabetically by first (sorted) group name
        const groupsCompared = simpleCompareTo(groupsListGetter(a)[0], groupsListGetter(b)[0]);
        if (groupsCompared !== 0) {
          return groupsCompared;
        }
        // If the groups are equal, we want to sort by name instead.
        return simpleCompareTo(individualsListGetter(a)[0], individualsListGetter(b)[0]);
      } else if (individualsListGetter(a).length > 0 && individualsListGetter(b).length > 0) {
        // a and be both do not have groups and both have individuals
        // Rank alphabetically by first (sorted) individual name
        return simpleCompareTo(individualsListGetter(a)[0], individualsListGetter(b)[0]);
      } else if (individualsListGetter(a).length > 0) {
        // a has individuals and b has nothing
        // Rank a ahead of b
        return -1 * dir;
      } else if (individualsListGetter(b).length > 0) {
        // b has individuals and a has nothing
        // Rank b ahead of a
        return 1 * dir;
      }
      // both a and b have nothing, and thus are equal
      return 0;
    };
  }
}
