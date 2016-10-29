import $ from 'jquery';
import _ from 'lodash';
import React from 'react';

import {
  ClusterUtil,
  InstanceStats,
  DBUTooltip,
  Label,
  AZTooltip,
  TypeTooltip,
  CustomSpotPriceTooltip,
  isGpuNodeType,
  isGpuNodeTypeAndExists,
} from '../clusters/Common.jsx';
import { InstanceProfileField } from '../clusters/InstanceProfileElements.jsx';
import { EBSVolumeFields } from '../clusters/EBSVolumeFields.jsx';
import { EBSVolumeUtils } from '../clusters/EBSVolumeUtils.jsx';

import { Input, Select } from '../forms/ReactFormElements.jsx';

import { InstanceProfilesProtos } from '../proto';
import { ProtoService } from '../requests/ProtoApi';

import DropdownMenuView from '../ui_building_blocks/dropdowns/DropdownMenuView.jsx';

import { IamRolesUtils } from '../user_menu/iam_roles/IamRolesUtils.jsx';

const checkIcon = <i className='fa fa-check' />;
const sortIcon = <i className='fa fa-sort' />;
const SAME_AS_WORKER = 'same-as-worker';

export class AwsSettings extends React.Component {
  constructor(props) {
    super(props);

    this._onZoneChange = this._onZoneChange.bind(this);
    this._onInstanceProfileChange = this._onInstanceProfileChange.bind(this);
    this._setSelectedNode = this._setSelectedNode.bind(this);
    this._setSelectedDriver = this._setSelectedDriver.bind(this);
    this._onSpotBidPriceChange = this._onSpotBidPriceChange.bind(this);
    this._onSpotBidPriceBlur = this._onSpotBidPriceBlur.bind(this);
    this._toggleNodeDropdown = this._toggleNodeDropdown.bind(this);
    this._toggleDriverDropdown = this._toggleDriverDropdown.bind(this);
    this._onNodeChange =
      this._onChange.bind(this, this._setSelectedNode, this._toggleNodeDropdown);
    this._onDriverChange =
      this._onChange.bind(this, this._setSelectedDriver, this._toggleDriverDropdown);
    this._addNodeToNodeList = this._addNodeToNodeList.bind(this);
    this.shouldDisableNodeType = this.shouldDisableNodeType.bind(this);
    this._getNodeTypes = this._getNodeTypes.bind(this);
    this._getDriverNodeTypes = this._getDriverNodeTypes.bind(this);
    this.onInstanceProfileRpcSuccess = this.onInstanceProfileRpcSuccess.bind(this);
    this.maxSpotBidPrice = window.settings && window.settings.maxSpotBidPricePercent;
    this.minSpotBidPrice = window.settings && window.settings.minSpotBidPricePercent;

    const selectedZone = this.props.defaultZoneId ? { id: this.props.defaultZoneId } :
        _.find(this.props.zoneInfos, (info) => info.isDefault);
    const selectedDriverType = this.props.defaultDriverNodeTypeId ?
      this.props.defaultDriverNodeTypeId : SAME_AS_WORKER;

    this.state = {
      selectedZone: selectedZone ? selectedZone.id : null,
      selectedNodeType: this.props.defaultNodeType,
      selectedDriverType: selectedDriverType,
      showSpotBidPriceError: false,
      nodeDropdownVisible: false,
      driverDropdownVisible: false,
      availableInstanceProfiles: [],
      showInstanceProfileWarning: false,
    };
  }

  componentDidMount() {
    const protoService = new ProtoService(InstanceProfilesProtos.InstanceProfilesService);
    this.protoCall = protoService.rpc('listInstanceProfiles')(
      null, // rpcArg
      this.onInstanceProfileRpcSuccess,
      () => this.forceUpdate(),
    );
  }

  componentWillUnmount() {
    if (this.protoCall) {
      this.protoCall.abort();
    }
  }

  componentWillReceiveProps(nextProps) {
    // Invariant to be maintained: if and only if a GPU workload is selected (as
    // indicated by the default node type being a GPU node), then the selected
    // node type must be a GPU node type.
    // or, in code:
    //
    // isGpuNodeType(state.selectedNodeType) === isGpuNodeType(props.defaultNodeType)
    //
    // (state.selectedDriverType == SAME_AS_WORKER) || (
    //   isGpuNodeType(state.selectedDriverType) ===
    //      isGpuNodeType(props.defaultDriverNodeTypeId)
    //   )
    const currentNodeTypeIsGpu = isGpuNodeTypeAndExists(
      this.state.selectedNodeType,
      this.props.nodeTypes);
    const nextDefaultNodeTypeIsGpu = isGpuNodeTypeAndExists(
      nextProps.defaultNodeType,
      this.props.nodeTypes);
    if (currentNodeTypeIsGpu !== nextDefaultNodeTypeIsGpu) {
      this.setState({ selectedNodeType: nextProps.defaultNodeType });
      if (this.state.selectedDriverType !== SAME_AS_WORKER) {
        this.setState({ selectedDriverType: nextProps.defaultDriverNodeTypeId });
      }
    }
  }

  onInstanceProfileRpcSuccess(response) {
    const protoResponse = new InstanceProfilesProtos.ListInstanceProfiles.Response(response);
    this.setState({
      availableInstanceProfiles: protoResponse.instance_profiles,
    });
  }

  getZoneId() {
    return this.state.selectedZone;
  }

  _onZoneChange(value) {
    this.setState({ selectedZone: value });
    this.props.onChange({ zoneId: value });
  }

  _setSelectedNode(value) {
    this.setState({ selectedNodeType: value });

    this.props.onChange({
      nodeTypeId: value,
      driverNodeTypeId: this._getSelectedDriverNodeType(value),
    });
  }

  _setSelectedDriver(value) {
    this.setState({ selectedDriverType: value });

    this.props.onChange({
      driverNodeTypeId: value === SAME_AS_WORKER ? this.state.selectedNodeType : value,
    });
  }

  _nodeTypeInfo(nodeType) {
    const nodeInfo = _.find(this.props.nodeTypes,
        (e) => e.node_type_id === nodeType);

    if (typeof nodeInfo !== 'undefined') {
      const mem = Math.floor(nodeInfo.memory_mb / 1024);
      const dbus = ClusterUtil.getDBU(nodeInfo, 1);
      return (
        <div className='nodetype-info'>
          <InstanceStats memory={mem} cores={nodeInfo.num_cores} dbus={dbus} />{' '}
          <DBUTooltip />
        </div>
      );
    }
    return null;
  }

  _onSpotBidPriceChange(val) {
    const intVal = parseInt(val, 10);
    const invalid = intVal < this.minSpotBidPrice || intVal > this.maxSpotBidPrice;
    this.setState({
      showSpotBidPriceError: invalid,
    });
    this.props.onChange({ spotBidPrice: val });
  }

  _onSpotBidPriceBlur(val) {
    const intVal = parseInt(val, 10);
    if (intVal > this.maxSpotBidPrice) {
      val = this.maxSpotBidPrice;
    }
    if (intVal < this.minSpotBidPrice || val === '') {
      val = this.minSpotBidPrice;
    }
    this._onSpotBidPriceChange(parseInt(val, 10));
  }

  _renderCustomSpotPricing() {
    if (this.props.hideSpotBidPrice || !window.settings.enableCustomSpotPricing) {
      return null;
    }

    const tooltip = (<CustomSpotPriceTooltip
      className='custom-spot-price-tooltip'
      min={this.minSpotBidPrice}
      max={this.maxSpotBidPrice}
    />);
    const error = (<span className='error'>
      Must be between {this.minSpotBidPrice} and {this.maxSpotBidPrice}.
    </span>);

    return (
      <div className='custom-spot-price-selection section-padded'>
        <Label>Spot Bid Price</Label> {tooltip}
        <div>
          <Input
            ref='customSpotPrice'
            required
            inputID='customSpotPrice'
            value={this.props.spotBidPrice ? this.props.spotBidPrice.toString() : ''}
            type='number'
            inputClassName='custom-spot-price'
            onBlur={this._onSpotBidPriceBlur}
            onChange={this._onSpotBidPriceChange}
            min={this.minSpotBidPrice}
            max={this.maxSpotBidPrice}
          />
          <div className='spot-bid-percent'>
            <span className='nodetype-info'>&#37; of on-demand instance price</span>
            {this.state.showSpotBidPriceError ? error : null}
          </div>
        </div>
      </div>
    );
  }

  _toggleNodeDropdown() {
    $('.nodetype-selection .fake-select').toggleClass('focus', !this.state.nodeDropdownVisible);
    this.setState({
      nodeDropdownVisible: !this.state.nodeDropdownVisible,
    });
  }

  _toggleDriverDropdown() {
    $('.driver-nodetype-selection .fake-select')
        .toggleClass('focus', !this.state.driverDropdownVisible);
    this.setState({
      driverDropdownVisible: !this.state.driverDropdownVisible,
    });
  }

  _onChange(setStateFunction, toggleDropdownFunction, evt) {
    if (evt) {
      const selectedOption = $(evt.target).closest('.node-type-li');
      // if you clicked on a section header rather than an actual option
      // or if you clicked on a disabled option
      if (selectedOption.length === 0 || selectedOption.hasClass('disabled')) {
        return;
      }

      const value = selectedOption.data('value');
      setStateFunction(value);
    }
    toggleDropdownFunction();
  }

  // Indicates if the given node type should be enabled. This depends on:
  //  - the explicit flag .disabled (provided by the backend)
  //  - the current type of workload: CPU node types cannot be used in GPU workloads
  //    and vice versa.
  shouldDisableNodeType(nodeType) {
    if (!nodeType.disabled) {
      const isGpu = isGpuNodeType(nodeType);
      const isGpuWorkload = this.props.gpuWorkloadIsSelected;
      // CPU and GPU workloads cannot be mixed.
      return ((!isGpuWorkload) && isGpu) || (isGpuWorkload && (!isGpu));
    }
    return true;
  }

  _addNodeToNodeList(nodeCategories, nodeType, i, selectedNodeType) {
    const mem = Math.floor(nodeType.memory_mb / 1024);
    const dbus = ClusterUtil.getDBU(nodeType, 1);
    const disabledClass = this.shouldDisableNodeType(nodeType) ? ' disabled' : '';
    const nodeOption = (
      <li key={`node-type-${i}`}
        className={`node-type-li${disabledClass}`}
        data-value={nodeType.node_type_id}
      >
        <a className={selectedNodeType === nodeType.node_type_id ? 'selected' : null}
          disabled={nodeType.disabled}
        >
          {selectedNodeType === nodeType.node_type_id ? checkIcon : null}
          {nodeType.description}
          <span className='node-type-descriptor'>
            (<InstanceStats memory={mem} cores={nodeType.num_cores} dbus={dbus} />)
          </span>
        </a>
      </li>
    );

    if (nodeCategories.hasOwnProperty(nodeType.category)) {
      nodeCategories[nodeType.category].push(nodeOption);
    } else {
      nodeCategories[nodeType.category] = [nodeOption];
    }
  }

  _getNodeTypes(selectedNodeType) {
    if (!this.props.nodeTypes) {
      return null;
    }
    if (!selectedNodeType) {
      selectedNodeType = this.state.selectedNodeType;
    }

    const nodeCategories = {};
    const nodeTypes = this.props.nodeTypes;

    for (let i = 0; i < nodeTypes.length; i++) {
      const nodeType = nodeTypes[i];

      this._addNodeToNodeList(nodeCategories, nodeType, i, selectedNodeType);
    }

    return _.map(Object.keys(nodeCategories), (key) =>
      <ul className='node-type-header'>
        <div className='node-type-header-text'>{key}</div>
        {nodeCategories[key]}
      </ul>
    );
  }

  _getDriverNodeTypes() {
    const listOfNodeTypes = this._getNodeTypes(this.state.selectedDriverType);
    const sameAsWorkerType = (
      <ul className='node-type-header'>
        <li key={'node-type-same'}
          className={'node-type-li'}
          data-value={SAME_AS_WORKER}
        >
          <a className={this.state.selectedDriverType === SAME_AS_WORKER ? 'selected' : null}>
            {this.state.selectedDriverType === SAME_AS_WORKER ? checkIcon : null}
            Same as worker
          </a>
        </li>
      </ul>
    );

    listOfNodeTypes.unshift(sameAsWorkerType);
    return listOfNodeTypes;
  }

  _getSelectedDriverNodeType(defaultNodeType = this.state.selectedNodeType) {
    return this.state.selectedDriverType === SAME_AS_WORKER ?
      defaultNodeType : this.state.selectedDriverType;
  }

  _isNodeTypeSupported(nodeType) {
    return EBSVolumeUtils.nodeTypeSupportsEBSVolumes(this.props.nodeTypes, nodeType);
  }

  _offendingNodeTypes() {
    const nodeTypes = [this.state.selectedNodeType, this._getSelectedDriverNodeType()];
    return _.uniq(nodeTypes)
      .filter((nodeType) => !this._isNodeTypeSupported(nodeType))
      .map((unsupportedNodeType) =>
        ClusterUtil.getNodeType(unsupportedNodeType, this.props.nodeTypes).description);
  }

  _getEBSVolumeFields() {
    const offendingNodeTypes = this._offendingNodeTypes();
    return (
      <EBSVolumeFields
        ebsVolumeType={this.props.ebsVolumeType}
        ebsVolumeCount={this.props.ebsVolumeCount}
        ebsVolumeSize={this.props.ebsVolumeSize}
        onChange={this.props.onChange}
        numWorkers={this.props.numWorkers}
        minWorkers={this.props.minWorkers}
        maxWorkers={this.props.maxWorkers}
        offendingNodeTypes={offendingNodeTypes}
        disableEBSVolumes={offendingNodeTypes.length > 0}
      />
    );
  }

  _onInstanceProfileChange(value) {
    this.props.onChange({ instanceProfileArn: value });
    this.setState({ showInstanceProfileWarning: !!value });
  }

  _getInstanceProfileOptions() {
    const options = [{
      value: '',
      label: 'None',
    }];
    const instanceProfileOptions = this.state.availableInstanceProfiles.map((profile) => {
      const arn = profile.instance_profile_arn;
      return {
        value: arn,
        label: IamRolesUtils.parseIamRoleName(arn),
      };
    });
    return options.concat(instanceProfileOptions);
  }

  _getInstanceProfileField() {
    return (
      <InstanceProfileField
        options={this._getInstanceProfileOptions()}
        value={this.props.instanceProfileArn}
        onChange={this._onInstanceProfileChange}
        showWarning={this.state.showInstanceProfileWarning}
        fetching={this.protoCall && this.protoCall.state() === 'pending'}
      />
    );
  }

  render() {
    const zoneOptions = _.map(this.props.zoneInfos, (info) => info.id);
    const displayedNode = _.find(this.props.nodeTypes, (nodeType) =>
      nodeType.node_type_id === this.state.selectedNodeType
    );
    const driverNodeTypes = _.cloneDeep(this.props.nodeTypes);
    const sameAsWorkerNodeType = _.cloneDeep(displayedNode);
    if (sameAsWorkerNodeType) {
      sameAsWorkerNodeType.category = undefined;
      sameAsWorkerNodeType.description = 'Same as worker';
      sameAsWorkerNodeType.node_type_id = SAME_AS_WORKER;

      if (driverNodeTypes) {
        driverNodeTypes.push(sameAsWorkerNodeType);
      }
    }
    const displayedDriver = _.find(driverNodeTypes, (nodeType) =>
      nodeType.node_type_id === this.state.selectedDriverType
    );

    const nodeDropdown = (
      <DropdownMenuView
        getItems={this._getNodeTypes}
        outsideClickHandler={this._onNodeChange}
        classes={['node-type-dropdown']}
      />
    );
    const driverDropdown = (
      <DropdownMenuView
        getItems={this._getDriverNodeTypes}
        outsideClickHandler={this._onDriverChange}
        classes={['node-type-dropdown']}
      />
    );

    return (
        <div className='aws-settings'>
          <div className='az-selection section-padded'>
            <Label>Availability Zone</Label> <AZTooltip />
            <div>
              <Select
                selectID='clusterZoneId'
                options={zoneOptions}
                value={this.state.selectedZone}
                onChange={this._onZoneChange}
                selectClassName='control-field cluster-dialog-element az-select'
              />
            </div>
          </div>
          <div className='nodetype-selection section-padded'>
            <Label>Worker Node Type</Label> <TypeTooltip />
            <div>
              <div className='control-field cluster-dialog-element fake-select worker-select'
                onClick={this._toggleNodeDropdown}
              >
                {displayedNode ? displayedNode.description : null}
                {sortIcon}
              </div>
              {this.state.nodeDropdownVisible ? nodeDropdown : null}
              {this._nodeTypeInfo(this.state.selectedNodeType)}
            </div>
          </div>
          <div className='driver-nodetype-selection section-padded'>
            <Label>Driver Node Type</Label> <TypeTooltip />
            <div>
              <div className='control-field cluster-dialog-element fake-select driver-select'
                onClick={this._toggleDriverDropdown}
              >
                {displayedDriver ? displayedDriver.description : null}
                {sortIcon}
              </div>
              {this.state.driverDropdownVisible ? driverDropdown : null}
              {this._nodeTypeInfo(this._getSelectedDriverNodeType())}
            </div>
          </div>
          {this._renderCustomSpotPricing()}
          {this.props.showEBSVolumes ? this._getEBSVolumeFields() : null}
          {this.props.showInstanceProfiles ? this._getInstanceProfileField() : null}
        </div>
    );
  }
}

AwsSettings.propTypes = {
  onChange: React.PropTypes.func.isRequired,
  hideSpotBidPrice: React.PropTypes.bool.isRequired,
  spotBidPrice: React.PropTypes.oneOfType([
    React.PropTypes.string,
    React.PropTypes.number,
  ]).isRequired,
  enableAZ: React.PropTypes.bool,
  enableNodeType: React.PropTypes.bool,
  defaultZoneId: React.PropTypes.string.isRequired,
  defaultDriverNodeTypeId: React.PropTypes.string,
  defaultNodeType: React.PropTypes.string.isRequired,
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
  numWorkers: React.PropTypes.number,
  minWorkers: React.PropTypes.number,
  maxWorkers: React.PropTypes.number,
  restrictedClusterCreation: React.PropTypes.bool,
  showEBSVolumes: React.PropTypes.bool,
  gpuWorkloadIsSelected: React.PropTypes.bool,
  showInstanceProfiles: React.PropTypes.bool,
  instanceProfileArn: React.PropTypes.string,
};

AwsSettings.defaultProps = {
  enableAZ: true,
  enableNodeType: true,
};
