/* eslint consistent-return: 0 */

import React from 'react';
import _ from 'underscore';

import { Label, ClusterUtil } from '../clusters/Common.jsx';
import { FallbackOnDemandCheckbox, FallbackOnDemandTooltip }
    from '../clusters/FallbackToOnDemand.jsx';
import { MixedWorkerInput } from '../clusters/MixedWorkerInput.jsx';
import { OnDemandWorkerInput } from '../clusters/OnDemandWorkerInput.jsx';
import { SpotWorkerInput } from '../clusters/SpotWorkerInput.jsx';

import { Select } from '../forms/ReactFormElements.jsx';

import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

import { DbGuideUrls } from '../urls/DbGuideUrls';
import DbGuideLinks from '../urls/DbGuideLinks.js';

export class ClusterWorkersInput extends React.Component {
  constructor(props) {
    super(props);

    this.spotInputRef = (ref) => this.spotInput = ref;
    this.onDemandInputRef = (ref) => this.onDemandInput = ref;

    this.onAutoScaleMaxWorkerChange = this.onAutoScaleMaxWorkerChange.bind(this);
    this.onAutoScaleMinWorkerChange = this.onAutoScaleMinWorkerChange.bind(this);
    this.onChangeInstanceType = this.onChangeInstanceType.bind(this);
    this.onChangeFallback = this.onChangeFallback.bind(this);
    this.onWorkerChange = this.onWorkerChange.bind(this);
    this.toggleAutoScale = this.toggleAutoScale.bind(this);
    this.clusterTypeSelectRef = this.clusterTypeSelectRef.bind(this);
    this.resetState = this.resetState.bind(this);

    this.state = this.getDefaultState();
    // @TODO(jengler) 2016-07-17: This is an absolutely terrible hack to deal with the fact that
    // the *WorkerInput.jsx files send multiple different change events, however, the setState
    // has not registered the update state so the validation of the workers is incorrect. Long story
    // short, we need to clean all of the validation logic up and put it in one location.
    this.current = this.getDefaultState();
  }

  getDefaultNumWorkers(instanceType, props) {
    if (instanceType === ClusterWorkersInput.INSTANCE_SPOT) {
      return 0;
    }
    return _.isNumber(props.defaultNumWorkers) ? props.defaultNumWorkers :
      ClusterWorkersInput.DEFAULT_WORKERS;
  }

  getDefaultNumSpotWorkers(instanceType, props) {
    if (instanceType === ClusterWorkersInput.INSTANCE_ONDEMAND) {
      return 0;
    }
    return _.isNumber(props.defaultSpotWorkers) ? props.defaultSpotWorkers :
      ClusterWorkersInput.DEFAULT_WORKERS;
  }

  getDefaultState() {
    let instanceType;
    if (this.props.defaultClusterType) {
      instanceType = this.props.defaultClusterType;
    } else {
      // TODO(aaron) I'm pretty sure defaultClusterType is always set.
      instanceType = ClusterWorkersInput.INSTANCE_SPOT;
    }

    return {
      instanceType: instanceType,
      workers: this.getDefaultNumWorkers(instanceType, this.props),
      spotWorkers: this.getDefaultNumSpotWorkers(instanceType, this.props),
      showAutoScaleInputs: this.props.defaultEnableAutoScale,
      fallbackToOnDemand: this.props.defaultFallbackToOnDemand,
      mixedAutoScaleMinWorkers: this.props.defaultMinAutoScaleWorkers,
      autoScaleMaxWorkers: this.getDefaultAutoScaleWorkersForInstance(instanceType, this.props),
      autoScaleMaxSpotWorkers: this.getDefaultAutoScaleMaxSpotWorkers(instanceType, this.props),
    };
  }

  resetState() {
    this.current = this.getDefaultState();
    this.setState(this.getDefaultState(), () => {
      // @NOTE(jengler) 2016-07-04: Must be called after the ClusterWorkersInput state has been
      // updated so that the instance specific component has the correct default props.
      if (this.state.instanceType === ClusterWorkersInput.INSTANCE_SPOT) {
        this.spotInput.resetState();
      } else if (this.state.instanceType === ClusterWorkersInput.INSTANCE_MIXED) {
        this.mixedInput.resetState();
      } else if (this.state.instanceType === ClusterWorkersInput.INSTANCE_ONDEMAND) {
        this.onDemandInput.resetState();
      }
    });
  }

  /**
   * Helper function for getting the default "autoScaleMaxSpotWorkers" for autoscaling clusters.
   * Used to set the default state for autoScaleMaxSpotWorkers in this.renderInstance().
   * Not meant to be used with autoScaleMaxWorkers.
   *
   * @param  {string} instanceType The ClusterWorkersInput.INSTANCE_* type.
   * @param  {object} props        this.props
   * @return {number}
   */
  getDefaultAutoScaleMaxSpotWorkers(instanceType, props) {
    if (instanceType === ClusterWorkersInput.INSTANCE_SPOT) {
      return props.defaultMaxAutoScaleWorkers ?
        props.defaultMaxAutoScaleWorkers
        :
        props.defaultSpotWorkers + 1;
    }
    return 0;
  }

  /**
   * Helper function for getting the default "autoScaleMaxWorkers" for autoscaling clusters.
   * Used to set the default state for autoScaleMaxWorkers. Not meant to be used with
   * autoScaleMaxSpotWorkers.
   *
   * @param  {string} instanceType The ClusterWorkersInput.INSTANCE_* type.
   * @param  {object} props        this.props
   * @return {number}
   */
  getDefaultAutoScaleWorkersForInstance(instanceType, props) {
    if (instanceType === ClusterWorkersInput.INSTANCE_SPOT) {
      return (
        props.defaultMaxAutoScaleWorkers ?
        props.defaultMaxAutoScaleWorkers :
        Math.max(props.defaultSpotWorkers + 1,
          ClusterWorkersInput.DEFAULT_MIXED_AUTOSCALE_MAX_WORKERS)
      );
    }

    return (
      props.defaultMaxAutoScaleWorkers ?
      props.defaultMaxAutoScaleWorkers :
      ClusterWorkersInput.DEFAULT_MIXED_AUTOSCALE_MAX_WORKERS
    );
  }

  /**
   * Helper for setting the ref of
   * @param  {ReactInstance} ref
   * @return {none}
   */
  clusterTypeSelectRef(ref) {
    this.clusterTypeSelect = ref;
  }

  onChangeInstanceType(selectedType) {
    let defaultWorkers;
    let defaultSpotWorkers;
    let mixedAutoScaleMinWorkers;
    let autoScaleMaxWorkers = 0;
    let autoScaleMaxSpotWorkers = 0;
    if (selectedType === ClusterWorkersInput.INSTANCE_MIXED) {
      mixedAutoScaleMinWorkers = ClusterWorkersInput.DEFAULT_AUTOSCALE_MIN_WORKERS;
      autoScaleMaxWorkers = ClusterWorkersInput.DEFAULT_MIXED_AUTOSCALE_MAX_WORKERS;
      defaultWorkers = ClusterWorkersInput.DEFAULT_MIXED_ONDEMAND_WORKERS;
      defaultSpotWorkers = ClusterWorkersInput.DEFAULT_MIXED_SPOT_WORKERS;
    } else if (selectedType === ClusterWorkersInput.INSTANCE_SPOT) {
      defaultWorkers = 0;
      defaultSpotWorkers = ClusterWorkersInput.DEFAULT_WORKERS;
      autoScaleMaxSpotWorkers = defaultSpotWorkers + 1;
      autoScaleMaxWorkers = 0;
    } else if (selectedType === ClusterWorkersInput.INSTANCE_ONDEMAND) {
      defaultSpotWorkers = 0;
      defaultWorkers = ClusterWorkersInput.DEFAULT_WORKERS;
      autoScaleMaxWorkers = defaultWorkers + 1;
      autoScaleMaxSpotWorkers = 0;
    }

    const stateObj = {
      instanceType: selectedType,
      workers: defaultWorkers,
      spotWorkers: defaultSpotWorkers,
      mixedAutoScaleMinWorkers: mixedAutoScaleMinWorkers,
      autoScaleMaxWorkers: autoScaleMaxWorkers,
      autoScaleMaxSpotWorkers: autoScaleMaxSpotWorkers,
    };

    this.setStateAndDispatchChanges(stateObj);
  }

  onChangeFallback(checked) {
    const state = {
      fallbackToOnDemand: checked,
    };
    this.setStateAndDispatchChanges(state);
  }

  isValidInstanceState(state) {
    if (state.showAutoScaleInputs) {
      return this.areAutoScalingWorkersValid(state);
    }
    return this.areWorkersValid(state.workers, state.spotWorkers);
  }

  areWorkersValid(workers, spotWorkers = 0) {
    const negativeWorkers = workers < 0 || spotWorkers < 0;
    const aboveMaxWorkers = workers > 100000 || spotWorkers > 100000;

    return !negativeWorkers && !aboveMaxWorkers;
  }

  /**
   * For autoscaling, the following combinations must be checked:
   *   when Spot max is changed: (this.state.spotWorkers < maxSpotWorkers)
   *   when On-Demand max is changed: (this.state.workers < maxWorkers)
   *   when Hybrid max is changed: (this.state.mixedAutoScaleMinWorkers < maxWorkers)
   * [areAutoScalingWorkersValid description]
   * @param  {object} state [description]
   * @return {boolean}      [description]
   */
  areAutoScalingWorkersValid(state) {
    let min;
    let max;
    if (state.instanceType === ClusterWorkersInput.INSTANCE_SPOT) {
      min = state.spotWorkers;
      max = state.autoScaleMaxSpotWorkers;
    } else if (state.instanceType === ClusterWorkersInput.INSTANCE_ONDEMAND) {
      min = state.workers;
      max = state.autoScaleMaxWorkers;
    } else {
      min = state.mixedAutoScaleMinWorkers;
      max = state.autoScaleMaxWorkers;
    }


    const negativeWorkers = min < 0 || min < 0;
    const aboveMaxWorkers = max > 100000 || max > 100000;
    const invalidRange = min >= max;

    return !negativeWorkers && !aboveMaxWorkers && !invalidRange;
  }

  onWorkerChange(workers, spotWorkers) {
    const newWorkers = workers || 0;
    const newSpotWorkers = spotWorkers || 0;
    const workerObj = {
      workers: newWorkers,
      spotWorkers: newSpotWorkers,
    };
    this.setStateAndDispatchChanges(workerObj);
  }

  onAutoScaleMaxWorkerChange(maxWorkers, maxSpotWorkers) {
    const workerObj = {
      autoScaleMaxWorkers: maxWorkers,
      autoScaleMaxSpotWorkers: maxSpotWorkers,
    };
    this.setStateAndDispatchChanges(workerObj);
  }

  onAutoScaleMinWorkerChange(minWorkers) {
    const workerObj = { mixedAutoScaleMinWorkers: minWorkers };
    this.setStateAndDispatchChanges(workerObj);
  }

  setStateAndDispatchChanges(workerObj) {
    this.setState(workerObj);
    this.current = Object.assign({}, this.current, workerObj);
    this.props.onChange(this.current);
    // @NOTE(jengler) 2017-07-14: It is important that this happen after the onChange event so that
    // any outer components that update their state based on the validation of the settings end up
    // with the correct final state for the cluster create button.
    this.toggleClusterCreateButton(this.isValidInstanceState(this.current));
  }

  toggleClusterCreateButton(valid) {
    if (this.props.toggleClusterCreateButton) {
      this.props.toggleClusterCreateButton(valid);
    }
  }

  getFallbackToOndemand() {
    return this.state.fallbackToOnDemand;
  }

  getTypeOptions() {
    return [
      { value: ClusterWorkersInput.INSTANCE_ONDEMAND,
        label: ClusterUtil.onDemandDisplayStr(), disabled: false },
      { value: ClusterWorkersInput.INSTANCE_MIXED,
        label: ClusterUtil.hybridDisplayStr(),
        disabled: !this.props.enableHybridClusterType },
      { value: ClusterWorkersInput.INSTANCE_SPOT,
        label: ClusterUtil.spotDisplayStr(), disabled: false },
    ];
  }

  /**
   * Used by toggleAutoScale to get the default min value it should use when showing the autoscaling
   * max box.
   *
   * @return {number} [description]
   */
  getDefaultMaxSpotWorkers() {
    let autoScaleMaxSpotWorkers = 0;

    if (this.spotInput) {
      autoScaleMaxSpotWorkers = this.spotInput.state.autoScaleMaxSpotWorkers;
      if (autoScaleMaxSpotWorkers <= this.state.spotWorkers) {
        autoScaleMaxSpotWorkers = this.state.spotWorkers + 20;
      }
    }

    return autoScaleMaxSpotWorkers;
  }

  /**
   * Used by toggleAutoScale to get the default max value when turning on autoscaling.
   * @return {number} [description]
   */
  getDefaultMaxOnDemandWorkers() {
    let autoScaleMaxWorkers;

    if (this.spotInput) {
      autoScaleMaxWorkers = 0;
    } else {
      if (this.onDemandInput) {
        autoScaleMaxWorkers = this.onDemandInput.state.autoScaleMaxWorkers;
      } else {
        autoScaleMaxWorkers = this.mixedInput.state.autoScaleMaxWorkers;
      }
      if (autoScaleMaxWorkers <= this.state.workers) {
        autoScaleMaxWorkers = this.state.workers + 20;
      }
    }

    return autoScaleMaxWorkers;
  }

  /**
   * Used by toggleAutoScale to get the default min value when turning on autoscaling.
   * @return {number} default number of min workers
   */
  getDefaultMinMixedWorkers() {
    if (this.mixedInput) {
      return ClusterWorkersInput.DEFAULT_AUTOSCALE_MIN_WORKERS;
    }
    return 0;
  }

  toggleAutoScale(isEnabled) {
    let autoScaleMaxWorkers;
    let autoScaleMaxSpotWorkers;
    let mixedAutoScaleMinWorkers;

    // if toggling auto scale off, set the autoScaleMax values back to 0
    if (!isEnabled) {
      autoScaleMaxWorkers = 0;
      autoScaleMaxSpotWorkers = 0;
      mixedAutoScaleMinWorkers = 0;
    } else {
      autoScaleMaxWorkers = this.getDefaultMaxOnDemandWorkers();
      autoScaleMaxSpotWorkers = this.getDefaultMaxSpotWorkers();
      mixedAutoScaleMinWorkers = this.getDefaultMinMixedWorkers();
    }

    const newAttrs = {
      showAutoScaleInputs: isEnabled,
      autoScaleMaxWorkers: autoScaleMaxWorkers,
      autoScaleMaxSpotWorkers: autoScaleMaxSpotWorkers,
      workers: this.state.workers,
      spotWorkers: this.state.spotWorkers,
      mixedAutoScaleMinWorkers: mixedAutoScaleMinWorkers,
    };

    this.setStateAndDispatchChanges(newAttrs);
  }

  renderInstance(instanceType) {
    if (instanceType === ClusterWorkersInput.INSTANCE_SPOT) {
      return (
        <SpotWorkerInput
          ref={this.spotInputRef}
          disabled={this.props.disabled}
          workers={0}
          instanceType={instanceType}
          enableAutoScale={this.props.enableAutoScale}
          showAutoScaleCheckbox={this.props.showAutoScaleCheckbox}
          showAutoScaleInputs={this.state.showAutoScaleInputs}
          toggleAutoScale={this.toggleAutoScale}
          spotWorkers={this.state.spotWorkers}
          nodeType={this.props.nodeType}
          driverNodeType={this.props.driverNodeType}
          autoScaleMaxWorkers={0}
          autoScaleMaxSpotWorkers={this.state.autoScaleMaxSpotWorkers}
          onAutoScaleMaxChange={this.onAutoScaleMaxWorkerChange}
          showAutoScaleWarning={this.props.showAutoScaleWarning}
          onChange={this.onWorkerChange}
        />);
    } else if (instanceType === ClusterWorkersInput.INSTANCE_MIXED) {
      const mixedInputRef = (ref) => this.mixedInput = ref;
      return (
        <MixedWorkerInput
          ref={mixedInputRef}
          disabled={this.props.disabled}
          workers={this.state.workers}
          instanceType={instanceType}
          fixedOnDemand={this.props.fixedOnDemand}
          enableAutoScale={this.props.enableAutoScale}
          showAutoScaleCheckbox={this.props.showAutoScaleCheckbox}
          showAutoScaleInputs={this.state.showAutoScaleInputs}
          toggleAutoScale={this.toggleAutoScale}
          spotWorkers={this.state.spotWorkers}
          nodeType={this.props.nodeType}
          driverNodeType={this.props.driverNodeType}
          mixedAutoScaleMinWorkers={this.state.mixedAutoScaleMinWorkers}
          autoScaleMaxWorkers={this.state.autoScaleMaxWorkers}
          autoScaleMaxSpotWorkers={this.state.autoScaleMaxSpotWorkers}
          onAutoScaleMinChange={this.onAutoScaleMinWorkerChange}
          onAutoScaleMaxChange={this.onAutoScaleMaxWorkerChange}
          showAutoScaleWarning={this.props.showAutoScaleWarning}
          onChange={this.onWorkerChange}
        />);
    } else if (instanceType === ClusterWorkersInput.INSTANCE_ONDEMAND) {
      return (
        <OnDemandWorkerInput
          ref={this.onDemandInputRef}
          disabled={this.props.disabled}
          workers={this.state.workers}
          instanceType={instanceType}
          enableAutoScale={this.props.enableAutoScale}
          showAutoScaleCheckbox={this.props.showAutoScaleCheckbox}
          showAutoScaleInputs={this.state.showAutoScaleInputs}
          toggleAutoScale={this.toggleAutoScale}
          spotWorkers={0}
          nodeType={this.props.nodeType}
          driverNodeType={this.props.driverNodeType}
          autoScaleMaxWorkers={this.state.autoScaleMaxWorkers}
          autoScaleMaxSpotWorkers={0}
          onAutoScaleMaxChange={this.onAutoScaleMaxWorkerChange}
          showAutoScaleWarning={this.props.showAutoScaleWarning}
          onChange={this.onWorkerChange}
        />);
    }
  }

  getRestrictedBody() {
    const driverGBs =
      ClusterUtil.containersToMemoryGB(0, this.props.nodeType, this.props.driverNodeType, true);
    const dbGuideUri = DbGuideUrls.getDbGuideUrl(DbGuideLinks.CLUSTERS_URL);
    const dbGuideSuggestionText = (
      <span>
        For <a target='_blank' href={dbGuideUri}>more configuration options</a>
      </span>);
    const devtierUpgradeText = Tooltip.getGenericUpgradeElement(dbGuideSuggestionText);
    return (
      <div className='instance-form'>
        <div className='disabled'>
          Free {driverGBs}GB Memory
        </div>
        <div>
          As a {window.settings.devTierName} user, your cluster will automatically terminate after
          an idle period of one hour.
        </div>
        <div>
          {devtierUpgradeText}
        </div>
      </div>
    );
  }

  getUnrestrictedBody() {
    const tooltipText = Tooltip.getGenericUpgradeElement(
      'For combination spot and on-demand clusters');
    const hybridUpgradeTooltip = (
      <span className='hybrid-tier-upgrade-tooltip'>
        <Tooltip text={tooltipText} customPosition={{ contentLeft: '0px' }}>
          <i className='fa fa-question-circle help-icon fall-back-icon' />
        </Tooltip>
      </span>
    );
    const fallbackToOndemandElem = (
      <span>
        <FallbackOnDemandCheckbox
          ref='fallback-cb'
          disabled={this.props.fixedFallbackToOnDemand || this.props.disabled}
          defaultOnDemandFallBack={this.props.defaultFallbackToOnDemand}
          onChange={this.onChangeFallback}
        /> <FallbackOnDemandTooltip />
      </span>
    );

    return (
        <div className='instance-form'>
          <div className='instance-type-label'>
            <Label>Type</Label>
            {this.props.enableHybridClusterType ? null : hybridUpgradeTooltip}
          </div>
          { this.props.fixedInstanceType || this.props.disabled ?
              this.renderFixedInstance()
              :
              this.renderInstanceSelector()
          }
          {this.state.instanceType !== ClusterWorkersInput.INSTANCE_ONDEMAND ?
            fallbackToOndemandElem : null}
          {this.renderInstance(this.state.instanceType)}
        </div>
    );
  }

  renderInstanceSelector() {
    return (
      <Select
        ref={this.clusterTypeSelectRef}
        options={this.getTypeOptions()}
        selectID='instanceType'
        defaultValue={this.state.instanceType}
        selectClassName='create-cluster-instance'
        optionClassName='create-cluster-instance-opt'
        onChange={this.onChangeInstanceType}
      />);
  }

  renderFixedInstance() {
    let clusterInstanceType;
    if (this.props.defaultClusterType === ClusterWorkersInput.INSTANCE_MIXED) {
      clusterInstanceType = 'On-Demand and Spot';
    } else if (this.props.defaultClusterType === ClusterWorkersInput.INSTANCE_SPOT) {
      clusterInstanceType = 'Spot';
    } else if (this.props.defaultClusterType === ClusterWorkersInput.INSTANCE_ONDEMAND) {
      clusterInstanceType = 'On-Demand';
    }

    return <span className='fixed-cluster-instance-type'>{clusterInstanceType}</span>;
  }

  render() {
    let body = null;
    if (this.props.restrictedClusterCreation) {
      body = this.getRestrictedBody();
    } else {
      body = this.getUnrestrictedBody();
    }
    return (
      <div className='instance-type'>
        <Label>Instance</Label>
        {body}
      </div>
    );
  }
}

ClusterWorkersInput.INSTANCE_SPOT = 'spot';
ClusterWorkersInput.INSTANCE_MIXED = 'mixed';
ClusterWorkersInput.INSTANCE_ONDEMAND = 'ondemand';
ClusterWorkersInput.DEFAULT_WORKERS = 8;
ClusterWorkersInput.DEFAULT_MIXED_AUTOSCALE_MAX_WORKERS = 20;
ClusterWorkersInput.DEFAULT_AUTOSCALE_MIN_WORKERS = 8;
// defaults for hybrid clusters when user switches instance types
ClusterWorkersInput.DEFAULT_MIXED_SPOT_WORKERS = 8;
ClusterWorkersInput.DEFAULT_MIXED_ONDEMAND_WORKERS = 0;

ClusterWorkersInput.propTypes = {
  defaultSpotWorkers: React.PropTypes.number.isRequired,
  defaultNumWorkers: React.PropTypes.number.isRequired,
  defaultClusterType: React.PropTypes.string,
  defaultFallbackToOnDemand: React.PropTypes.bool,
  defaultEnableAutoScale: React.PropTypes.bool,
  defaultMaxAutoScaleWorkers: React.PropTypes.number,

  // tier-based; controls whether the auto scale checkbox is greyed out & disabled
  enableAutoScale: React.PropTypes.bool,
  enableHybridClusterType: React.PropTypes.bool,
  fixedOnDemand: React.PropTypes.bool,
  disabled: React.PropTypes.bool,
  fixedInstanceType: React.PropTypes.bool,
  fixedFallbackToOnDemand: React.PropTypes.bool,
  nodeType: React.PropTypes.object,
  driverNodeType: React.PropTypes.object,
  onChange: React.PropTypes.func,
  // controls whether the auto scale checkbox appears at all
  showAutoScaleCheckbox: React.PropTypes.bool,
  showAutoScaleWarning: React.PropTypes.bool,
  toggleClusterCreateButton: React.PropTypes.func,
  restrictedClusterCreation: React.PropTypes.bool,
  defaultMinAutoScaleWorkers: React.PropTypes.number,
};

ClusterWorkersInput.defaultProps = {
  enableAutoScale: true,
  enableHybridClusterType: true,
  fixedOnDemand: false,
  fixedSpot: false,
  disabled: false,
  fixedInstanceType: false,
  fixedFallbackToOnDemand: false,
  restrictedClusterCreation: false,
  defaultFallbackToOnDemand: true,
  defaultEnableAutoScale: false,
  showAutoScaleCheckbox: false,
  mixedAutoScaleMinWorkers: ClusterWorkersInput.DEFAULT_AUTOSCALE_MIN_WORKERS,
  showAutoScaleWarning: false,
};
