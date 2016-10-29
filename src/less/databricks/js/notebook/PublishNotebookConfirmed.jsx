import React from 'react';

const ReactConfirm = require('../forms/ReactConfirm.jsx');
const ReactFormElements = require('../forms/ReactFormElements.jsx'),
  Input = ReactFormElements.Input;

// Confirms that the user's notebook has been published and shows the user the public URL
export class PublishNotebookConfirmed extends React.Component {
  componentDidMount() {
    if (this.refs.url) {
      this.refs.url.select();
    }
  }

  render() {
    const nodeType = this.props.isDashboard ? 'Dashboard' : 'Notebook';
    const header = <h3>{nodeType} Published</h3>;
    const infoText = (
      <div>
        The {nodeType.toLowerCase()} was published successfully. Please copy the url and save it
        <br />
        (it may take a minute or two for your updates to be publicly available).
        <br />
        The link will remain valid for 6 months.
      </div>
    );
    const publicLink = (
      <Input
        ref='url'
        type='text'
        inputID='publish-notebook-url'
        readOnly
        value={this.props.url}
      />);
    const body = (
      <div>
        {infoText}
        {publicLink}
      </div>
    );

    return (
      <ReactConfirm
        title = {header}
        message = {body}
        confirmButton = 'Done'
        showCancel = {false}
        name = 'publish-notebook-confirm'
      />
    );
  }
}

// @param url: The public-facing url to which the notebook was published
PublishNotebookConfirmed.propTypes = {
  url: React.PropTypes.string.isRequired,
  isDashboard: React.PropTypes.bool,
};
