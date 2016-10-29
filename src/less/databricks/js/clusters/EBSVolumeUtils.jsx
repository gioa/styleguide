/* eslint consistent-return: 0 */

import React from 'react';

import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

/**
 * Helpers for the EBS volume fields used in cluster create & cluster details views.
 */

function HelpIconTooltip({ text }) {
  return (
    <Tooltip text={text} customPosition={{ contentLeft: '0' }}>
      <i className='fa fa-question-circle help-icon' />
    </Tooltip>
  );
}

HelpIconTooltip.propTypes = {
  text: React.PropTypes.string.isRequired,
};

function EBSVolumeTypeTooltip() {
  const text = `Use EBS volumes instead of local storage for the driver and each of the worker
    instances in the cluster. This is useful for running workloads that require a lot of shuffle
    spaces. Note: this is only supported for beta node types.`;
  return <HelpIconTooltip text={text} />;
}

function EBSVolumeSizeTooltip({ GPMin, GPMax, TOMin, TOMax }) {
  const text = `The size of each EBS volume (in GB) launched for each instance. For general purpose
    SSD, this value must be within the range ${GPMin} - ${GPMax}. For throughput optimized HDD,
    this value must be within the range ${TOMin} - ${TOMax}.`;
  return <HelpIconTooltip text={text} />;
}

EBSVolumeSizeTooltip.propTypes = {
  GPMin: React.PropTypes.number.isRequired,
  GPMax: React.PropTypes.number.isRequired,
  TOMin: React.PropTypes.number.isRequired,
  TOMax: React.PropTypes.number.isRequired,
};

function EBSVolumeCountTooltip({ maxCount }) {
  const text = `The number of volumes to provision for each instance. Users can choose up
    to ${maxCount} volumes per instance.`;
  return <HelpIconTooltip text={text} />;
}

EBSVolumeCountTooltip.propTypes = {
  maxCount: React.PropTypes.number.isRequired,
};

export class EBSVolumeUtils {
  static getGeneralPurposeMin() {
    const sizeLimits = window.settings.ebsVolumeSizeLimitGB;
    if (!sizeLimits) { return; }
    return sizeLimits[EBSVolumeUtils.GENERAL_PURPOSE][0];
  }

  static getGeneralPurposeMax() {
    const sizeLimits = window.settings.ebsVolumeSizeLimitGB;
    if (!sizeLimits) { return; }
    return sizeLimits[EBSVolumeUtils.GENERAL_PURPOSE][1];
  }

  static getThroughputOptimizedMin() {
    const sizeLimits = window.settings.ebsVolumeSizeLimitGB;
    if (!sizeLimits) { return; }
    return sizeLimits[EBSVolumeUtils.THROUGHPUT_OPTIMIZED][0];
  }

  static getThroughputOptimizedMax() {
    const sizeLimits = window.settings.ebsVolumeSizeLimitGB;
    if (!sizeLimits) { return; }
    return sizeLimits[EBSVolumeUtils.THROUGHPUT_OPTIMIZED][1];
  }

  static getEBSSummary(count, size) {
    return `${count * size} GB storage per instance`;
  }

  /**
   * @param {array} nodeTypes - list of nodeType objects
   * @param {string} nodeTypeId - id of nodeType being checked (for EBS support)
   * @returns {boolean}
   */
  static nodeTypeSupportsEBSVolumes(nodeTypes, nodeTypeId) {
    if (!nodeTypes) { return false; }
    return !!nodeTypes.find((nodeType) =>
      nodeType.node_type_id === nodeTypeId && nodeType.support_ebs_volumes
    );
  }
}

EBSVolumeUtils.EBSVolumeTypeTooltip = EBSVolumeTypeTooltip;
EBSVolumeUtils.EBSVolumeSizeTooltip = EBSVolumeSizeTooltip;
EBSVolumeUtils.EBSVolumeCountTooltip = EBSVolumeCountTooltip;
EBSVolumeUtils.GENERAL_PURPOSE = 'GENERAL_PURPOSE_SSD';
EBSVolumeUtils.GENERAL_PURPOSE_LABEL = 'General Purpose SSD';
EBSVolumeUtils.THROUGHPUT_OPTIMIZED = 'THROUGHPUT_OPTIMIZED_HDD';
EBSVolumeUtils.THROUGHPUT_OPTIMIZED_LABEL = 'Throughput Optimized HHD';
EBSVolumeUtils.TYPE_LABEL = 'EBS Volume Type';
EBSVolumeUtils.COUNT_LABEL = '# Volumes';
EBSVolumeUtils.SIZE_LABEL = 'Size in GB';
