import React from 'react';

import { Label } from '../clusters/Common.jsx';

import { Input } from '../forms/ReactFormElements.jsx';

export class CustomSparkVersionInput extends React.Component {
  constructor(props) {
    super(props);
    this.onVersionChange = this.onVersionChange.bind(this);
    this.state = {
      version: this.props.defaultVersionKey,
    };
  }

  // We should polyfill this and use .startsWith
  startsWithCustom(sparkVersion) {
    const searchString = 'custom:';
    return sparkVersion.substr(0, searchString.length) === searchString;
  }

  onVersionChange(newVersion) {
    let newSparkVersion = newVersion;
    if (!this.startsWithCustom(newSparkVersion)) {
      newSparkVersion = 'custom:' + newVersion;
    }
    this.setState({ version: newSparkVersion });
    if (this.props.onChange) {
      this.props.onChange(newSparkVersion);
    }
  }

  render() {
    // Custom version UI for development
    return (
        <div className='custom-spark-version section-padded'>
          <div>
            <Label>Custom Spark Version</Label>
            <div>
              <Input
                ref={CustomSparkVersionInput.CUSTOM_VERSION_REF}
                inputID={CustomSparkVersionInput.CUSTOM_VERSION_REF}
                type='text'
                inputClassName='control-field cluster-dialog-element'
                onChange={this.onVersionChange}
                value={this.state.version}
              />
            </div>
          </div>
        </div>
    );
  }
}

CustomSparkVersionInput.CUSTOM_VERSION_REF = 'customSparkVersion';

CustomSparkVersionInput.propTypes = {
  defaultVersionKey: React.PropTypes.string,
  onChange: React.PropTypes.func,
};
