/* eslint react/prefer-es6-class: 0 */

import React from 'react';

import Clipboard from '../notebook/Clipboard';
import NotebookModel from '../notebook/NotebookModel';

const CommandDivider = React.createClass({

  propTypes: {
    notebook: React.PropTypes.instanceOf(NotebookModel).isRequired,
    nextCommandPosition: React.PropTypes.number.isRequired,
    prevCommandPosition: React.PropTypes.number.isRequired,
    isEmptyNotebook: React.PropTypes.bool,
    insertCommand: React.PropTypes.func,
    pasteCommand: React.PropTypes.func,
  },

  componentDidMount() {
    Clipboard.on('clipboardChanged', this.forceUpdate.bind(this, null), this);
  },

  componentWillUnmount() {
    Clipboard.off(null, null, this);
  },

  getInsertPosition() {
    return this.props.prevCommandPosition +
      ((this.props.nextCommandPosition - this.props.prevCommandPosition) / 2);
  },

  onDragEnter() {
    const newPosition = this.getInsertPosition();
    this.props.notebook.updateDraggingPosition(newPosition);
  },

  render() {
    return (
      <div className={'command divider' + (this.props.isEmptyNotebook ? ' only-divider' : '')}
        onDragEnter={this.onDragEnter}
      >
        <hr></hr>
        <a className='btn btn-default btn-circle insert-command-btn'
          title='Insert a new cell'
          onClick={this.props.insertCommand}
        ><i className='fa fa-plus fa-fw'></i></a>
        <a className={['btn btn-default btn-circle paste-command-btn',
          Clipboard.isEmpty() ? 'hidden' : ''].join(' ')}
          title='Paste cell here'
          onClick={this.props.pasteCommand}
        ><i className='fa fa-paste fa-fw'></i></a>
      </div>
    );
  },
});

module.exports = CommandDivider;
