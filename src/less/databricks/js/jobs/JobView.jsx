/* eslint prefer-spread: 0, complexity: 0, consistent-return: 0, max-lines: 0, func-names: 0 */

/**
 * Do not use this as an example for tables; it needs to be refactored to use
 * ReactTable's Table and Column. For now, see ClusterDetailsLibrariesList and
 * ClusterDetailsLibrariesListView.
 */

import $ from 'jquery';
import _ from 'lodash';
import underscore from 'underscore';
import React from 'react';
import ReactDOM from 'react-dom';

import ElasticDomUtil from '../jobs/ElasticDomUtil';

import { AclUtils } from '../acl/AclUtils.jsx';
import WorkspacePermissions from '../acl/WorkspacePermissions';

import Cluster from '../clusters/Cluster';
import { ClusterUtil } from '../clusters/Common.jsx';

import ItemDeltaReceiverView from '../delta_receiver/ItemDeltaReceiverView';

import TreeNode from '../filebrowser/TreeNode';

import FileTree from '../filetree/FileTree';
import NavFunc from '../filetree/NavFunc.jsx';

import { CronSchedule } from '../jobs/CronSchedule.jsx';
import ElasticUtil from '../jobs/ElasticUtil';
import FullElasticJobStatus from '../jobs/FullElasticJobStatus';
import { JobActionElement } from '../jobs/JobActionElement.jsx';
import { JobUtils } from '../jobs/JobUtils.jsx';
import ReactJarJobDialog from '../jobs/ReactJarJobDialog.jsx';
import { ReactJobClusterDialog } from '../jobs/ReactJobClusterDialog.jsx';

import { Input } from '../forms/ReactFormElements.jsx';

import { DeleteButton } from '../ui_building_blocks/buttons/DeleteButton.jsx';
import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';
import ReactModal from '../ui_building_blocks/dialogs/ReactModal.jsx';
import ReactModalUtils from '../ui_building_blocks/dialogs/ReactModalUtils';
import IconsForType from '../ui_building_blocks/icons/IconsForType';
import InlineEditableText from '../ui_building_blocks/text/InlineEditableText.jsx';
import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

import { BrowserUtils } from '../user_platform/BrowserUtils';
import { DateTimeFormats } from '../user_platform/DateTimeFormats';

import { EmailValidators } from '../validators/EmailValidators';

import '../../lib/jquery-cron'; // jquery-cron

const FILETREE_VIEW = 'fileTreeView';
const FILETREE_CONTROL = 'filetreeControl';
const FILETREE_DIV = 'filetreeDiv';

/**
 * Helper function for checking if the jobAction is for a Jar Job
 * @param  {object}  jobAction A jobAction for a job
 * @return {Boolean}           True iff the jobAction parameters match a jar job
 */
export function isJarJobAction(jobAction) {
  if (!jobAction) {
    return false;
  }
  const s3Path = jobAction.s3JarFile;
  return jobAction.type === 'jar' || !!(s3Path && s3Path.match(/^(dbfs|file):\/FileStore\/jars\//));
}


// @HACK(jengler) 2016-05-18: For JAR jobs we do not set a tree node as it may not have one
// if it was directly uploaded through a job's "Set JAR" menu.
export function treeNodeForJobAction(jobAction) {
  let selectedNode;
  if (jobAction) {
    selectedNode = window.treeCollection.find(function(treeNode) {
      if (jobAction.notebookPath) { // notebook task
        return NavFunc.getFullPath(treeNode.id) === jobAction.notebookPath;
      }
      // jar task
      return treeNode.get('file') === jobAction.s3JarFile;
    });
  }

  return selectedNode;
}

export class RunStatus extends React.Component {
  stateMessageIcon() {
    if (_.isEmpty(this.props.stateMessage)) {
      return null;
    }
    return <i className={'fa fa-' + IconsForType.error + ' state-message-icon'} />;
  }

  render() {
    return (
      <Tooltip ref='stateTooltip' text={this.props.stateMessage}>
        <div className='state-info'>
          <span>
            {this.props.displayState}
            &nbsp;
            {this.stateMessageIcon()}
          </span>
        </div>
      </Tooltip>);
  }
}

RunStatus.propTypes = {
  displayState: React.PropTypes.string.isRequired,
  stateMessage: React.PropTypes.string.isRequired,
};

/**
 * A wrapper of the JobView that:
 *   1. sets up the ItemDeltaReceiverView to listen to updates on the job model
 *   2. fetches run history data for pagination of the completed runs table
 *   3. (if cluster ACLs enabled) fetches cluster create permissions
 *   4. (if cluster ACLs enabled) fetches job permissions
 */
export class JobViewWrapper extends React.Component {
  constructor(props) {
    super(props);

    this.setupItemDeltaReceiver();
    this.pageData = null;
    this.pageDataStatus = 'Loading...';

    this.state = {
      hasModifyAndExecutePermission: true,
      hasCreateClusterPerms: true,
    };
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.page > 0) {
      this.fetchRunHistoryData(nextProps);
    }
  }

  setupItemDeltaReceiver() {
    const publisherRootId = this.props.job.get('publisherRootId');
    if (publisherRootId === null) {
      throw new Error('Publisher root id is null. Cannot listen to updates');
    }
    // Setup the ItemDeltaReceiver of FullElasticJobStatus
    this.receiver = new ItemDeltaReceiverView();
    this.receiver.startWatching(publisherRootId, FullElasticJobStatus);
    this.receiver.onChange(this.forceUpdate.bind(this));
  }

  componentDidMount() {
    this.fetchRunHistoryData(this.props);
    if (AclUtils.clusterAclsEnabled()) {
      this.fetchClusterCreatePermissions();
      this.fetchJobPermissions();
    }
  }

  componentWillUnmount() {
    this.receiver.collection.stopWatching();
  }

  fetchClusterCreatePermissions() {
    Cluster.ROOT.fetchPermissions(() => {
      this.setState({ hasCreateClusterPerms: Cluster.ROOT.canCreateClusters() });
    });
  }

  fetchJobPermissions() {
    const job = this.props.job;
    job.fetchPermissions(() => {
      this.setState({
        hasModifyAndExecutePermission: job.canRun(),
      });
    });
  }

  fetchRunHistoryData(props) {
    const self = this;
    const jobId = props.job.get('basicInfo').jobId;
    const offset = JobViewWrapper.RUN_TABLE_PAGE_OFFSET * props.page;
    $.ajax(`/jobs/get/${jobId}/limit/20/offset/${offset}`, {
      type: 'GET',
      success: (data) => {
        self.setPageData.call(self, data);
      },
      error: (xhr, status, error) => {
        self.pageDataStatus = 'Error fetching results: ' + error;
        self.forceUpdate();
      },
    });
  }

  setPageData(data) {
    this.pageData = data;
    if (data.history.length > 0) {
      this.pageDataStatus = null;
    } else {
      this.pageDataStatus = this.props.page > 0 ? 'No more results.' : null;
    }
    this.forceUpdate();
  }

  render() {
    return this.receiver && this.receiver.model ?
      <JobView
        isNewJob={this.props.isNewJob}
        hasCreateClusterPerms={this.state.hasCreateClusterPerms}
        openEditJar={this.props.openEditJar}
        job={this.receiver.model}
        page={this.props.page}
        pageData={this.pageData}
        pageDataStatus={this.pageDataStatus}
        lacksModifyAndExecutePermission={!this.state.hasModifyAndExecutePermission}
      /> : null;
  }
}

JobViewWrapper.RUN_TABLE_PAGE_OFFSET = 20;

JobViewWrapper.propTypes = {
  job: React.PropTypes.instanceOf(FullElasticJobStatus).isRequired,
  isNewJob: React.PropTypes.bool,
  // whether to immediately open the edit jar dialog (passed on to JobView)
  openEditJar: React.PropTypes.bool,
  page: React.PropTypes.number,
};

JobViewWrapper.defaultProps = {
  isNewJob: false,
  openEditJar: false,
  page: 0,
};

export class JobTaskView extends React.Component {
  constructor(props) {
    super(props);

    this.changeMenus = this.changeMenus.bind(this);

    this.state = {
      selectedNode: this.props.openNode,
      selectFile: true,
      parameters: '',
    };
  }

  destroyModal(e) {
    if (e) {
      e.preventDefault();
    }
    ReactModalUtils.destroyModal();
  }

  changeMenus(e) {
    e.preventDefault();

    let selectedNode;
    if (this.refs[FILETREE_VIEW]) {
      selectedNode = this.refs[FILETREE_VIEW].refs[FILETREE_CONTROL].fileTree.selectedNode();
    }

    if (this.state.selectFile && window.treeCollection.get(selectedNode).get('type') === 'shell') {
      this.props.onConfirmSetNotebook(selectedNode);
      this.destroyModal();
    } else {
      this.setState({
        selectFile: !this.state.selectFile,
        selectedNode: window.treeCollection.get(selectedNode),
      });
    }
  }

  render() {
    if (this.state.selectFile && !this.props.onlySetParameters) {
      return (
        <JobTaskFileTreeView
          ref={FILETREE_VIEW}
          openNode={this.props.openNode}
          jobAction={this.props.jobAction}
          destroyModal={this.destroyModal}
          changeMenus={this.changeMenus}
          shouldWarnRestartCluster={this.props.shouldWarnRestartCluster}
        />);
    }
    return (
      <JobTaskParametersView
        s3JarFile={this.props.jobAction[0].s3JarFile}
        setLibraryParameters={this.props.setLibraryParameters}
        onlySetParameters={this.props.onlySetParameters}
        mainClass={this.props.mainClass}
        parameters={this.props.parameters}
        destroyModal={this.destroyModal}
        changeMenus={this.changeMenus}
      />);
  }
}

JobTaskView.propTypes = {
  openNode: React.PropTypes.instanceOf(TreeNode),
  onConfirmSetNotebook: React.PropTypes.func,
  onlySetParameters: React.PropTypes.bool,
  setLibraryParameters: React.PropTypes.func,
  jobAction: React.PropTypes.array,
  mainClass: React.PropTypes.func,
  parameters: React.PropTypes.object,
  shouldWarnRestartCluster: React.PropTypes.bool,
};

export class JobTaskParametersView extends React.Component {
  constructor(props) {
    super(props);

    this._setLibrary = this._setLibrary.bind(this);
    this._onMainClassChange = this._onMainClassChange.bind(this);
    this._onParameterChange = this._onParameterChange.bind(this);
    this._getHeader = this._getHeader.bind(this);
    this._getBody = this._getBody.bind(this);
    this._getFooter = this._getFooter.bind(this);

    this.state = {
      mainClass: this.props.mainClass,
      parameters: this.props.parameters,
    };
  }

  _setLibrary(e) {
    e.preventDefault();

    let updatingTask = false;
    if (this.props.onlySetParameters) {
      updatingTask = true;
    }

    // we're no longer using a props selected node in this view
    // the selected node was actual irrelevant after ES-1056, but removed in ES-1505
    // as long as workspace libraries cannot be used as jar tasks
    // this.props.setLibraryParameters(this.props.selectedNode.get('file'),
    //     this.state.mainClass, this.state.parameters, this.props.selectedNode, updatingTask);
    this.props.setLibraryParameters(this.props.s3JarFile,
      this.state.mainClass, this.state.parameters, this.props.selectedNode, updatingTask);

    this.props.destroyModal();
  }

  _onMainClassChange(e) {
    this.setState({
      mainClass: e,
    });
  }

  _onParameterChange(e) {
    this.setState({
      parameters: e,
    });
  }

  _getHeader() {
    return <h3>Set Parameters</h3>;
  }

  _getBody() {
    const libraryType = 'java-jar';
    // @TODO(austin) bring this back when we can use libraries from the filetree
    // This feature is disabled because it is broken (PROD-11854)
    // if (this.props.selectedNode) {
    //   nodeId = this.props.selectedNode.get('id');
    //   libraryType = this.props.selectedNode.get('libraryType');
    // }
    // const nodeId = NavFunc.getDefaultFolderId();
    // const nodePath = NavFunc.getFullPath(nodeId);
    const nodePath = this.props.s3JarFile;
    let libraryTypeString;
    switch (libraryType) {
      case 'java-jar':
        libraryTypeString = 'JAR';
        break;
      case 'python-pypi':
        libraryTypeString = 'PyPi';
        break;
      case 'python-egg':
        libraryTypeString = 'Python Egg';
        break;
      case 'maven':
        libraryTypeString = 'Maven';
        break;
      default:
        // Do nothing
    }
    return (
      <div>
        <div className='row-fluid'>
          <div className='set-parameters-label'>
            Please specify the parameters for the task
          </div>
        </div>
        <div className='row-fluid'>
          <span className='set-parameters-label'>Type: </span>
          {libraryTypeString}
          <span className='set-parameters-label'>Task: </span>
          {nodePath}
        </div>
        <div className='row-fluid' id='task-parameter-fields'>
          <div className='set-parameters-label'>
            Main Class
          </div>
          <Input type='text'
            inputClassName='control-field parameter-input'
            required
            onChange={this._onMainClassChange}
            defaultValue={this.state.mainClass}
          />
          <div className='set-parameters-label'>
            Arguments
          </div>
          <Input type='text'
            inputClassName='control-field parameter-input'
            onChange={this._onParameterChange}
            defaultValue={this.state.parameters}
          />
        </div>
      </div>
    );
  }

  _getFooter() {
    return (
      <div>
        {this.props.onlySetParameters ?
        <a className='btn cancel-button' onClick={this.props.destroyModal}>Cancel</a>
        :
        <a className='btn cancel-button' onClick={this.props.changeMenus}>Back</a>
        }
        <a className='btn btn-primary confirm-button' onClick={this._setLibrary}>
          Confirm
        </a>
      </div>
    );
  }
  render() {
    const header = this._getHeader();
    const body = this._getBody();
    const footer = this._getFooter();

    return (
      <ReactModal
        modalName='set-parameters'
        header={header}
        body={body}
        footer={footer}
      />);
  }
}

JobTaskParametersView.propTypes = {
  mainClass: React.PropTypes.func,
  onlySetParameters: React.PropTypes.bool,
  setLibraryParameters: React.PropTypes.func,
  s3JarFile: React.PropTypes.string,
  destroyModal: React.PropTypes.func,
  changeMenus: React.PropTypes.func,
  parameters: React.PropTypes.object,
};

export class JobTaskFileTreeView extends React.Component {
  constructor(props) {
    super(props);

    this._getHeader = this._getHeader.bind(this);
    this._getBody = this._getBody.bind(this);
    this._getFooter = this._getFooter.bind(this);
  }

  componentDidMount() {
    this.setupFileTree();
  }

  componentDidUpdate() {
    this.setupFileTree();
  }

  setupFileTree() {
    const dialog = $('.modal-main-job-task');
    const treeDiv = $(this.refs[FILETREE_DIV]);
    const newControl = $(this.refs[FILETREE_CONTROL]);
    const fileTree = new FileTree(
      treeDiv,
      window.fileBrowserView.getReadOnlyTreeProvider(['shell']),
      { scrollElement: newControl[0] });

    const updateTreeValidityFunc = function() {
      const validate = (node) => {
        if (node === undefined || node.hasChildren) {
          return false;
        }
        return true;
      };

      const updateFormValidity = function() {
        let valid = true;
        dialog.find('.control-field').each(function() {
          if ($(this).hasClass('invalid-form')) {
            valid = false;
          }
        });
        if (valid) {
          dialog.find('.confirm-button').removeAttr('disabled');
        } else {
          dialog.find('.confirm-button').attr('disabled', true);
        }
      };

      const toggleFormValidity = function() {
        newControl.toggleClass('invalid-form', !validate(fileTree.selectedNode()));
        updateFormValidity();
      };

      return toggleFormValidity;
    };

    newControl[0].fileTree = fileTree;
    dialog.addClass('file-picker-dialog');
    newControl.addClass('control-field');
    newControl.attr('id', 'notebookPicker');
    const validFunc = updateTreeValidityFunc();
    fileTree.treeProvider.selectionChanged = validFunc;
    validFunc();

    // Sometimes the open node won't be propagated correctly at instantiation of view.
    // This is probably due to the window.treeCollection not being there at the very start.
    // This safeguards for it.
    let selectedNode = this.props.openNode;
    if (!selectedNode) {
      selectedNode = treeNodeForJobAction(this.props.jobAction);
    }

    // If we could not find the node in the tree store, then open the filebrowser to the home
    // folder. If we can't find the user's home folder, just get the rootFolderNode (which we
    // assume always exists)
    if (!selectedNode) {
      selectedNode = NavFunc.getHomeFolderNode() || NavFunc.getRootFolderNode();
    }

    fileTree.openToNode(
      window.fileBrowserView.toTreeNode(selectedNode)
    );
  }

  _getHeader() {
    return <h3>Select Notebook</h3>;
  }

  _getExistingClusterJarWarning() {
    return (
      <div className='jar-dialog-notice'>
        <span className='warning-font'>
          If you select a JAR, you must restart the cluster for the new JAR file
          to be attached to your cluster.
        </span>
      </div>
    );
  }

  _getBody() {
    return (
      <div>
        {this.props.shouldWarnRestartCluster ? this._getExistingClusterJarWarning() : null}
        <div className='select-notebook-label'>
          Select a notebook to run as a job:
        </div>
        <div className='dialog-filetree-container' ref={FILETREE_CONTROL}>
          <div id='tree-div' ref={FILETREE_DIV}></div>
        </div>
      </div>
    );
  }

  _getFooter() {
    return (
      <div>
        <a className='btn cancel-button' onClick={this.props.destroyModal}>Cancel</a>
        <a className='btn btn-primary confirm-button' onClick={this.props.changeMenus}>
          OK
        </a>
      </div>
    );
  }

  render() {
    const header = this._getHeader();
    const body = this._getBody();
    const footer = this._getFooter();

    return (
      <ReactModal
        modalName='job-task'
        header={header}
        body={body}
        footer={footer}
      />);
  }
}

JobTaskFileTreeView.propTypes = {
  openNode: React.PropTypes.instanceOf(TreeNode),
  destroyModal: React.PropTypes.func,
  changeMenus: React.PropTypes.func,
  jobAction: React.PropTypes.array,
  shouldWarnRestartCluster: React.PropTypes.bool,
};

export class JobView extends React.Component {
  constructor(props) {
    super(props);

    this.onConfirmAddCluster = this.onConfirmAddCluster.bind(this);
    this.onConfirmSelectCluster = this.onConfirmSelectCluster.bind(this);
    this.onConfirmSetLibrary = this.onConfirmSetLibrary.bind(this);
    this.onConfirmSetNotebook = this.onConfirmSetNotebook.bind(this);
    this.onClickRemoveLibrary = this.onClickRemoveLibrary.bind(this);
    this.onClickSetNotebook = this.onClickSetNotebook.bind(this);
    this.onClickSetJar = this.onClickSetJar.bind(this);
    this.onClickReplaceJar = this.onClickReplaceJar.bind(this);
    this.onClickEditJar = this.onClickEditJar.bind(this);
    this.onClickRemoveTask = this.onClickRemoveTask.bind(this);
    this.onClickAddLibrary = this.onClickAddLibrary.bind(this);
    this.onClickRemoveTimeout = this.onClickRemoveTimeout.bind(this);
    this.onClickRemoveRetry = this.onClickRemoveRetry.bind(this);
    this.onClickEditMaxConcurrentRuns = this.onClickEditMaxConcurrentRuns.bind(this);
    this.onClickEditTimeout = this.onClickEditTimeout.bind(this);
    this.onClickEditRetry = this.onClickEditRetry.bind(this);
    this.onClickEditAlert = this.onClickEditAlert.bind(this);
    this.onClickJobRun = this.onClickJobRun.bind(this);
    this.onJobNameChange = this.onJobNameChange.bind(this);
    this.onClickJobName = this.onClickJobName.bind(this);
    this.onClickSetSchedule = this.onClickSetSchedule.bind(this);
    this.onClickRemoveSchedule = this.onClickRemoveSchedule.bind(this);
    this.onClickSetCluster = this.onClickSetCluster.bind(this);
    this.stopEditingJobName = this.stopEditingJobName.bind(this);
    this.toggleAdvancedOpts = this.toggleAdvancedOpts.bind(this);
    this.shouldRestartClusterIfJar = this.shouldRestartClusterIfJar.bind(this);
    this.setJarHasChanged = this.setJarHasChanged.bind(this);
    this.shouldShowJarWarning = this.shouldShowJarWarning.bind(this);
    this.homeFolderNode = NavFunc.getHomeFolderNode();

    this.restrictedText = 'When cluster ACLs are enabled, job edit permissions are ' +
      'restricted to the job owner.';

    let selectedNode = this.homeFolderNode;
    const jobAction = props.job.get('basicInfo').jobActions[0];
    if (jobAction) {
      if (isJarJobAction(jobAction)) {
        selectedNode = this.homeFolderNode;
      } else {
        selectedNode = treeNodeForJobAction(jobAction);
      }
    }

    const jobInfo = this.props.job.get('basicInfo');
    this.deleteClickCallback = JobUtils.getDeleteJobClickHandler(jobInfo.jobId, jobInfo.jobName);

    this.state = {
      editingJobName: false,
      retryTimes: this.props.job.getRetryTimes(),
      settingRetry: false,
      showAdvancedOptions: false,
      runningJob: false,
      selectedNode: selectedNode,
      jarHasChanged: false,
    };

    this.setupHistory(this.props);
  }

  componentWillReceiveProps(nextProps) {
    this.setupHistory(nextProps);
    this.setRetryTimesState(nextProps.job);
  }

  componentDidMount() {
    this.countdownInterval = setInterval(
      this.setRetryTimesState.bind(this, this.props.job), 5000
    );
    // adding a unique class guards against changing the topbar if this component is unmounted
    $('#topbar .tb-title').addClass('jobview-topbar');
    this.renderTopbarTitle();
    if (this.props.openEditJar && !this.props.lacksModifyAndExecutePermission) {
      this.onClickEditJar();
    }
    if (this.props.isNewJob) {
       // focus on job-name input for newly created job
      this.delayedJobNameFocusTimerId = underscore.delay(() => {
        this.onClickJobName();
      }, 200);
    }
  }

  componentWillUnmount() {
    clearInterval(this.countdownInterval);
    clearTimeout(this.delayedJobNameFocusTimerId);
    $('#topbar .tb-title').removeClass('jobview-topbar');
  }

  setupHistory(props) {
    let history = props.job.get('history');
    if (props.page > 0) {
      if (props.pageData) {
        history = props.pageData.history;
      } else {
        history = [];
      }
    }
    this.history = history;
    this.pageDataStatus = props.pageDataStatus;
  }

  renderTopbarTitle(name) {
    const info = this.props.job.get('basicInfo');
    if (info && $('.jobview-topbar').length > 0) {
      name = name || info.jobName;
      $('#topbar').show();
      this.name = name;
      $('#topbar .tb-title.jobview-topbar').text(name);
      $('#topbar .tb-title.jobview-topbar').attr({ 'data-name': name });
      BrowserUtils.setDocumentTitle(name);
    }
  }

  setRetryTimesState(job) {
    // TODO(ydmao): make sure this actually forces react to re-render when we refactor the Jobs UI
    // and fix the retry Pending issue as part of CJ-8520.
    const retryTimes = job.getRetryTimes();
    if (retryTimes.length === 0) {
      this.setState({ retryTimes: [] });
    } else {
      this.setState({ retryTimes: retryTimes });
    }
  }

  handleLinkClicked(endpoint, data, reenableLink, onSuccess, onError) {
    data = data ? JSON.stringify(data) : this.props.job.get('basicInfo').jobId;
    const completeOnSuccess = () => {
      if (onSuccess) { onSuccess(); }
      if (reenableLink) { reenableLink(); }
    };
    const completeOnError = (error) => {
      if (onError) { onError(); }
      DeprecatedDialogBox.alert('Request failed: ' + error);
      if (reenableLink) { reenableLink(); }
    };
    this.props.job.editJob(endpoint, data, completeOnSuccess, completeOnError);
  }

  toggleJobRunState(state) {
    this.setState({ runningJob: state });
  }

  onClickJobRun() {
    if (this.state.runningJob) { return; }
    this.toggleJobRunState(true);
    this.handleLinkClicked('/jobs/run', null, this.toggleJobRunState.bind(this, false));
  }

  onClickSetNotebook() {
    ReactModalUtils.createModal(
      <JobTaskView
        openNode={this.state.selectedNode}
        jobAction={this.props.job.get('basicInfo').jobActions[0]}
        onConfirmSetNotebook={this.onConfirmSetNotebook}
        setLibraryParameters={this.onConfirmSetLibrary}
        shouldWarnRestartCluster={this.shouldRestartClusterIfJar()}
      />
    );
  }

  onConfirmSetNotebook(node) {
    this.handleLinkClicked('/jobs/set-action', {
      jobId: this.props.job.get('basicInfo').jobId,
      notebookId: node.id,
    });
    this.setState({
      selectedNode: node,
    });
  }

  onConfirmSetLibrary(path, mainClass, parameters, node, updating) {
    let endpoint = 'set-action';
    if (updating) {
      endpoint = 'update-jar-action';
    }
    this.handleLinkClicked('/jobs/' + endpoint, {
      jobId: this.props.job.get('basicInfo').jobId,
      mainClass: mainClass,
      parameters: parameters || '',
      jarPath: path,
      runAsNotebook: true,
    }, undefined, this.setJarHasChanged);
    this.setState({
      selectedNode: node,
    });
  }

  onClickAddLibrary() {
    const dialog = DeprecatedDialogBox.custom({
      title: 'Select Library',
      controls: [
        {
          controlType: 'filetree',
          id: 'notebookPicker',
          nodeType: 'library',
          validate: (node) => node !== undefined && !node.hasChildren,
        },
      ],
      confirm: (dialogElem) => {
        const node = dialogElem.find('#notebookPicker')[0].fileTree.selectedNode();
        this.onConfirmAddLibrary(node.id);
        dialogElem.remove();
      },
    });
    const selectedNode = this.homeFolderNode || NavFunc.getRootFolderNode();
    const treeNode = window.fileBrowserView.toTreeNode(selectedNode);

    dialog.find('#notebookPicker')[0].fileTree.openToNode(treeNode);
  }

  onConfirmAddLibrary(id) {
    this.handleLinkClicked('/jobs/add-library', {
      jobId: this.props.job.get('basicInfo').jobId,
      libraryId: id,
    });
  }

  onClickRemoveLibrary(libType, nameOrUri, optionalRepo) {
    DeprecatedDialogBox.confirm({
      message: 'Are you sure you want to remove this library?',
      confirm: () => { this.onConfirmRemoveLibrary(libType, nameOrUri, optionalRepo); },
    });
  }

  onConfirmRemoveLibrary(libType, nameOrUri, optionalRepo) {
    this.handleLinkClicked('/jobs/remove-library', {
      jobId: this.props.job.get('basicInfo').jobId,
      libType: libType,
      name: nameOrUri,
      repo: optionalRepo || '',
    });
  }

  shouldRestartClusterIfJar() {
    const job = this.props.job;
    const isExistingCluster = !job.get('basicInfo').resources.runOnNewCluster;
    const beenRun = job.get('history').length > 0;
    return isExistingCluster && beenRun;
  }

  setJarHasChanged() {
    this.setState({
      jarHasChanged: true,
    });
  }

  // Upload a new jar and set main class and arguments for current job
  onClickSetJar() {
    ReactJarJobDialog.createDialog(
      false,
      this.props.job,
      this.shouldRestartClusterIfJar(),
      this.setJarHasChanged
    );
  }

  // Upload a new jar to replace current job action, keep current main class and arguments
  onClickReplaceJar() {
    ReactJarJobDialog.createDialog(
      true,
      this.props.job,
      this.shouldRestartClusterIfJar(),
      this.setJarHasChanged
    );
  }

  onClickEditJar() {
    const jobActions = this.props.job.get('basicInfo').jobActions;
    const mainClass = jobActions[0] ? jobActions[0].mainClassName : null;
    const parameters = jobActions[0] ? jobActions[0].parameters : null;
    ReactModalUtils.createModal(
      <JobTaskView
        openNode={this.state.selectedNode}
        jobAction={jobActions}
        onlySetParameters
        setLibraryParameters={this.onConfirmSetLibrary}
        mainClass={mainClass}
        parameters={parameters}
      />
    );
  }

  onClickRemoveTask() {
    DeprecatedDialogBox.confirm({
      message: 'Are you sure you want to remove this task?',
      confirm: () => {
        this.handleLinkClicked('/jobs/set-action',
          { jobId: this.props.job.get('basicInfo').jobId });
        this.setState({
          selectedNode: this.homeFolderNode,
        });
      },
    });
  }

  onConfirmAddCluster(
    version, workers, useSpot, fallBack, zoneId, sparkConf, nodeType, driverNodeType
  ) {
    const currentResources = this.props.job.get('basicInfo').resources;
    const memory =
      ClusterUtil.containersToMemoryMB(Number(workers), nodeType, driverNodeType, false);
    const fallbackToOndemand = useSpot && fallBack;
    if (!currentResources.runOnNewCluster ||
      version !== currentResources.sparkVersion ||
      memory !== parseInt(currentResources.totalMemMb, 10) ||
      useSpot !== currentResources.useSpot ||
      fallbackToOndemand !== currentResources.fallbackToOndemand ||
      zoneId !== currentResources.zoneId ||
      sparkConf !== currentResources.sparkConf
    ) {
      this.handleLinkClicked('/jobs/set-cluster', {
        // Note: the handler will only update fields relevant to the value of runOnNewCluster
        jobId: this.props.job.get('basicInfo').jobId,
        runOnNewCluster: true,
        clusterId: null,
        newClusterNumWorkers: workers,
        useSpot: useSpot,
        fallbackToOndemand: fallbackToOndemand,
        sparkVersion: version,
        zoneId: zoneId,
        sparkConf: sparkConf,
      });
    }
  }

  onConfirmSelectCluster(e, clusterId, onSuccessCallback) {
    const currentResources = this.props.job.get('basicInfo').resources;
    if (currentResources.runOnNewCluster || clusterId !== currentResources.clusterId) {
      this.handleLinkClicked('/jobs/set-cluster', {
        // Note: the handler will only update fields relevant to the value of runOnNewCluster
        jobId: this.props.job.get('basicInfo').jobId,
        runOnNewCluster: false,
        clusterId: clusterId,
        memoryMB: 0,
        useSpot: false,
        fallbackToOndemand: false,
        sparkVersion: currentResources.sparkVersion,
      }, onSuccessCallback, null);
    } else if (clusterId === currentResources.clusterId) {
      if (onSuccessCallback) {
        onSuccessCallback();
      }
    }
  }

  onClickSetCluster() {
    const clusterDialog = (
      <ReactJobClusterDialog
        basicInfo={this.props.job.get('basicInfo')}
        clusters={window.clusterList.attachableClusters()}
        setNewCluster={this.onConfirmAddCluster}
        setExistingCluster={this.onConfirmSelectCluster}
        enableVersionUI={window.settings.enableSparkVersionsUI}
        enableCustomVersionUI={window.prefs.get('enableCustomSparkVersions') || false}
        zoneInfos={window.settings.zoneInfos}
        restrictedClusterCreation={window.settings.enableRestrictedClusterCreation}
      />);

    // if cluster ACLs enabled, we first fetch permissions on clusters and then show the dialog,
    // in order to accurately disable/enable the right existing clusters
    if (AclUtils.clusterAclsEnabled()) {
      const deferreds = _.map(
        window.clusterList.attachableClusters(),
        (cluster) => cluster.fetchPermissionLevel()
      );
      $.when.apply($, deferreds).done(() => {
        ReactModalUtils.createModal(clusterDialog);
      });
    } else {
      ReactModalUtils.createModal(clusterDialog);
    }
  }

  _atLeastOne(n) {
    return !isNaN(n) && parseInt(n, 10) >= 1;
  }

  _nonNegative(n) {
    return !isNaN(n) && parseInt(n, 10) >= 0;
  }

  onClickEditMaxConcurrentRuns() {
    const initialValue = this.props.job.getMaxConcurrentRuns().toString();
    const dialog = DeprecatedDialogBox.custom({
      title: 'Set Job Maximum Concurrent Runs',
      controls: [
        {
          controlType: 'text',
          id: 'jobMaxConcurrentRunsHelpText',
          message: 'Maximum number of concurrent runs of this job.',
        },
        {
          controlType: 'input',
          id: 'maxConcurrentRuns',
          type: 'text',
          focus: true,
          label: 'Maximum concurrent runs',
          value: initialValue,
          confirmOnEnter: true,
          validate: this._nonNegative,
        },
      ],
      confirm: (dialogElem) => {
        const newValue = parseInt(dialogElem.find('#maxConcurrentRuns').val(), 10);
        if (newValue !== initialValue) {
          this.onConfirmEditMaxConcurrentRuns(newValue);
        }
      },
    });
    dialog.addClass('dialog-set-max-concurrent-runs');
  }

  onConfirmEditMaxConcurrentRuns(newValue) {
    this.handleLinkClicked('/jobs/set-max-concurrent-runs', {
      jobId: this.props.job.get('basicInfo').jobId,
      maxConcurrentRuns: newValue,
    });
  }

  onClickEditTimeout() {
    let initialValue = '';
    const currentValue = parseInt(this.props.job.get('basicInfo').timeoutSeconds, 10) / 60;
    if (currentValue > 0) {
      initialValue = currentValue;
    }
    const dialog = DeprecatedDialogBox.custom({
      title: 'Set Job Timeout',
      controls: [
        {
          controlType: 'text',
          id: 'jobTimeoutHelpText',
          message: 'Jobs still running after the specified timeout will be terminated.',
        },
        {
          controlType: 'input',
          id: 'timeoutMinutes',
          type: 'text',
          focus: true,
          label: 'Timeout in minutes',
          value: initialValue,
          confirmOnEnter: true,
          validate: this._atLeastOne,
        },
      ],
      confirm: (dialogElem) => {
        const newValue = parseInt(dialogElem.find('#timeoutMinutes').val(), 10);
        if (newValue !== currentValue) {
          this.onConfirmEditTimeout(newValue);
        }
      },
    });
    dialog.addClass('dialog-set-timeout');
  }

  onConfirmEditTimeout(newValue) {
    this.handleLinkClicked('/jobs/set-timeout', {
      jobId: this.props.job.get('basicInfo').jobId,
      timeoutSeconds: 60 * newValue,
    });
  }

  onClickRemoveTimeout() {
    this.handleLinkClicked('/jobs/set-timeout', {
      jobId: this.props.job.get('basicInfo').jobId,
      timeoutSeconds: 0,
    });
  }


  /**
   * Helper to set the job schedule as the result of an event.
   * @TODO(jengler) 2016-02-19: We should remove the passing around of the event object.
   *
   * @param {Event} e        Event object that generated the changing of the schedule.
   * @param {string} quartz   Quarts cron expression
   * @param {string} timeZone Timezone id, e.g. "US/Pacific"
   *
   * @return {none}
   */
  setJobSchedule(e, quartz, timeZone) {
    this.handleLinkClicked('/jobs/set-sched', {
      jobId: this.props.job.get('basicInfo').jobId,
      timeZone: timeZone,
      cronExpr: quartz,
    });
  }

  /**
   * Handler for when a user clicks the confirm button for the dialog created in onSetSchedule.
   * Responsible for getting the dialog's results and calling setJobSchedule if needed. Is also
   * responsible for clearing the this._cronSchedule reference to ensure we do not hold a pointer
   * to the destroyed dialog.
   *
   * @param  {Event} e Event object that generated the changing of the schedule.
   * @return {none}
   */
  handleScheduleUpdate(e) {
    const schedule = this._cronSchedule.value();
    if (schedule.quartzCronExpression !== this.props.job.getCronSched() ||
        schedule.timeZoneId !== this.props.job.getCronTimeZone()) {
      this.setJobSchedule(e, schedule.quartzCronExpression, schedule.timeZoneId);
    }
    // Stop holding a reference to the JobSchedule since the dialog closed.
    this._cronSchedule = undefined;
  }

  /**
   * Open a set schedule dialog for the current job.
   *
   * @param  {Event} e Event object that generated the changing of the schedule.
   * @return {none}
   */
  onClickSetSchedule(e) {
    const refFunc = (r) => { this._cronSchedule = r; };
    DeprecatedDialogBox.reactCustom({
      title: 'Schedule Job',
      name: 'job-schedule-dialog',
      controls: [
        {
          class: 'remove-dialog-margin',
          controlType: 'react',
          component: (
            /*
             * @NOTE(jengler) 2016-02-19: Holding on to a reference of the jobSchedule so we can
             * get the values from it if the users clicks the dialog confirm button.
            */
            <CronSchedule
              ref={refFunc}
              currentQuartz={this.props.job.getCronSched()}
              currentTimeZone={this.props.job.getCronTimeZone()}
            />
          ),
        },
      ],
      confirm: this.handleScheduleUpdate.bind(this, e),
      cancel: () => {
        // Ensure we do not hold refence to closed dialog
        this._cronSchedule = undefined;
      },
    });
  }

  onClickEditAlert() {
    const basicInfo = this.props.job.get('basicInfo');
    const dialog = DeprecatedDialogBox.custom({
      title: 'Email Alerts',
      controls: [
        {
          controlType: 'text',
          id: 'emailAlertsHelpText',
          message:
            'Enter addresses to email when a run starts, succeeds, or encounters an error.',
        },
        {
          controlType: 'input',
          id: 'onStartEmail',
          type: 'text',
          focus: true,
          label: 'On start',
          placeholder: 'Emails (comma-separated)',
          value: basicInfo.onStartEmail.join(', '),
          validate: EmailValidators.isValidEmailsField,
        },
        {
          controlType: 'input',
          id: 'onSuccessEmail',
          type: 'text',
          label: 'On success',
          placeholder: 'Emails (comma-separated)',
          value: basicInfo.onSuccessEmail.join(', '),
          validate: EmailValidators.isValidEmailsField,
        },
        {
          controlType: 'input',
          id: 'onErrorEmail',
          type: 'text',
          label: 'On error',
          placeholder: 'Emails (comma-separated)',
          value: basicInfo.onErrorEmail.join(', '),
          validate: EmailValidators.isValidEmailsField,
        },
      ],
      confirm: (dialogElem) => {
        const onStartEmail = dialogElem.find('#onStartEmail').val();
        const onSuccessEmail = dialogElem.find('#onSuccessEmail').val();
        const onErrorEmail = dialogElem.find('#onErrorEmail').val();
        const split = (emails) => _.filter(
          _.map(emails.split(','), (email) => email.trim()),
          (email) => email.length > 0);
        if (!_.isEqual(basicInfo.onStartEmail, split(onStartEmail)) ||
            !_.isEqual(basicInfo.onSuccessEmail, split(onSuccessEmail)) ||
            !_.isEqual(basicInfo.onErrorEmail, split(onErrorEmail))) {
          this.onConfirmEditAlert(onStartEmail, onSuccessEmail, onErrorEmail);
        }
      },
    });
    dialog.css('width', '520px');
  }

  onConfirmEditAlert(onStartEmail, onSuccessEmail, onErrorEmail) {
    this.handleLinkClicked('/jobs/set-alert', {
      jobId: this.props.job.get('basicInfo').jobId,
      onStartEmail: onStartEmail,
      onSuccessEmail: onSuccessEmail,
      onErrorEmail: onErrorEmail,
    });
  }

  onClickEditRetry() {
    const policy = this.props.job.get('basicInfo').retryPolicy;
    const timeoutControl = window.settings.enableJobsRetryOnTimeout ?
      this.renderRetryOnTimeoutCheckbox(policy.retryOnTimeout) : [];
    const dialog = DeprecatedDialogBox.custom({
      title: 'Set Retry Policy',
      controls: [
        {
          controlType: 'text',
          id: 'jobRetryHelpText',
          message: ('Jobs that fail will be retried a number of times based on the following ' +
            'policy. You can specify a maximum number of attempts for a run and a minimal ' +
            'interval between attempts.'),
        },
        {
          controlType: 'multifield',
          id: 'retryMultiField',
          subfields: [
            {
              type: 'html',
              html: 'Retry at most&nbsp;&nbsp;',
            },
            {
              type: 'select',
              width: '100px',
              id: 'retryCount',
              value: policy.maxAttempts - 1,
              options: ElasticUtil.RETRY_COUNT_OPTIONS,
            },
            {
              type: 'html',
              html: '&nbsp;&nbsp;and wait&nbsp;&nbsp;',
            },
            {
              type: 'select',
              id: 'retryDelay',
              width: '80px',
              value: policy.minRetryIntervalMillis,
              options: ElasticUtil.RETRY_POLICY_DELAY_MILLIS_OPTIONS,
            },
            {
              type: 'html',
              html: '&nbsp;&nbsp;between retries.',
            },
          ],
        },
      ].concat(timeoutControl),
      confirm: (dialogElem) => {
        const retryDelay = parseInt(dialogElem.find('#retryDelay').val(), 10);
        const retryCount = parseInt(dialogElem.find('#retryCount').val(), 10);
        const retryOnTimeout = dialogElem.find('#retryOnTimeout')[0].checked;
        this.onConfirmEditRetry(retryDelay, retryCount, retryOnTimeout);
      },
    });
    dialog.addClass('dialog-set-retry');
  }

  onConfirmEditRetry(retryDelay, retryCount, retryOnTimeout) {
    this.handleLinkClicked('/jobs/set-retry', {
      jobId: this.props.job.get('basicInfo').jobId,
      retryDelay: retryDelay,
      retryCount: retryCount,
      retryOnTimeout: retryOnTimeout,
    });
  }

  renderRetryOnTimeoutCheckbox(retry) {
    const prefix = '<span><input type="checkbox" id="retryOnTimeout"';
    const mid = retry ? ' checked' : '';
    const suffix = '></input> Retry on timeouts</span>';
    const html = prefix + mid + suffix;
    return [{
      controlType: 'html',
      id: 'retryOnTimeoutHolder',
      message: html,
    }];
  }

  onClickRemoveRetry() {
    this.handleLinkClicked('/jobs/set-retry', { jobId: this.props.job.get('basicInfo').jobId });
  }

  onClickRemoveSchedule() {
    this.handleLinkClicked('/jobs/remove-sched');
  }

  onClickJobName() {
    this.setState({ isEditingName: true });
    this.refs.title.startEditing();
  }

  stopEditingJobName() {
    this.setState({ isEditingName: false });
  }

  onJobNameChange(newName) {
    const origJobName = this.props.job.get('basicInfo').jobName;
    this.handleLinkClicked('/jobs/rename', {
      jobId: this.props.job.get('basicInfo').jobId,
      newName: newName,
    }, null, () => {
      this.renderTopbarTitle(newName);
    }, () => {
      // make sure the component is still mounted
      if (ReactDOM.findDOMNode(this.refs.title)) {
        this.refs.title.value = origJobName; // Revert on error.
      }
    });
  }

  toggleAdvancedOpts() {
    this.setState({ showAdvancedOptions: !this.state.showAdvancedOptions });
  }

  hasNoAlerts() {
    return !this.hasEmail('onStartEmail') && !this.hasEmail('onSuccessEmail') &&
      !this.hasEmail('onErrorEmail');
  }

  hasEmail(emailType) {
    return this.props.job.get('basicInfo')[emailType].length > 0;
  }

  getEmailList(basicInfo) {
    const emailList = [];
    if (this.hasEmail('onStartEmail')) {
      emailList.push(<li>On start: {basicInfo.onStartEmail.join(', ')}</li>);
    }
    if (this.hasEmail('onSuccessEmail')) {
      emailList.push(<li>On success: {basicInfo.onSuccessEmail.join(', ')}</li>);
    }
    if (this.hasEmail('onErrorEmail')) {
      emailList.push(<li>On error: {basicInfo.onErrorEmail.join(', ')}</li>);
    }
    return emailList;
  }

  renderBasicLibrary(dataUri, name, language, disabled, onClickCallback) {
    return (
        <li key={`lib-${name}`}>
          {name + ' - (' + language + ') '}
          <a className='job-remove-library'
            data-uri={dataUri}
            disabled={disabled}
            onClick={disabled ? null : onClickCallback}
          >Remove</a>
        </li>
    );
  }

  renderUriLibrary(lib, disabled) {
    return this.renderBasicLibrary(
        lib.uri,
        lib.uri.substring(lib.uri.lastIndexOf('/') + 1),
        _.capitalize(lib.type),
        disabled,
        this.onClickRemoveLibrary.bind(null, lib.type, lib.uri, null));
  }

  renderMavenLibrary(lib, disabled) {
    return this.renderBasicLibrary(
        lib.coordinate,
        lib.coordinate,
        _.capitalize(lib.type),
        disabled,
        this.onClickRemoveLibrary.bind(null, lib.type, lib.coordinate, lib.repo));
  }

  renderPypiLibrary(lib, disabled) {
    return this.renderBasicLibrary(
        lib.packageName,
        lib.packageName,
        _.capitalize(lib.type),
        disabled,
        this.onClickRemoveLibrary.bind(null, lib.type, lib.packageName, lib.repo));
  }

  renderLibrariesList(libraries) {
    const disabled = this.props.lacksModifyAndExecutePermission;
    return libraries.map((lib) => {
      if (lib.type === 'maven') {
        return this.renderMavenLibrary(lib, disabled);
      } else if (lib.type === 'pypi') {
        return this.renderPypiLibrary(lib, disabled);
      } else if (lib.type === 'egg') {
        return this.renderUriLibrary(lib, disabled);
      } else if (lib.type === 'jar') {
        return this.renderUriLibrary(lib, disabled);
      }
      return null;
    });
  }

  getRestrictedWarning() {
    return (
      <Tooltip ref='restrictedWarning' text={this.restrictedText}>
        <i className='fa fa-exclamation-circle state-message-icon restricted-job-icon' />
      </Tooltip>);
  }

  getTaskElem() {
    const job = this.props.job;
    const disabled = this.props.lacksModifyAndExecutePermission;
    const actions = job.get('basicInfo').jobActions;
    const isJarJob = isJarJobAction(actions[0]);

    if (actions.length === 0) {
      return (
        <span>
          <span className='job-action'></span>
          <span>
            <a className='job-set-notebook' onClick={disabled ? null : this.onClickSetNotebook}
              disabled={disabled}
            >Select Notebook</a> /&nbsp;
            <a className='job-set-jar' onClick={disabled ? null : this.onClickSetJar}
              disabled={disabled}
            >Set JAR</a>
          </span>
          {disabled ? this.getRestrictedWarning() : null}
        </span>
      );
    }
    const editLink = (
      <a className='job-edit-jar' onClick={disabled ? null : this.onClickEditJar}
        disabled={disabled}
      >Edit</a>);
    const changeLink = (
      <a className='job-set-notebook' disabled={disabled}
        onClick={disabled ? null : this.onClickSetNotebook}
      >Edit</a>);
    const setJarLink = (
      <a className='job-replace-jar'
        onClick={disabled ? null : this.onClickReplaceJar}
        disabled={disabled}
      >Upload JAR</a>);
    const removeLink = (
      <a className='job-remove-task' disabled={disabled}
        onClick={disabled ? null : this.onClickRemoveTask}
      >Remove</a>);

    const modifyLinks = isJarJob ? <span> - {changeLink} / {setJarLink} / {removeLink}</span> :
                        <span> - {changeLink} / {removeLink}</span>;
    const jobActions = job.get('basicInfo').jobActions;
    const mainClass = jobActions[0] ? jobActions[0].mainClassName : null;
    const argumentsList = jobActions[0] ? JSON.stringify(jobActions[0].splitParams) : null;
    const librariesElem = (
      <li>
        {"Dependent Libraries: "}
        <a className='job-add-library'
          disabled={disabled}
          onClick={disabled ? null : this.onClickAddLibrary}
        >Add</a>
        <ul>{this.renderLibrariesList(job.get('basicInfo').libraries)}</ul>
      </li>
    );
    const argumentsElem = (
      <ul>
        <li>Parameters {editLink}
          <ul>
            <li>Main Class: {mainClass}</li>
            <li>Arguments: {argumentsList}</li>
          </ul>
        </li>
        {librariesElem}
      </ul>
    );

    return (
      <span>
        <JobActionElement actions={jobActions} />
        {modifyLinks}
        {disabled ? this.getRestrictedWarning() : null}
        {job.hasJarAction() ? argumentsElem : <ul>{librariesElem}</ul>}
      </span>
    );
  }

  getMaxConcurrentRunsControl(job, disabled) {
    if (!window.settings.enableMaxConcurrentRuns) {
      return null;
    }
    return (
      <li>
        <span className='job-subheader'>Maximum Concurrent Runs: </span>
        <span className='job-max-concurrent-runs'>{job.getMaxConcurrentRuns()} </span>
        <span>
          <a className='job-set-max-concurrent-runs'
            onClick={disabled ? null : this.onClickEditMaxConcurrentRuns}
            disabled={disabled}
          >Edit </a>
        </span>
      </li>);
  }

  getAdvancedOptions() {
    if (!this.state.showAdvancedOptions) {
      return null;
    }

    const job = this.props.job;
    const disabled = this.props.lacksModifyAndExecutePermission;

    return (
      <div className='jobs-advanced'>
        <li>
          <span className='job-subheader'>Alerts: </span>{this.hasNoAlerts() ? 'None ' : null}
          <a className='job-set-alerts' disabled={disabled}
            onClick={disabled ? null : this.onClickEditAlert}
          >Edit</a>
          <ul>{this.getEmailList(job.get('basicInfo'))}</ul>
        </li>
        {this.getMaxConcurrentRunsControl(job, disabled)}
        <li>
          <span className='job-subheader'>Timeout: </span>
          <span className='job-timeout'>{job.getTimeoutString()} </span>
          <span>
            <a className='job-set-timeout' onClick={disabled ? null : this.onClickEditTimeout}
              disabled={disabled}
            >Edit </a>
              {job.getTimeoutString() !== 'None' ?
               <span>
                 {"/ "}
                 <a className='job-remove-timeout' disabled={disabled}
                   onClick={disabled ? null : this.onClickRemoveTimeout}
                 >Remove</a>
               </span>
              : null}
          </span>
        </li>
        <li>
          <span className='job-subheader'>Retries: </span>
          <span className='job-retry'>{job.getRetryString()} </span>
          <span>
            <a className='job-set-retry' onClick={disabled ? null : this.onClickEditRetry}
              disabled={disabled}
            >Edit </a>
              {job.getRetryString() !== 'None' ?
               <span>
                 {"/ "}
                 <a className='job-remove-retry' disabled={disabled}
                   onClick={disabled ? null : this.onClickRemoveRetry}
                 >Remove</a>
               </span>
              : null}
          </span>
        </li>
      </div>
    );
  }

  getCountdownRow() {
    const numRetryTimes = this.state.retryTimes.length;
    if (numRetryTimes === 0) {
      return null;
    }
    const countDowns = _.map(this.state.retryTimes, function(retryTime) {
      const serverTime = window.conn.wsClient.serverTime();
      const countdownString = ElasticDomUtil.getCountdownString(retryTime, serverTime);
      return (
        <span className='auto-updating-countdown-widget'
          data-time={retryTime}>{countdownString}
        </span>
      );
    });
    return (
      <tr><td colSpan={6}>
        <span>
          Run failed, will retry in {countDowns}
        </span>
      </td></tr>
    );
  }

  getRunNowRow() {
    const job = this.props.job;
    if (job.hitMaxConcurrentRuns()) {
      return null;
    }
    const disabled = !job.isRunnableConfiguration() || this.props.lacksModifyAndExecutePermission;
    const jobRunLinkClasses = this.state.runningJob ?
                              'job-run-link link-active' : 'job-run-link';
    return (
      <tr><td colSpan={6}>
      <span>
        <a className={jobRunLinkClasses}
          disabled={disabled}
          onClick={disabled ? null : this.onClickJobRun}
        >Run Now</a>
        {this.props.lacksModifyAndExecutePermission ? this.getRestrictedWarning() : null}
      </span>
      </td></tr>
    );
  }

  getTableHead() {
    return (
      <thead>
        <tr>
          <th className='span2'>Run</th>
          <th className='span2'>Start Time</th>
          <th className='span2'>Launched</th>
          <th className='span2'>Duration</th>
          <th className='span2'>Status</th>
        </tr>
      </thead>
    );
  }

  getRunRows(isActive) {
    return _.map(this.history, (run) => {
      if (run.active === isActive) {
        return (<RunRow
          key={`run-${run.runId}`}
          lacksModifyAndExecutePermission={this.props.lacksModifyAndExecutePermission}
          durationMillis={run.durationMillis}
          handleLinkClicked={this.handleLinkClicked}
          idInJob={run.idInJob}
          isActiveRun={run.active}
          job={this.props.job}
          jobId={this.props.job.get('basicInfo').jobId}
          message={run.message}
          runId={run.runId}
          startTime={run.startTime}
          status={run.status}
          trigger={run.trigger}
        />);
      }
    });
  }

  getJobUpgradeTooltip() {
    const msg = (<span>This job is using an old version of Ubuntu that will be deprecated.
      To configure this cluster, you will need to select an updated Spark version
      (the same Spark versions are supported).</span>);
    return (
      <Tooltip text={msg}>
        <i className={`fa fa-${IconsForType.error} state-message-icon job-upgrade-tooltip`} />
      </Tooltip>
    );
  }

  getRunsNav() {
    const page = this.props.page;
    const jobId = this.props.job.get('basicInfo').jobId;
    let prevLinkHref;
    if (page === 0) {
      prevLinkHref = '#';
    } else if (page === 1) {
      prevLinkHref = `#job/${jobId}`;
    } else {
      prevLinkHref = `#job/${jobId}/${page - 1}`;
    }
    const prevLinkProps = {
      className: 'job-paginate-prev',
      disabled: page === 0,
      href: prevLinkHref,
    };
    const lessThanOffset = this.history.length < JobViewWrapper.RUN_TABLE_PAGE_OFFSET;
    const nextLinkProps = {
      className: 'job-paginate-next',
      disabled: lessThanOffset,
      href: lessThanOffset ? '#' : `#job/${jobId}/${page + 1}`,
    };

    return (
      <span>
        <a {...prevLinkProps}>
          <i className='fa fa-angle-left'></i> Previous 20
        </a>
        <a {...nextLinkProps}>
          Next 20 <i className='fa fa-angle-right'></i>
        </a>
      </span>
    );
  }

  shouldShowJarWarning() {
    const basicInfo = this.props.job.get('basicInfo');
    return this.shouldRestartClusterIfJar() &&
      isJarJobAction(basicInfo.jobActions[0]) &&
      this.state.jarHasChanged;
  }

  getJarWarning() {
    return (
      <span className='warning-font'>
        {' You must restart the cluster for the new JAR file to be attached to your cluster.'}
      </span>
    );
  }

  renderDeleteButton() {
    return (
      <span>
        <span className='job-header-separator'>
          {'|'}
        </span>
        <DeleteButton onClick={this.deleteClickCallback} />
      </span>
    );
  }

  render() {
    /**
     * Do not use this as an example for tables; it needs to be refactored to use
     * ReactTable's Table and Column. For now, see ClusterDetailsLibrariesList and
     * ClusterDetailsLibrariesListView.
     */
    const job = this.props.job;
    const isEditing = this.state.isEditingName;
    const disabled = this.props.lacksModifyAndExecutePermission;
    const wrapperClasses = isEditing ? 'job-name-wrapper active' : 'job-name-wrapper';
    const editableJobNameElem = (
      <div className={wrapperClasses} onClick={disabled ? null : this.onClickJobName}>
        <h2>
          <InlineEditableText
            ref='title'
            allowEdit={!disabled}
            initialText={job.get('basicInfo').jobName}
            updateText={this.onJobNameChange}
            onStopEdit={this.stopEditingJobName}
            className='job-name control-field'
            maxLength={100}
            showSaveAndEditBtn={false}
          />
          {isEditing || disabled ? null : <i className='fa fa-edit job-name-edit'></i>}
          {this.props.isNewJob ? null : this.renderDeleteButton()}
        </h2>
      </div>
    );
    const modifySchedLinks = (
      <span>
        <a className='job-set-schedule' onClick={disabled ? null : this.onClickSetSchedule}
          disabled={disabled}
        >Edit</a>
        {job.getCronSched() ? <span>
          {" / "}
          <a className='job-remove-schedule' disabled={disabled}
            onClick={disabled ? null : this.onClickRemoveSchedule}
          >Remove</a></span> : null}
      </span>
    );
    const latestJobRunResultPermalink = (
      <a disabled={job.attributes.history.length === 0}
        href={`#job/${job.get('basicInfo').jobId}/run/latestSuccess`}
      >
        Latest successful run (refreshes automatically)
      </a>
    );
    const aclsWarning = (
      <Tooltip ref='clusterCreateWarning' text={WorkspacePermissions.JOB_CREATE_CLUSTER_WARNING}>
        <i className='fa fa-exclamation-circle state-message-icon no-create-perms-icon' />
      </Tooltip>);

    return (
      <div className='job-view'>
        <a className='all-jobs-link job-page-link' href='#joblist'>
          <i className='fa fa-angle-left' /> All Jobs
        </a>
        {editableJobNameElem}
        <ul className='unstyled'>
          <li>
            <span className='job-subheader'>Task: </span>{this.getTaskElem()}
          </li>
          <li>
            <span className='job-subheader'>Cluster: </span>
            <span className='job-resources'>{job.getResourceString()} </span>
            <a className='job-set-cluster' disabled={disabled}
              onClick={disabled ? null : this.onClickSetCluster}
            >Edit</a>
            {this.shouldShowJarWarning() ? this.getJarWarning() : null}
            {job.needsUpgrade() ? this.getJobUpgradeTooltip() : null}
            {!this.props.hasCreateClusterPerms && AclUtils.clusterAclsEnabled() ?
              aclsWarning : null}
          </li>
          <li>
            <span className='job-subheader'>Schedule: </span>
            <span className='job-schedule'>{job.getSchedString()} </span>
            {modifySchedLinks}
          </li>
          <span className='job-show-advanced-options' onClick={this.toggleAdvancedOpts}>
            {"Advanced "}
            <i className={this.state.showAdvancedOptions ?
              'fa fa-caret-down' : 'fa fa-caret-right'}
            />
          </span>
          {this.getAdvancedOptions()}
        </ul>
        <h2>Active runs</h2>
        <table className='table table-bordered-outer runs-table active-runs-table'>
          {this.getTableHead()}
          <tbody>
            {this.getCountdownRow()}
            {this.getRunNowRow()}
            {this.getRunRows(true)}
          </tbody>
        </table>
        <h2>Completed runs</h2>
        {latestJobRunResultPermalink}
        <div className='runs-nav-top'>{this.getRunsNav()}</div>
        <table className='table table-bordered-outer runs-table completed-runs-table'>
          {this.getTableHead()}
          <tbody>
            {this.pageDataStatus ? <tr><td colSpan={100}>{this.pageDataStatus}</td></tr> : null}
            {this.getRunRows(false)}
          </tbody>
        </table>
        <div className='runs-nav-bottom'>{this.getRunsNav()}</div>
      </div>
    );
  }
}

JobView.propTypes = {
  job: React.PropTypes.instanceOf(FullElasticJobStatus).isRequired,
  // whether to open the edit jar dialog immediately upon render
  hasCreateClusterPerms: React.PropTypes.bool,
  openEditJar: React.PropTypes.bool,
  page: React.PropTypes.number,
  pageData: React.PropTypes.object,
  pageDataStatus: React.PropTypes.string,
  // if true, will not allow user to modify, run, or cancel run of job
  lacksModifyAndExecutePermission: React.PropTypes.bool,
  isNewJob: React.PropTypes.bool,
};

JobView.defaultProps = {
  hasCreateClusterPerms: true,
  openEditJar: false,
  page: 0,
  lacksModifyAndExecutePermission: false,
};

export class RunRow extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      runDuration: this.getRunDuration(),
    };
  }

  getRunLinkUrl() {
    return `#job/${this.props.jobId}/run/${this.props.idInJob}`;
  }

  getRunDuration() {
    const delta = window.conn.wsClient.serverTime() - parseInt(this.props.startTime, 10);
    return DateTimeFormats.formatDuration(Math.floor(delta / 1000));
  }

  setRunDurationState() {
    this.setState({ runDuration: this.getRunDuration() });
  }

  componentDidMount() {
    this.runDurationInterval = setInterval(this.setRunDurationState.bind(this), 5000);
  }

  componentWillUnmount() {
    clearInterval(this.runDurationInterval);
  }

  componentWillReceiveProps(nextProps) {
    if (!nextProps.isActiveRun) {
      clearInterval(this.runDurationInterval);
    }
  }

  getDuration() {
    if (this.props.isActiveRun) {
      return (
        <span className='auto-updating-time-widget' data-start-time={this.props.startTime}>
          {this.state.runDuration}
        </span>
      );
    }
    return this.props.durationMillis > 0 ?
      DateTimeFormats.formatDuration(this.props.durationMillis / 1000) : '-';
  }

  onClickRunRowJobCancel() {
    DeprecatedDialogBox.confirm({
      message: 'Are you sure you want to cancel this run?',
      confirm: () => {
        this.props.handleLinkClicked.apply(this, ['/jobs/cancel-run', {
          jobId: this.props.jobId,
          runId: this.props.runId }]);
      },
    });
  }

  isCancellable() {
    return this.props.status === FullElasticJobStatus.RunLifeCycleState.PENDING ||
      this.props.status === FullElasticJobStatus.RunLifeCycleState.RUNNING;
  }

  getStatus() {
    if (this.props.isActiveRun) {
      const disabled = this.props.lacksModifyAndExecutePermission;
      const cancelLink = (<span>
        {" - "}
        <a className='job-cancel-link' disabled={disabled}
          onClick={disabled ? null : this.onClickRunRowJobCancel.bind(this)}
        >Cancel</a></span>);
      return (
        <td>
          {this.props.status}
          {this.isCancellable() ? cancelLink : null}
        </td>
      );
    }
    return (
      <td data-run-message={this.props.message} data-run-status={this.props.status}
        className='run-status'
      >
        <RunStatus displayState={this.props.status} stateMessage={this.props.message} />
      </td>
    );
  }

  render() {
    return (
      <tr className='run-row'
        data-run-cluster={`job-${this.props.jobId}-run-${this.props.idInJob}`}
        data-run-id={this.props.runId}
        data-run-status={this.props.status}
        data-run-message={this.props.message}
      >
        <td>
          <a className='run-link' href={this.getRunLinkUrl()}>
            Run {this.props.idInJob}
          </a>
        </td>
        <td>{DateTimeFormats.formatTimestamp(this.props.startTime)}</td>
        <td>{JobUtils.formatRunTriggerString(this.props.trigger)}</td>
        <td>{this.getDuration()}</td>
        {this.getStatus()}
      </tr>
    );
  }
}

RunRow.propTypes = {
  handleLinkClicked: React.PropTypes.func.isRequired,
  job: React.PropTypes.instanceOf(FullElasticJobStatus).isRequired,
  durationMillis: React.PropTypes.number,
  isActiveRun: React.PropTypes.bool,
  idInJob: React.PropTypes.number,
  jobId: React.PropTypes.number,
  message: React.PropTypes.string,
  lacksModifyAndExecutePermission: React.PropTypes.bool,
  runId: React.PropTypes.string,
  startTime: React.PropTypes.number,
  status: React.PropTypes.string,
  trigger: React.PropTypes.string,
};
