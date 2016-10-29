import $ from 'jquery';
import _ from 'lodash';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';

import { IdleIndicator } from '../user_activity/IdleIndicator.jsx';

function localGenerateGUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
  });
}

/** Uniquely identifies this tab session. */
const browserTabId = localGenerateGUID();

function disableBackspaceEventHandler(e) {
  const BACKSPACE = 8;
  if (e.which === BACKSPACE) {
    const node = e.srcElement || e.target;
    const nodeName = node.nodeName.toLowerCase();
    // Only permit backspace when inside editable input and textarea fields
    // Note: this won't prevent backspace when focused on a all non-text inputs,
    // but it is less dangerous than trying to white-list all the valid text types.
    // Instead, we white-list input types that are ok to ignore backspace in
    // such as checkboxes and radio buttons.
    if (nodeName === 'input' || nodeName === 'textarea') {
      const nodeType = node.type !== undefined ? node.type.toLowerCase() : '';
      if (node.readOnly || node.disabled || nodeType === 'checkbox' || nodeType === 'radio') {
        e.preventDefault();
      }
    } else {
      e.preventDefault();
    }
  }
}

/** Measurement tags that are included in requests to the server */
let globalMeasurementTags = {};

export class BrowserUtils {
  static generateGUID() {
    return localGenerateGUID();
  }

  static getBrowserTabId() {
    return browserTabId;
  }

  /**
   * If str is longer than maxlen, truncate it and append [TRUNCATED] so that the total length is
   * at most maxlen. maxlen must be > 11.
   */
  static truncate(str, maxlen) {
    const truncated = '[TRUNCATED]';
    if (!str) {
      return str;
    } else if (str.length > maxlen) {
      return str.substring(0, maxlen - truncated.length) + truncated;
    }
    return str;
  }

  /**
   * Should be used to set tags sent by requests while viewing the current page. For example,
   * for "Send Feedback" emails sent while viewing the current page.
   *
   * @param {object} tags a map from string -> string
   */
  static setGlobalMeasurementTags(tags) {
    globalMeasurementTags = tags;
  }

  /**
   * Returns map of measurement tags for this browser session merged with additionalTags.
   */
  static getMeasurementTags(additionalTags) {
    let tags = _.clone(globalMeasurementTags);

    // additional tags should override global tags
    if (additionalTags) {
      tags = _.extend(tags, additionalTags);
    }

    // add tags if the current page is a notebook page
    if (window.notebook && window.location.hash.indexOf('notebook') > -1) {
      const notebookId = window.notebook.id;
      const nb = window.treeCollection.get(notebookId);
      if (nb) {
        tags = _.extend(tags, nb.tags());
      }
    }

    const defaultTags = {
      browserTabId: browserTabId,
      browserHasFocus: document.hasFocus(),
      // keep this truncated to at most UsageLogging.MAX_TAG_LENGTH (see UsageLogging.scala)
      browserHash: BrowserUtils.truncate(window.location.hash, 200),
      browserHostName: window.location.hostname,
      browserUserAgent: navigator.userAgent,
    };
    for (const tagKey in defaultTags) {
      if (defaultTags.hasOwnProperty(tagKey)) {
        tags[tagKey] = defaultTags[tagKey];
      }
    }
    if (window.settings && window.settings.enableSessionIdleDetection) {
      tags.browserIdleTime = IdleIndicator.default.idleTimeMillis();
    }
    return tags;
  }

  static setDocumentTitle(title) {
    $(document).attr('title', title ? (title + ' - Databricks') : 'Databricks');
  }

  /**
   * Disable the backspace key from navigating back in the browser history
   */
  static disableBackspace(disable) {
    disable = disable !== undefined ? disable : true;
    if (disable) {
      $(document).on('keydown', disableBackspaceEventHandler);
    } else {
      $(document).off('keydown', disableBackspaceEventHandler);
    }
  }

  /**
   * Fetches settings for the specified org and calls onSuccess with the settings json. If
   * chosenWorkspaceId is null, then settings will be that of the default org for the user.
   */
  static getSettings(chosenWorkspaceId, onSuccess) {
    $.ajax({
      dataType: 'json',
      beforeSend(request) {
        if (chosenWorkspaceId !== null) {
          request.setRequestHeader('X-Databricks-Org-Id', chosenWorkspaceId.toString());
        }
      },
      url: '/config',
      success(configJson) {
        window.settings = configJson;
        if (onSuccess) onSuccess();
      },
      error(xhr) {
        window.location = '/login.html';
        if (xhr.status === 503) {
          DeprecatedDialogBox.alert(
            'Databricks Community Edition is currently experiencing heavy load.' +
            ' Please try again later.');
        }
      },
    });
  }
}
