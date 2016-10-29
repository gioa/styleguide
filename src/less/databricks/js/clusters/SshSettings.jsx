import React from 'react';

import { Label, SshSetupTooltip } from '../clusters/Common.jsx';

import ReactFormElements from '../forms/ReactFormElements.jsx';

import { DbGuideUrls } from '../urls/DbGuideUrls';
import DbGuideLinks from '../urls/DbGuideLinks.js';

const TextArea = ReactFormElements.TextArea;

export class SshSettings extends React.Component {
  constructor(props) {
    super(props);

    this.updateSshKey = this.updateSshKey.bind(this);

    this.state = {
      sshKeyBlob: this.props.defaultSshKeyBlob,
    };
  }

  updateSshKey(newBlob) {
    const newKey = [];
    if (newBlob) {
      newKey.push(newBlob);
    }
    this.setState({
      sshKeyBlob: newKey,
    });
    if (this.props.onChange) {
      this.props.onChange(newKey);
    }
  }

  render() {
    const url = DbGuideUrls.getDbGuideUrl(DbGuideLinks.SSH_URL);
    const learnLink = <a href={url} target='_blank'>Learn more</a>;
    return (
      <div className='ssh-section'>
        <div className='ssh-warning'>
          This feature is supported only with the beta node types. {learnLink}
        </div>
        <Label>SSH Public Key</Label>{' '}
        <SshSetupTooltip customPosition={{ contentLeft: '0px' }} />
        <div>
          <TextArea
            ref='sshKey'
            textareaClassName='control-field ssh-key-text-area'
            defaultValue={this.state.sshKeyBlob[0] ? this.state.sshKeyBlob[0] : ''}
            placeholder='ssh-rsa <public_key> email@example.com'
            onChange={this.updateSshKey}
          />
        </div>
      </div>
    );
  }
}

SshSettings.defaultProps = {
  defaultSshKeyBlob: [],
};

SshSettings.propTypes = {
  defaultSshKeyBlob: React.PropTypes.array,
  onChange: React.PropTypes.func,
};
