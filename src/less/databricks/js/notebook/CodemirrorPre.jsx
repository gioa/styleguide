import React, { Component } from 'react';
import CodeMirrorUtils from '../notebook/CodeMirrorUtils';
import CodeMirror from '../../lib/codemirror/lib/codemirror';

export class CodemirrorPre extends Component {
  constructor(props) {
    super(props);

    // es6 binds
    this.updateText = this.updateText.bind(this);
  }

  componentDidMount() {
    this.updateText();
  }

  componentDidUpdate() {
    this.updateText();
  }

  updateText() {
    this.props.renderCodeToDom(
      this.props.command, this.props.notebookLanguage, this.pre);
  }

  render() {
    return (
      <pre ref={(ref) => this.pre = ref}
        className='cm-s-eclipse capture-run-mode'
      />
    );
  }
}

CodemirrorPre.defaultCodeRenderer = function defaultCodeRenderer(command, nbLang, el) {
  const mode = CodeMirrorUtils.determineMode(null, command, nbLang);
  CodeMirror.runMode(command + '\n', mode, el);
};

CodemirrorPre.propTypes = {
  command: React.PropTypes.string.isRequired,
  notebookLanguage: React.PropTypes.string.isRequired,
  renderCodeToDom: React.PropTypes.func,
};

CodemirrorPre.defaultProps = {
  renderCodeToDom: CodemirrorPre.defaultCodeRenderer,
};
