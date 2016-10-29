import React from 'react';

import { AutoScaleCheckbox } from '../clusters/AutoScaleCheckbox.jsx';
import { Label, InstanceStats, DBUTooltip } from '../clusters/Common.jsx';
import { WorkerInput } from '../clusters/WorkerInput.jsx';

import { Input } from '../forms/ReactFormElements.jsx';

export class SpotWorkerInput extends WorkerInput {
  constructor(props) {
    super(props);
    this.onAutoScaleMaxChange = this.onAutoScaleMaxChange.bind(this);
    this.onChangeCount = this.onChangeCount.bind(this);
  }

  onChangeCount(newSpotWorkers) {
    const value = this.getValue(newSpotWorkers);

    this.setState({ spotWorkers: value });
    this.spotWorkersValidator(value);
    this.props.onChange(0, value);
    if (this.state.autoScaleMaxSpotWorkers <= value) {
      this.setState({ autoScaleMaxSpotWorkers: value + 1 });
      this.onAutoScaleMaxChange(value + 1);
    }
  }

  onAutoScaleMaxChange(newMaxSpotWorkers) {
    const value = this.getValue(newMaxSpotWorkers);

    this.setState({ autoScaleMaxWorkers: 0, autoScaleMaxSpotWorkers: value });
    this.spotWorkersValidator(value);
    this.props.onAutoScaleMaxChange(0, value);
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
    const autoScaleMaxSpotRef = (ref) => this.autoScaleMaxSpot = ref;
    const autoScaleMaxInput = this.props.showAutoScaleInputs ? (
      <div className='spot-worker-count worker-count-inner'>
        <Label>Max</Label>
        <Input
          ref={autoScaleMaxSpotRef}
          disabled={this.props.disabled}
          inputID={WorkerInput.AUTO_SCALE_MAX_COUNT}
          value={this.state.autoScaleMaxSpotWorkers.toString()}
          type='number'
          inputClassName='worker-count'
          onChange={this.onAutoScaleMaxChange}
          min={this.state.spotWorkers + 1}
          max={this.props.maxWorkers}
        />
      </div>
    ) : null;

    const spotRef = (ref) => this.spot = ref;
    return (
        <div className='spot-instances worker-count-outer'>
          <Label>
            <span>Spot Driver{' '}</span>
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
          <div className='spot-worker-count worker-count-inner'>
            <Label>{this.props.showAutoScaleInputs ? 'Min' : 'Size'}</Label>
            <Input
              ref={spotRef}
              disabled={this.props.disabled}
              inputID={WorkerInput.SPOT_COUNT}
              defaultValue={this.props.spotWorkers.toString()}
              type='number'
              inputClassName='worker-count'
              onChange={this.onChangeCount}
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
