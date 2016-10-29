/**
 * This component is deprecated. For any new tables, we should be using ReactTable's
 * Table and Column components. See ClusterDetailsLibrariesList and ClusterDetailsLibrariesListView
 * for an example of usage.
 */

import React from 'react';
import ClassNames from 'classnames';

/**
 * A Table Header that for columns that support sorting. Common use cases would be to sort
 * clusters by name. Currently used for sorting in Package Browsers (sorting Spark and Maven
 * packages). Can be in three states: None, Sorted DESC, Sorted ASC. Only one of sortedDesc, and
 * sortedAsc should be true at any given moment. They can be false at the same time.
 *
 * @param{string} title The title to display for the header.
 * @param{string} extraClasses Extra classes like the width of the column, e.g. 'span3'.
 * @param{string} key The key prop for the th element.
 * @param{bool} sortedDesc Whether the column is sorted in descending order.
 * @param{bool} sortedAsc Whether the column is sorted in ascending order.
 * @param{function} onClick A callback function for th on click event.
 */
function SortableTableHeader({ title, extraClasses, key, sortedDesc, sortedAsc, onClick }) {
  const classes = ClassNames({
    'fa fa-caret-down fa-fw': sortedDesc,
    'fa fa-caret-up fa-fw': sortedAsc,
  });

  const className = 'sortable-header ' + extraClasses;

  return (
    <th className={className} key={key} onClick={onClick}>
      {title}
      <i className={classes}></i>
    </th>
  );
}

SortableTableHeader.propTypes = {
  title: React.PropTypes.string.isRequired,
  extraClasses: React.PropTypes.string.isRequired,
  sortedDesc: React.PropTypes.bool.isRequired,
  sortedAsc: React.PropTypes.bool.isRequired,
  onClick: React.PropTypes.func,
  key: React.PropTypes.string,
};

module.exports = SortableTableHeader;
