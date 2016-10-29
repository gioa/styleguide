import React from 'react';

import ReactFormFooter from '../../forms/ReactFormFooter.jsx';

import { Pluralize } from '../../i18n/Pluralize';

import { Collapsible } from '../../ui_building_blocks/Collapsible.jsx';
import ReactModal from '../../ui_building_blocks/dialogs/ReactModal.jsx';
import { Table, Column } from '../../ui_building_blocks/tables/ReactTable.jsx';
import { CellRenderers } from '../../ui_building_blocks/tables/ReactTableUtils.jsx';

export class IamRoleDeleteDialogView extends React.Component {
  constructor(props) {
    super(props);

    // es6 bindings
    this.renderBody = this.renderBody.bind(this);

    // Create renderers
    this.nameCellRenderer = CellRenderers.getLinkCellRenderer(
      (row) => row.href, // href getter
      (row) => row.name, // content getter
      () => false,       // getter for should-be-disabled
      true               // should open in new tab
    );
  }

  linkCellRenderer(row) {
    return (
      <div>
        <a
          href={row.href}
          target='_blank'
        >
          <i className='fa fa-fw fa-external-link pull-right'></i>
        </a>
      </div>
    );
  }

  /**
   * @param {string} title: a title to give the expandable section
   * @param {array} list: a list of resources using this iam role
   *   Each list element should have keys: name, href
   */
  getCollapsibleTable(title, list) {
    if (list.length === 0) {
      return null;
    }
    // This width was calculated as (modal.width - 2 * expansionIcon.width)
    const tableWidth = 446;
    const linkWidth = 40;
    return (
      <Collapsible
        ref={title.toLowerCase() + 'Table'}
        title={title + ` (${list.length})`}
      >
        <Table
          rows={list}
          width={tableWidth}
          rowHeight={30}
          isHeaderless
        >
          <Column
            width={tableWidth - linkWidth}
            cellRenderer={this.nameCellRenderer}
          />
          <Column
            width={linkWidth}
            cellRenderer={this.linkCellRenderer}
          />
        </Table>
      </Collapsible>
    );
  }

  /**
   * @param {int} numClusters: a number of clusters to design a message for.
   *   If there are no clusters, then we do not want a message.
   * @return {string} the warning to render regarding clusters
   */
  getPluralizedClusterMessage(numClusters) {
    if (numClusters === 0) {
      return '';
    }
    const objectPronoun = numClusters === 1 ? 'it' : 'them';
    return `The running ${Pluralize.simplePluralize(numClusters, 'cluster')} shown ` +
      'below will continue to use this IAM role to access AWS resources until you ' +
      `terminate ${objectPronoun}.`;
  }

  /**
   * @param {boolean} needsTransition: true when job message will follow another sentence
   * @return {string} a warning to render regarding jobs, with the proper transition
   */
  getJobMessageWithTransition(needsTransition) {
    const prefix = needsTransition ? ' In addition, all' : 'All';
    return `${prefix} jobs using this IAM role will fail as a result of deleting the ` +
      'IAM role.';
  }

  /**
   * @param {int} numClusters: the number of clusters using this IAM role
   * @return {string} the message we show at the top of the dialog
   */
  getPrimaryMessageText(numClusters) {
    const clusterMsg = this.getPluralizedClusterMessage(numClusters);
    const jobMsg = this.getJobMessageWithTransition(numClusters > 0);
    return clusterMsg + jobMsg;
  }

  renderBody() {
    const confirmMsg = this.getPrimaryMessageText(
      this.props.clustersUsingRole.length
    );
    const shiftTip = this.props.showShiftTip ? (
      <p className='hint-msg'>
        Tip: bypass this dialog by holding the 'Shift' key when deleting an IAM role.
      </p>
    ) : null;
    return (
      <div>
        <span ref='message'>{confirmMsg}</span>
        {shiftTip}
        {this.getCollapsibleTable('Clusters', this.props.clustersUsingRole)}
        {this.getCollapsibleTable('Jobs', this.props.jobsUsingRole)}
      </div>
    );
  }

  render() {
    const footer = (
      <ReactFormFooter
        ref='footer'
        confirm={this.props.deleteFunc}
        confirmButton='Delete Role'
        confirmBtnClassName='btn btn-danger'
      />
    );
    return (
      <ReactModal
        modalName='iam-role-delete-dialog'
        header={<h3>Delete IAM Role</h3>}
        body={this.renderBody()}
        footer={footer}
      />
    );
  }
}

IamRoleDeleteDialogView.propTypes = {
  deleteFunc: React.PropTypes.func.isRequired,
  clustersUsingRole: React.PropTypes.array.isRequired,
  jobsUsingRole: React.PropTypes.array.isRequired,
  showShiftTip: React.PropTypes.bool,
};

IamRoleDeleteDialogView.defaultProps = {
  showShiftTip: false,
};
