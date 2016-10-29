/* eslint func-names: 0 */

const _ = require('lodash');

export class GitHubUtils {
  static isStringEntryValid(entry) {
    return _.isString(entry) && !_.isEmpty(entry);
  }

  static isValidHostname(hostname) {
    return GitHubUtils.isStringEntryValid(hostname);
  }

  static isValidGitHubLink(link) {
    return _.isObject(link) && this.isStringEntryValid(link.owner) &&
      this.isStringEntryValid(link.repo) && this.isStringEntryValid(link.path);
  }

  static getHostname(gitLink) {
    return gitLink && gitLink.hostname ? gitLink.hostname : 'github.com';
  }

  static getRepoURL(gitLink, hostname, owner, repo) {
    if (GitHubUtils.isValidGitHubLink(gitLink)) {
      owner = gitLink.owner;
      repo = gitLink.repo;
      // hostname could still be undefined after this line
      hostname = GitHubUtils.isValidHostname(gitLink.hostname) ? gitLink.hostname : hostname;
    }
    hostname = hostname || GitHubUtils.getHostname();
    const isValid = GitHubUtils.isStringEntryValid(owner) && GitHubUtils.isStringEntryValid(repo) &&
      GitHubUtils.isStringEntryValid(hostname);
    return isValid ? 'https://' + hostname + '/' + owner + '/' + repo : null;
  }

  /** Returns the branch string with the owner of the repo, e.g. `databricks:universe` */
  static getDefaultBranchString(branchInfo, gitLink) {
    let owner;
    let defaultBranch = 'master';
    if (GitHubUtils.isValidGitHubLink(gitLink)) {
      defaultBranch = gitLink.branch ? gitLink.branch : 'master';
      owner = gitLink.owner;
    }
    if (branchInfo) {
      if (GitHubUtils.isStringEntryValid(branchInfo.parentOwner)) {
        owner = branchInfo.parentOwner;
      }
      if (GitHubUtils.isStringEntryValid(branchInfo.parentBranch)) {
        defaultBranch = branchInfo.parentBranch;
      }
    }
    return owner ? owner + ':' + defaultBranch : defaultBranch;
  }

  static shouldLink(currentLink, newLink) {
    return GitHubUtils.isValidGitHubLink(newLink) && (!currentLink ||
      newLink.hostname !== currentLink.hostname ||
      newLink.owner !== currentLink.owner ||
      newLink.repo !== currentLink.repo ||
      newLink.branch !== currentLink.branch ||
      newLink.path !== currentLink.path);
  }

  static createPRURL(gitLink, branchInfo) {
    let branch;
    let gitRepo;
    let defaultBranch = GitHubUtils.getDefaultBranchString(branchInfo);
    if (GitHubUtils.isValidGitHubLink(gitLink)) {
      if (defaultBranch === 'master') {
        defaultBranch = gitLink.owner + ':' + defaultBranch;
      }
      gitRepo = GitHubUtils.getRepoURL(gitLink);
      branch = GitHubUtils.getDefaultBranchString(null, gitLink);
    }
    return branch && branch !== defaultBranch ? (gitRepo + '/compare/' + defaultBranch +
      '...' + branch) : null;
  }

  static shouldFetchBranches(oldLink, nextLink) {
    if (!window.settings || !window.settings.enableNotebookGitBranching) {
      return false;
    }
    if (!oldLink && nextLink) {
      return true;
    } else if (oldLink && nextLink) {
      if (oldLink.owner !== nextLink.owner || oldLink.repo !== nextLink.repo) {
        return true;
      }
    }
    return false;
  }
}

export class GitHubLink {
  constructor(ownerOrObject, repo, path, branch, hostname) {
    if (_.isString(ownerOrObject)) {
      this.owner = ownerOrObject;
      this.repo = repo;
      this.path = path;
      this.branch = branch;
      this.hostname = hostname;
    } else if (_.isObject(ownerOrObject)) {
      this.owner = ownerOrObject.owner;
      this.repo = ownerOrObject.repo;
      this.path = ownerOrObject.path;
      this.branch = ownerOrObject.branch;
      this.hostname = ownerOrObject.hostname;
    } else {
      console.error('Unexpected format for GitHubLink owner: ' + ownerOrObject);
    }
  }

  withPath(path) {
    this.path = path;
  }

  withHostname(hostname) {
    this.hostname = hostname;
  }

  withBranch(branch) {
    this.branch = branch;
  }

  getGitHubLink(commit) {
    commit = commit || 'master';
    if (GitHubUtils.isValidGitHubLink(this)) {
      const base = GitHubUtils.getRepoURL(this) + '/blob/' + commit + '/';
      // replace special characters using encodeURIComponent, but keep `/` because those are used
      // in the path of the notebook. encodeURI is not enough, because it doesn't encode `#`.
      return base + encodeURIComponent(this.path).replace(new RegExp('%2F', 'g'), '/');
    }
    return null;
  }
}


GitHubUtils.parseGitHubData = function(link) {
  const parts = link.trim().split('/');
  if (parts[0].indexOf('http') < 0) {
    return null;
  }
  let hostname;
  if (parts[2] !== 'github.com') {
    hostname = parts[2];
  }
  let repo;
  let path;
  let branch;
  if (parts.length < 5) {
    return null; // http, "", github.com, owner, repo
  }
  const owner = parts[3];
  repo = parts[4];
  if (repo.slice(-4) === '.git') {
    repo = repo.slice(0, -4);
  }
  if (parts.length >= 8 && parts[5] === 'blob') {
    // try to refer branch and path of file if it exists in the url, e.g.
    // github.com/databricks/universe/blob/master/webapp/web/js/notebook/GitHubModalView.jsx ->
    // branch: "master", path: "webapp/web/js/notebook/GitHubModalView.jsx"
    branch = parts[6];
    path = decodeURIComponent(parts.slice(7).join('/'));
  }
  return new GitHubLink(owner, repo, path, branch, hostname);
};
