import _ from 'underscore';
import $ from 'jquery';
import React from 'react';

import IconsForType from '../ui_building_blocks/icons/IconsForType';

import { ResourceUrls } from '../urls/ResourceUrls';

// Key codes
const ENTER = 13;

export class LoginOrgSelectionView extends React.Component {
  constructor(props) {
    super(props);
    this._gotoLoginPage = this._gotoLoginPage.bind(this);
    this.state = {
      // the orgId we are currently loading, if any
      loadingOrg: null,
    };
  }

  componentDidMount() {
    if (this.props.availableWorkspaces.length > 0) {
      this._keyHandler = this._onKeyDown.bind(this, this.props.availableWorkspaces[0].orgId);
      $(document).on('keydown', this._keyHandler);
    }
  }

  componentWillUnmount() {
    if (this._keyHandler) {
      $(document).off('keydown', this._keyHandler);
    }
  }

  // navigate to the login page in the same window
  // visible for testing so we can mock the navigation
  _gotoLoginPage() {
    window.location = '/login.html';
  }

  // When the user clicks on an organization
  _onClick(orgId, e) {
    // on middle-, control-, meta-, and shift-click propagate the event and use the href
    if (e.nativeEvent.which === 2 || e.ctrlKey || e.metaKey || e.shiftKey) {
      return;
    }

    this.setState({ loadingOrg: orgId });
    this.props.selectFunc(orgId, this._onLoadingComplete.bind(this));
    e.preventDefault();
  }

  // If the user just clicks enter, select the first workspace by default
  // TODO(jeffpang): one day allow the user to use arrow keys to select workspaces
  _onKeyDown(orgId, e) {
    if (e.which === ENTER) {
      this.setState({ loadingOrg: orgId });
      this.props.selectFunc(orgId, this._onLoadingComplete.bind(this), e);
      e.preventDefault();
    }
  }

  _onLoadingComplete() {
    this.setState({ loadingOrg: null });
  }

  _getSortedWorkspaces() {
    return this.props.availableWorkspaces.sort((a, b) => a.name.localeCompare(b.name));
  }

  _workspaceList() {
    let first = true;
    const isLoading = this.state.loadingOrg !== null;

    const items = _.flatten(this._getSortedWorkspaces().map((workspace) => {
      let title = workspace.name;
      if (workspace.owner) {
        title += ' (' + workspace.owner + ')';
      }
      // show a spinner if we are currently loading the organization
      const iconType = this.state.loadingOrg === workspace.orgId ?
        IconsForType.inProgress : IconsForType.user;
      const icon = <i className={'fa fa-' + iconType} />;
      const arrow = <i className='fa fa-chevron-right' />;

      // TODO(jeffpang, ekl): figure out how to record metrics on this page
      // Right now this page before window.recordEvent is bound so we can't use it.

      const item = (
        <a key={workspace.orgId}
          className='workspace-link'
          data-name={workspace.name}
          data-owner={workspace.owner}
          // href is used when this is opened in a new tab
          href={'/?o=' + workspace.orgId + window.location.hash}
          // click handler is used when this is opened in the same tab
          onClick={isLoading ? null : this._onClick.bind(this, workspace.orgId)}
          onKeyDown={isLoading ? null : this._onKeyDown.bind(this, workspace.orgId)}
          title={title}
        >
          <div className='workspace-item'>
            <div className='icon'>{icon}</div>
            <div className='workspace-text'>
              <div className='workspace-name'>{workspace.name}</div>
              {workspace.owner ? <div className='workspace-owner'>{workspace.owner}</div> : null}
            </div>
            <div className='arrow'>{arrow}</div>
          </div>
        </a>
      );

      if (first) {
        first = false;
        return [item];
      }
      return [<hr key={'divider-' + workspace.orgId} />, item];
    }));

    return <div className='org-list'>{items}</div>;
  }

  render() {
    // TODO(jeffpang): one day migrate login.html into here
    return (
      <div id='login-page'>
        <img src={ResourceUrls.getResourceUrl('login/databricks_logoTM_rgb_TM.svg')}
          className='login-logo'
        />
        <div className='login-form'>
          <h3 className='sub-header'>Choose Organization</h3>

          <div className='org-list-container'>
            {this._workspaceList()}
          </div>

          <button className='back-to-signin btn btn-primary btn-large'
            onClick={this._gotoLoginPage}
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }
}

LoginOrgSelectionView.propTypes = {
  // array of workspaces available to this user to switch to (including the current one)
  // each workspace object: {name: string, owner: string, orgId: number, needsConfirmation: bool}
  availableWorkspaces: React.PropTypes.array.isRequired,
  // a callback f(orgId, doneCallback) that is called when an organization is selected to be open
  // in the *same* tab as this page. the callback is not called if the organization is opened
  // in a new tab (middle, control, command, or shift-click). In that case, an href link is used
  // to open the link.
  //
  // @param orgId the organization selected
  // @param doneCallback a callback function that should be called when we are finished loading
  //   the organization. This will stop the spinner.
  selectFunc: React.PropTypes.func.isRequired,
};
