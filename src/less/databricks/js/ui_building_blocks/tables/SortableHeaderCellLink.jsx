import React from 'react';

import { SortDirections } from '../../ui_building_blocks/tables/SortDirections';
import { SortIcons } from '../../ui_building_blocks/tables/SortIcons.jsx';

export class SortableHeaderCellLink extends React.Component {
  constructor(props) {
    super(props);

    this.onClick = this.onClick.bind(this);

    this.state = {
      dir: props.initiallySorted ? SortDirections.ASC : SortDirections.DESC,
    };
  }

  onClick() {
    const newDir = SortDirections.flip(this.state.dir);
    this.props.sortFunc(newDir);
    this.setState({ dir: newDir });
  }

  getDirIcon() {
    if (!this.props.isSorted) {
      return null;
    }
    if (this.state.dir === SortDirections.ASC) {
      return SortIcons.getAscIcon();
    }
    return SortIcons.getDescIcon();
  }

  render() {
    return (
      <a
        ref='link'
        className={this.props.className}
        onClick={this.onClick}
      >
        {this.props.label}
        {this.getDirIcon()}
      </a>
    );
  }
}

SortableHeaderCellLink.propTypes = {
  label: React.PropTypes.string.isRequired,
  sortFunc: React.PropTypes.func.isRequired, // args: [dir]
  isSorted: React.PropTypes.bool.isRequired,
  initiallySorted: React.PropTypes.bool,
  className: React.PropTypes.string,
};

SortableHeaderCellLink.defaultProps = {
  initiallySorted: false,
  className: 'header-cell',
};
