import React from 'react';

import { Label } from '../clusters/Common.jsx';

import { Select } from '../forms/ReactFormElements.jsx';

import IconsForType from '../ui_building_blocks/icons/IconsForType';
import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

/**
 * Stateless functional components for IAM role field in cluster create/configure
 */

export function InstanceProfileAddInstructions() {
  if (!window.settings.isAdmin) {
    return <span>To add a new IAM role, ask your admin.</span>;
  }

  const addUrl = '#setting/accounts/iamRoles/new';
  return (
    <span>
      <a href={addUrl} target='blank' rel='noopener noreferrer'>New IAM roles</a>
      {' '}can be added in the Admin Console.
    </span>
  );
}

function InstanceProfileTooltip({ customPosition }) {
  const tooltipText = (
    <span>
      IAM roles allow you to access your data from Databricks clusters without the need to manage,
      deploy, or rotate AWS keys.{' '}
      <InstanceProfileAddInstructions />
    </span>
  );

  return (
    <Tooltip text={tooltipText} customPosition={customPosition || { contentLeft: '0px' }}>
      <i className='fa fa-question-circle help-icon' />
    </Tooltip>
  );
}

InstanceProfileTooltip.propTypes = {
  customPosition: React.PropTypes.object,
};

function InstanceProfileUpsellTooltip({ customPosition }) {
  const tooltipText = Tooltip.getUpgradeElement('IAM roles', true);

  return (
    <Tooltip text={tooltipText} customPosition={customPosition || { contentLeft: '0px' }}>
      <i className='fa fa-question-circle help-icon' />
    </Tooltip>
  );
}

InstanceProfileUpsellTooltip.propTypes = {
  customPosition: React.PropTypes.object,
};

function InstanceProfileWarning() {
  return (
    <div className='instance-profile-warning-wrapper'>
      <div className='instance-profile-warning'>
        <strong>Note:</strong>{' '}anyone with access to the cluster can access the resources
          controlled by the IAM role. Cluster access can be controlled on the permissions tab
          once you have created a cluster.
        </div>
    </div>
  );
}

export function InstanceProfileField({ options, readOnly, value, onChange, showWarn, fetching }) {
  const instanceProfilesDisabled = !window.settings.enableInstanceProfilesByTier;
  const fetchedSelectField = (
    <Select
      selectID='instanceProfile'
      options={options}
      value={value}
      onChange={onChange}
      selectClassName='control-field cluster-dialog-element instance-profile-select'
      disableAllSelection={instanceProfilesDisabled}
    />
  );
  const selectField = fetching ? <FetchingInstanceProfilesSelect/> : fetchedSelectField;

  return (
    <div className='instance-profile section-padded'>
      <Label>IAM Role</Label>
      {' '}
      {instanceProfilesDisabled ? <InstanceProfileUpsellTooltip /> : <InstanceProfileTooltip />}
      <div>
        {readOnly ? value : selectField}
        {showWarn ? <InstanceProfileWarning /> : null}
      </div>
    </div>
  );
}

InstanceProfileField.propTypes = {
  value: React.PropTypes.string,
  options: React.PropTypes.array,
  onChange: React.PropTypes.func,
  readOnly: React.PropTypes.bool,
  showWarn: React.PropTypes.bool,
  fetching: React.PropTypes.bool,
};

InstanceProfileField.defaultProps = {
  options: [],
  showWarn: false,
  fetching: false,
};

export function FetchingInstanceProfilesSelect() {
  return (
    <div className='dropdown-menu instance-profile-select fetching-iam-wrapper'>
      <li className='dropdown-menu-item'>
        <div className='fetching-iam-roles'>
          <i className={'fa fa-' + IconsForType.inProgress}></i>
          {' '}
          Fetching IAM role list...
        </div>
      </li>
    </div>
  );
}
