import _ from 'lodash';
import React from 'react';

import { AwsSettings } from '../clusters/AwsSettings.jsx';
import { SshSettings } from '../clusters/SshSettings.jsx';
import ReactSparkConfElement from '../clusters/ReactSparkConfElement.jsx';
import { AwsTagList } from '../clusters/aws_tags/AwsTagList.jsx';
import { AwsTagListViewConstants } from '../clusters/aws_tags/AwsTagListViewConstants';
import { ClusterUtil } from '../clusters/Common.jsx';

import { Tabs, Panel } from '../ui_building_blocks/TabsView.jsx';

export class AdvancedSettings extends React.Component {
  constructor(props) {
    super(props);

    this.onChangeAws = this.onChangeAws.bind(this);
    this.onChangeSparkConf = this.onChangeSparkConf.bind(this);
    this.onChangeTags = this.onChangeTags.bind(this);
    this.onChangeSshKey = this.onChangeSshKey.bind(this);
    this.toggleAdvancedSettings = this.toggleAdvancedSettings.bind(this);

    this.state = {
      showAdvancedSettings: true,
      sparkConf: this.props.defaultSparkConf,
      sshKey: this.props.defaultSshKey,
      zoneId: this.props.defaultZoneId,
      nodeTypeId: this.props.defaultNodeType,
      driverNodeTypeId: this.props.defaultDriverNodeTypeId,
      spotBidPrice: this.props.defaultSpotBid,
      ebsVolumeType: this.props.ebsVolumeType,
      ebsVolumeCount: this.props.ebsVolumeCount,
      ebsVolumeSize: this.props.ebsVolumeSize,
      instanceProfileArn: this.props.instanceProfileArn,
      customTags: this.props.customTags,
    };
  }

  componentWillReceiveProps(nextProps) {
    // Reset the node types to make sure they are in sync.
    // NOTE: these state variables should not be here.
    if (nextProps.defaultNodeType !== this.state.nodeTypeId) {
      this.setState({ nodeTypeId: nextProps.defaultNodeType });
    }
    if (nextProps.defaultDriverNodeTypeId !== this.state.defaultDriverNodeTypeId) {
      this.setState({ driverNodeTypeId: nextProps.defaultDriverNodeTypeId });
    }
  }


  toggleAdvancedSettings() {
    this.setState({ showAdvancedSettings: !this.state.showAdvancedSettings });
    // record when user toggles open the advanced settings (the state is still false
    // at this point since the pending state transition hasn't taken effect)
    if (!this.state.showAdvancedSettings) {
      window.recordEvent('clusterCreateClick', {
        clusterCreateElementClicked: 'createClusterAdvSettingsOpen',
      });
    }
  }

  onChangeSparkConf(newSparkConf) {
    this.setStateAndReportChange({ sparkConf: newSparkConf });
  }

  onChangeAws(attrObj) {
    const changes = {};
    const keysToAddIfChanged = Object.keys(this.state);
    keysToAddIfChanged.forEach((key) => {
      if (key in attrObj) {
        changes[key] = attrObj[key];
      }
    });
    this.setStateAndReportChange(changes);
  }

  onChangeTags(tagsObj) {
    this.setStateAndReportChange({
      customTags: tagsObj.customTags,
    });
  }

  onChangeSshKey(newSshKey) {
    this.setStateAndReportChange({ sshKey: newSshKey });
  }

  setStateAndReportChange(changes) {
    this.setState(changes);
    const oldState = {
      zoneId: this.state.zoneId,
      nodeTypeId: this.state.nodeTypeId,
      driverNodeTypeId: this.state.driverNodeTypeId || this.props.defaultNodeType,
      sparkConf: this.state.sparkConf,
      spotBidPrice: this.state.spotBidPrice,
      sshKey: this.state.sshKey,
      ebsVolumeType: this.state.ebsVolumeType,
      ebsVolumeCount: this.state.ebsVolumeCount,
      ebsVolumeSize: this.state.ebsVolumeSize,
      instanceProfileArn: this.state.instanceProfileArn,
      customTags: this.state.customTags,
    };

    this.props.onChange(Object.assign({}, oldState, changes));
  }

  /**
   * If the user is a dev-tier user, show them the extra node types which are available in paid
   * tiers. Otherwise, show them the supported node types.
   * TODO(mgyucht): Remove these when we support display node types per workspace feature tier.
   * @returns {*}
   */
  getNodeTypes() {
    // Fail gracefully - nodeTypes may equal [] or undefined due to a race condition, so we
    // should return a valid array in case of failure.
    if (!this.props.nodeTypes) {
      return [];
    }
    return this.props.nodeTypes;
  }

  /**
   * @param {Array} selectedNodeTypeIds list of node type IDs (both worker & driver) user selected
   * @param {Array} allNodeTypes list of all node type objects user is choosing from
   * @return {Boolean} whether selected node types support aws tags
   */
  doNodeTypesSupportTags(selectedNodeTypeIds, allNodeTypes) {
    return _.filter(selectedNodeTypeIds, (nodeTypeId) => {
      // the second case of the OR only occurs before anything in advanced settings has been set
      // i.e. the driver node type is still undefined
      const nodeTypeObj =
        ClusterUtil.getNodeType(nodeTypeId || this.props.defaultNodeType, allNodeTypes);
      return nodeTypeObj.support_cluster_tags;
    }).length === 2;
  }

  renderTagsTab() {
    const tagsRef = (ref) => this.tags = ref;
    const shouldDisable = !this.doNodeTypesSupportTags(
      [this.state.nodeTypeId, this.state.driverNodeTypeId], this.props.nodeTypes
    );
    return (
      <Panel
        key='tags'
        title='Tags'
        name='tags'
        disabled={shouldDisable}
        tooltipText={AwsTagListViewConstants.DISABLED_TOOLTIP_TEXT}
      >
        <AwsTagList
          ref={tagsRef}
          editable
          customTags={this.state.customTags}
          onChange={this.onChangeTags}
        />
      </Panel>
    );
  }

  renderSshTab() {
    return (
      <Panel key='ssh' title='SSH' name='ssh'>
        <SshSettings
          ref='sshSettings'
          defaultSshKeyBlob={this.state.sshKey}
          onChange={this.onChangeSshKey}
        />
      </Panel>
    );
  }

  renderTabs() {
    const awsRef = (ref) => this.aws = ref;
    const sparkRef = (ref) => this.sparkConf = ref;
    return (
        <Tabs>
          <Panel key='aws' title='AWS' name='aws'>
            <AwsSettings
              ref={awsRef}
              enableAZ={this.props.enableAZ}
              enableNodeType={this.props.enableNodeType}
              defaultZoneId={this.state.zoneId}
              defaultNodeType={this.state.nodeTypeId}
              defaultDriverNodeTypeId={this.state.driverNodeTypeId}
              zoneInfos={this.props.zoneInfos}
              nodeTypes={this.getNodeTypes()}
              onChange={this.onChangeAws}
              hideSpotBidPrice={this.props.hideSpotBidPrice}
              spotBidPrice={this.state.spotBidPrice}
              ebsVolumeType={this.props.ebsVolumeType}
              ebsVolumeCount={this.props.ebsVolumeCount}
              ebsVolumeSize={this.props.ebsVolumeSize}
              numWorkers={this.props.numWorkers}
              minWorkers={this.props.minWorkers}
              maxWorkers={this.props.maxWorkers}
              restrictedClusterCreation={this.props.restrictedClusterCreation}
              showEBSVolumes={this.props.showEBSVolumes}
              gpuWorkloadIsSelected={this.props.gpuWorkloadIsSelected}
              showInstanceProfiles={this.props.showInstanceProfiles}
              instanceProfileArn={this.props.instanceProfileArn}
            />
          </Panel>
          <Panel key='spark' title='Spark' name='spark'>
            <ReactSparkConfElement
              ref={sparkRef}
              defaultSparkConfBlob={ReactSparkConfElement.makeSparkConfString(this.state.sparkConf)}
              onChange={this.onChangeSparkConf}
            />
          </Panel>
          {this.props.renderTags ? this.renderTagsTab() : null}
          {this.props.renderSsh ? this.renderSshTab() : null}
        </Tabs>
    );
  }

  render() {
    let links = null;
    let tabs = null;

    if (this.state.showAdvancedSettings) {
      links = <div><i className='fa fa-angle-double-up' /> Hide advanced settings</div>;
      tabs = this.renderTabs();
    } else {
      links = <div><i className='fa fa-angle-double-down' /> Show advanced settings</div>;
    }
    return (
        <div className='create-advanced'>
          <a ref='toggleAdvancedSettings'
            onClick={this.toggleAdvancedSettings}
            className='advanced-settings-link'
          >
            {links}
          </a>
          {tabs}
        </div>
    );
  }
}

AdvancedSettings.propTypes = {
  onChange: React.PropTypes.func.isRequired,
  hideSpotBidPrice: React.PropTypes.bool.isRequired,
  defaultSpotBid: React.PropTypes.number.isRequired,
  enableAZ: React.PropTypes.bool,
  enableNodeType: React.PropTypes.bool,
  defaultZoneId: React.PropTypes.string.isRequired,
  defaultNodeType: React.PropTypes.string.isRequired,
  defaultSparkConf: React.PropTypes.object.isRequired,
  defaultDriverNodeTypeId: React.PropTypes.string.isRequired,
  defaultSshKey: React.PropTypes.array,
  renderSsh: React.PropTypes.bool,
  renderTags: React.PropTypes.bool,
  zoneInfos: React.PropTypes.array.isRequired,
  nodeTypes: React.PropTypes.array.isRequired,
  ebsVolumeType: React.PropTypes.string,
  ebsVolumeCount: React.PropTypes.oneOfType([
    React.PropTypes.string,
    React.PropTypes.number,
  ]),
  ebsVolumeSize: React.PropTypes.oneOfType([
    React.PropTypes.string,
    React.PropTypes.number,
  ]),
  toggleAdvSettingsCallback: React.PropTypes.func,
  restrictedClusterCreation: React.PropTypes.bool,
  numWorkers: React.PropTypes.number,
  minWorkers: React.PropTypes.number,
  maxWorkers: React.PropTypes.number,
  showEBSVolumes: React.PropTypes.bool,
  gpuWorkloadIsSelected: React.PropTypes.bool,
  showInstanceProfiles: React.PropTypes.bool,
  instanceProfileArn: React.PropTypes.string,
  customTags: React.PropTypes.array,
};

AdvancedSettings.defaultProps = {
  defaultSparkConf: '',
  defaultSshKey: [],
  enableAZ: true,
  enableNodeType: true,
  restrictedClusterCreation: false,
  gpuWorkloadIsSelected: false,
  customTags: [],
};
