/* eslint react/prefer-es6-class: 0, react/no-is-mounted: 0, max-lines: 0 */

import $ from 'jquery';
import _ from 'underscore';
import React from 'react';
import ClassNames from 'classnames';

import ClusterList from '../clusters/ClusterList';

import FileBrowserView from '../filebrowser/FileBrowserView';
import TreeNodeCollection from '../filebrowser/TreeNodeCollection';

import NavFunc from '../filetree/NavFunc.jsx';

import { JobListView } from '../jobs/JobListView.jsx';

import LocalUserPreference from '../local_storage/LocalUserPreference';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';
import Highlight from '../ui_building_blocks/highlight/Highlight.jsx';
import IconsForType from '../ui_building_blocks/icons/IconsForType';
import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

import { DbGuideUrls } from '../urls/DbGuideUrls';
import DbGuideLinks from '../urls/DbGuideLinks';
import { ResourceUrls } from '../urls/ResourceUrls';

import { RecordEventMixin } from '../user_activity/UsageLogging';

const HomeViewCreate = React.createClass({

  propTypes: {
    clusterList: React.PropTypes.instanceOf(ClusterList).isRequired,
    localpref: React.PropTypes.instanceOf(LocalUserPreference).isRequired,
    // don't show the "create cluster" and "create notebook" tooltip hints
    disableHints: React.PropTypes.bool,
  },

  mixins: [RecordEventMixin],

  getInitialState() {
    return {
      newNotebookLinkReady: false,
    };
  },

  // hint to the user that they should:
  // - create a cluster if there are no clusters
  // - create a notebook if they have not seen the hint before
  hintListener() {
    // don't do anything until we have synced the cluster list at least once
    if (this.isMounted() && this.props.clusterList.finishedInitialFetch) {
      const numClusters = this.props.clusterList.activeClusters().length;
      const hasSeenNotebookHint = this.props.localpref.get('seenNotebookHint');

      if (numClusters === 0) {
        this.refs['new-cluster-link'].highlight({
          animate: false,
          duration: -1,
          autoHideTooltip: true,
          tooltip: 'Create a cluster to get started!',
        });
        this.refs['new-notebook-link'].unhighlight();
      } else if (!hasSeenNotebookHint) {
        this.refs['new-cluster-link'].unhighlight();
        this.refs['new-notebook-link'].highlight({
          animate: false,
          duration: -1,
          autoHideTooltip: true,
          tooltip: 'Create a notebook and start coding!',
        });
        this.props.localpref.set('seenNotebookHint', true);
      }
    }
  },

  componentDidMount() {
    // if we enable the new homepage with featured links, don't show the hints any more since
    // the featured notebooks and notebook auto-attach will give the user a walk through
    if (!this.props.disableHints) {
      // maybe show hints on the create page
      const self = this;
      _.delay(function clusterListListenerOn() {
        if (self.isMounted()) {
          self.hintListener();
          self.props.clusterList.on('reset change add remove', self.hintListener, this);
        }
      }, 250);
    }

    this._setNewNotebookLinkState();
  },

  componentWillUnmount() {
    this.props.clusterList.off(null, null, this);
  },

  /** Link for creating new libraries */
  _newLibrariesLink() {
    const parentId = NavFunc.getDefaultFolderId();
    return '#create/library/' + parentId;
  },

  _onNewLinkClick(location) {
    if (location === 'NewNotebookLink') {
      NavFunc.addReactNotebook(NavFunc.getDefaultFolderId());
    } else if (location === 'NewClusterLink') {
      NavFunc.addCluster();
    } else if (location === 'NewScheduledJobLink') {
      JobListView.createJob();
    }
    this.recordEvent('homeViewClick', {
      homeViewClickLocation: location,
    });
  },

  _setNewNotebookLinkState() {
    const self = this;
    setTimeout(function updateNewNotebookLinkState() {
      if (self.isMounted()) {
        self.setState({ newNotebookLinkReady: true });
      }
    }, 200);
  },

  _getNewNotebookLink() {
    // wait to render this link, otherwise clicking on the link may incorrectly
    // create a notebook in the root folder.
    const newNotebookClick = this._onNewLinkClick.bind(this, 'NewNotebookLink');
    return (
      <a className='create-item' data-name='Notebook'
        onClick={newNotebookClick}
      >
        <i className='fa fa-file-text-o' />
        Notebook
      </a>
    );
  },

  _getNewJobLink() {
    const jobsDisabled = !window.settings.enableElasticSparkUI;
    const newScheduledJobClick = this._onNewLinkClick.bind(this, 'NewScheduledJobLink');
    const linkElem = (
      <a className='create-item' data-name='Job' disabled={jobsDisabled}
        onClick={newScheduledJobClick}
      >
        <i className='fa fa-calendar' />
        Job
      </a>
    );
    const jobsLink = <a href={DbGuideUrls.getDbGuideUrl(DbGuideLinks.JOBS_URL)}>Jobs</a>;
    const tooltipText = Tooltip.getGenericUpgradeElement(<span>For access to {jobsLink}</span>);

    if (jobsDisabled) {
      return <Tooltip text={tooltipText}>{linkElem}</Tooltip>;
    }
    return <Highlight ref='new-job-link'>{linkElem}</Highlight>;
  },

  /**
   * Creates the New Cluster link to show on the homepage. This link is highlighted when the
   * user has no clusters.
   * @returns {XML} The ReactElement to be displayed.
   * @private
   */
  _getNewClusterLink() {
    const newClusterClick = this._onNewLinkClick.bind(this, 'NewClusterLink');
    return (<Highlight ref='new-cluster-link'>
      <a className='create-item'
        data-name='Cluster'
        onClick={newClusterClick}
      >
        <i className='fa fa-sitemap' />
        Cluster
      </a>
    </Highlight>);
  },

  render() {
    const newTableClick = this._onNewLinkClick.bind(this, 'NewTableLink');
    const newLibraryClick = this._onNewLinkClick.bind(this, 'NewLibraryLink');
    return (
      <div className='homeview-create-section'>
        <div className='homeview-main-section-inner create-section-inner'>
          <h3>New</h3>
          <div className='create-item-container'>
            <Highlight ref='new-notebook-link'>
              {this.state.newNotebookLinkReady ? this._getNewNotebookLink() : null}
            </Highlight>
          </div>

          <div className='create-item-container'>
            {this._getNewJobLink()}
          </div>
          <div className='create-item-container'>
            {this._getNewClusterLink()}
          </div>
          <div className='create-item-container'>
            <Highlight ref='new-table-link'>
              <a className='create-item' data-name='Table' href='#create/table'
                onClick={newTableClick}
              >
                <i className='fa fa-table' />
                Table
              </a>
            </Highlight>
          </div>
          <div className='create-item-container'>
            <Highlight ref='new-library-link'>
              <a className='create-item' data-name='Library' href={this._newLibrariesLink()}
                onClick={newLibraryClick}
              >
                <i className='fa fa-book' />
                Library
              </a>
            </Highlight>
          </div>
        </div>
      </div>);
  },
});

const HomeViewDocs = React.createClass({

  mixins: [RecordEventMixin],

  /**
   * Transforms a workspace link into a react component link, possibly opening in a new tab
   * e.g., <a href={url}>{content}</a>
   * We need this layer of indirection since depending on whether static dbguide is enabled,
   * we direct the link to different places.
   */
  _getDbGuideLink(url, content, forceNewTab, onClick) {
    const href = DbGuideUrls.getDbGuideUrl(url);
    if (!window.settings.useStaticGuide) {
      return <a href={href} target='_blank' onClick={onClick}>{content}</a>;
    }
    let target = '_blank';
    if (window.settings.useFramedStaticNotebooks && !forceNewTab) {
      target = '_self';
    }
    return <a href={href} target={target} onClick={onClick}>{content}</a>;
  },

  _onClick(location) {
    this.recordEvent('homeViewClick', {
      homeViewClickLocation: location,
    });
  },

  _docLink(dbGuideUrl, label) {
    const content = <span><i className={'fa fa-' + IconsForType.navigate} />{label}</span>;
    return (
      <div className='create-item-container'>
        {this._getDbGuideLink(dbGuideUrl, content, false, this._onClick.bind(null, label))}
      </div>
    );
  },

  _langLink(dbGuideUrl, label) {
    return this._getDbGuideLink(dbGuideUrl, label, false, this._onClick.bind(null, label));
  },

  /**
   * @WARNING(jengler) 2016-02-22: If you change the number of links in this, you should decrease
   * the number of links shown in the dev tier "recents" menu that is displayed in it. See
   * HomeView.getMiddleColumn().
   *
   * @return {ReactElement} The rendered react element.
   */
  render() {
    return (
      <div className='homeview-docs-section'>
        <div className='homeview-main-section-inner docs-section-inner'>
          <h3>Documentation</h3>
          {this._docLink(DbGuideLinks.WELCOME_GUIDE_URL, 'Databricks Guide')}
          <div className='create-item-container'>
            <i className={'fa fa-' + IconsForType.navigate} />
            <span>
              {this._langLink(DbGuideLinks.PYTHON_INTRO_URL, 'Python')},&nbsp;
              {this._langLink(DbGuideLinks.R_INTRO_URL, 'R')},&nbsp;
              {this._langLink(DbGuideLinks.SCALA_INTRO_URL, 'Scala')},&nbsp;
              {this._langLink(DbGuideLinks.SQL_INTRO_URL, 'SQL')}
            </span>
          </div>
          {this._docLink(DbGuideLinks.ACCESSING_DATA_URL, 'Importing Data')}
        </div>
      </div>
    );
  },
});

const HomeViewFeaturedLink = React.createClass({
  propTypes: {
    // the URL of the notebook to import when clicked
    url: React.PropTypes.string.isRequired,
    // the title to display for the notebook
    displayName: React.PropTypes.string.isRequired,
    // the path to an image file to show as the icon for the notebook
    imagePath: React.PropTypes.string.isRequired,
    // the tree collection containing the workspace nodes (i.e., window.treeCollection)
    treeCollection: React.PropTypes.instanceOf(TreeNodeCollection).isRequired,
    // a callback that will be called when the notebook link is clicked and we are loading it
    showLoading: React.PropTypes.func.isRequired,
    // a callback that will be called when the notebook is finished loading
    hideLoading: React.PropTypes.func.isRequired,
    vertical: React.PropTypes.bool,
  },

  mixins: [RecordEventMixin],

  getInitialState() {
    return {
      hovering: false,
    };
  },

  _mouseOver() {
    this.setState({
      hovering: true,
    });
  },

  _mouseOut() {
    this.setState({
      hovering: false,
    });
  },

  /**
   * Escape the given string so that it is treated literally in a regular expression.
   * From: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
   */
  _escapeRegExp(string) {
    return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
  },

  // return the existing notebook in the homeId folder with the same name as this notebook or
  // the same name with a (number) suffix, or null if none
  _existingNode(homeId) {
    // TODO(jeffpang): we should have a more reliable way for checking whether this notebook
    // is the same as the imported one or not. For the CE MVP we assume this is OK since everyone
    // is a new user and aren't likely to have notebooks with the same name.
    const children = this.props.treeCollection.where({ parentId: homeId });
    const nameRegex = new RegExp(this._escapeRegExp(this.props.displayName) + ' \\([0-9]+\\)');
    return _.find(children, (node) => node.get('type') === 'shell' &&
        node.get('name') &&
        (node.get('name') === this.props.displayName || node.get('name').match(nameRegex)));
  },

  _importNb(e) {
    e.preventDefault();

    this.recordEvent('homeViewClick', {
      homeViewClickLocation: this.props.displayName + '-FeaturedNotebook',
    });

    const homeId = NavFunc.getDefaultFolderId();

    // if this notebook already exists, just navigate to it
    const existing = this._existingNode(homeId);
    if (existing) {
      window.router.navigate('shell/' + existing.id, { trigger: true });
      return;
    }

    // otherwise, import the notebook from the url and then open it

    const success = (message) => {
      if (message && message.newId) {
        window.router.navigate('shell/' + message.newId, { trigger: true });
      }
      this.props.hideLoading();
    };

    const error = (jqXHR, textStatus, errorThrown) => {
      console.error('Import failed with error:', errorThrown);
      DeprecatedDialogBox.alert('Import failed with error: ' + errorThrown, false, 'OK');
      this.props.hideLoading();
    };

    this.props.showLoading();

    $.ajax('/serialize/url/' + homeId, {
      type: 'POST',
      data: JSON.stringify({
        url: this.props.url,
        // override the name of the imported item so the one that we lookup is the same
        nameOverride: this.props.displayName,
      }),
      success: success,
      error: error,
    });
  },

  render() {
    let classNames = 'learn-step';

    if (this.state.hovering) {
      classNames += ' active';
    }
    if (this.props.vertical) {
      classNames += ' vertical';
    }

    // the href is a backup for when people who want to open it in a new window
    // TODO(jeffpang): actually make the href do the import as well
    const makeLink = (className, contents) => (
        <a className={className}
          data-name={this.props.displayName}
          onClick={this._importNb}
          href={this.props.url}
          onMouseOver={this._mouseOver}
          onMouseOut={this._mouseOut}
        >
          {contents}
        </a>
    );

    // TODO(jeffpang): use different classNames so we aren't tied to the learning step styles
    return (
      <div className={classNames}>
        {makeLink(
          'learn-step-icon',
           <img src={ResourceUrls.getResourceUrl(this.props.imagePath)} />
         )}
        {this.props.vertical ?
          <span>{makeLink('main-link', this.props.displayName)}</span>
          :
          <p>{makeLink('main-link', this.props.displayName)}</p>
        }
      </div>
    );
  },
});

function HomeViewFeaturedLinks({
  treeCollection,
  featuredLinks,
  showLoading,
  hideLoading,
  vertical,
}) {
  const links = featuredLinks.map((elem) => (
      <HomeViewFeaturedLink
        key={elem.displayName}
        url={elem.linkURI}
        displayName={elem.displayName}
        imagePath={elem.icon ? elem.icon : 'img/home/Python_icon.svg'}
        treeCollection={treeCollection}
        showLoading={showLoading}
        hideLoading={hideLoading}
        vertical={vertical}
      />
  ));

  if (vertical) {
    return (
      <div className='featured-links-section'>
        <div className='homeview-main-section-inner create-section-inner'>
          <h3>Featured Notebooks</h3>
          <div className='featured-links learn-steps'>
            {links}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className='homeview-header'>
      <div className='homeview-section featured-links-section'>
        <h2>Featured Notebooks</h2>
        <div className='featured-links learn-steps'>
          {links}
        </div>
      </div>
    </div>
  );
}

HomeViewFeaturedLinks.propTypes = {
  // the tree collection containing the workspace nodes (i.e., window.treeCollection)
  treeCollection: React.PropTypes.instanceOf(TreeNodeCollection).isRequired,
  // the links to show in the following format:
  // {url: string, displayName: string, icon: string (optional)}
  featuredLinks: React.PropTypes.array.isRequired,
  // a callback that will be called when the notebook link is clicked and we are loading it
  showLoading: React.PropTypes.func.isRequired,
  // a callback that will be called when the notebook is finished loading
  hideLoading: React.PropTypes.func.isRequired,
  vertical: React.PropTypes.bool,
};

const HomeViewLearnStep = React.createClass({
  propTypes: {
    step: React.PropTypes.number,
  },

  getInitialState() {
    return {
      hovering: false,
    };
  },

  getDefaultProps() {
    return {
      step: 1,
    };
  },

  mouseOver() {
    this.setState({
      hovering: true,
    });
  },

  mouseOut() {
    this.setState({
      hovering: false,
    });
  },

  render() {
    let classNames = 'learn-step';
    let output;

    if (this.state.hovering) {
      classNames += ' active';
    }

    if (this.props.step === 2) {
      output = (
        <div className={classNames}>
          <i className='fa fa-chevron-right'></i>
          <a href={DbGuideUrls.getDbGuideUrl(DbGuideLinks.NOTEBOOKS_OVERVIEW_URL)}
            className='learn-step-icon notebooks'
            onMouseOver={this.mouseOver}
            onMouseOut={this.mouseOut}
          >
            <img src={ResourceUrls.getResourceUrl('img/home/code_icon.svg')} />
          </a>
          <p>
            2. Using&nbsp;
            <a href={DbGuideUrls.getDbGuideUrl(DbGuideLinks.NOTEBOOKS_OVERVIEW_URL)}
              className='main-link underline'
              onMouseOver={this.mouseOver}
              onMouseOut={this.mouseOut}
            >Notebooks</a> in&nbsp;
            <a href={DbGuideUrls.getDbGuideUrl(DbGuideLinks.PYTHON_INTRO_URL)}
              className='underline'
            >Python</a>,&nbsp;
            <a href={DbGuideUrls.getDbGuideUrl(DbGuideLinks.SCALA_INTRO_URL)}
              className='underline'
            >Scala</a>,&nbsp;
            <a href={DbGuideUrls.getDbGuideUrl(DbGuideLinks.SQL_INTRO_URL)}
              className='underline'
            >SQL</a> or&nbsp;
            <a href={DbGuideUrls.getDbGuideUrl(DbGuideLinks.R_INTRO_URL)}
              className='underline'
            >R</a>
          </p>
        </div>

      );
    } else if (this.props.step === 3) {
      output = (
        <div className={classNames}>
          <i className='fa fa-chevron-right'></i>
          <a href={DbGuideUrls.getDbGuideUrl(DbGuideLinks.ACCESSING_DATA_URL)}
            className='learn-step-icon'
            onMouseOver={this.mouseOver}
            onMouseOut={this.mouseOut}
          >
            <img src={ResourceUrls.getResourceUrl('img/home/add_data_icon.svg')} />
          </a>
          <p>
            <a href={DbGuideUrls.getDbGuideUrl(DbGuideLinks.ACCESSING_DATA_URL)}
              className='main-link'
              onMouseOver={this.mouseOver}
              onMouseOut={this.mouseOut}
            >3. Accessing Data in Databricks</a>
          </p>
        </div>
      );
    } else {
      output = (
        <div className={classNames}>
          <a href={DbGuideUrls.getDbGuideUrl(DbGuideLinks.WELCOME_GUIDE_URL)}
            className='learn-step-icon'
            onMouseOver={this.mouseOver}
            onMouseOut={this.mouseOut}
          >
            <img src={ResourceUrls.getResourceUrl('img/home/help_doc_icon.svg')} />
          </a>
          <p>
            <a href={DbGuideUrls.getDbGuideUrl(DbGuideLinks.WELCOME_GUIDE_URL)}
              className='main-link'
              onMouseOver={this.mouseOver}
              onMouseOut={this.mouseOut}
            >1. Get started with the Welcome Guide</a>
          </p>
        </div>
      );
    }

    return output;
  },
});

function HomeViewLearnSteps() {
  return (
    <div className='homeview-header'>
      <div className='homeview-section learn-steps-section'>
        <h2>Featured Notebooks</h2>
        <div className='learn-steps'>
          <HomeViewLearnStep step={1} />
          <HomeViewLearnStep step={2} />
          <HomeViewLearnStep step={3} />
        </div>
      </div>
    </div>
  );
}

const HomeView = React.createClass({

  propTypes: {
    // The branch hash for display
    gitHash: React.PropTypes.string.isRequired,
    // The git branch (release version) for display
    branch: React.PropTypes.string.isRequired,
    // FileBrowserView for querying history for recent items
    fbView: React.PropTypes.instanceOf(FileBrowserView).isRequired,
    // FileBrowser's TreeCollection we listen to this to repopulate the history
    fbCollection: React.PropTypes.instanceOf(TreeNodeCollection).isRequired,
    // Cluster List collection (i.e., window.clusterList) we listen to this to show hints
    clusterList: React.PropTypes.instanceOf(ClusterList).isRequired,
    // function to record metrics (default is window.recordEvent) (OPTIONAL)
    recordEvent: React.PropTypes.func,
    // array of recent backbone routes in the browser history
    recentRoutes: React.PropTypes.array.isRequired,
    // the user preference for the modal and tab
    localpref: React.PropTypes.instanceOf(LocalUserPreference).isRequired,
    // use the new home page that shows featured links
    showFeaturedLinks: React.PropTypes.bool,
    // the list of featured links to show, each element should be
    // {url: string, displayName: string, icon: string (optional)}
    featuredLinks: React.PropTypes.array,
    // if true, the version string in the upper-right corner will say "Community Edition ver (Beta)"
    isDevTier: React.PropTypes.bool,
    // the name of devtier (e.g., "Community Edition")
    devTierName: React.PropTypes.string,
  },

  newFeaturesList:
    <div>
      <ul>
        <li>
          New add user workflow
        </li>
      </ul>
    </div>,

  mixins: [RecordEventMixin],

  getDefaultProps() {
    return {
      showFeaturedLinks: false,
      featuredLinks: [],
    };
  },

  getInitialState() {
    return {
      loading: false,
      lastLogin: null,
    };
  },

  componentDidMount() {
    const _this = this;
    // Start loading last loging information
    this.fetchLoginHistory = $.ajax('/loginhistory', {
      success: (data) => {
        if (data.timestamp !== 0 && data.userName !== '') {
          const date = new Date(data.timestamp);
          _this.setState({ lastLogin: `Last login: ${date.toLocaleString()}` });
        }
      },
    });
    // PROD-9043: Only show the upgrade button on the homescreen.
    // PROD-9338: Only show the upgrade button to admin users
    if (window.settings.upgradeURL && window.settings.isAdmin) {
      $('.tb-button-upgrade')
        .attr('href', window.settings.upgradeURL)
        .toggle(true);
    }
    this.throttledForceUpdate = _.throttle(function forceUpdateWhenMounted() {
      if (_this.isMounted()) {
        _this.forceUpdate();
      }
    }, 250);

    this.props.fbCollection.on('change add remove reset', this.throttledForceUpdate, this);
  },

  componentWillUnmount() {
    this.props.fbCollection.off(null, null, this);
    if (window.settings.upgradeURL && window.settings.isAdmin) {
      // Hide the upgrade button if we are not on the homescreen.
      $('.tb-button-upgrade').toggle(false);
    }
    // If we have an AJAX request to fetch login history in flight, we abort it
    // We check to make sure lastLogin state has not been set
    if (this.fetchLoginHistory && !this.fetchLoginHistory.state() === 'pending') {
      this.fetchLoginHistory.abort();
    }
  },

  _onRecentLinkClick(name) {
    this.recordEvent('homeViewClick', {
      homeViewClickLocation: name + 'RecentLink',
    });
  },

  showLoading() {
    this.setState({ loading: true });
  },

  hideLoading() {
    this.setState({ loading: false });
  },

  renderRecentsLinks(limit) {
    const recents = [];
    limit = limit || this.props.recentRoutes.length;
    this.props.recentRoutes.slice(0, limit).forEach((recentRoute) => {
      const recent = this.props.fbView.entryFromViewRoute(recentRoute);
      if (recent) {
        const iconClass = 'fa fa-' + recent.icon;
        const recentClick = this._onRecentLinkClick.bind(this, recent.name);
        recents.push(
            <div className='recent-item-container' key={recent.url}>
              <a className='recent-item' href={recent.url} data-name={recent.name}
                onClick={recentClick}
              >
                <i className={iconClass} />
                {recent.name}
              </a>
            </div>);
      }
    });

    return (
      <div className='homeview-recent-section' key='homeview-recent-section'>
        <h3>Open Recent</h3>
        {recents.length > 0 ? recents :
         <p>
           {"Recent files appear here as you work. Get started with the "}
           <a href={DbGuideUrls.getDbGuideUrl(DbGuideLinks.WELCOME_GUIDE_URL)}>welcome
             guide</a>.
         </p>}
      </div>
    );
  },

  getHeader() {
    if (this.props.isDevTier) {
      return (
        <HomeViewFeaturedLinks
          featuredLinks={this.props.featuredLinks}
          treeCollection={this.props.fbCollection}
          showLoading={this.showLoading}
          hideLoading={this.hideLoading}
        />
      );
    }
    if (this.props.showFeaturedLinks) {
      return (
        <HomeViewFeaturedLinks
          featuredLinks={this.props.featuredLinks}
          treeCollection={this.props.fbCollection}
          showLoading={this.showLoading}
          hideLoading={this.hideLoading}
        />
      );
    }
    return (<HomeViewLearnSteps />);
  },

  getMiddleColumn() {
    if (this.props.isDevTier || this.props.showFeaturedLinks) {
      return [
        (<HomeViewDocs key='homeViewDocs' />),
        // @NOTE(jengler) 2016-02-19: 7, because of the sizing with documentation above.
        this.renderRecentsLinks(7),
      ];
    }
    return this.renderRecentsLinks();
  },

  render() {
    const classes = ClassNames({
      'homeview': true,
      'notebook-loading': this.state.loading,
    });

    const versionText = this.props.isDevTier ?
      (<span>
        {this.props.devTierName} ({this.props.branch})
      </span>)
      :
      (<span>
        version {this.props.branch}
      </span>);

    const lastLoginDiv = window.settings.notifyLastLogin && this.state.lastLogin ?
      (<div className='homeview-lastlogin'>
         <span title='Last login'>
           {this.state.lastLogin}
         </span>
       </div>) : null;


    return (<div className={classes}>
      <img className='load-spinner' src={ResourceUrls.getResourceUrl('img/spinner.svg')} />
      <div className='homeview-body'>
        {lastLoginDiv}
        <div className='homeview-version'>
          <span title={this.props.gitHash}>
            {versionText}
          </span>
        </div>

        <div className='homeview-inner'>
          <div className='homeview-logo-container'>
            <h1 className='welcome'>
              {"Welcome to "}
              <img src={ResourceUrls.getResourceUrl('img/databricks_logoTM_rgb_TM.svg')}
                className='homepage-logo'
              />
            </h1>
          </div>

          <div className='homeview-panel'>
            {this.getHeader()}

            <div className='homeview-main'>
              <div className='homeview-section'>
                <HomeViewCreate
                  clusterList={this.props.clusterList}
                  localpref={this.props.localpref}
                  disableHints={this.props.showFeaturedLinks}
                />
              </div>
              <div className='homeview-section'>
                {this.getMiddleColumn()}
              </div>
              <div className='homeview-section'>
                <div className='homeview-newfeatures-section'>
                  <h3>What’s new?</h3>
                  {this.newFeaturesList}
                  <p>
                    <a target='_blank' href={DbGuideLinks.RELEASE_NOTES_URL}>
                      Latest release notes
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>);
  },
});

module.exports.HomeView = HomeView;
module.exports.HomeViewCreate = HomeViewCreate;
module.exports.HomeViewDocs = HomeViewDocs;
module.exports.HomeViewFeaturedLink = HomeViewFeaturedLink;
