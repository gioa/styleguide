/* eslint react/prefer-es6-class: 0, react/no-is-mounted: 0 */

import $ from 'jquery';
import React from 'react';

import SparkPackage from '../../libraries/search/SparkPackage';
import SparkPackageRelease from '../../libraries/search/SparkPackageRelease';
import SparkPackageReleaseList from '../../libraries/search/SparkPackageReleaseList';

import IconsForType from '../../ui_building_blocks/icons/IconsForType';

/** For opening a link on a new tab. */
function PageLink({ link, text }) {
  return (
    <a href={link} target='_blank'>{text}</a>
  );
}

PageLink.propTypes = {
  link: React.PropTypes.string.isRequired,
  text: React.PropTypes.string.isRequired,
};

/** Information about the owner of a Spark Package. */
function OwnerInfo({ orgName, owner }) {
  const githubUrl = 'https://github.com/';
  const ownerLink = githubUrl + owner;
  const ownerEntry = (<PageLink link={ownerLink} text={'@' + owner} />);

  if (orgName !== owner) {
    const orgLink = githubUrl + orgName;
    const orgEntry = (<PageLink link={orgLink} text={'@' + orgName} />);
    return (
      <span>from: {orgEntry} / owner: {ownerEntry}</span>
    );
  }
  return (
    <span>{ownerEntry}</span>
  );
}

OwnerInfo.propTypes = {
  orgName: React.PropTypes.string.isRequired,
  owner: React.PropTypes.string.isRequired,
};

function TitleArea({ model }) {
  const name = model.get('packageName');
  const homepage = model.get('packageHomepage');
  const shortDescription = model.get('packageShortDescription');
  const longDescription = model.get('packageDescription');

  const orgName = model.get('packageOrg');
  const owner = model.get('packageOwner');
  const rating = model.get('packageRating');

  const ownerInfo = (
    <OwnerInfo
      orgName={orgName}
      owner={owner}
    />
  );

  return (
    <div className='row-fluid'>
      <h2>{name} &nbsp;
        <span style={{ fontSize: '0.5em' }}>
          <PageLink text={"homepage"} link={homepage} />
        </span>
      </h2>
      <div className='row-fluid'>
        <h4>{shortDescription}</h4>
      </div>
      <div className='row-fluid'>
        <span>{ownerInfo} / Rating: {rating} / 5</span>
      </div>
      <div className='row-fluid'>{longDescription}</div>
    </div>
  );
}

TitleArea.propTypes = {
  model: React.PropTypes.instanceOf(SparkPackage).isRequired,
};

/** Tags of the shown Spark Package. */
function TagsArea({ tags }) {
  let tagNames = [];
  if (tags) {
    tagNames = tags.map((elem) => elem.name);
  }
  const keywords = tagNames.join(', ');
  if (keywords.length > 0) {
    return (
      <div>
        <h3>Tags</h3>
        <p>{keywords}</p>
      </div>
    );
  }
  return (
    <div className='row-fluid'>
      <h3>Tags</h3>
      <p>This package doesn't have any tags.</p>
    </div>
  );
}

TagsArea.propTypes = {
  tags: React.PropTypes.array.isRequired,
};

function Compatibility({ compatibility, prefix }) {
  const url = 'http://spark-packages.org/release-compatibility/' + compatibility.id;
  return (
    <span>{prefix}{compatibility.spark_version} - &nbsp;
      <PageLink link={url} text={compatibility.percentage + '%'} />
    </span>
  );
}

Compatibility.propTypes = {
  compatibility: React.PropTypes.shape({
    id: React.PropTypes.number,
    spark_version: React.PropTypes.string,
    percentage: React.PropTypes.number,
  }).isRequired,
  prefix: React.PropTypes.string.isRequired, // usually a comma and space
};

function CompatibilityList({ list }) {
  if (list && list.length > 0) {
    const firstReport = (
      <Compatibility
        key={0}
        compatibility={list.shift()}
        prefix=''
      />);
    const section = [firstReport];

    list.forEach((i, elem) => {
      section.push(
        <Compatibility
          key={i + 1}
          compatibility={elem}
          prefix=', '
        />);
    });
    return (
      <p>Spark Scala/Java API Compatibility: {section}</p>
    );
  }
  return (<span />);
}

CompatibilityList.propTypes = {
  list: React.PropTypes.array.isRequired,
};

const Release = React.createClass({
  propTypes: {
    model: React.PropTypes.instanceOf(SparkPackageRelease).isRequired,
    name: React.PropTypes.string.isRequired,
    selectRelease: React.PropTypes.func.isRequired,
  },

  _onSelectClick() {
    const coordinate = this.props.model.artifactCoordinate();
    this.props.selectRelease(coordinate, 'spark', true);
  },

  render() {
    const version = this.props.model.get('releaseVersion');
    const date = this.props.model.get('releaseCreateTime');
    const license = this.props.model.get('releaseLicense');
    const scalaVersion = this.props.model.get('releaseScalaVersion');
    let scalaString;
    if (scalaVersion) {
      scalaString = ' / Scala Version: ' + scalaVersion;
    }

    const compList = this.props.model.get('releaseCompatibility');
    const compatibility = (<CompatibilityList list={compList} />);

    return (
      <div className='row-fluid'>
        <div className='row-fluid' style={{ marginBottom: '5px' }}>
          <span>
            <a
              onClick={this._onSelectClick}
              className='install-button with-icon pointer'
            >
              <i className='fa fa-plus fa-fw'></i>Select
            </a>
            &nbsp;
            <b>Version: {version}</b> /
            Date: {date} /
            License: {license}
            {scalaString}
          </span>
        </div>
        <div className='row-fluid'>
          {compatibility}
        </div>
      </div>
    );
  },
});

function ReleasesArea({ releases, name, selectRelease }) {
  const releaseList = [];
  releases.each((elem) => {
    releaseList.push(
      <Release
        key={elem.cid}
        name={name}
        model={elem}
        selectRelease={selectRelease}
      />);
  });
  return (
    <div>
      <h3>Releases</h3>
      {releaseList}
    </div>
  );
}

ReleasesArea.propTypes = {
  releases: React.PropTypes.instanceOf(SparkPackageReleaseList).isRequired,
  name: React.PropTypes.string.isRequired,
  selectRelease: React.PropTypes.func.isRequired,
};

/**
 * A view to display the details of a Spark Package. Loaded on top of the Add Library Page,
 * after the Package Browsing modal has been hidden. Users can select which version of the Spark
 * Package they would like to install directly from this view. Also contains links to the
 * package's homepage, owner's homepage, and compatibility reports.
 *
 * @param package The package to display
 * @param selectRelease Callback to select a release for this package.
 */
const SparkPackageDetailView = React.createClass({
  propTypes: {
    package: React.PropTypes.instanceOf(SparkPackage).isRequired,
    selectRelease: React.PropTypes.func.isRequired,
  },

  _forceUpdate() {
    if (this.isMounted()) {
      this.forceUpdate();
    }
  },

  componentDidMount() {
    $('.modal-body-package-search').animate({ scrollTop: 0 }, 0);
    this.props.package.on('change reset add remove', this._forceUpdate.bind(this, null), this);
  },

  render() {
    const self = this;
    if (this.props.package.isValid() && this.props.package.get('packageReleases')) {
      const title = (<TitleArea model={this.props.package} />);
      const tags = (<TagsArea tags={this.props.package.get('packageTags')} />);
      const releases = (
        <ReleasesArea
          releases={this.props.package.get('packageReleases')}
          name={this.props.package.fullName()}
          selectRelease={self.props.selectRelease}
        />);
      return (
        <div className='show-package-details'>
          <div>
            {title}
            {tags}
            {releases}
          </div>
        </div>
      );
    }
    return (
      <div className='show-package-details'>
        <div className='search-feedback'>
          <h3><i className={'fa fa-' + IconsForType.inProgress}></i> Loading Package</h3>
        </div>
      </div>
    );
  },
});

module.exports = SparkPackageDetailView;
