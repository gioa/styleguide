import React from 'react';
import { InstanceStats, DBUTooltip } from '../clusters/Common.jsx';

export function CreateSummary(props) {
  let workers = props.workers;
  let memoryGb = props.memoryGb;
  let cores = props.cores;
  let workerDBU = props.workerDBU;
  if (props.maxWorkers > 0) {
    workers = `${props.workers}-${props.maxWorkers}`;
    memoryGb = `${props.memoryGb}-${props.maxMemoryGb}`;
    cores = `${props.cores}-${props.maxCores}`;
    workerDBU = `${props.workerDBU}-${props.maxDBU}`;
  }
  const workerStatsElem = (<InstanceStats
    memory={memoryGb}
    cores={cores}
    dbus={workerDBU}
  />);
  const driverStatsElem = (<InstanceStats
    memory={props.driverMemoryGb}
    cores={props.driverCores}
    dbus={props.driverDBU}
  />);

  return (
    <div className='create-summary'>
      <div>
        {/* Be careful of spacing. HTML will auto add a space at word breaks, but will not
            add it for quotation (like after the comma). */}
        {workers} Workers, {workerStatsElem} <DBUTooltip /> and {props.driver} Driver,{' '}
        {driverStatsElem} <DBUTooltip />
      </div>
    </div>
  );
}

CreateSummary.propTypes = {
  maxWorkers: React.PropTypes.number,
  workers: React.PropTypes.number.isRequired,
  maxMemoryGb: React.PropTypes.number.isRequired,
  memoryGb: React.PropTypes.number.isRequired,
  cores: React.PropTypes.number.isRequired,
  maxCores: React.PropTypes.number.isRequired,
  driver: React.PropTypes.number.isRequired,
  driverMemoryGb: React.PropTypes.number.isRequired,
  driverCores: React.PropTypes.number.isRequired,
  workerDBU: React.PropTypes.number.isRequired,
  maxDBU: React.PropTypes.number.isRequired,
  driverDBU: React.PropTypes.number.isRequired,
};
