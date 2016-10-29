import React from 'react';

import { AutoScaleCheckbox } from '../clusters/AutoScaleCheckbox.jsx';
import { Label, InstanceStats, DBUTooltip } from '../clusters/Common.jsx';
import { WorkerInput } from '../clusters/WorkerInput.jsx';

import { Input } from '../forms/ReactFormElements.jsx';

export class OnDemandWorkerInput extends WorkerInput {
  constructor(props) {
    super(props);
    this.onAutoScaleMaxChange = this.onAutoScaleMaxChange.bind(this);
    this.onChangeCount = this.onChangeCount.bind(this);
  }

  onChangeCount(newOnDemandWorkers) {
    const value = this.getValue(newOnDemandWorkers);

    this.setState({ workers: value });
    this.workersValidator(value);
    this.props.onChange(value, 0);
    if (this.state.autoScaleMaxWorkers <= value) {
      this.setState({ autoScaleMaxWorkers: value + 1 });
      this.onAutoScaleMaxChange(value + 1);
    }
  }

  onAutoScaleMaxChange(newMaxWorkers) {
    const value = this.getValue(newMaxWorkers);

    this.setState({ autoScaleMaxWorkers: newMaxWorkers, autoScaleMaxSpotWorkers: 0 });
    this.workersValidator(value);
    this.props.onAutoScaleMaxChange(value, 0);
  }

  render() {
    const stats = this.updateWorkerStats();
    const autoScaleCheckbox = (
      <AutoScaleCheckbox
        disabled={this.props.disabled}
        defaultChecked={this.props.showAutoScaleInputs}
        onChange={this.props.toggleAutoScale}
        enableAutoScale={this.props.enableAutoScale}
        showWarning={this.props.showAutoScaleWarning}
      />);
    const autoScaleMaxRef = (ref) => this.autoScaleMax = ref;
    const autoScaleMaxInput = this.props.showAutoScaleInputs ? (
      <div className='ondemand-worker-count worker-count-inner'>
        <Label>Max</Label>
        <Input
          ref={autoScaleMaxRef}
          disabled={this.props.disabled}
          inputID={WorkerInput.AUTO_SCALE_MAX_COUNT}
          value={this.state.autoScaleMaxWorkers.toString()}
          type='number'
          inputClassName='worker-count'
          onChange={this.onAutoScaleMaxChange}
          min={this.state.workers + 1}
          max={this.props.maxWorkers}
        />
      </div>
    ) : null;

    const onDemandRef = (ref) => this.ondemand = ref;
    return (
      <div className='ondemand-instances worker-count-outer'>
        <Label>
          <span>On Demand Driver{' '}</span>
          <span className='reg-font-label'>
            (<InstanceStats
              memory={stats.driverMemory}
              cores={stats.driverCores}
              dbus={stats.driverDBU}
            />)
            {' '}<DBUTooltip />
          </span>
        </Label>
        <hr className='divider' />
        <Label>
          <span>Workers{' '}</span>
          <span className='reg-font-label'>
            (<InstanceStats memory={stats.memory} cores={stats.cores} dbus={stats.workerDBU} />)
            {' '}<DBUTooltip />
          </span>
        </Label>
        <div className='ondemand-worker-count worker-count-inner'>
          <Label>{this.props.showAutoScaleInputs ? 'Min' : 'Size'}</Label>
          <Input
            ref={onDemandRef}
            disabled={this.props.disabled}
            inputID={WorkerInput.ONDEMAND_COUNT}
            defaultValue={this.props.workers.toString()}
            type='number'
            inputClassName='worker-count'
            onChange={this.onChangeCount}
            readOnly={this.props.restrictedClusterCreation}
            min={this.props.minWorkers}
            max={this.props.maxWorkers}
          />
        </div>
        {this.props.showAutoScaleInputs ? autoScaleMaxInput : null}
        { // TODO(cg) When this is ready to release, remove this window.settings check!
          window.settings.enableClusterAutoScaling && this.props.showAutoScaleCheckbox ?
          autoScaleCheckbox : null}
      </div>
    );
  }
}
