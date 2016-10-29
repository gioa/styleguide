import React, { Component } from 'react';

import IconsForType from '../ui_building_blocks/icons/IconsForType';
import Highlight from '../ui_building_blocks/highlight/Highlight.jsx';
import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

export class ContextBarLink extends Component {

  highlight(options) {
    this.refs.highlightable.highlight(options);
  }

  render() {
    const items = [];
    const props = this.props;

    if (props.iconType && IconsForType[props.iconType]) {
      items.push(<i className={'fa fa-' + IconsForType[props.iconType]}></i>, ' ');
    }
    items.push(<span className={'context-bar-link-text'}>{props.text}</span>);
    if (props.caret) {
      items.push(' ', <i className='fa fa-caret-down'></i>);
    }

    const classes = props.classes || [];
    classes.unshift('context-bar-item');
    if (props.inset) {
      classes.unshift('inset');
    }
    if (!props.onClick) {
      classes.unshift('no-click');
    }

    const id = props.id || String(Math.random());
    const contents = (
      <a className={classes.join(' ')} id={id} data-name={props.text} onClick={props.onClick}
        disabled={props.disabled ? 'disabled' : null}
      >
          {items}
      </a>
    );

    if (props.tooltip) {
      return (
        <Tooltip id={id} ref='highlightable' text={props.tooltip}>
          {contents}
        </Tooltip>
      );
    }
    return (
      <Highlight id={id} ref='highlightable'>
        {contents}
      </Highlight>
    );
  }
}

ContextBarLink.propTypes = {
  // link text
  text: React.PropTypes.string.isRequired,

  // onclick callback function
  onClick: React.PropTypes.func,

  // link id, used as selector for tests, show tooltip or highlight
  id: React.PropTypes.string,

  iconType: React.PropTypes.string,

  // whether to show dropdown caret
  caret: React.PropTypes.bool,

  // additional css class list
  classes: React.PropTypes.array,

  // optional tooltip text
  tooltip: React.PropTypes.string,

  // disable the link
  disabled: React.PropTypes.bool,

  // apply 'inset' css class for visual style 'clicked'
  inset: React.PropTypes.bool,
};
