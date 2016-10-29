import React from 'react';

import { IamRolesUtils, ArnTooltip } from './IamRolesUtils.jsx';

import { PermissionEditBody } from '../../acl/PermissionEditView.jsx';

import { DeleteButton } from '../../ui_building_blocks/buttons/DeleteButton.jsx';

export function IamRoleDetailsView({ iamRoleName, arn, workspaceAcl, deleteIamRoleFunc,
  renderAclChangeHeader, onConfirmAcl, onCancelAcl }) {
  return (
    <div className='instance-profile-view instance-profile-details-view'>
      <h2>
        <a href={IamRolesUtils.LIST_VIEW_ROUTE} className='back-btn'>
          <i className='fa fa-angle-left' />
        </a>
        {iamRoleName}
        <span className='header-separator'>|</span>
        {renderAclChangeHeader ?
          <ChangeHeader onConfirm={onConfirmAcl} onCancel={onCancelAcl} /> : null}
        <DeleteButton onClick={deleteIamRoleFunc} />
      </h2>

      <label>
        Instance Profile ARN{' '}
        <ArnTooltip />
      </label>
      <p>{arn}</p>

      <label>Name</label>
      <p>{iamRoleName}</p>

      <div className='workspace-acl'>
        <PermissionEditBody workspaceAcl={workspaceAcl} />
      </div>
    </div>
  );
}

IamRoleDetailsView.propTypes = {
  iamRoleName: React.PropTypes.string.isRequired,
  arn: React.PropTypes.string.isRequired,
  onConfirmAcl: React.PropTypes.func.isRequired,
  onCancelAcl: React.PropTypes.func.isRequired,
  workspaceAcl: React.PropTypes.object.isRequired,
  deleteIamRoleFunc: React.PropTypes.func.isRequired,
  renderAclChangeHeader: React.PropTypes.bool,
};

function ChangeHeader({ onConfirm, onCancel }) {
  return (
    <span className='change-buttons'>
      <button className='btn btn-primary' onClick={onConfirm}>
        Confirm
      </button>
      <button className='btn btn-default' onClick={onCancel}>
        Cancel
      </button>
    </span>
  );
}

ChangeHeader.propTypes = {
  onConfirm: React.PropTypes.func.isRequired,
  onCancel: React.PropTypes.func.isRequired,
};
