import React from 'react';

export function TruncatedList(props) {
  if (props.list.length <= props.untruncatedMax) {
    return (
      <span className={props.className}>
        {props.list.join(', ')}
      </span>
    );
  }
  return (
    <span className={props.className}>
      {props.list.slice(0, props.truncatedMax).join(', ')}
      {', and '}
      {props.list.length - props.truncatedMax}
      {' more'}
    </span>
  );
}

/**
 * list: a list of strings to truncate
 *   e.g. ['a', 'b', 'c', 'd'] => 'a, b, c, d'
 *   e.g. ['a', 'b', 'c', 'd', 'e', 'f'] => 'a, b, c, and 3 more'
 * untruncatedMax: the maximum allowed elements a list can have without getting
 *   truncated.
 * truncatedMax: the maximum allowed visible elements in a truncated list.
 * className: class for the internal span
 */
TruncatedList.propTypes = {
  list: React.PropTypes.arrayOf(React.PropTypes.string).isRequired,
  untruncatedMax: React.PropTypes.number,
  truncatedMax: React.PropTypes.number,
  className: React.PropTypes.string,
};

TruncatedList.defaultProps = {
  untruncatedMax: 4,
  truncatedMax: 3,
  className: '',
};
