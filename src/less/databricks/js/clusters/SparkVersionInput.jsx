import _ from 'lodash';
import React from 'react';

import { Label, SparkImageTooltip, CudaEulaTooltip } from '../clusters/Common.jsx';

import { Select } from '../forms/ReactFormElements.jsx';

export class SparkVersionInput extends React.Component {
  constructor(props) {
    super(props);
    this.onVersionChange = this.onVersionChange.bind(this);
    this.state = {
      version: this.props.defaultSparkVersion.key,
    };
  }

  onVersionChange(newVersion) {
    this.setState({ version: newVersion });
    if (this.props.onChange) {
      this.props.onChange(newVersion);
    }
  }

  getVersionsToShow() {
    const versionsToShow = [];
    const namesTaken = {};
    versionsToShow.push(this.props.defaultSparkVersion);
    namesTaken[this.props.defaultSparkVersion.displayName] = true;
    // Then insert all other entries, avoiding duplicate names.
    // Order lexicographically by displayName
    _.sortBy(this.props.sparkVersions, 'displayName').forEach((version) => {
      if ((this.props.showHiddenSparkVersions || version.customerVisible) &&
          !namesTaken[version.displayName]) {
        versionsToShow.push(version);
        namesTaken[version.displayName] = true;
      }
    });
    return versionsToShow;
  }

  getSparkOptions() {
    const options = [];
    this.getVersionsToShow().forEach((version) => {
      options.push({
        value: version.key,
        label: (version.displayName +
        (version.deprecated ? ' (deprecated)' : '') +
        ((version.packageLabel ||
        this.props.hideMissingSparkPackageWarning) ? '' : ' [package missing]')),
      });
    });
    return options;
  }

  renderCudaEula() {
    if (this.props.gpuWorkloadIsSelected) {
      return (
        <span className='nvidia-licence-info'>
          NVIDIA EULA {' '}
          <CudaEulaTooltip />
        </span>);
    }
    // Do not show anything.
    return null;
  }

  render() {
    // Version UI visible to users
    const options = this.getSparkOptions();
    const sparkVersionSelectRef = (ref) => this.sparkVersionSelect = ref;
    const eula = this.renderCudaEula();
    return (
        <div className='spark-version section-padded'>
          <div>
            <Label>
              <span>Apache Spark Version </span>
              <span className='reg-font-label'><SparkImageTooltip /></span>
            </Label>
            <div>
              <Select
                ref={sparkVersionSelectRef}
                selectID={SparkVersionInput.SPARK_VERSION_REF}
                options={options}
                selectClassName='spark-version-input control-field cluster-dialog-element'
                onChange={this.onVersionChange}
                value={this.state.version}
              />
              {eula}
            </div>
          </div>
        </div>
    );
  }
}

SparkVersionInput.SPARK_VERSION_REF = 'clusterSparkVersion';

SparkVersionInput.propTypes = {
  defaultSparkVersion: React.PropTypes.object.isRequired,
  hideMissingSparkPackageWarning: React.PropTypes.bool,
  onChange: React.PropTypes.func,
  showHiddenSparkVersions: React.PropTypes.bool,
  sparkVersions: React.PropTypes.array.isRequired,
  gpuWorkloadIsSelected: React.PropTypes.bool.isRequired,
};

SparkVersionInput.defaultProps = {
  hideMissingSparkPackageWarning: true,
  showHiddenSparkVersions: false,
};
