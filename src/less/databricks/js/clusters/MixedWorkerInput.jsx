import React from 'react';

import { AutoScaleCheckbox } from '../clusters/AutoScaleCheckbox.jsx';
import { Label, InstanceStats, DBUTooltip } from '../clusters/Common.jsx';
import { ClusterWorkersInput } from '../clusters/ClusterWorkersInput.jsx';
import { WorkerInput } from '../clusters/WorkerInput.jsx';

import { Input } from '../forms/ReactFormElements.jsx';

import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

export class MixedWorkerInput extends WorkerInput {
  constructor(props) {
    super(props);

    this.onAutoScaleMaxChange = this.onAutoScaleMaxChange.bind(this);
    this.onAutoScaleMinChange = this.onAutoScaleMinChange.bind(this);
    this.toggleAutoScale = this.toggleAutoScale.bind(this);
    this.onChangeSpotWorkerCount = this.onChangeSpotWorkerCount.bind(this);
    this.onChangeWorkerCount = this.onChangeWorkerCount.bind(this);
    this.workersValidator = this.workersValidator.bind(this);
  }

  onChangeWorkerCount(newValue) {
    const value = this.getValue(newValue);

    this.setState({ workers: value });
    this.workersValidator(value);
    this.props.onChange(value, this.state.spotWorkers);
  }

  onChangeSpotWorkerCount(newValue) {
    const value = this.getValue(newValue);

    this.setState({ spotWorkers: value });
    this.spotWorkersValidator(value);
    this.props.onChange(this.state.workers, value);
  }

  onAutoScaleMinChange(newValue) {
    const value = this.getValue(newValue);

    this.setState({ mixedAutoScaleMinWorkers: value });
    if (this.state.autoScaleMaxWorkers <= value) {
      this.setState({ autoScaleMaxWorkers: value + 1 });
      this.onAutoScaleMaxChange(value + 1);
    }
    this.workersValidator(value);
    this.props.onAutoScaleMinChange(value);
  }

  onAutoScaleMaxChange(newValue) {
    const value = this.getValue(newValue);

    this.setState({ autoScaleMaxWorkers: value });
    this.workersValidator(value);
    this.props.onAutoScaleMaxChange(value, 0);
  }

  _renderFixedOnDemandInput() {
    return <div className='fixed-worker-count'>{this.props.numOnDemand}</div>;
  }

  toggleAutoScale(isEnabled) {
    let mixedAutoScaleMinWorkers;

    if (!isEnabled) {
      mixedAutoScaleMinWorkers = 0;
    } else {
      mixedAutoScaleMinWorkers = ClusterWorkersInput.DEFAULT_MIXED_SPOT_WORKERS;
    }
    this.setState({
      mixedAutoScaleMinWorkers: mixedAutoScaleMinWorkers,
    });

    this.props.toggleAutoScale(isEnabled);
  }

  render() {
    const stats = this.updateWorkerStats();
    const classes = this.props.fixedOnDemand ? 'disabled-input worker-count' : 'worker-count';
    const onDemandRef = (ref) => this.ondemand = ref;
    let onDemandInput = (
      <div className='mixed-worker-count worker-count-inner workers-on-demand' key='ondemand'>
        <Label>On Demand</Label>
        <Input
          ref={onDemandRef}
          inputID={WorkerInput.ONDEMAND_COUNT}
          value={this.props.workers.toString()}
          type='number'
          disabled={this.props.fixedOnDemand || this.props.disabled}
          inputClassName={classes}
          validate={this.workersValidator}
          onChange={this.onChangeWorkerCount}
          readOnly={this.props.restrictedClusterCreation}
          min={this.props.minWorkers}
          max={this.props.maxWorkers}
        />
      </div>
    );

    if (this.props.fixedOnDemand) {
      const tooltipText = 'You cannot change the number of on-demand workers when ' +
        'configuring clusters.';
      onDemandInput = (
        <Tooltip text={tooltipText}>
          {onDemandInput}
        </Tooltip>
      );
    }

    const spotRef = (ref) => this.spot = ref;
    const spotInput = (
      <div className='mixed-worker-count worker-count-inner workers-spot' key='spot'>
        <Label>Spot</Label>
        <Input
          ref={spotRef}
          disabled={this.props.disabled}
          inputID={WorkerInput.SPOT_COUNT}
          value={this.props.spotWorkers.toString()}
          type='number'
          inputClassName='worker-count'
          onChange={this.onChangeSpotWorkerCount}
          min={this.props.minWorkers}
          max={this.props.maxWorkers}
        />
      </div>
    );

    const autoScaleCheckbox = (<AutoScaleCheckbox
      disabled={this.props.disabled}
      defaultChecked={this.props.showAutoScaleInputs}
      onChange={this.toggleAutoScale}
      enableAutoScale={this.props.enableAutoScale}
      showWarning={this.props.showAutoScaleWarning}
      showHybridMessaging
    />);
    const autoScaleMinRef = (ref) => this.autoScaleMin = ref;
    const autoScaleMaxRef = (ref) => this.autoScaleMax = ref;
    const autoScaleInputs = this.props.showAutoScaleInputs ? (
      <div key='autoscale'>
        <div className='mixed-worker-count worker-count-inner'>
          <Label>Min</Label>
          <Input
            ref={autoScaleMinRef}
            disabled={this.props.disabled}
            inputID={WorkerInput.AUTO_SCALE_MIN_COUNT}
            value={this.state.mixedAutoScaleMinWorkers.toString()}
            type='number'
            inputClassName='worker-count'
            onChange={this.onAutoScaleMinChange}
            min={this.props.minWorkers}
            max={this.props.maxWorkers}
          />
        </div>
        <div className='mixed-worker-count worker-count-inner'>
          <Label>Max</Label>
          <Input
            ref={autoScaleMaxRef}
            disabled={this.props.disabled}
            inputID={WorkerInput.AUTO_SCALE_MAX_COUNT}
            value={this.state.autoScaleMaxWorkers.toString()}
            type='number'
            inputClassName='worker-count'
            onChange={this.onAutoScaleMaxChange}
            min={this.state.mixedAutoScaleMinWorkers + 1}
            max={this.props.maxWorkers}
          />
        </div>
      </div>
    ) : null;

    const divClass = 'mixed-instances worker-count-outer' +
      (this.props.showAutoScaleInputs ? ' autoscale' : '');
    // TODO(cg) When this is ready to release, remove this window.settings check!
    const showAutoScaleCheckbox =
      window.settings.enableClusterAutoScaling && this.props.showAutoScaleCheckbox;
    return (
        <div className={divClass}>
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
          {[onDemandInput, spotInput]}
          { showAutoScaleCheckbox ? autoScaleCheckbox : null }
          { this.props.showAutoScaleInputs ? autoScaleInputs : null }
        </div>
    );
  }
}

MixedWorkerInput.defaultProps = Object.create(WorkerInput.defaultProps, {
  fixedOnDemand: { value: false },
});
