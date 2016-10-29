/* eslint consistent-return: 0, max-lines: 0 */

import $ from 'jquery';
import _ from 'underscore';

import React from 'react';
import PureRenderMixin from 'react-addons-pure-render-mixin';

import { NumberUtils } from '../js_polyfill/NumberUtils';

import Presence from '../presence/Presence';

import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';
import { Panel } from '../ui_building_blocks/TabsView.jsx';

import { DbGuideUrls } from '../urls/DbGuideUrls';
import DbGuideLinks from '../urls/DbGuideLinks.js';

export class Label extends React.Component {
  constructor(props) {
    super(props);
    this.shouldComponentUpdate = PureRenderMixin.shouldComponentUpdate.bind(this);
  }

  render() {
    return <div className='cluster-create-label'>{this.props.children}</div>;
  }
}

Label.propTypes = {
  children: React.PropTypes.node,
};

export class CancelButton extends React.Component {
  constructor(props) {
    super(props);
    this.shouldComponentUpdate = PureRenderMixin.shouldComponentUpdate.bind(this);
  }

  render() {
    return (<div className='btn cancel-button' onClick={this.props.onClick}>
      Cancel
    </div>);
  }
}

CancelButton.propTypes = {
  onClick: React.PropTypes.func,
};

export class SubmitButton extends React.Component {
  constructor(props) {
    super(props);
    this.shouldComponentUpdate = PureRenderMixin.shouldComponentUpdate.bind(this);
  }

  render() {
    return (
      <div className='btn btn-primary confirm-button' disabled={this.props.disabled}
        onClick={this.props.disabled ? null : this.props.onClick}
      >
        {this.props.text}
      </div>
    );
  }
}

SubmitButton.propTypes = {
  disabled: React.PropTypes.bool,
  onClick: React.PropTypes.func,
  text: React.PropTypes.oneOfType([
    React.PropTypes.string,
    React.PropTypes.node,
  ]),
};

SubmitButton.defaultProps = {
  disabled: false,
};

export function JdbcExampleTooltip() {
  const url = DbGuideUrls.getDbGuideUrl(DbGuideLinks.SQL_ENDPOINTS_URL);
  const SQLHelpText = (<div>
    Spark-compatible JDBC/ODBC clients can access the SQL functionality of this cluster using
    these URLs.
    {' '}
    <a href={url} target='_blank'>Learn more</a>
  </div>);

  return (
    <Tooltip text={SQLHelpText} customPosition={{ contentLeft: '0px' }}>
      <i className='fa fa-question-circle help-icon' />
    </Tooltip>
  );
}

export function JdbcInstructions() {
  const url = DbGuideUrls.getDbGuideUrl(DbGuideLinks.SQL_ENDPOINTS_URL);
  const learnLink = <a href={url} target='_blank'>click here</a>;
  return (
    <div className='ssh-instructions'>
      For more information on connecting your favorite BI tool to Databricks,
      {' '}
      {learnLink}.
    </div>
  );
}

export function DBUTooltip({ customPosition }) {
  const DBULink = 'https://www.databricks.com/product/pricing#dbu';
  const DBUHelpText = (<div>
    A Databricks Unit ("DBU") is a unit of Apache Spark processing capability per
    hour. <a href={DBULink} target='_blank'>Learn more</a>
  </div>);

  return (
    <Tooltip text={DBUHelpText} customPosition={customPosition}>
      <i className='fa fa-question-circle help-icon' />
    </Tooltip>
  );
}

export function CudaEulaTooltip({ customPosition }) {
  const url = 'http://docs.nvidia.com/cuda/eula';
  const link = (<a href={url} target='_blank'>
      CUDA End User License Agreement (EULA)
    </a>);
  const helpText = (<div>
    By using this version of Spark, you agree to the terms and conditions outlined
    in the NVIDIA {link}.
  </div>);

  return (
    <Tooltip text={helpText} customPosition={customPosition}>
      <i className='fa fa-question-circle help-icon' />
    </Tooltip>
  );
}

DBUTooltip.propTypes = {
  customPosition: React.PropTypes.object,
};

export function AZTooltip({ customPosition }) {
  const tooltipText = (
    <div>
      <span><i>Cluster availability zone</i> - your desired machine type may only be available
        in certain availability zones.
      </span><br /><br />
      <span><i>Spot pricing</i> - the cost of spot instances may vary between availability
        zones.
      </span><br /><br />
      <span><i>Reserved instances</i> - select an availability zone to use reserved instances
        you may have.
      </span>
    </div>
  );

  // customPosition added in case position of tooltip isn't being rendered quite correctly.
  // This mirrors the customPosition optional prop in Tooltip.jsx
  return (
    <Tooltip text={tooltipText} customPosition={customPosition || { contentLeft: '0px' }}>
      <i className='fa fa-question-circle help-icon availability-zone-tooltip' />
    </Tooltip>
  );
}

AZTooltip.propTypes = {
  customPosition: React.PropTypes.object,
};

export function InstanceTypeTooltip({ customPosition }) {
  const tooltipText = (
    <div>
      <span>
        <i>Instance Availability</i> - your desired machine type may only be available in
        certain availability zones.
      </span>
      <br /><br />
      <span>
        <i>On-Demand</i> - Driver and worker are placed on on-demand instances.
      </span>
      <br /><br />
      <span>
        <i>On-Demand and Spot</i> - Driver on-demand, workers can be on spot or on-demand.
      </span>
      <br /><br />
      <span>
        <i>Spot</i> - Driver and worker on spot instances.
      </span>
    </div>
  );

  // customPosition added in case position of tooltip isn't being rendered quite correctly.
  // This mirrors the customPosition optional prop in Tooltip.jsx
  return (
    <Tooltip text={tooltipText} customPosition={customPosition || { contentLeft: '0px' }}>
      <i className='fa fa-question-circle help-icon instancetype-tooltip' />
    </Tooltip>
  );
}

InstanceTypeTooltip.propTypes = {
  customPosition: React.PropTypes.object,
};

/**
 * Given a NodeType object, indicates if this node can be launched with GPU driver images.
 */
export function isGpuNodeType(nodeType) {
  // in prod: gpu, in little-bang: compute
  const MAGIC_GPU_NODE_STRING = 'gpu';
  return nodeType.category && nodeType.category.toLowerCase().includes(MAGIC_GPU_NODE_STRING);
}

/**
 * Given the id of a node type (a string) and an array of NodeType objects,
 * indicates if the node type referenced by the string is a GPU node type.
 *
 * Returns undefined if the nodeTypes array does not contain the node of the
 * given id.
 */
export function isGpuNodeTypeAndExists(nodeTypeId, nodeTypes) {
  const nodeType = nodeTypes.find((nt) => nt.node_type_id === nodeTypeId);
  return nodeType && isGpuNodeType(nodeType);
}

/**
 * Given a string with a spark version, checks if this spark version requires some special
 * hardware support (GPU) to run correctly.
 *
 * The spark version is supposed to include some special string in this case.
 */
export function isGpuSparkVersion(sparkVersion) {
  // in prod: gpu, in little-bang: little
  const MAGIC_SPARK_GPU_STRING = 'gpu';
  return sparkVersion.toLowerCase().includes(MAGIC_SPARK_GPU_STRING);
}

export function TypeTooltip({ customPosition }) {
  const tooltipText =
    `New (beta) node types have one Spark worker per instance.
    Original node types have two Spark workers per instance.`;
  // customPosition added in case position of tooltip isn't being rendered quite correctly.
  // This mirrors the customPosition optional prop in Tooltip.jsx
  return (
      <Tooltip text={tooltipText} customPosition={customPosition || { contentLeft: '-1px' }}>
        <i className='fa fa-question-circle help-icon nodetype-tooltip' />
      </Tooltip>
  );
}

TypeTooltip.propTypes = {
  customPosition: React.PropTypes.object,
};

export function CustomSpotPriceTooltip({ min, max, className, customPosition }) {
  const tooltipText = (<div>
    <i>Spot Bid Price</i> - specifies the spot bid price as a percentage of the on-demand instance
    price ({min}-{max}&#37;). The default percentage is the on-demand instance price. Note that
    Databricks will only place clusters on instances with this exact bid. This means that new spot
    instances will be acquired when launching a new cluster, even if there currently are unutilized
    spot instances acquired using a different bid.
  </div>);
  const position = customPosition || { contentLeft: '-1px' };

  return (
    <Tooltip text={tooltipText} customPosition={position} classes={[className]} >
      <i className='fa fa-question-circle help-icon custom-spot-price-tooltip-icon' />
    </Tooltip>
  );
}

CustomSpotPriceTooltip.propTypes = {
  min: React.PropTypes.number.isRequired,
  max: React.PropTypes.number.isRequired,
  className: React.PropTypes.string,
  customPosition: React.PropTypes.object,
};

CustomSpotPriceTooltip.defaultProps = {
  className: '',
};

export function SshInstructions() {
  const url = DbGuideUrls.getDbGuideUrl(DbGuideLinks.SSH_URL);
  const learnLink = <a href={url} target='_blank'>Learn more</a>;

  return (
    <div className='ssh-instructions'>
      <strong>Note:</strong> Your Databricks EC2 security group also needs to
      be configured to allow access to port {window.settings.sshContainerForwardedPort}.
      To SSH into workers, find the worker hostnames
      on the Spark Cluster UI -> Master tab.{' '}{learnLink}
    </div>
  );
}

export function SshExampleTooltip({ customPosition }) {
  const text = 'Copy the below SSH command and replace the private key ' +
    'and hostname with actual values.';
  return (
    <Tooltip text={text} customPosition={customPosition}>
      <i className='fa fa-question-circle help-icon ssh-tooltip' />
    </Tooltip>
  );
}

SshExampleTooltip.propTypes = {
  customPosition: React.PropTypes.object,
};

export function SshSetupTooltip({ customPosition }) {
  const url = DbGuideUrls.getDbGuideUrl(DbGuideLinks.SSH_URL);
  const learnLink = <a href={url} target='_blank'>Learn more</a>;
  const text = (<span>
    The public key of the SSH key pair to use to login to the driver or worker
    instances. You need to update the "unmanaged" security group in AWS console
    to provide access from the machine you want to ssh. {learnLink}
  </span>);

  return (
    <Tooltip text={text} customPosition={customPosition}>
      <i className='fa fa-question-circle help-icon ssh-tooltip' />
    </Tooltip>
  );
}

SshSetupTooltip.propTypes = {
  customPosition: React.PropTypes.object,
};

export function SparkImageTooltip() {
  const url = 'http://docs.databricks.com/user-guide/clusters/index.html#' +
      'databricks-cluster-versions';
  const learnLink = <a href={url} target='_blank'>Databricks Guide</a>;
  const text = (<span>
    Selects the image that will be used to create the cluster.
    For details about specific images, see {learnLink}.
  </span>);

  return (
    <Tooltip text={text} inlineAutoPosition={true}>
      <i className='fa fa-question-circle help-icon cluster-image-tooltip' />
    </Tooltip>
  );
}

/**
 * Render memory, cores, and DBU stats
 */
export function InstanceStats({ memory, cores, dbus }) {
  // because we use customized instance types internally that may not map to DBUs, only show
  // dbus if it exists
  const dbuElem = <span>, {dbus} DBU</span>;
  const showDBUElem = !window.settings.enableRestrictedClusterCreation &&
    dbus !== undefined && dbus !== null;

  return (
    <span className='reg-font-label'>
      {memory} GB Memory, {cores} Cores
      {showDBUElem ? dbuElem : null}
    </span>
  );
}

InstanceStats.propTypes = {
  memory: React.PropTypes.oneOfType([
    React.PropTypes.string,
    React.PropTypes.number,
  ]).isRequired,
  cores: React.PropTypes.oneOfType([
    React.PropTypes.string,
    React.PropTypes.number,
  ]).isRequired,
  dbus: React.PropTypes.oneOfType([
    React.PropTypes.string,
    React.PropTypes.number,
  ]).isRequired,
};

// Please keep this in sync with SparkVersionConf.scala
const SPARK_VERSIONS_KEY = 'sparkVersions';

export class ClusterUtil {
  static onDemandDisplayStr() {
    return 'On-Demand';
  }

  static hybridDisplayStr() {
    return 'On-Demand and Spot';
  }

  static spotDisplayStr() {
    return 'Spot';
  }

  /**
   * Important: keep in sync with slugify() in Util.scala. This is used in public APIs.
   * @param name cluster name to slugify
   */
  static slugifyClusterName(name) {
    const lower = name.toLowerCase();
    let result = '';
    for (let i = 0; i < lower.length; i++) {
      const c = lower.charAt(i);
      if (c.match('[a-z0-9]')) {
        result += c;
      } else if (c === '-' || c === ' ' || c === '_') {
        result += '-';
      }
    }
    return result;
  }

  /**
   * Returns a dictionary of jdbc connectivity information, including a URL that can be used to
   * connect to the cluster through the SQL proxy.
   *
   * @param context reference to the window object
   * @param clusterSpec cluster slug or cluster id
   */
  static getJdbcInfo(context, clusterSpec) {
    const port = context.location.port || '443';
    const maybeSSL = (context.location.protocol === 'https:') ? 'ssl=true;' : '';
    const httpPath = 'sql/protocolv1/o/' + context.settings.orgId + '/' + clusterSpec;
    const url = 'jdbc:hive2://' + context.location.hostname + ':' + port +
      '/default;transportMode=http;' + maybeSSL + 'httpPath=' + httpPath;
    return {
      host: context.location.hostname,
      port: port,
      path: httpPath,
      protocol: maybeSSL ? 'HTTPS' : 'HTTP',
      url: url,
    };
  }

  /**
   * Renders the JDBC/ODBC tab for a given cluster.
   */
  static renderJdbcTab(cluster, metricFunc) {
    const info = ClusterUtil.getJdbcInfo(window, cluster.get('clusterId'));
    const alias = ClusterUtil.getJdbcInfo(
      window, ClusterUtil.slugifyClusterName(cluster.get('clusterName')));
    return (
      <Panel key='jdbcOdbc' title='JDBC/ODBC' name='jdbcOdbc' onClick={metricFunc}>
        <div className='tab-info-section-wrapper'>
          <div className='tab-info-section section-padded'>
            <Label>Server Hostname</Label>
            <div>{info.host}</div>
          </div>
          <div className='tab-info-section section-padded'>
            <Label>Port</Label>
            <div>{info.port}</div>
          </div>
          <div className='tab-info-section section-padded'>
            <Label>Protocol</Label>
            <div>{info.protocol}</div>
          </div>
          <div className='tab-info-section section-padded'>
            <Label>HTTP Path</Label>
            <div>
              <span className='ex-command'>{info.path}</span>
              <span className='cluster-detail-label'>(unique)</span>
            </div>
            <div>
              <span className='ex-command'>{alias.path}</span>
              <span className='cluster-detail-label'>(alias, not guaranteed unique)</span>
            </div>
          </div>
          <div className='tab-info-section section-padded'c>
            <Label>JDBC URL</Label>{' '}
            <JdbcExampleTooltip customPosition={{ contentLeft: '0px' }} />
            <pre>{info.url}</pre>
            <pre>{alias.url}</pre>
          </div>
          <JdbcInstructions />
        </div>
      </Panel>
    );
  }

  /**
   * @param numWorkers
   * @param nodeType
   * @param {bool} [displayToUser] (optional) whether the result is being shown to the user
   */
  static workersToMemoryMB(numWorkers, nodeType, displayToUser) {
    /**
     {
        nodeTypeId: "memory-optimized",
        memoryMb: 30 * 1024,
        numCores: 4.0,
        description: "Memory Optimized",
        instanceTypeId: "r3.2xlarge",
        containerMemoryMb: 28000,
        sparkHeapMemory: Math.floor(28000 * 0.85)
      },
     */
    const mem = this.getMemMB(nodeType, displayToUser);
    return numWorkers * mem;
  }

  static workersToMemoryGB(numWorkers, nodeType, displayToUser) {
    return this.workersToMemoryMB(numWorkers, nodeType, displayToUser) / 1024;
  }

  static getMemMB(nodeType, displayToUser) {
    let mem;

    // throw exception if the wrong type is passed in for nodeType (see PROD-10865)
    if (nodeType && typeof nodeType !== 'object') {
      throw new Error('Error: incorrect nodeType passed in; should be an object. ' +
        'See use of getMemMB or functions that call it.');
    }

    if (nodeType && nodeType.memory_mb) {
      mem = (nodeType.memory_mb);
    } else if (displayToUser) {
      mem = window.settings.displayDefaultContainerMemoryGB * 1024;
    } else {
      mem = window.settings.defaultMemoryPerContainerMB;
    }

    return mem;
  }

  /**
   * Same as workersToMemory except adds 1 for the driver
   */
  static containersToMemoryMB(numWorkers, nodeType, driverNodeType, displayToUser) {
    const mem = this.getMemMB(nodeType, displayToUser);
    const driverMem = this.getMemMB(driverNodeType, displayToUser);
    return (numWorkers * mem) + driverMem;
  }

  static containersToMemoryGB(numWorkers, nodeType, driverNodeType, displayToUser) {
    return this.containersToMemoryMB(numWorkers, nodeType, driverNodeType, displayToUser) / 1024;
  }

  /**
   *
   * @param numWorkers
   * @param nodeType
   */
  static workersToCores(numWorkers, nodeType) {
    /**
     {
        nodeTypeId: "memory-optimized",
        memoryMb: 30 * 1024,
        numCores: 4.0,
        description: "Memory Optimized",
        instanceTypeId: "r3.2xlarge",
        containerMemoryMb: 28000,
        sparkHeapMemory: Math.floor(28000 * 0.85)
      },
     */
    let cores;
    if (nodeType && nodeType.num_cores) {
      cores = nodeType.num_cores;
    } else {
      cores = window.settings.defaultCoresPerContainer;
    }
    return numWorkers * cores;
  }

  /**
   * Get the DBUs to display to the user.
   * @param {object} nodeType NodeType object
   * @param {number} numOfInstances number of instances (will be multiplied by default DBU)
   * @returns {number or undefined}
   */
  static getDBU(nodeType, numOfInstances) {
    const nodeTypeToDBUsMap = window.settings && window.settings.defaultNodeTypeToPricingUnitsMap;
    if (!nodeTypeToDBUsMap) { return; }
    const dbus = nodeTypeToDBUsMap[nodeType.node_type_id];
    if (!dbus) { return; }
    return dbus * numOfInstances;
  }

  static createCluster(clusterAttr, success, fail) {
    const clusterName = clusterAttr.clusterName;
    const numWorkers = clusterAttr.numWorkers || 0;
    Presence.pushHistory(`Created cluster ${clusterName} (${numWorkers} workers)`);
    $.ajax('/clusters/create', {
      type: 'POST',
      data: JSON.stringify(clusterAttr),
      dataType: 'json',
    }).fail(fail).done(success);
  }

  static createClusterForJob(clusterAttr, success, fail) {
    $.ajax('/jobs/set-cluster', {
      type: 'POST',
      data: JSON.stringify(clusterAttr),
      dataType: 'json',
    }).fail(fail).done(success);
  }

  static configureCluster(clusterAttr, success, fail) {
    $.ajax('/clusters/resize', {
      type: 'POST',
      data: JSON.stringify(clusterAttr),
      dataType: 'json',
    }).fail(fail).done(success);
  }

  /**
   *
   * @param {string} nodeTypeId
   * @param {array} [nodeTypeList] array of nodeType objects (optional)
   *
   * @return {object} nodeType object
   */
  static getNodeType(nodeTypeId, nodeTypeList) {
    if (!nodeTypeList) {
      nodeTypeList = window.settings.nodeInfo.node_types;
    }

    // @TODO(jengler) We should just store the node type objects in a hash of id -> object.
    return _.find(nodeTypeList, (e) => e.node_type_id === nodeTypeId);
  }

  static fetchLatest(endpoint, success, failure) {
    $.ajax({
      dataType: 'json',
      url: '/clusters/' + endpoint,
      success: success,
      error: failure,
    });
  }

  static updateNodeInfo(dest) {
    const success = (nodeTypes) => {
      dest.node_types.splice(0, dest.length);
      Array.prototype.push.apply(dest.node_types, nodeTypes.node_types);
      dest.default_node_type_id = nodeTypes.default_node_type_id;
    };

    const failure = (xhr, status, error) => {
      console.error('Failed to fetch Node Types, retrying', status, error);
      _.delay(ClusterUtil.updateNodeInfo.bind(this, dest), 10000);
    };

    this.fetchLatest('node-types', success, failure);
  }

  static updateSparkVersions(dest, successCallback) {
    const success = (data) => {
      dest[SPARK_VERSIONS_KEY] = data[SPARK_VERSIONS_KEY];
      if (successCallback) {
        successCallback(data[SPARK_VERSIONS_KEY]);
      }
    };

    const failure = (xhr, status, error) => {
      console.error('Failed to fetch Spark versions, retrying', status, error);
      _.delay(ClusterUtil.updateSparkVersions.bind(this, dest, successCallback), 10000);
    };

    this.fetchLatest('spark-versions', success, failure);
  }

  /**
   * Returns true if the number of clusters exceeds the active clusters limit with the current
   * settings.
   */
  static exceedsClusterLimit(numActiveClusters) {
    return window.settings.enableRestrictedClusterCreation &&
           window.settings.clustersLimit !== -1 &&
           numActiveClusters >= window.settings.clustersLimit;
  }

  /**
   * Returns the tooltip to show when the number of active clusters exceeds the limit.
   * @param link The link that the tooltip appears underneath.
   * @returns {XML} A ReactElement for the link and tooltip.
   */
  static generateClusterLimitTooltip(link) {
    // PROD-8484: Show a tooltip when restricted cluster creation is enabled and we already have
    // reached the total cluster limit.
    const tip = (
        <span>
          You have reached the maximum number of active clusters. Please terminate an existing
          cluster or <a href={window.settings.pricingURL} target={"_blank"}>upgrade</a> to a
          larger plan.
        </span>
    );
    return (
      <Tooltip id={"cluster-limit-tooltip"} text={tip}>
        {link}
      </Tooltip>
    );
  }

  /**
   * Returns true if value is a valid number of workers for a cluster
   * @param  {String} value Input value of number of workers
   * @return {bool} Whether or not the number of workers is valid
   */
  static clusterWorkersValidator(value) {
    return value !== '' && NumberUtils.isSimpleInteger(value) &&
      Number(value) >= 0 && Number(value) <= 100000;
  }

  /**
   * Returns the number of notebooks which, when attached to a single cluster, can start to
   * cause performance issues due to resource limitations in the driver.
   *
   * TODO(mgyucht): PROD-9336 We found out that we can attach up to about 30 notebooks to a
   * Community Edition cluster before crashing the driver. Additionally, we have a hard-coded
   * limit in the driver of 150 notebooks attached to a cluster for the traditional 30GB driver.
   * We should figure out how many notebooks we can attach to a 30GB driver and fix the logic here.
   *
   * @param cluster {Cluster} The cluster in question.
   * @returns {boolean} true if the cluster has close to the maximum number of notebooks attached.
   */
  static warnTooManyNotebooks(cluster) {
    const maxNotebooksPerDriverGB = 5;
    const warningBuffer = 10;

    const nodeType = this.getNodeType(cluster.get('nodeTypeId'));
    const driverNodeType = this.getNodeType(cluster.get('driverNodeTypeId'));
    const driverGB = this.containersToMemoryGB(0, nodeType, driverNodeType);
    const limit = (driverGB * maxNotebooksPerDriverGB) - warningBuffer;
    return cluster.get('notebooks').length > limit;
  }

  /**
   * Given a cluster, returns a warning which can be displayed to the user indicating this fact.
   *
   * @param cluster {Cluster} The cluster in question.
   * @returns {ReactElement} A warning message that the cluster has too many notebooks attached.
   */
  static getTooManyAttachedNotebooksWarning(cluster) {
    const numAttachedNotebooks = cluster.get('notebooks').length;
    return (
        <div><i>
          Warning: {numAttachedNotebooks} notebooks are already attached to this cluster. Attaching
          more notebooks might result in degraded performance.
        </i></div>
    );
  }

  static reuseExistingInstancesTip() {
    return (
      'Tip: Instances will be kept until their next hour of EC2 billing ends, without ' +
      'incurring additional EC2 costs. New clusters will reuse such instances.'
    );
  }

  static deleteCluster(clusterList, clusterId) {
    console.log('Removing cluster ID:' + clusterId);
    const model = clusterList.findWhere({ clusterId: clusterId });
    if (model) {
      const clusterName = model.get('clusterName');
      model.set('state', 'Terminating');
      model.save({ remove: true }, { patch: true });
      Presence.pushHistory('Terminated ' + clusterName);
    } else {
      console.error('Attempt to remove cluster not in cluster list: ', clusterId);
    }
  }

  static getDetailsLinks(clusterId) {
    const base = '#setting/clusters/' + clusterId;
    return {
      base: base,
      configuration: base + '/configuration',
      notebooks: base + '/notebooks',
      libraries: base + '/libraries',
      driverlogs: base + '/driverLogs',
      sparkclusterui: base + '/sparkClusterUi',
      sparkui: base + '/sparkUi',
    };
  }

  /**
   * Get the initial ZoneId that should be selected on the cluster create page.
   */
  static getInitialZoneId() {
    if (window.settings.randomizeZoneIds &&
        window.settings.zoneInfos &&
        window.settings.zoneInfos.length > 0) {
      return window.settings.zoneInfos[_.random(0, window.settings.zoneInfos.length - 1)].id;
    }
    return window.settings.defaultZoneId;
  }

  static isSparkVersionBadForAutoscaling(versionString) {
    return versionString.indexOf('1.3') === 0 || versionString.indexOf('1.4') === 0 ||
      versionString.indexOf('1.5') === 0 || versionString.indexOf('1.6.0') === 0 ||
      versionString.indexOf('1.6.1') === 0;
  }
}
