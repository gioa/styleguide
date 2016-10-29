import React, { Component, PropTypes } from 'react';

import { InstanceProfilesProtos } from '../../proto.js';

import { ProtoService } from '../../requests/ProtoApi.js';

import WorkspaceAcl from '../../acl/WorkspaceAcl';
import WorkspacePermissions from '../../acl/WorkspacePermissions';
import ReactDialogBox from '../../ui_building_blocks/dialogs/ReactDialogBox.jsx';
import ReactModalUtils from '../../ui_building_blocks/dialogs/ReactModalUtils';

import { BrowserUtils } from '../../../js/user_platform/BrowserUtils';

import { IamRolesUtils } from './IamRolesUtils.jsx';
import { IamRoleDeleteDialog } from './IamRoleDeleteDialog.jsx';
import { IamRoleDetailsView } from './IamRoleDetailsView.jsx';

const LIST_ROUTE = '#setting/accounts/iamRoles';

export class IamRoleDetails extends Component {
  constructor(props) {
    super(props);

    this.protoService = new ProtoService(InstanceProfilesProtos.InstanceProfilesService);

    this.iamRoleName = IamRolesUtils.parseIamRoleName(this.props.arn);
    if (!this.iamRoleName) {
      const tags = BrowserUtils.getMeasurementTags({
        error: 'Invalid IAM role in IAM Role View page',
      });
      window.recordEvent('renderingError', tags, this.props.arn);
      ReactDialogBox.alert('Invalid IAM role arn', null, null,
        () => window.router.navigate(IamRolesUtils.LIST_VIEW_ROUTE, { trigger: true }),
      );
    }

    this.deleteIamRole = this.deleteIamRole.bind(this);
    this.confirmAclChanges = this.confirmAclChanges.bind(this);
    this.cancelAclChanges = this.cancelAclChanges.bind(this);

    const iamRoleAclModel = {
      getName: () => this.iamRoleName,
      getAclObjectType: () => WorkspacePermissions.IAM_ROLE_TYPE,
      getAclObjectId: () => encodeURIComponent(this.props.arn),
    };

    this.workspaceAcl = new WorkspaceAcl({ model: iamRoleAclModel });
  }

  componentDidMount() {
    this.workspaceAcl.on('change', this.forceUpdate.bind(this, null), this);
    this.workspaceAcl.fetch();
  }

  componentWillUnmount() {
    this.workspaceAcl.off('change');
  }

  getFuncToDeleteRole() {
    const successFunc = () => window.router.navigate(LIST_ROUTE, {
      trigger: true,
    });
    return () => this.protoService.rpc('removeInstanceProfile')({
      instance_profile_arn: this.props.arn,
    }, successFunc);
  }

  deleteIamRole() {
    ReactModalUtils.createModal(
      <IamRoleDeleteDialog
        arn={this.props.arn}
        deleteFunc={this.getFuncToDeleteRole()}
      />
    );
  }

  confirmAclChanges() {
    ReactDialogBox.confirm({
      message: 'You are changing who has access to this IAM role. ' +
               'Are you sure you want to continue?',
      confirm: () => {
        this.workspaceAcl.commit({ sync: true });
      },
    });
  }

  cancelAclChanges() {
    this.workspaceAcl.resetAllChanges();
  }

  render() {
    return (
      <IamRoleDetailsView
        iamRoleName={this.iamRoleName}
        renderAclChangeHeader={this.workspaceAcl.hasChanges()}
        onConfirmAcl={this.confirmAclChanges}
        onCancelAcl={this.cancelAclChanges}
        deleteIamRoleFunc={this.deleteIamRole}
        arn={this.props.arn}
        workspaceAcl={this.workspaceAcl}
      />
    );
  }
}

IamRoleDetails.propTypes = {
  arn: PropTypes.string.isRequired,
  workerEnvId: PropTypes.string,
};

IamRoleDetails.defaultProps = {
  workerEnvId: 'default-worker-env',
};
