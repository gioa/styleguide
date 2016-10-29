import _ from 'lodash';
import React from 'react';

import { AclUtils } from '../../acl/AclUtils.jsx';
import WorkspacePermissions from '../../acl/WorkspacePermissions';

import { InstanceProfilesProtos } from '../../proto.js';

import { ObjectUtils } from '../../js_polyfill/ObjectUtils';

import { ProtoService } from '../../requests/ProtoApi.js';

import ReactModalUtils from '../../ui_building_blocks/dialogs/ReactModalUtils';
import { CompareTos } from '../../ui_building_blocks/tables/ReactTableUtils.jsx';

import { NameUtils } from '../../user_info/NameUtils';

import { IamRoleDeleteDialog } from '../../user_menu/iam_roles/IamRoleDeleteDialog.jsx';
import { IamRolesListView } from '../../user_menu/iam_roles/IamRolesListView.jsx';
import { IamRolesUtils } from '../../user_menu/iam_roles/IamRolesUtils.jsx';

export class IamRolesList extends React.Component {
  constructor(props) {
    super(props);

    // es6 bindings
    this.accessSortFunc = this.accessSortFunc.bind(this);
    this.deleteHandler = this.deleteHandler.bind(this);
    this.filter = this.filter.bind(this);
    this.fetchPermissions = this.fetchPermissions.bind(this);
    this.updateListWithPermissions = this.updateListWithPermissions.bind(this);

    // Sort functions
    this.nameSortFunc = this.getSortFunc((row) => IamRolesUtils.parseIamRoleName(row.arn));
    this.arnSortFunc = this.getSortFunc((row) => row.arn);

    // Proto service
    this.protoService = new ProtoService(InstanceProfilesProtos.InstanceProfilesService);

    this.state = {
      list: [],
      currentFilter: '',
    };
  }

  componentWillMount() {
    this.updateList();
  }

  /**
   * @param {string} arn: some instance profile ARN, corresponding to a row
   * @return {Object} a row object
   */
  transformArnToListElem(arn) {
    const thoseWithAccess = {
      thoseWithAccess: {
        // start with empty arrays so as not to block rendering while ACLs are being fetched
        individuals: [],
        groups: [],
      },
    };
    return _.assign({
      arn: arn,
    }, thoseWithAccess);
  }

  /**
   * Success function called when ACLs are fetched. Generates list of individuals & groups with
   * permissions on each IAM role, and updates the state accordingly.
   * @param {object} permissionsMap: mapping of ARN string to permissions object for that role
   */
  updateListWithPermissions(permissionsMap) {
    const updatedList = this.state.list.slice();
    updatedList.forEach((listElem) => {
      const permissionsObj = permissionsMap[listElem.arn];
      if (!permissionsObj) { return; }
      const permissionsList = permissionsObj.permissions;
      listElem.thoseWithAccess.individuals = this.getListOfThoseWithAccess(permissionsList, 'user');
      listElem.thoseWithAccess.groups = this.getListOfThoseWithAccess(permissionsList, 'group');
    });
    this.setState({
      list: updatedList,
    });
  }

  /**
   * @param {array} permissionsList: list of permissions objects for a given IAM role, each with:
   *                  - permissions: list of permissions for a given user
   *                  - user: user object who has the associated permissions on the IAM role
   * @param {string} userKind: "user" (i.e. individual) or "group"
   * @return {array} list of those with access to IAM role
   */
  getListOfThoseWithAccess(permissionsList, userKind) {
    const thoseWithAccess = [];
    permissionsList.forEach((permissionsObj) => {
      const userHasPermissions = permissionsObj.permission.length > 0;
      const userIsRightKind = permissionsObj.user.kind === userKind;
      if (userHasPermissions && userIsRightKind) {
        const displayName = this.getUserDisplayName(permissionsObj.user, userKind);
        thoseWithAccess.push(displayName);
      }
    });
    return thoseWithAccess;
  }

  getUserDisplayName(user, userKind) {
    const displayName = user.fullName || user.username;
    return userKind === 'group' ? NameUtils.capitalizeAllNames(displayName) : displayName;
  }

  /**
   * Bulk fetches ACLs for the IAM roles
   * @param {array} arnObjList list of arn objects displayed in the UI
   * @param {function} onSuccess success callback
   */
  fetchPermissions(arnObjList, onSuccess) {
    const listOfARNs = arnObjList.map((arnObj) => arnObj.instance_profile_arn);
    const aclObjectType = WorkspacePermissions.IAM_ROLE_TYPE;
    AclUtils.bulkFetchEffectivePermissions(listOfARNs, aclObjectType, onSuccess);
  }

  /**
   * Update the list and filtered list with the API
   */
  updateList() {
    const listRpc = this.protoService.rpc('listInstanceProfiles');
    listRpc(undefined, (data) => {
      const inputList = data.instance_profiles ? data.instance_profiles : [];
      if (inputList.length > 0) {
        this.fetchPermissions(inputList, this.updateListWithPermissions);
      }
      const newList = inputList.map(
        (arnObj) => this.transformArnToListElem(arnObj.instance_profile_arn)
      );
      this.setState({
        list: newList,
      });
    });
  }

  /**
   * @param {function} valueGetter: given a row, return the value to be sorted by
   * @return {function} a callback to sort the rows
   */
  getSortFunc(valueGetter) {
    return (dir) => {
      const newList = this.state.list.sort(CompareTos.getSimpleCompareTo(valueGetter, dir));
      this.setState({
        list: newList,
      });
    };
  }

  /**
   * This function is the callback used to sort by the "Who has access" column
   * @param {number} dir: the direction (asc or desc) to sort by
   */
  accessSortFunc(dir) {
    const newList = this.state.list.sort(CompareTos.getNameListCompareTo(
      (row) => row.thoseWithAccess.groups,
      (row) => row.thoseWithAccess.individuals,
      dir
    ));
    this.setState({
      list: newList,
    });
  }

  getFuncToDeleteRole(arn) {
    const allButThisRow = (row) => row.arn !== arn;
    const successFunc = () => this.setState({
      list: this.state.list.filter(allButThisRow),
    });
    return () => this.protoService.rpc('removeInstanceProfile')({
      instance_profile_arn: arn,
    }, successFunc);
  }

  /**
   * Delete a particular IAM role
   * @param {object} rowToDelete: the element of this.state.list we want to delete
   */
  deleteHandler(rowToDelete, evt) {
    if (evt && evt.getModifierState && evt.getModifierState('Shift')) {
      this.getFuncToDeleteRole(rowToDelete.arn)();
    } else {
      ReactModalUtils.createModal(
        <IamRoleDeleteDialog
          arn={rowToDelete.arn}
          deleteFunc={this.getFuncToDeleteRole(rowToDelete.arn)}
          showShiftTip
        />
      );
    }
  }

  /**
   * @param {string} value: the current value of the filter <input />
   */
  filter(value) {
    this.setState({
      currentFilter: value,
    });
  }

  getFilteredList() {
    return this.state.list.filter((row) =>
      ObjectUtils.deepIncludesString(row, this.state.currentFilter));
  }

  render() {
    return (
      <IamRolesListView
        rows={this.getFilteredList()}
        nameSortFunc={this.nameSortFunc}
        arnSortFunc={this.arnSortFunc}
        accessSortFunc={this.accessSortFunc}
        deleteFunc={this.deleteHandler}
        filterFunc={this.filter}
      />
    );
  }
}
