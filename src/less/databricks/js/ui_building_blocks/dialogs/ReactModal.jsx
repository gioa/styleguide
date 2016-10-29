/* @flow weak */
/* eslint react/prefer-es6-class: 0 */

import React from 'react';

/**
 * A Modal template following dialogBaseTemplate. Create this modal, and supply it to
 * ReactModalUtils.createModal. Excerpt from MavenLibraryCreateView.js:
 *  ```
 *  const PackageBrowseModalViewFactory = React.createFactory(PackageBrowseModalView);
 *  const browser = PackageBrowseModalViewFactory({
 *    coordinateInput: coordinateField,
 *    callback: this.enableOrDisableSubmission.bind(this, null),
 *    sparkPackages: window.sparkPackageList,
 *    mavenPackages: new MavenPackageList()
 *  });
 *  ReactModalUtils.createModal(browser);
 *  ```
 *
 * PackageBrowseModalView.jsx has an example on how to create and supply a header, body, and
 * footer.
 *
 * @param modalName A class name to append to the modal for Selenium, and easy jquery access.
 *                  Appends this value to "modal-main", "modal-header", "modal-body", etc...
 *                  For example for modalName: "package" -> "modal-header-package". Any css
 *                  that you would like to apply, can be applied through these classes.
 * @param header Things to put in the header. Can be null, or an array of objects.
 * @param body Things to put in the body. Can be null, or an array of objects
 * @param footer Things to put in the footer. Can be null. Makes sense to put the Confirm buttons
 *               here though :)
 */
const ReactModal = React.createClass({

  propTypes: {
    modalName: React.PropTypes.string.isRequired,
    classes: React.PropTypes.string,
    header: React.PropTypes.oneOfType([
      React.PropTypes.object,
      React.PropTypes.array]),
    body: React.PropTypes.oneOfType([
      React.PropTypes.object,
      React.PropTypes.array]),
    footer: React.PropTypes.oneOfType([
      React.PropTypes.object,
      React.PropTypes.array]),
    onHide: React.PropTypes.func,
  },

  componentWillUnmount() {
    if (this.props.onHide) {
      this.props.onHide();
    }
  },

  render() {
    let mainClasses = 'modal modal-narrow modal-main-' + this.props.modalName;
    mainClasses += ' ' + this.props.modalName;
    if (this.props.classes) {
      mainClasses += ' ' + this.props.classes;
    }
    const headerClasses = 'modal-header modal-header-' + this.props.modalName;
    const bodyClasses = 'modal-body modal-body-' + this.props.modalName;
    const footerClasses = 'modal-footer modal-footer-' + this.props.modalName;
    return (
      <div className={mainClasses}>
        <div className={headerClasses}>
          {this.props.header}
        </div>
        <div className={bodyClasses}>
          {this.props.body}
        </div>
        <div className={footerClasses}>
          {this.props.footer}
        </div>
      </div>
    );
  },
});

module.exports = ReactModal;
