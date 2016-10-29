/**
 * View for creating a new user library (uploading eggs).
 *
 * DEPENDENCIES: Backbone, Underscore, jQuery, Router
 */
import $ from 'jquery';
import React from 'react';
import Backbone from 'backbone';

import NavFunc from '../filetree/NavFunc.jsx';

import MavenPackageList from '../libraries/search/MavenPackageList';
import PackageBrowseModalView from '../libraries/search/PackageBrowseModalView.jsx';
import SparkPackageList from '../libraries/search/SparkPackageList';

import mavenLibraryCreateTemplate from '../templates/mavenLibraryCreate.html';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';
import ReactModalUtils from '../ui_building_blocks/dialogs/ReactModalUtils';

const MavenLibraryCreateView = Backbone.View.extend({
  initialize(options) {
    this.options = options || {};

    this.name = 'Create Library';
    this.makingAjaxCall = false;

    this.parentId = this.options.parentId || 0;
  },

  render() {
    this.$el.html(mavenLibraryCreateTemplate);
    this.$el.attr('class', 'library-import');

    // Disable the submit button.
    this.enableOrDisableSubmission();
  },

  /**
   * Check whether the form is valid. If it is, enable the submission button. Otherwise, disable
   * the submission button.
   */
  enableOrDisableSubmission() {
    if (!this.makingAjaxCall) {
      const name = this.$('.maven_library_name').val();
      if (name === null || name === '' || name.split(':').length !== 3) {
        this.$('.submit-create-library').attr('disabled', 'disabled');
      } else {
        this.$('.submit-create-library').removeAttr('disabled');
      }
    }
  },

  events: {
    'input .maven_library_name': 'enableOrDisableSubmission',
    'keyup .maven_library_name': 'queryMavenCentral',
    'click .submit-create-library': 'onSubmit',
    'click .open-package-browse': 'openPackageBrowser',
    'click .advanced-pointer': 'renderCollapse',
    'change .source': 'switchLibraryView',
  },

  /**
   * Queries search.maven.org for autocomplete suggestions to users.
   */
  queryMavenCentral() {
    const name = this.$('.maven_library_name').val();
    if (name === null || name === '' || name.length < 3) {
      // do nothing
    } else {
      // send ajax to maven central and populate dropdown
      const baseUrl = 'http://search.maven.org/solrsearch/select';
      let q = '';
      const splits = name.split(':');
      const isValid = true;
      if (splits.length === 1) {
        q += name;
      }
      if (splits.length >= 2) {
        if (splits[0] !== null && splits[1] !== null) {
          q += 'g:' + splits[0] + '+AND+a:' + splits[1];
        }
      }
      if (splits.length === 3) {
        if (splits[2] !== null) {
          q += '+AND+v:' + splits[2];
        }
      }
      if (isValid) {
        const url = '/proxy/' + encodeURIComponent(baseUrl + '?q=' + q + '&wt=json&rows=10');
        $.ajax(url, {
          contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
          type: 'GET',
          success(searchResult) {
            const results = [];
            if (searchResult.response) {
              $.each(searchResult.response.docs, (idx, artifact) => {
                results.push(artifact.id + ':' + artifact.latestVersion);
              });
            }
            $('.maven_library_name').autocomplete({
              source: results,
              minLength: 0,
              scroll: true,
              select() {
                $('.submit-create-library').removeAttr('disabled');
              },
            });
          },
        });
      }
    }
  },

  openPackageBrowser() {
    const coordinateField = $('.maven_library_name');
    if (!window.sparkPackageList) {
      window.sparkPackageList = new SparkPackageList();
      window.sparkPackageList.fetch();
    }
    window.sparkPackageList.changeSort('ratingDesc');
    const PackageBrowseModalViewFactory = React.createFactory(PackageBrowseModalView);
    const browser = PackageBrowseModalViewFactory({
      coordinateInput: coordinateField,
      callback: this.enableOrDisableSubmission.bind(this, null),
      sparkPackages: window.sparkPackageList,
      mavenPackages: new MavenPackageList(),
    });
    ReactModalUtils.createModal(browser);
  },

  switchLibraryView() {
    const source = document.getElementById('lib-selector');
    const src = source.options[source.selectedIndex].value;
    NavFunc.removeView(this);
    if (src === 'python') {
      window.router.navigate('create/pythonLibrary/' + this.parentId, { trigger: true });
    } else if (src === 'scala') {
      window.router.navigate('create/library/' + this.parentId, { trigger: true });
    }
  },

  /**
   * Check whether the provided maven coordinates are valid.
   */
  validateCoordinate(coordinate) {
    const splits = coordinate.split(':');
    const splitsLength = splits.length;
    if (splitsLength !== 3) {
      return false;
    }
    for (let i = 0; i < splitsLength; i++) {
      if (splits[i] === null || splits[i] === '') {
        return false;
      }
    }
    return true;
  },

  renderCollapse() {
    const triangle = this.$('#options-arrow');
    if (triangle.attr('class').indexOf('fa-caret-right') > -1) {
      triangle.removeClass('fa-caret-right');
      triangle.addClass('fa-caret-down');
    } else {
      triangle.removeClass('fa-caret-down');
      triangle.addClass('fa-caret-right');
    }
  },

  onSubmit() {
    const self = this;
    const name = this.$('.maven_library_name').val();

    if (this.validateCoordinate(name)) {
      self.$('.library-create-message').html('');
      const libraryType = 'maven';
      const spinner = self.$('.maven-resolve-process');
      const repository = 'r:' + this.$('.maven_repo_name').val();
      const excludes = 'e:' + this.$('.maven_excludes').val();
      spinner.removeAttr('hidden');
      $('.submit-create-library').attr('disabled', 'disabled');
      $('.open-package-browse').attr('disabled', 'disabled');
      this.makingAjaxCall = true;
      $.ajax('/libraries/create', {
        contentType: 'application/json; charset=UTF-8',
        type: 'POST',
        data: JSON.stringify({
          name: name,
          file: repository + ';' + excludes,
          parentId: this.parentId,
          libraryType: libraryType,
          autoAttach: false,
        }),
        complete() {
          spinner.attr('hidden', 'hidden');
          $('.submit-create-library').removeAttr('disabled');
          $('.open-package-browse').removeAttr('disabled');
          self.makingAjaxCall = false;
        },
        success(msg) {
          const libId = msg.id;
          NavFunc.removeView(self, true);
          if (libId) {
            const route = '#/library/' + libId;
            window.router.navigate(route, { trigger: true });
          } else {
            console.error('MavenLibraryCreateView', 'onSubmit', 'success', msg);
            window.router.navigate('', { trigger: true });
          }
        },
        error(msg) {
          DeprecatedDialogBox.alert('Error: ' + msg.statusText);
        },
      });
    } else {
      self.$('.library-create-message').html('Error: Invalid maven coordinate.');
    }
  },
});

module.exports = MavenLibraryCreateView;
