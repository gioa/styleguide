import _ from 'underscore';
import React from 'react';

import { AclUtils } from '../acl/AclUtils.jsx';

import ClusterList from '../clusters/ClusterList';

import { Input, Select } from '../forms/ReactFormElements.jsx';
import ReactFormFooter from '../forms/ReactFormFooter.jsx';

import ReactModal from '../ui_building_blocks/dialogs/ReactModal.jsx';

import { NodeNameValidators } from '../validators/NodeNameValidators';

export class AddNotebookView extends React.Component {
  constructor(props) {
    super(props);

    this._onEnter = this._onEnter.bind(this);
    this._onConfirm = this._onConfirm.bind(this);
    this._handleNameChange = this._handleNameChange.bind(this);

    this.availableLangs = ['Python', 'Scala', 'SQL', 'R'];

    this.state = {
      nameValid: false,
    };
  }

  componentDidMount() {
    this.refs.notebookNameInput.focus();
    this.fetchClusterAcls();
    if (this.props.clusters) {
      this.props.clusters.on('reset change add remove', this._forceUpdate.bind(this, null), this);
    }
  }

  _forceUpdate() {
    this.forceUpdate();
    this.fetchClusterAcls();
  }

  fetchClusterAcls() {
    const clusters = this.props.clusters;
    const attachableClustersExist = clusters && clusters.attachableClusters() &&
      clusters.attachableClusters().length > 0;
    if (AclUtils.clusterAclsEnabled() && attachableClustersExist) {
      clusters.attachableClusters().forEach((cluster) => {
        cluster.fetchPermissionLevel();
      });
    }
  }

  componentWillUnmount() {
    if (this.props.clusters) {
      this.props.clusters.off(null, null, this);
    }
  }

  _onEnter(e) {
    if (this.state.nameValid) {
      this.refs.notebookFormFooter.confirm(e);
    }
  }

  _onConfirm() {
    if (this.state.nameValid) {
      const name = this.refs.notebookNameInput.value();
      const language = this.refs.languageSelect.value();

      // @NOTE(jengler) 2016-03-31: PROD-10042, clusterSelect will not be shown
      // when there are not clusters that can be attached to.
      const clusterId = this.refs.clusterSelect && this.refs.clusterSelect.value();

      this.props.createNotebookFunc(name, language, clusterId);
    }
  }

  _getClusterInput() {
    if (!this.props.clusters || this.props.clusters.length === 0) {
      return null;
    }
    const attachableClusters = this.props.clusters.attachableClusters();
    if (!attachableClusters || attachableClusters.length === 0) {
      return null;
    }

    let cannotAttachToAnyClusters = true;
    const clusterOptions = attachableClusters.map((cluster) => {
      if (cluster.canAttach() || !AclUtils.clusterAclsEnabled()) {
        cannotAttachToAnyClusters = false;
      }
      return {
        label: cluster.shortDescription(),
        value: cluster.get('clusterId'),
        disabled: AclUtils.clusterAclsEnabled() ? !cluster.canAttach() : false,
      };
    });

    if (cannotAttachToAnyClusters) {
      return null;
    }

    const defaultCluster = _.find(attachableClusters, (cluster) => cluster.canAttach());

    return (
      <div className='multi-input-row clusters-row' ref='clusterInputDiv'>
        <div>
          <label>Cluster</label>
          <div>
            <Select
              selectId='clusters'
              ref='clusterSelect'
              selectClassName='control-field clusters'
              options={clusterOptions}
              defaultValue={defaultCluster ? defaultCluster.get('clusterId') : null}
              confirm={this._onEnter}
            />
          </div>
        </div>
      </div>
    );
  }

  _getLangOptions() {
    return _.map(this.availableLangs, (lang) => ({
      label: lang,
      value: lang.toLowerCase(),
    }));
  }

  _handleNameChange(name) {
    this.setState({
      nameValid: NodeNameValidators.isValidName(name),
    });
  }

  _getBody() {
    return (
      <div>
        <div className='multi-input-row'>
          <div>
            <label>Name</label>
            <div>
              <Input
                type={"text"}
                ref='notebookNameInput'
                id='notebook-name-input'
                validate={NodeNameValidators.isValidName}
                onChange={this._handleNameChange}
                confirm={this._onEnter}
                inputClassName='control-field shell-name'
                required
              />
            </div>
          </div>
        </div>
        <div className='multi-input-row'>
          <div>
            <label>Language</label>
            <div>
              <Select
                ref='languageSelect'
                options={this._getLangOptions()}
                selectId='notebook-lang-select'
                selectClassName='control-field language'
                confirm={this._onEnter}
                defaultValue={this.props.lastLanguage}
              />
            </div>
          </div>
        </div>
        {this._getClusterInput()}
      </div>
    );
  }

  _getFooter() {
    return (
      <ReactFormFooter
        ref='notebookFormFooter'
        confirm={this._onConfirm}
        showConfirm
        showCancel
        confirmDisabled={!this.state.nameValid}
        confirmButton='Create'
      />);
  }

  render() {
    return (
      <ReactModal
        modalName='create-notebook-modal'
        header={<h3>Create Notebook</h3>}
        body={this._getBody()}
        footer={this._getFooter()}
      />
    );
  }
}

AddNotebookView.propTypes = {
  clusters: React.PropTypes.instanceOf(ClusterList).isRequired,
  createNotebookFunc: React.PropTypes.func,
  lastLanguage: React.PropTypes.string,
};

AddNotebookView.defaultProps = {
  lastLanguage: 'python',
};
