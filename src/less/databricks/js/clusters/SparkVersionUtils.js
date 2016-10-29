/**
 * Core set of utility functions
 *
 */
import _ from 'lodash';

export class SparkVersionUtils {
  /**
   * Resolves a spark version key (e.g. "1.2") to a sparkVersion struct, or null.
   * See window.settings.sparkVersions for the list of possible matches.
   */
  static resolveSparkVersion(key) {
    let i;
    for (i in window.settings.sparkVersions) {
      if (!window.settings.sparkVersions.hasOwnProperty(i)) {
        continue;
      }
      const version = window.settings.sparkVersions[i];
      if (version.key === key) {
        return version;
      }
    }
    return null;
  }

  static getDefaultSparkVersion() {
    const key = window.prefs.get('defaultSparkVersion');
    const entry = SparkVersionUtils.resolveSparkVersion(key);
    if (entry === null) {
      return window.settings.defaultSparkVersion.key;
    }
    return key;
  }

  static setDefaultSparkVersion(version) {
    window.prefs.set('defaultSparkVersion', version);
  }

  static formatSparkVersion(key) {
    if (!key) {
      return 'Unspecified spark version';
    }
    const sparkVersion = _.where(window.settings.sparkVersions, { key: key })[0];
    if (sparkVersion) {
      return sparkVersion.displayName;
    }
    return "Spark '" + key + "'";
  }
}
