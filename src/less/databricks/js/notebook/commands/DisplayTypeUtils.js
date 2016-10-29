import _ from 'lodash';

export class DisplayTypeUtils {
  /**
   * Compute displayType based on resultType and existing displayType
   * This allows us retain complexDisplayTypes (barChart, etc) if result is displayable and
   * still change it when resultType changes.
   */
  static computeDisplayType(existingDisplayType, resultType, suggestedDisplayType) {
    if (suggestedDisplayType) {
      return suggestedDisplayType;
    }
    if (resultType === null) {
      return existingDisplayType;
    }
    if (resultType !== 'table' ||
        existingDisplayType === 'markdown' ||
        existingDisplayType === 'html' ||
        existingDisplayType === 'image' ||
        DisplayTypeUtils.isMLSpecificDisplayType(existingDisplayType)) {
      return resultType;
    }
    return existingDisplayType;
  }

  /**
   * Checks if the given displayType is specific to ML (machine learning) display
   */
  static isMLSpecificDisplayType(displayType) {
    return _.contains(['ROC'], displayType);
  }
}
