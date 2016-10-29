import React from 'react';
import ClassNames from 'classnames';

import { AclUtils } from '../acl/AclUtils.jsx';
import WorkspacePermissions from '../acl/WorkspacePermissions';

import WorkspaceConstants from '../filetree/WorkspaceConstants';

import ReactDialogBox from '../ui_building_blocks/dialogs/ReactDialogBox.jsx';
import IconsForType from '../ui_building_blocks/icons/IconsForType';
import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

import { DbGuideUrls } from '../urls/DbGuideUrls';
import DbGuideLinks from '../urls/DbGuideLinks';
import { ResourceUrls } from '../urls/ResourceUrls';

export class AclSettingsView extends React.Component {
  constructor() {
    super();

    this.turnSpinnerOff = this.turnSpinnerOff.bind(this);
    this.turnSpinnerOn = this.turnSpinnerOn.bind(this);

    this.state = {
      showSpinner: false,
    };
  }

  onToggleSuccess(configString, newConfig) {
    if (window.settings) {
      window.settings[configString] = newConfig;
    }
  }

  turnSpinnerOn() {
    this.setState({ showSpinner: true });
  }

  turnSpinnerOff() {
    this.setState({ showSpinner: false });
  }

  render() {
    const clusterBasicDescrip = 'Enabling Cluster Access Control will allow users to control ' +
    'who can attach to, restart, and manage (resize/delete) clusters that they create. It also ' +
    'allows control of who can create clusters.';
    const clusterAdditionalConfirm1 = 'Note: When cluster ACLs are enabled, only the job ' +
      'owner/creator can edit or run a job.';
    const clusterAdditionalConfirm2 = 'If running jobs via the REST API: Before ' +
      'enabling cluster ACLs, users should ensure that the API user is identical to the job ' +
      'owner/creator. This will ensure seamless continued operation. Job access controls ' +
      'will be available soon.';
    const clusterAdditionalConfirmText = (
      <ul><li>{clusterAdditionalConfirm1}</li><li>{clusterAdditionalConfirm2}</li></ul>);
    const clusterAdditional = [
      <p>When cluster access control is enabled, admins will still have attach, restart and
       manage permissions on existing clusters, as well as the ability to create clusters.</p>,
      <p>When cluster access control is disabled, all users will have permissions to create
       clusters, as well as attach to, restart, and manage existing clusters.</p>,
      <p>{clusterAdditionalConfirm1}</p>,
      <p>{clusterAdditionalConfirm2}</p>,
    ];

    const workspaceBasicDescrip = 'Enabling Workspace Access Control will allow users to ' +
    'control who can view, edit, and run notebooks in their workspace.';
    const usersFolder = WorkspaceConstants.UserFolderName;
    const workspaceAdditional = [
      <p>When workspace access control is enabled, items in each user's home directory in
        <b> /{usersFolder}</b> will become private. Existing top-level items will remain
      shared with all users, but new top-level items will be private by default.</p>,
      <p>When workspace access control is disabled, all items in the workspace will be
      accessible to all users.</p>,
    ];

    const mountPointBasicDescrip = 'Enabling Mount Point Access Control will allow users to ' +
      'control who can access data within mount points provided on clusters.';
    const mountPointAdditional = [
      <p>When mount point access control is enabled, mount points can be made private.
      Existing mount points will remain shared with all users, but new mount points will be
      private by default.</p>,
      <p>When mount point access control is disabled, all items in the workspace will be
      accessible to all users.</p>,
    ];

    const spinner = (
      <img
        className='load-spinner'
        src={ResourceUrls.getResourceUrl('img/spinner.svg')}
      />);

    const workspaceRef = (ref) => this.workspace = ref;
    const clusterRef = (ref) => this.cluster = ref;
    const mountRef = (ref) => this.mount = ref;

    return (
        <div className='acl-settings-wrapper'>
          {this.state.showSpinner ? spinner : null}
          <AclControl
            ref={workspaceRef}
            aclsAvailable={window.settings && window.settings.enableWorkspaceAcls}
            additionalDescriptionElements={workspaceAdditional}
            basicDescription={workspaceBasicDescrip}
            enabled={window.settings && window.settings.enableWorkspaceAclsConfig}
            configWindowSetting={"enableWorkspaceAclsConfig"}
            controlType={WorkspacePermissions.WORKSPACE_TYPE}
            title={"Workspace Access Control"}
            turnSpinnerOn={this.turnSpinnerOn}
            turnSpinnerOff={this.turnSpinnerOff}
            onToggleSuccess={this.onToggleSuccess}
          />
          {AclUtils.clusterAclsFeatureFlag() ?
           <AclControl
             ref={clusterRef}
             aclsAvailable={AclUtils.clusterAclsAvailable()}
             additionalDescriptionElements={clusterAdditional}
             additionalConfirmTextElem={clusterAdditionalConfirmText}
             basicDescription={clusterBasicDescrip}
             enabled={AclUtils.clusterAclsEnabled()}
             configWindowSetting={"enableClusterAclsConfig"}
             controlType={WorkspacePermissions.CLUSTER_TYPE}
             title={"Cluster Access Control"}
             turnSpinnerOn={this.turnSpinnerOn}
             turnSpinnerOff={this.turnSpinnerOff}
             onToggleSuccess={this.onToggleSuccess}
           /> : null}
           {AclUtils.mountPointAclsFeatureFlag() ?
            <AclControl
              ref={mountRef}
              aclsAvailable={AclUtils.mountPointAclsAvailable()}
              additionalDescriptionElements={mountPointAdditional}
              basicDescription={mountPointBasicDescrip}
              enabled={AclUtils.mountPointAclsEnabled()}
              configWindowSetting={"enableMountPointAclsConfig"}
              controlType={WorkspacePermissions.MOUNTPOINT_TYPE}
              title={"Mount Point Access Control"}
              onToggleSuccess={this.onToggleSuccess}
            /> : null}
        </div>
    );
  }
}

export class AclControl extends React.Component {
  constructor(props) {
    super(props);

    this.toggleExpandState = this.toggleExpandState.bind(this);
    this.onClickToggle = this.onClickToggle.bind(this);

    this.state = {
      enabled: this.props.enabled,
      expandedText: false,
      submitting: false,
    };
  }

  toggleSuccess() {
    const newConfig = !this.state.enabled;
    if (this.props.turnSpinnerOff) { this.props.turnSpinnerOff(); }
    this.props.onToggleSuccess(this.props.configWindowSetting, newConfig);
    this.setState({
      submitting: false,
      enabled: newConfig,
    });
  }

  toggleError() {
    if (this.props.turnSpinnerOff) { this.props.turnSpinnerOff(); }
    ReactDialogBox.alert('Error while updating Access Control config, please try again later.');
    this.setState({ submitting: false });
  }

  onClickToggle() {
    const enablingClusterAcls = !this.state.enabled &&
      this.props.controlType === WorkspacePermissions.CLUSTER_TYPE;

    let message = this.state.enabled ?
        <p>Are you sure you want to <b>disable</b> {this.props.title}?</p> :
        <p>Are you sure you want to <b>enable</b> {this.props.title}?</p>;
    if (!this.state.enabled && this.props.additionalConfirmTextElem) {
      message = <span>{message}{this.props.additionalConfirmTextElem}</span>;
    }

    ReactDialogBox.confirm({
      message: message,
      confirmButton: 'Confirm',
      cancelButton: 'Cancel',
      confirm: () => {
        if (this.props.turnSpinnerOn) { this.props.turnSpinnerOn(); }
        this.setState({ submitting: true });
        AclUtils.toggleAclSetting(
            this.props.controlType,
            this.state.enabled,
            this.toggleSuccess.bind(this),
            this.toggleError.bind(this));
      },
      cancel: () => {
        if (enablingClusterAcls) {
          window.recordEvent('aclClusterEnableCancel');
        }
      },
    });
  }

  toggleExpandState() {
    this.setState({ expandedText: !this.state.expandedText });
  }

  renderInfo() {
    let docUrl;
    if (this.props.controlType === WorkspacePermissions.CLUSTER_TYPE) {
      docUrl = DbGuideUrls.getDbGuideUrl(DbGuideLinks.ACL_CLUSTERS_URL);
    } else {
      docUrl = DbGuideUrls.getDbGuideUrl(DbGuideLinks.ACL_WORKSPACE_URL);
    }
    if (!this.props.aclsAvailable) {
      const upgradeRef = (ref) => this.upgrade = ref;
      return (
          <div ref={upgradeRef}>
            <p>{Tooltip.getGenericUpgradeElement(`To enable ${this.props.title}`)}</p>
            <p>{this.props.basicDescription}</p>
            <p>See the <a target='_blank' href={docUrl}>Databricks Guide</a> to learn more.</p>
          </div>);
    }
    const infoRef = (ref) => this.info = ref;
    return (
      <div ref={infoRef}>
        <p>{this.props.basicDescription}</p>
        {this.props.additionalDescriptionElements}
        <p>See the <a target='_blank' href={docUrl}>Databricks Guide</a> to learn more.</p>
      </div>);
  }

  getButton(text, enabled, dataAction) {
    const btnClasses = ClassNames({
      'btn': true,
      'btn-danger': text === 'Disable',
      'btn-primary': text === 'Enable',
      'disabled': !enabled,
    });
    const toggleRef = (ref) => this.toggle = ref;
    return (
      <button
        ref={toggleRef}
        onClick={enabled ? this.onClickToggle : null}
        className={btnClasses}
        data-action={enabled ? dataAction : null}
      >
        {text}
      </button>);
  }

  render() {
    let aclState;
    let btn;
    const iconType = this.state.expandedText ? 'chevronDown' : 'chevronRight';
    if (!this.props.aclsAvailable) {
      aclState = 'Disabled';
      btn = null;
    } else if (this.state.enabled) {
      aclState = 'Enabled';
      btn = this.getButton('Disable', !this.state.submitting,
        `disable-${this.props.controlType}-acls`);
    } else {
      aclState = 'Disabled';
      btn = this.getButton('Enable', !this.state.submitting,
        `enable-${this.props.controlType}-acls`);
    }

    const expandRef = (ref) => this.expand = ref;
    return (
        <div className={`${this.props.controlType}-acl-settings acl-settings-control`}>
          <h1>
            {this.props.title}: <b data-status={aclState}>{aclState}</b>
          </h1>
          {btn}
          <a ref={expandRef}
            className='expand'
            onClick={this.toggleExpandState}
          >
            What this means<i className={'fa fa-' + IconsForType[iconType]} />
          </a>
          {this.state.expandedText ? this.renderInfo() : null}
        </div>
    );
  }
}

AclControl.propTypes = {
  // if the ACLs are feature flagged on and available for the customer tier
  aclsAvailable: React.PropTypes.bool.isRequired,
  basicDescription: React.PropTypes.string.isRequired,
  configWindowSetting: React.PropTypes.string.isRequired,
  // cluster, workspace, mount point, etc.
  controlType: React.PropTypes.string.isRequired,
  enabled: React.PropTypes.bool.isRequired,
  title: React.PropTypes.string.isRequired,
  additionalDescriptionElements: React.PropTypes.array,
  // additional html to display in the confirm dialog
  additionalConfirmTextElem: React.PropTypes.node,
  turnSpinnerOff: React.PropTypes.func,
  turnSpinnerOn: React.PropTypes.func,
  onToggleSuccess: React.PropTypes.func,
};
