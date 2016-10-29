import React, { Component } from 'react';

import ReactDialogBox from '../../ui_building_blocks/dialogs/ReactDialogBox.jsx';

import { Input } from '../../forms/ReactFormElements.jsx';

import { BrowserUtils } from '../../user_platform/BrowserUtils';
import { ProtoService } from '../../requests/ProtoApi.js';
import { InstanceProfilesProtos } from '../../proto.js';
import { IamRolesUtils, ArnTooltip } from './IamRolesUtils.jsx';

export class NewIamRoleView extends Component {
  constructor(props) {
    super(props);

    this.protoService = new ProtoService(InstanceProfilesProtos.InstanceProfilesService);

    // es6 binds
    this.addInstanceProfileRpc = this.addInstanceProfileRpc.bind(this);
    this.onArnInputChange = this.onArnInputChange.bind(this);
    this.addInstanceProfile = this.addInstanceProfile.bind(this);
    this.recordAddInstanceProfileEvent = this.recordAddInstanceProfileEvent.bind(this);

    this.state = { arn: '' };
  }

  addInstanceProfileRpc(arn, success, error) {
    const addRpcProto = new InstanceProfilesProtos.AddInstanceProfile(
      new InstanceProfilesProtos.InstanceProfile().setInstanceProfileArn(arn));
    this.protoService.rpc('addInstanceProfile')(addRpcProto, success, error);
  }

  recordAddInstanceProfileEvent(error = '') {
    const tags = BrowserUtils.getMeasurementTags({ error: error });
    window.recordEvent('createInstanceProfile', tags);
  }

  addInstanceProfile() {
    // @Note Add workerEnvId to getIamRoleUrl when we actually support it
    const successCallback = () => {
      this.recordAddInstanceProfileEvent();
      window.router.navigate(IamRolesUtils.getIamRoleUrl(this.state.arn), { trigger: true });
    };

    const errorCallback = (xhr) => {
      // @TODO(Chaoyu): Confirm error message with PM/Design
      let message = 'Unknown error, please contact Databricks for support.';
      if (xhr.responseJSON && xhr.responseJSON.message) {
        message = xhr.responseJSON.message;
      }
      this.recordAddInstanceProfileEvent(message);
      ReactDialogBox.confirm({
        title: 'Error Encountered',
        message: message,
        confirmButton: 'OK',
        showCancel: false,
        confirm: () => this.input && this.input.focus(),
      });
    };

    this.addInstanceProfileRpc(this.state.arn, successCallback, errorCallback);
  }

  onArnInputChange(arn) {
    this.setState({ arn: arn });
  }

  static IamRoleIntro() {
    return (
      <div className='iam-role-intro'>
        <p>
          {'IAM roles allow you to access your data from Databricks clusters without ' +
           'the need to manage, deploy, or rotate AWS keys.'}
        </p>
        <p>
          {'In order to use an IAM role in Databricks, the access policy used by ' +
           'Databricks to launch clusters must be given the "PassRole" permission ' +
           'for that role.'}
        </p>
      </div>);
  }

  getErrorMsg() {
    const iamRoleNameIsValid = !!IamRolesUtils.parseIamRoleName(this.state.arn);
    const arnIsNonempty = this.state.arn && this.state.arn.length > 0;
    if (iamRoleNameIsValid || !arnIsNonempty) {
      return null;
    }
    return (
      <div className='error'>
        {IamRolesUtils.invalidArnSyntaxMsg}
      </div>
    );
  }

  getParsedNameField(name) {
    if (!name) {
      return null;
    }
    return (
      <div>
        <label>IAM Role Name</label>
        <p>{name}</p>
      </div>
    );
  }

  render() {
    const iamRoleName = IamRolesUtils.parseIamRoleName(this.state.arn);

    return (
      <div className='instance-profile-view new-instance-profile-view'>
        <h2>
          <a href={IamRolesUtils.LIST_VIEW_ROUTE} className='back-btn'>
            <i className='fa fa-angle-left' />
          </a>
          Add IAM Role
          <span className='header-separator'>|</span>
          <a className='btn' href={IamRolesUtils.LIST_VIEW_ROUTE}>
            Cancel
          </a>
          <button
            className='btn btn-primary'
            disabled={!iamRoleName}
            onClick={this.addInstanceProfile}
          >Add</button>
        </h2>

        {NewIamRoleView.IamRoleIntro()}

        <label>
          {'Instance Profile ARN '}
          <ArnTooltip />
        </label>
        <Input
          type='text'
          ref={(ref) => this.input = ref}
          inputID='new-iam-role-arn'
          onChange={this.onArnInputChange}
        />
        {this.getErrorMsg()}
        {this.getParsedNameField(iamRoleName)}
      </div>
    );
  }
}
