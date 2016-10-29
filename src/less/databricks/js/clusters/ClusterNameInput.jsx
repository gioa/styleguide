import React from 'react';

import { Label } from '../clusters/Common.jsx';
import ClusterList from '../clusters/ClusterList';

import { Input } from '../forms/ReactFormElements.jsx';

export class ClusterNameInput extends React.Component {
  constructor(props) {
    super(props);
    this.validateName = this.validateName.bind(this);
    this.onChangeName = this.onChangeName.bind(this);
    this.state = {
      name: this.props.clusterName,
      nameValid: false,
    };
  }

  validateName(name) {
    const clusterExists = this.props.clusters.find(function matchThisCluster(cluster) {
      return !cluster.isTerminated() && cluster.get('clusterName') === name;
    });
    const isValid = !clusterExists && name !== '';
    this.setState({ nameValid: isValid });
    if (this.props.onNameValidation) {
      this.props.onNameValidation(isValid);
    }

    return isValid;
  }

  get() {
    return this.state.name;
  }

  focus() {
    this.refs[ClusterNameInput.CLUSTER_NAME_REF].focus();
  }

  onChangeName(name) {
    this.setState({ name: name });
  }

  nameTooltipConditions() {
    return [
      {
        condition: function condition(value) {
          return this.props.clusters.find(function matchThisCluster(cluster) {
            return !cluster.isTerminated() && cluster.get('clusterName') === value;
          });
        }.bind(this),
        tooltip: 'A cluster with this name already exists.',
      },
      {
        condition(value) {
          return value === '';
        },
        tooltip: 'Please enter a cluster name.',
      },
    ];
  }

  render() {
    return (
        <div className='cluster-name section-padded'>
          <Label>Cluster Name</Label>
          <Input
            type='text'
            ref={ClusterNameInput.CLUSTER_NAME_REF}
            inputID={ClusterNameInput.CLUSTER_NAME_REF}
            inputClassName='cluster-name-input'
            validate={this.validateName}
            onChange={this.onChangeName}
            required
            defaultValue={this.state.name}
            tooltipConditions={this.nameTooltipConditions()}
          />
        </div>
    );
  }
}

ClusterNameInput.CLUSTER_NAME_REF = 'clusterName';

ClusterNameInput.propTypes = {
  clusters: React.PropTypes.instanceOf(ClusterList).isRequired,
  clusterName: React.PropTypes.string,
  onNameValidation: React.PropTypes.func,
};
