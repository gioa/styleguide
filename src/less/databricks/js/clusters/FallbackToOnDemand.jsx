import React from 'react';

import { LabeledCheckbox } from '../forms/ReactFormElements.jsx';

import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

export class FallbackOnDemandCheckbox extends React.Component {
  _isDisabled() {
    return this.props.disabled;
  }

  render() {
    return (
        <div className='fall-back-checkbox'>
          <LabeledCheckbox
            ref={"clusterFallBack"}
            checkboxID={"clusterFallBack"}
            label='Fall back to On-Demand'
            checkboxClassName='control-field fallback-checkbox'
            confirm={this.props.confirmOnEnter}
            onChange={this.props.onChange}
            defaultChecked={this.props.defaultOnDemandFallBack}
            disabled={this._isDisabled()}
          />
        </div>
    );
  }
}

FallbackOnDemandCheckbox.propTypes = {
  disabled: React.PropTypes.bool,
  defaultOnDemandFallBack: React.PropTypes.bool,
  onChange: React.PropTypes.func,
  confirmOnEnter: React.PropTypes.func,
};

FallbackOnDemandCheckbox.defaultProps = {
  disabled: false,
  defaultOnDemandFallBack: true,
};

export function FallbackOnDemandTooltip({ customPosition }) {
  const tooltipText = (
    <div>
      If spot price for Amazon EC2 instances exceeds the bid at cluster
      creation, then create on-demand instances instead of spot-instances.
    </div>);

  return (
    <div className='fall-back-tooltip'>
      <Tooltip customPosition={customPosition} text={tooltipText}>
        <i className='fa fa-question-circle help-icon fall-back-icon' />
      </Tooltip>
    </div>
  );
}

FallbackOnDemandTooltip.propTypes = {
  customPosition: React.PropTypes.object,
};
