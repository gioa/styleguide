import React from 'react';
import $ from 'jquery';
import ClassNames from 'classnames';

import NavFunc from '../filetree/NavFunc.jsx';

import LocalUserPreference from '../local_storage/LocalUserPreference';

import { LanguageNames } from '../notebook/LanguageNames';

import IconsForType from '../ui_building_blocks/icons/IconsForType';
import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

import { ResourceUrls } from '../urls/ResourceUrls';

import { IdleIndicator } from '../user_activity/IdleIndicator.jsx';

import { BrowserUtils } from '../user_platform/BrowserUtils';

const SEEN_IMPORT_HINT_KEY = 'seenImportHint';

/**
 * A view to show static notebooks within the #content pane of the product. This component takes
 * a url and shows it in an iframe within #content. The url is assumed to be to a static notebook
 * which sends he appropriate events to its parent to set the url and title.
 *
 * If the url is not a static notebook, the content will be shown in the iframe but the clone
 * button will be disabled.
 */
export class FramedStaticNotebookView extends React.Component {
  constructor(props) {
    super(props);
    // React classes in ES6 don't have this bound automatically
    this._iframeListener = this._iframeListener.bind(this);
    this.state = {
      // the current url of the notebook in the iframe
      currentUrl: null,
      // the current title of the notebook in the iframe
      currentTitle: null,
      // true if we are loading the cloned notebook
      loading: false,
    };
  }

  // the prefix of the url, without the path component (e.g., https://hostname:port)
  _urlPrefix() {
    const link = document.createElement('a');
    link.href = this.props.url;
    return link.protocol + '//' + link.host;
  }

  // listener that will be called when the iframe sends the parent events.
  // we expect static notebooks to send us two events:
  // - setLocation: this event is sent when the framed static notebook navigates to another static
  //   notebook URL in a notebook collection (such as the databricks guide). This event is sent
  //   when the new notebook URL has finished loading.
  // - unload: this event is sent when a new URL starts loading in the iframe.
  _iframeListener(msg) {
    if (!msg || !msg.data) {
      return;
    }

    // TODO(jeffpang): stop reaching into the topbar directly when we refactor it!
    const title = $('.tb-title');
    const titleLang = $('.tb-title-lang');

    // TODO(jeffpang): we should have a list of trusted domains and only show URLs from those
    // domains, so that people can't embed arbitrary content inside the content pane

    if (msg.data.type === 'setLocation') {
      // this event is sent when the iframe has finished loading a new page
      // data = {
      //   title: string - the title of the notebook
      //   language: string - the language of the notebook
      //   path: string - the path component of the URL of the notebook, assumed to be within
      //     the same domain as the original URL.
      // }
      title.text(msg.data.title);
      BrowserUtils.setDocumentTitle(msg.data.title);

      const nbLang = msg.data.language;
      if (nbLang) {
        titleLang.text('(' + LanguageNames[nbLang] + ')');
        titleLang.attr({ 'data-lang': nbLang });
      } else {
        titleLang.text('');
        titleLang.attr({ 'data-lang': 'none' });
      }

      const newUrl = this._urlPrefix() + msg.data.path;
      this.props.historyReplaceState(null, null, '#externalnotebook/' + encodeURIComponent(newUrl));
      this._safeSetState({ currentUrl: newUrl, currentTitle: msg.data.title });

      // mark user activity within iframe
      // TODO(jeffpang): properly propagate mouse/keyboard events from the iframe to the parent
      this.props.idleIndicator.markActivity();
    } else if (msg.data.type === 'unload') {
      // this event is sent when the iframe starts loading a new page
      title.text('');
      titleLang.text('');
      titleLang.attr({ 'data-lang': 'none' });
      this._safeSetState({ currentUrl: null, currentTitle: null });

      // mark user activity within iframe
      // TODO(jeffpang): properly propagate mouse/keyboard events from the iframe to the parent
      this.props.idleIndicator.markActivity();
    }
  }

  componentWillMount() {
    window.addEventListener('message', this._iframeListener);
    this._isMounted = true;
  }

  componentWillUnmount() {
    window.removeEventListener('message', this._iframeListener);
    this._isMounted = false;
  }

  // set state if the component is mounted, else noop
  _safeSetState(newState) {
    if (this._isMounted) {
      this.setState(newState);
    }
  }

  // given a title, return a notebook name that only includes the string after the last /
  // PROD-12376: needed because our DBGuide titles include /s for the sections the notebook is in
  _getSafeName(title) {
    const elems = title.split('/');
    return elems[elems.length - 1].trim();
  }

  // show a dialog box to clone the notebook at the current URL in the iframe
  _clone() {
    const self = this;
    NavFunc.cloneNodeOrUrl({
      url: this.state.currentUrl,
      name: this._getSafeName(this.state.currentTitle),
      onConfirm: () => {
        self._safeSetState({ loading: true });
      },
      onSuccess: (newId) => {
        self._safeSetState({ loading: false });
        self.props.navigate('notebook/' + newId, { trigger: true });
      },
      onFailure: () => {
        self._safeSetState({ loading: false });
      },
    });
  }

  render() {
    const disabled = !this.state.currentUrl;
    const tooltipText =
      !disabled ? 'Make a copy of this notebook that you can run' : null;

    const classes = ClassNames({
      'framed-static-notebook': true,
      'notebook-loading': this.state.loading,
    });

    return (
      <div className={classes}>
        <img className='load-spinner' src={ResourceUrls.getResourceUrl('img/spinner.svg')} />
        <div className='new-notebook context-bar' id='context-bar'>
          <Tooltip ref='import-tooltip' text={tooltipText}>
            <a className='context-bar-item'
              data-name='Import Notebook'
              onClick={disabled ? null : this._clone.bind(this)}
              disabled={disabled}
            >
              <i className={'fa fa-' + IconsForType.import} />
              <span className={"context-bar-link-text"}>Import Notebook</span>
            </a>
          </Tooltip>
        </div>
        <div id='content'>
          <iframe src={this.props.url}></iframe>
        </div>
      </div>
    );
  }

  componentDidMount() {
    if (!this.props.prefs.get(SEEN_IMPORT_HINT_KEY)) {
      this.refs['import-tooltip'].showTooltip();
      this.props.prefs.set(SEEN_IMPORT_HINT_KEY, true);
    }
  }
}

FramedStaticNotebookView.propTypes = {
  // the initial static notebook URL to show in the iframe
  url: React.PropTypes.string.isRequired,
  // the LocalUserPreference object to set local user prefs for (e.g., window.prefs)
  prefs: React.PropTypes.instanceOf(LocalUserPreference).isRequired,
  // the history.replaceState function (visible for testing)
  historyReplaceState: React.PropTypes.func,
  // the window.router.navigate function (visible for testing)
  navigate: React.PropTypes.func,
  // idle indicator that tracks user idleness
  idleIndicator: React.PropTypes.instanceOf(IdleIndicator),
};

FramedStaticNotebookView.defaultProps = {
  historyReplaceState: (data, title, url) => {
    history.replaceState(data, title, url);
  },
  navigate: (target, opts) => {
    window.router.navigate(target, opts);
  },
  idleIndicator: IdleIndicator.default,
};
