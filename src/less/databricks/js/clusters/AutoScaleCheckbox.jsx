import React from 'react';

import { LabeledCheckbox } from '../forms/ReactFormElements.jsx';

import IconsForType from '../ui_building_blocks/icons/IconsForType';
import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

import { DbGuideUrls } from '../urls/DbGuideUrls';
import DbGuideLinks from '../urls/DbGuideLinks';

export class AutoScaleCheckbox extends React.Component {
  constructor(props) {
    super(props);

    this.onChange = this.onChange.bind(this);
  }

  getTooltipText() {
    let tooltipText =
      'A cluster that automatically scales between the minimum and maximum number of nodes, ' +
      'based on load. ';

    if (this.props.showHybridMessaging) {
      tooltipText += 'The on-demand size determines the number of on-demand nodes; the rest of ' +
        'the nodes in the cluster will attempt to be on spot. The driver will be on demand. ';
    }

    if (this.props.showWarning) {
      tooltipText = 'Autoscaling works best with Spark 1.6.2+ / Spark 2.0. ';
    }

    return (
      <span>
        {tooltipText}
        <a href={DbGuideUrls.getDbGuideUrl(DbGuideLinks.CLUSTER_AUTOSCALING_URL)}>Learn more</a>
      </span>
    );
  }

  onChange(value) {
    if (this.props.onChange) {
      this.props.onChange(value);
    }
  }

  render() {
    let tooltipText;

    if (this.props.enableAutoScale) {
      tooltipText = this.getTooltipText();
    } else {
      tooltipText = Tooltip.getGenericUpgradeElement('To enable cluster auto scaling');
    }

    const iconClass = this.props.showWarning ? IconsForType.warning : IconsForType.hint;

    return (
      <div className='auto-scale-checkbox'>
        <LabeledCheckbox
          ref={"autoScaleCheckbox"}
          checkboxID={"autoScaleCheckbox"}
          defaultChecked={this.props.defaultChecked}
          disabled={!this.props.enableAutoScale || this.props.disabled}
          labelClassName={this.props.enableAutoScale ? null : 'disabled'}
          label='Enable Autoscaling (beta)'
          checkboxClassName='control-field auto-scale-input'
          onChange={this.onChange}
        />
        <div className='auto-scale-tooltip'>
          <Tooltip text={tooltipText}>
            <i className={'fa fa-' + iconClass} />
          </Tooltip>
        </div>
      </div>
    );
  }
}

AutoScaleCheckbox.propTypes = {
  defaultChecked: React.PropTypes.bool,
  enableAutoScale: React.PropTypes.bool,
  showHybridMessaging: React.PropTypes.bool,
  onChange: React.PropTypes.func,
  disabled: React.PropTypes.bool,
  showWarning: React.PropTypes.bool,
};

AutoScaleCheckbox.defaultProps = {
  enableAutoScale: true,
  showHybridMessaging: false,
  disabled: false,
  showWarning: false,
};
