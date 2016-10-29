/* eslint complexity: 0 */

import React from 'react';

import { Label } from '../clusters/Common.jsx';
import { EBSVolumeUtils } from '../clusters/EBSVolumeUtils.jsx';

import { Input, Select } from '../forms/ReactFormElements.jsx';

export class EBSVolumeFields extends React.Component {
  constructor(props) {
    super(props);

    this._onTypeChange = this._onTypeChange.bind(this);
    this._onCountChange = this._onCountChange.bind(this);
    this._onCountBlur = this._onCountBlur.bind(this);
    this._onSizeChange = this._onSizeChange.bind(this);
    this._onSizeBlur = this._onSizeBlur.bind(this);

    this._setupRangesAndMessaging();
    const defaults = this.getRangeDefaults(this.props.ebsVolumeType);

    this.state = {
      noneChosen: !this.props.ebsVolumeType,
      countValid: true,
      sizeValid: true,
      minSize: defaults.minSize,
      maxSize: defaults.maxSize,
      defaultSize: defaults.defaultSize,
    };
  }

  _setupRangesAndMessaging() {
    this.WARN_MSG = `If you provision EBS volumes, the local storage of the instances will not
    be used.`;
    this.minCount = 1;
    this.defaultCount = 3;
    this.maxCount = window.settings.maxEbsVolumesPerInstance;
    this.generalPurposeMin = EBSVolumeUtils.getGeneralPurposeMin();
    this.generalPurposeMax = EBSVolumeUtils.getGeneralPurposeMax();
    this.throughputOptimizedMin = EBSVolumeUtils.getThroughputOptimizedMin();
    this.throughputOptimizedMax = EBSVolumeUtils.getThroughputOptimizedMax();
  }

  getRangeDefaults(type) {
    if (type === EBSVolumeUtils.GENERAL_PURPOSE) {
      return {
        minSize: this.generalPurposeMin,
        maxSize: this.generalPurposeMax,
        defaultSize: 100,
      };
    } else if (type === EBSVolumeUtils.THROUGHPUT_OPTIMIZED) {
      return {
        minSize: this.throughputOptimizedMin,
        maxSize: this.throughputOptimizedMax,
        defaultSize: 500,
      };
    }
    return {};
  }

  _onTypeChange(value) {
    const newDefaults = this.getRangeDefaults(value);
    this.setState({
      noneChosen: value === '',
      countValid: true,
      sizeValid: true,
      minSize: newDefaults.minSize,
      maxSize: newDefaults.maxSize,
      defaultSize: newDefaults.defaultSize,
    });
    const changes = { ebsVolumeType: value };
    if (value === '') {
      changes.ebsVolumeCount = null;
      changes.ebsVolumeSize = null;
    } else {
      changes.ebsVolumeCount = this.defaultCount;
      changes.ebsVolumeSize = newDefaults.defaultSize;
    }
    this.props.onChange(changes);
  }

  _onCountChange(value) {
    this.setState({
      countValid: parseInt(value, 10) >= this.minCount && parseInt(value, 10) <= this.maxCount,
    });
    this.props.onChange({ ebsVolumeCount: value });
  }

  _onCountBlur(value) {
    if (parseInt(value, 10) < this.minCount || !value) {
      value = this.minCount;
    }
    if (parseInt(value, 10) > this.maxCount) {
      value = this.maxCount;
    }

    this._onCountChange(parseInt(value, 10));
  }

  _onSizeChange(value) {
    this.setState({
      sizeValid: parseInt(value, 10) >= this.state.minSize &&
        parseInt(value, 10) <= this.state.maxSize,
    });

    this.props.onChange({ ebsVolumeSize: value });
  }

  _onSizeBlur(value) {
    if (parseInt(value, 10) < this.state.minSize || !value) {
      value = this.state.minSize;
    }
    if (parseInt(value, 10) > this.state.maxSize) {
      value = this.state.maxSize;
    }
    this._onSizeChange(parseInt(value, 10));
  }

  _getTypeSelectOptions() {
    return [
      { value: '', label: 'None' },
      { value: EBSVolumeUtils.GENERAL_PURPOSE,
        label: EBSVolumeUtils.GENERAL_PURPOSE_LABEL },
      { value: EBSVolumeUtils.THROUGHPUT_OPTIMIZED,
        label: EBSVolumeUtils.THROUGHPUT_OPTIMIZED_LABEL },
    ];
  }

  _shouldShowWarnMsg() {
    return this.state.noneChosen && !this.props.disableEBSVolumes;
  }

  _shouldShowSummary() {
    return !this.props.disableEBSVolumes && !this.state.noneChosen &&
      this.state.countValid && this.state.sizeValid;
  }

  render() {
    const countError = (
      <span className='error'>
        Count must be between {this.minCount} and {this.maxCount}.{' '}
      </span>
    );
    const sizeError = (
      <span className='error'>
        Size must be between {this.state.minSize} and {this.state.maxSize}.
      </span>
    );
    const summary = (
      <span ref='summary'>
        {EBSVolumeUtils.getEBSSummary(this.props.ebsVolumeCount, this.props.ebsVolumeSize)}
      </span>
    );
    const offendingNodeTypes = this.props.offendingNodeTypes ?
      this.props.offendingNodeTypes.join(', ') : '';
    const disableMsg = (
      <span className='disable-message'>
        EBS volumes is not supported for the following node types: {offendingNodeTypes}.
      </span>
    );
    const typeValue = this.props.disableEBSVolumes ? '' : this.props.ebsVolumeType;
    const countValue = this.props.disableEBSVolumes ? null : this.props.ebsVolumeCount;
    const sizeValue = this.props.disableEBSVolumes ? null : this.props.ebsVolumeSize;

    return (
      <div className='storage-parent-wrapper section-padded'>
        <div className='label-select-group create type-group'>
          <div>
            <Label>{EBSVolumeUtils.TYPE_LABEL}</Label>{' '}
            <EBSVolumeUtils.EBSVolumeTypeTooltip />
          </div>
          <Select
            selectID='typeSelect'
            options={this._getTypeSelectOptions()}
            value={typeValue}
            onChange={this._onTypeChange}
            selectClassName='ebs-field type'
            useLowerCaseValue={false}
            disableAllSelection={this.props.disableEBSVolumes}
          />
        </div>
        <div className='label-select-group create count-group'>
          <div>
            <Label>{EBSVolumeUtils.COUNT_LABEL}</Label>{' '}
            <EBSVolumeUtils.EBSVolumeCountTooltip maxCount={this.maxCount} />
          </div>
          <Input
            ref='countInput'
            inputID='countSelect'
            type='number'
            value={countValue}
            onChange={this._onCountChange}
            onBlur={this._onCountBlur}
            inputClassName='ebs-field count'
            disabled={this.state.noneChosen || this.props.disableEBSVolumes}
            valid={this.state.countValid}
            min={this.minCount}
            max={this.maxCount}
          />
        </div>
        <div className='label-select-group create size-group'>
          <div>
            <Label>{EBSVolumeUtils.SIZE_LABEL}</Label>{' '}
            <EBSVolumeUtils.EBSVolumeSizeTooltip
              GPMin={this.generalPurposeMin}
              GPMax={this.generalPurposeMax}
              TOMin={this.throughputOptimizedMin}
              TOMax={this.throughputOptimizedMax}
            />
          </div>
          <Input
            ref='sizeInput'
            inputID='sizeSelect'
            type='number'
            value={sizeValue}
            onChange={this._onSizeChange}
            onBlur={this._onSizeBlur}
            inputClassName='ebs-field size'
            disabled={this.state.noneChosen || this.props.disableEBSVolumes}
            valid={this.state.sizeValid}
            min={this.state.minSize}
            max={this.state.maxSize}
          />
        </div>
        <span>
          {this.state.countValid ? null : countError}
          {this.state.sizeValid ? null : sizeError}
          <span className='ebs-info'>
            {this._shouldShowWarnMsg() ? this.WARN_MSG : null}
            {this._shouldShowSummary() ? summary : null}
            {this.props.disableEBSVolumes ? disableMsg : null}
          </span>
        </span>
      </div>
    );
  }
}

EBSVolumeFields.propTypes = {
  onChange: React.PropTypes.func.isRequired,
  numWorkers: React.PropTypes.number,
  ebsVolumeType: React.PropTypes.string,
  ebsVolumeCount: React.PropTypes.oneOfType([
    React.PropTypes.string,
    React.PropTypes.number,
  ]),
  ebsVolumeSize: React.PropTypes.oneOfType([
    React.PropTypes.string,
    React.PropTypes.number,
  ]),
  offendingNodeTypes: React.PropTypes.array,
  disableEBSVolumes: React.PropTypes.bool,
};
