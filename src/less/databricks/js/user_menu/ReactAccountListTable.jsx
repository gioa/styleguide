/* eslint react/prefer-es6-class: 0, react/no-is-mounted: 0, max-lines: 0, func-names: 0 */

/**
 * Do not use this as an example for tables; it needs to be refactored to use
 * ReactTable's Table and Column. For now, see ClusterDetailsLibrariesList and
 * ClusterDetailsLibrariesListView.
 */

import $ from 'jquery';
import _ from 'underscore';
import FixedDataTable from 'fixed-data-table';
import React from 'react';

import { AclUtils } from '../acl/AclUtils.jsx';
import WorkspacePermissions from '../acl/WorkspacePermissions';

import Cluster from '../clusters/Cluster';
import ClusterList from '../clusters/ClusterList';
import { ClusterUtil } from '../clusters/Common.jsx';

import Presence from '../presence/Presence';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';
import ReactDialogBox from '../ui_building_blocks/dialogs/ReactDialogBox.jsx';
import { CollapsibleTableView } from '../ui_building_blocks/tables/Table.jsx';
import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

import Account from '../user_menu/Account';
import AccountList from '../user_menu/AccountList';
import ReactAccountsTableCheckbox from '../user_menu/ReactAccountsTableCheckbox.jsx';

import { PasswordValidators } from '../validators/PasswordValidators';

const Table = FixedDataTable.Table;
const Column = FixedDataTable.Column;

const ClustersCheckbox = React.createClass({
  propTypes: {
    model: React.PropTypes.instanceOf(Account).isRequired,
    disabled: React.PropTypes.bool,
    tooltipElem: React.PropTypes.object,
    clusterRootAclService: React.PropTypes.object.isRequired,
  },

  getDefaultProps() {
    return {
      disabled: false,
      tooltipElem: null,
    };
  },

  getInitialState() {
    return {
      checked: this._getInitialChecked(),
    };
  },

  componentWillReceiveProps(nextProps) {
    this.setState({ checked: this._getInitialChecked(nextProps) });
  },

  componentWillUnmount() {
    // remove the tooltips that were attached to the document body
    $('.body-tooltip-wrapper').remove();
  },

  _getInitialChecked(nextProps) {
    const props = nextProps || this.props;
    const model = props.model;
    const aclService = props.clusterRootAclService;
    // TODO(PROD-8296) this logic will have to be changed if-and-when we can grant
    // CLUSTER_CREATE_ACTION to groups other than admins
    const hasPermission = aclService && aclService.userHasPermission(
      model, WorkspacePermissions.CLUSTER_CREATE_ACTION);

    // a checkbox can only be unchecked if:
    //   1. user is not admin
    //   2. user has had permissions removed by an admin
    //   3. ACLs are enabled by user
    return !(!model.get('isAdmin') && !hasPermission && AclUtils.clusterAclsEnabled());
  },

  componentWillMount() {
    this.setState({ checked: this._getInitialChecked() });
  },

  onClickClustersCheckbox() {
    const action = this.state.checked ? 'turn off' : 'turn on';
    ReactDialogBox.confirm({
      title: 'Change cluster create permissions?',
      message: `Are you sure you want to ${action} cluster create permissions for this user?`,
      confirm: () => { this.toggleClustersCheckbox(true); },
      cancel: () => { this.toggleClustersCheckbox(false); },
    });
  },

  toggleClustersCheckbox(change) {
    const self = this;
    const model = this.props.model;
    const newCheckedState = change ? !this.state.checked : this.state.checked;
    const newPermissions = newCheckedState ? [WorkspacePermissions.CLUSTER_CREATE_ACTION] : [];
    const clustersAclObject = this.props.clusterRootAclService;
    clustersAclObject.setPermission(model.id, newPermissions);
    clustersAclObject.commit({
      sync: true,
      success() {
        self.setState({ checked: newCheckedState });
      },
      error(error) {
        const msg = '<p>Oops! Error setting permissions:</p><p>' + error + '</p>';
        ReactDialogBox.alert(msg, true);
      },
    });
  },

  render() {
    const model = this.props.model;
    const isAdmin = model.get('isAdmin');
    const adminTooltipText = 'Cannot remove create cluster permissions for admin users.';
    // If tooltipElem was passed in as prop, use that. Otherwise, the only reason to show
    // a tooltip is if the user is admin, so use that text.
    const tooltipText = this.props.tooltipElem ? this.props.tooltipElem : adminTooltipText;

    let checkbox =
      (<div ref='clustersCheckbox' className='checkbox-wrapper'>
        <input type='checkbox'
          className='clusters-checkbox'
          data-name={model.get('username') + '-clusters-checkbox'}
          name={model.get('username') + '-clusters-checkbox'}
          key={model.get('username') + '-clusters-checkbox'}
          onChange={this.onClickClustersCheckbox}
          checked={this.state.checked}
          disabled={isAdmin || this.props.disabled}
        />
      </div>);

    if (isAdmin || this.props.disabled) {
      checkbox =
        (<Tooltip ref='clustersTooltip' text={tooltipText} attachToBody hoverDelayMillis={0}
          classes={['cluster-tooltip']}
        >
          {checkbox}
        </Tooltip>);
    }

    return checkbox;
  },
});

const ReactAccountListTable = React.createClass({

  propTypes: {
    accounts: React.PropTypes.instanceOf(AccountList).isRequired,
    adminCheckboxDisabled: React.PropTypes.bool.isRequired,
    clusterList: React.PropTypes.instanceOf(ClusterList).isRequired,
    adminCheckboxDisabledReason: React.PropTypes.node,
    numAdmins: React.PropTypes.number,
  },

  getInitialState() {
    return {
      editingPassword: false,
      // sortBy can either be null (no sorting) or the string representing the
      // header by which to sort
      sortBy: null,
      // if sortAsc is true, we sort alphabetically
      // if sortAsc is false, we sort reverse-alphabetically
      sortAsc: true,
      tableWidth: this.getWidth(),
    };
  },

  componentDidMount() {
    this.props.accounts.on('change add remove reset', this.forceUpdate.bind(this, null), this);
    const self = this;
    // save a reference to the resize handler so we can unbind it later
    this.resizeHandler = function() {
      if (self.isMounted()) {
        self.setState({ tableWidth: self.getWidth() });
      }
    };
    $(window).resize(this.resizeHandler);

    if (AclUtils.clusterAclsEnabled()) {
      Cluster.ROOT.fetchWorkspaceAcl(function(workspaceAcl) {
        workspaceAcl.on('change', function() {
          if (self.isMounted()) {
            self.forceUpdate();
          }
        });
        self.setState({ clusterRootAclService: workspaceAcl });
      });
    }
  },

  componentWillMount() {
    this.props.accounts.fetch({ reset: true });
  },

  componentWillUnmount() {
    this.props.accounts.off(null, null, this);
    if (AclUtils.clusterAclsEnabled() && this.state.clusterRootAclService) {
      this.state.clusterRootAclService.off('change');
    }
    $(window).unbind('resize', this.resizeHandler);
  },

  setSortState(header) {
    // If the clicked header is the same as the current sortBy header,
    // reverse the order (sortAsc boolean). Otherwise, set the sortBy
    // state to the new header and set sortAsc to true.
    if (!this.isMounted()) { return; }

    if (this.state.sortBy === header) {
      this.setState({
        sortAsc: !this.state.sortAsc,
      });
    } else {
      this.setState({
        sortBy: header,
        sortAsc: true,
      });
    }
  },

  rowGetter(rowIndex) {
    // This function fetches the data for our rows; it takes a row number
    // and returns a row in an array
    const rows = this.getModels();
    return [rows[rowIndex]];
  },

  getModels() {
    // This function gets the data from the models and sorts it.
    // On initial render, sortBy state is null and we return unsorted models.
    // Clicking on a column header sets the sortBy state, triggering a
    // rerender and returning sorted models.
    const self = this;
    if (this.state.sortBy === null) {
      return this.props.accounts.models;
    }
    const sortedModels = _.sortBy(this.props.accounts.models, function(model) {
      return model.get(self.state.sortBy).toLowerCase();
    });
    if (this.state.sortAsc === true) {
      return sortedModels;
    }
    return sortedModels.reverse();
  },

  getUsernameElement(model) {
    const username = model.get('username');
    return (
      <span data-username={username} className='username-cell'>
        {username}
      </span>
    );
  },

  getNameElement(model) {
    const fullname = model.get('fullname');
    return (
      <span data-name={fullname} className='name-cell'>
        {fullname}
      </span>
    );
  },

  getResetPasswordLink(model) {
    const onResetPassword = function() {
      DeprecatedDialogBox.custom({
        title: 'Change Password: ' + model.get('username'),
        controls: [
          {
            controlType: 'input',
            id: 'newPassword',
            type: 'password',
            label: 'New Password',
            placeholder: '',
            required: true,
            validate(value) {
              const [valid, message] = PasswordValidators.validatePassword(
                value, model.get('username'), model.get('fullname'));
              $('#passwordErrorMessage').text(message);
              return valid;
            },
          },
          {
            controlType: 'input',
            id: 'newPassword2',
            type: 'password',
            label: 'Confirm New Password',
            placeholder: '',
            required: true,
            validate(value) {
              if (value !== $('#newPassword').val()) {
                $('#passwordErrorMessage').text("Passwords don't match");
                return false;
              }
              const [valid, message] = PasswordValidators.validatePassword(
                value, model.get('username'), model.get('fullname'));
              if (!valid) {
                $('#passwordErrorMessage').text(message);
              } else {
                $('#passwordErrorMessage').text('All set!');
              }
              return valid;
            },
          },
          {
            controlType: 'text',
            id: 'passwordErrorMessage',
            message: '',
          },
        ],
        confirm(dialog) {
          Presence.pushHistory('Changed password for ' + model.get('username'));

          if (dialog.find('#newPassword').val() !== dialog.find('#newPassword2').val()) {
            return;
          }

          const curAttr = model.attributes;
          curAttr.password = dialog.find('#newPassword').val();
          model.save(curAttr, {
            patch: true,
            success() { dialog.remove(); },
            error(account, response) {
              DeprecatedDialogBox.alert('Error: ' + response.statusText);
            },
          });
        },
        cancel() {},
      }, null, true);
    };

    return (
      <a onClick={onResetPassword} className='reset-password pointer'>
        Reset password
      </a>
    );
  },

  getAdminCheckbox(model) {
    const self = this;
    const onChangeCallback = function() {
      if (AclUtils.clusterAclsEnabled()) {
        self.state.clusterRootAclService.fetch();
      }
    };

    return (
      <ReactAccountsTableCheckbox
        ref='adminCheckbox'
        model={model}
        onChangeCallback={onChangeCallback}
        adminCheckboxDisabled={this.props.adminCheckboxDisabled}
        adminCheckboxDisabledReason={this.props.adminCheckboxDisabledReason}
        numAdmins={this.props.numAdmins}
      />
    );
  },

  getClustersCheckbox(model) {
    let tooltipElem;
    // user is in incorrect tier
    if (AclUtils.clusterAclsAvailableWithTierUpgrade()) {
      tooltipElem = Tooltip.getGenericUpgradeElement('To enable cluster access control');
    // user is in correct tier but cluster ACLs are disabled
    } else if (AclUtils.couldEnableClusterAcls()) {
      tooltipElem = "Admin users can enable cluster-level ACLs under 'Access Control'";
    }

    return (
      <ClustersCheckbox
        model={model}
        disabled={!AclUtils.clusterAclsEnabled()}
        tooltipElem={tooltipElem}
        clusterRootAclService={this.state.clusterRootAclService}
      />);
  },

  /**
   * Render a resource that will be removed. This is currently jobs and clusters.
   *
   * @param  {string} id The resources unique identifier.
   * @param  {string} link The link to navigate to when the user clicks the resource name
   * @param  {string} name The name of the resource.
   * @return {ReactElement}
   */
  renderResource(id, link, name) {
    return (
      <tr className='user-resource' key={id}>
        <td>
          <a href={link} target='_blank'>
            <span className='name'>{name}</span>
            <i className='fa fa-fw fa-external-link pull-right'></i>
          </a>
        </td>
      </tr>
    );
  },

  renderJobList(jobsForUser) {
    return (
      <div className='resource-list'>
        <CollapsibleTableView
          headers={[`Jobs (${jobsForUser.length})`]}
          content={jobsForUser.map((job) =>
            this.renderResource(
              job.jobId,
              `#job/${job.jobId}`,
              job.jobName
          ))}
        />
      </div>
    );
  },

  renderClustersList(clustersForUser) {
    return (
      <div className='resource-list'>
        <CollapsibleTableView
          headers={[`Clusters (${clustersForUser.length})`]}
          content={clustersForUser.map((cluster) =>
            this.renderResource(
              cluster.get('clusterId'),
              '#setting/clusters',
              cluster.get('clusterName')
          ))}
        />
      </div>
    );
  },

  /**
   * Render the resource lists. Assumes that at least one of the arguments has elements.
   * @param  {Cluster[]} clustersForUser List of the users clusters.
   * @param  {Job[]} jobsForUser List of the users jobs.
   * @return {ReactElement}
   */
  renderUserResources(clustersForUser, jobsForUser) {
    return (
      <div className='resources'>
        The following resources will be removed with the user:
        { jobsForUser.length ? this.renderJobList(jobsForUser) : null }
        { clustersForUser.length ? this.renderClustersList(clustersForUser) : null }
      </div>
    );
  },

  /**
   * Render details message for removing a user. If user has clusters or jobs, will render detailed
   * lists of those resources.
   *
   * @param  {User} model The user model
   * @param  {Cluster[]} clustersForUser List of the users clusters.
   * @param  {Job[]} jobsForUser List of the users jobs.
   * @return {ReactElement}
   */
  renderRemoveUserDetails(model, clustersForUser, jobsForUser) {
    return (
      <div className='remove-user-dialog'>
        Are you sure you want to remove access for {model.get('username')}?
        {
          jobsForUser.length || clustersForUser.length
          ?
            this.renderUserResources(clustersForUser, jobsForUser)
          :
            null
        }
      </div>
    );
  },

  /**
   * Handler for when user has confirmed they want to remove the user and all of their resources.
   * Will manually iterate through clusters and jobs and remove them one by one.
   *
   * @param  {User} model The user model
   * @param  {Cluster[]} clustersForUser List of the users clusters.
   * @param  {Object[]} jobsForUser List of the users jobs as attribute objects (not Job model).
   * @return {none}
   */
  removeUser(model, clustersToRemove, jobsToRemove) {
    clustersToRemove.forEach((cluster) => {
      ClusterUtil.deleteCluster(this.props.clusterList, cluster.get('clusterId'));
    });

    jobsToRemove.forEach((job) => {
      $.ajax('/jobs/remove', {
        type: 'POST',
        data: job.jobId.toString(),
        error(xhr, status, error) {
          console.error('error deleting job', xhr, status, error);
        },
      });
    });

    model.destroy();
  },

  /**
   * Fetch all jobs for a given user.
   *
   * @param  {string} userId The user ID to fetch jobs for.
   * @param  {function} onSuccess Called with the users job list.
   * @param  {function} onError
   * @return {none}
   */
  fetchUserJobs(userId, onSuccess, onError) {
    $.ajax('/jobs/user/' + userId.toString(), {
      type: 'GET',
      error(xhr, status, error) {
        console.error('Error fetch jobs for user', xhr, status, error);
        if (onError) {
          onError(xhr, status, error);
        }
      },
      success(data) {
        if (onSuccess) {
          onSuccess(data);
        }
      },
    });
  },

  /**
   * Wrapper for showing remove user dialog.
   *
   * @param  {User} model The user model
   * @param  {Cluster[]} clustersForUser List of the users clusters.
   * @param  {Object[]} jobsForUser List of the users jobs as attribute objects (not Job model).
   * @return {none}
   */
  showRemoveDialogForUser(model, clustersForUser, userJobs) {
    ReactDialogBox.confirm({
      name: 'remove-user',
      title: 'Remove User',
      message: this.renderRemoveUserDetails(model, clustersForUser, userJobs),
      confirmButton: 'Remove User',
      confirm: () => this.removeUser(model, clustersForUser, userJobs),
    });
  },

  /**
   * Click handler for when admin chooses to remove a user.
   * @param  {User} model The model for the user to be removed.
   * @return {none}
   */
  onRemoveUserHandler(model) {
    const userId = model.get('id');
    const clustersForUser = this.props.clusterList.activeClustersForUser(userId);

    if (!window.settings.enableElasticSparkUI) {
      // If jobs is not enabled, like in training and community edition.
      this.showRemoveDialogForUser(model, clustersForUser, []);
    } else {
      this.fetchUserJobs(userId,
        (userJobs) => this.showRemoveDialogForUser(model, clustersForUser, userJobs),
        (xhr, status, error) => {
          const msg = `
            Error removing user
            ${error}
          `;
          ReactDialogBox.alert(msg);
        }
      );
    }
  },

  /**
   * Creates the 'X' used to select a user to remove. Responsible for creating the event handler
   * that will show user a "confirm remove" dialog.
   *
   * @param  {User} model The user who will be removed by clicking this remove user element.
   * @return {ReactElement} The remove user element to display (an 'X' next to the username).
   */
  getRemoveUserElement(model) {
    if (model.get('id') === window.settings.userId) {
      return null;  // You're not allowed to delete your own user.
    }

    const onRemoveUser = () => this.onRemoveUserHandler(model);

    return (
      <div style={{ 'marginRight': '8px' }}>
        <a onClick={onRemoveUser}
          className='remove-button pointer'
          title='Remove'
          key={model.get('username')}
          data-username={model.get('username')}
        >
          <i className='fa fa-remove'></i>
        </a>
      </div>
    );
  },

  getUsernameHeader(label) {
    const sortUsername = this.setSortState.bind(this, 'username');
    return (
      <a onClick={sortUsername}
        className='table-header username-header'
      >
        {label}
      </a>
    );
  },

  getNameHeader(label) {
    const sortFullname = this.setSortState.bind(this, 'fullname');
    return (
      <a onClick={sortFullname}
        className='table-header name-header'
      >
        {label}
      </a>
    );
  },

  getBasicHeader(label) {
    return (
      <span className='table-header basic-header'>{label}</span>
    );
  },

  getSortIcon(header) {
    // This function returns the appropriate arrow to indicate the direction
    // a header is currently sorted. If the given header is currently set as
    // the sortBy state, it returns an up arrow for ascending and down for
    // descending, and nothing otherwise.
    if (this.state.sortBy === header) {
      if (this.state.sortAsc) {
        return ' ↑';
      }
      return ' ↓';
    }
    return '';
  },

  getWidth() {
    return ($('#content').innerWidth() - 25);
  },

  render() {
    /**
     * Do not use this as an example for tables; it needs to be refactored to use
     * ReactTable's Table and Column. For now, see ClusterDetailsLibrariesList and
     * ClusterDetailsLibrariesListView.
     */
    const usernameHeaderIcon = this.getSortIcon('username');
    const fullnameHeaderIcon = this.getSortIcon('fullname');
    const removeUserColumnWidth = 100;
    // feature flag check (whether to show cluster permissions column at all)
    const showClusterCheckbox = AclUtils.clusterAclsFeatureFlag();
    const showResetPassword =
      (window.settings.enableAdminPasswordReset && !window.settings.enableX509Authentication);
    let widthDivisor = 3;
    if (showClusterCheckbox) {
      widthDivisor += 1;
    }
    if (showResetPassword) {
      widthDivisor += 1;
    }
    const columnWidth = (this.state.tableWidth - removeUserColumnWidth) / widthDivisor;

    const retAccountListRow = function() {
      return 'account-list-row';
    };
    const renderUsername = (model) => this.getUsernameElement(model);
    const renderName = (model) => this.getNameElement(model);
    const renderResetPw = (model) => this.getResetPasswordLink(model);
    const renderAdminCheckbox = (model) => this.getAdminCheckbox(model);
    const renderClustersCheckbox = (model) => this.getClustersCheckbox(model);
    const renderRemoveUser = (model) => this.getRemoveUserElement(model);

    return (
      <div className='accounts-table'>
        <Table
          rowHeight={26}
          rowGetter={this.rowGetter}
          rowsCount={this.getModels().length}
          width={this.state.tableWidth}
          maxHeight={50000}
          headerHeight={26}
          rowClassNameGetter={retAccountListRow}
          ref='table'
        >
          <Column
            headerRenderer={this.getUsernameHeader}
            headerClassName='header-container'
            label={'Username' + usernameHeaderIcon}
            width={columnWidth}
            dataKey={0}
            cellClassName='cell-container'
            cellRenderer={renderUsername}
          />
          <Column
            headerRenderer={this.getNameHeader}
            headerClassName='header-container'
            label={'Name' + fullnameHeaderIcon}
            width={columnWidth}
            dataKey={0}
            cellClassName='cell-container'
            cellRenderer={renderName}
          />
          {showResetPassword ? <Column
            headerRenderer={this.getBasicHeader}
            headerClassName='header-container'
            label='Password'
            width={columnWidth}
            dataKey={0}
            cellClassName='cell-container'
            cellRenderer={renderResetPw}
          /> : null}
          <Column
            headerRenderer={this.getBasicHeader}
            headerClassName='header-container admin-column-header'
            label='Admin'
            align='center'
            width={columnWidth}
            dataKey={0}
            cellClassName='cell-container'
            cellRenderer={renderAdminCheckbox}
          />
          {showClusterCheckbox ? <Column
            headerRenderer={this.getBasicHeader}
            headerClassName='header-container create-cluster-column-header'
            label='Allow cluster creation'
            align='center'
            width={columnWidth}
            dataKey={0}
            cellClassName='cell-container'
            cellRenderer={renderClustersCheckbox}
          /> : null}
          <Column
            headerRenderer={this.getBasicHeader}
            headerClassName='header-container'
            label=''
            align='right'
            width={removeUserColumnWidth}
            dataKey={0}
            cellClassName='cell-container'
            cellRenderer={renderRemoveUser}
          />
        </Table>
      </div>
    );
  },
});

module.exports = ReactAccountListTable;
