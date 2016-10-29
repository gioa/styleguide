import React from 'react';

import { ClusterUtil } from '../clusters/Common.jsx';

import { NumberUtils } from '../js_polyfill/NumberUtils';

export class WorkerInput extends React.Component {
  constructor(props) {
    super(props);

    this.resetState = this.resetState.bind(this);

    this.state = this.getDefaultState();
  }

  getDefaultState() {
    return {
      workers: this.props.workers,
      spotWorkers: this.props.spotWorkers,
      autoScaleMaxWorkers: this.props.autoScaleMaxWorkers,
      autoScaleMaxSpotWorkers: this.props.autoScaleMaxSpotWorkers,
      mixedAutoScaleMinWorkers: this.props.mixedAutoScaleMinWorkers,
      autoScaleFirstOnDemandWorkers: this.props.autoScaleFirstOnDemandWorkers,
      workersValid: true,
      spotWorkersValid: true,
    };
  }

  resetState() {
    this.setState(this.getDefaultState());
  }

  getValue(workerNum) {
    // If the user deletes the entire input field, this will get an empty string. Guard against that
    // here by defaulting to zero if the parseInt returns a falsey value (NaN or zero).
    return parseInt(workerNum, 10) || 0;
  }

  isValid() {
    return this.state.workersValid && this.state.spotWorkersValid;
  }

  validateNumber(value) {
    return (value !== '' && NumberUtils.isSimpleInteger(value) &&
        Number(value) >= this.props.minWorkers && Number(value) <= this.props.maxWorkers);
  }

  workersValidator(value) {
    const isValid = this.validateNumber(value);
    this.setState({
      workersValid: isValid,
    });
    if (this.props.validateCallback) {
      this.props.validateCallback(isValid);
    }
    return isValid;
  }

  spotWorkersValidator(value) {
    const isValid = this.validateNumber(value);
    this.setState({
      spotWorkersValid: isValid,
    });
    if (this.props.validateCallback) {
      this.props.validateCallback(isValid);
    }
    return isValid;
  }

  updateWorkerStats() {
    // || 0 to protect against children having invalid state showing NaN.
    // @TODO(jengler) 2016-06-29: This should not be getting the instance type. As the parent of
    // the WorkerInput components, it should be agnostic and oblivious to the child interfaces. If
    // something special needs to happen for mixed instance types, then the MixedWorkerInput should
    // override an exposed interface in WorkerInput (like updateWorkerStats, etc). Alternatively,
    // if WorkerInput is meant to be abstract, then the calculation of numWorkers can be handed off
    // to the children.
    let numWorkers = (Number(this.state.workers) + Number(this.state.spotWorkers)) || 0;

    if (this.props.showAutoScaleInputs && this.props.instanceType === 'mixed') {
      numWorkers = this.state.mixedAutoScaleMinWorkers;
    }
    let memory = Math.floor(ClusterUtil.workersToMemoryGB(numWorkers, this.props.nodeType));
    let cores = ClusterUtil.workersToCores(numWorkers, this.props.nodeType);

    // number of DBU
    let workerDBU = ClusterUtil.getDBU(this.props.nodeType, numWorkers);
    const driverDBU = ClusterUtil.getDBU(this.props.driverNodeType, 1);

    // show ranges if autoscaling
    if (this.props.showAutoScaleInputs) {
      const maxNumWorkers = (Number(this.state.autoScaleMaxWorkers) +
        Number(this.state.autoScaleMaxSpotWorkers)) || 0;
      const maxMemory = Math.floor(ClusterUtil.workersToMemoryGB(
        maxNumWorkers, this.props.nodeType));
      const maxCores = ClusterUtil.workersToCores(maxNumWorkers, this.props.nodeType);
      const maxDBU = ClusterUtil.getDBU(this.props.nodeType, maxNumWorkers);
      memory = `${memory}-${maxMemory}`;
      cores = `${cores}-${maxCores}`;
      workerDBU = `${workerDBU}-${maxDBU}`;
    }


    return {
      memory: memory,
      cores: cores,
      workerDBU: workerDBU,
      driverMemory: Math.floor(ClusterUtil.workersToMemoryGB(1, this.props.driverNodeType)),
      driverCores: ClusterUtil.workersToCores(1, this.props.driverNodeType),
      driverDBU: driverDBU,
    };
  }
}

WorkerInput.SPOT_COUNT = 'clusterSpotCount';
WorkerInput.ONDEMAND_COUNT = 'clusterOndemandCount';
WorkerInput.AUTO_SCALE_MAX_COUNT = 'clusterAutoScaleMaxCount';
/** Used in autoscaled hybrid clusters only */
WorkerInput.AUTO_SCALE_MIN_COUNT = 'clusterAutoScaleMinCount';

WorkerInput.propTypes = {
  // used only in hybrid clusters (spotWorkers/workers used as auto scale min in spot/on demand)
  mixedAutoScaleMinWorkers: React.PropTypes.number,
  autoScaleFirstOnDemandWorkers: React.PropTypes.number,
  autoScaleMaxWorkers: React.PropTypes.number,
  autoScaleMaxSpotWorkers: React.PropTypes.number,
  maxWorkers: React.PropTypes.number,
  minWorkers: React.PropTypes.number,
  onAutoScaleMinChange: React.PropTypes.func,
  onAutoScaleMaxChange: React.PropTypes.func,
  instanceType: React.PropTypes.string,
  // called after validating the worker input
  validateCallback: React.PropTypes.func,
  workers: React.PropTypes.number,
  // tier-based; controls whether the auto scale checkbox is greyed out & disabled
  enableAutoScale: React.PropTypes.bool,
  // controls whether the auto scale checkbox appears at all
  showAutoScaleCheckbox: React.PropTypes.bool,
  showAutoScaleInputs: React.PropTypes.bool,
  toggleAutoScale: React.PropTypes.func,
  showAutoScaleWarning: React.PropTypes.bool,
  spotWorkers: React.PropTypes.number,
  nodeType: React.PropTypes.object,
  driverNodeType: React.PropTypes.object,
  restrictedClusterCreation: React.PropTypes.bool,
};

WorkerInput.defaultProps = {
  enableAutoScale: true,
  showAutoScaleCheckbox: false,
  showAutoScaleInputs: false,
  mixedAutoScaleMinWorkers: 8,
  autoScaleMaxWorkers: 20,
  autoScaleMaxSpotWorkers: 20,
  workers: 0,
  spotWorkers: 0,
  showAutoScaleWarning: false,
  minWorkers: 0,
  maxWorkers: 100000,
};
