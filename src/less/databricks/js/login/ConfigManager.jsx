import $ from 'jquery';

/**
 * Helper for fetching public configurations. Creating a new instance will fetch configurations
 * and set the configPromise object on the manager. You can set a callback to be executed when
 * the configPromise is resolved by passing it to configPromise.done().
 */

const FETCHING_CONFIG_MSG = 'Fetching configuration... Try again!';

export class ConfigManager {
  constructor() {
    this.configPromise = this.fetchConfigurations();
  }

  /**
   * Fetches public configurations.
   * @returns {jqXHR object} jQuery Promise-like object
   */
  fetchConfigurations() {
    return $.ajax({
      dataType: 'json',
      url: '/pub-conf',
      success: (json) => {
        window.settings = json;
      },
    });
  }

  isConfigReady() {
    return !!(window.settings);
  }

  isConfigPending() {
    return this.configPromise && this.configPromise.state() === 'pending';
  }

  /**
   * Check whether configurations are pending or unresolved, & calls function to set message.
   *
   * @param {function} setMessageFunc  function to set the corresponding message
   * @param {string} notReadyMsg  string to use in setMessageFunc if config is not ready
   *
   * @return {bool}
   */
  checkConfigState(setMessageFunc, notReadyMsg) {
    if (this.isConfigPending()) {
      setMessageFunc(FETCHING_CONFIG_MSG);
      return false;
    } else if (!this.isConfigReady()) {
      setMessageFunc(notReadyMsg);
      return false;
    }
    setMessageFunc('');
    return true;
  }
}

ConfigManager.FETCHING_CONFIG_MSG = FETCHING_CONFIG_MSG;
