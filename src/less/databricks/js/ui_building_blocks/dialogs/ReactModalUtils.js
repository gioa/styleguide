import $ from 'jquery';
import ReactDOM from 'react-dom';

import '../../../lib/jquery-ui-bundle'; // jquery-ui
import '../../../lib/bootstrap';

const ReactModalUtils = {};

const ESC = 27;

// Creates a Modal and renders a React class inside the Modal. Use ReactModal, which follows
// the baseDialogTemplate.
ReactModalUtils.createModal = function createModal(toShow) {
  const content = $('body');
  content.append($("<div class='modal react-modal-place'></div>"));
  const dialog = $('.react-modal-place');
  // keep previous keydown function
  const keydownCb = document.onkeydown;

  dialog.modal('show');
  const backButtonListener = () => dialog.modal('hide');

  // Remove the modal from the DOM when it is hidden.
  dialog.on('hidden', function onHidden() {
    dialog.remove();
    $('.modal-backdrop').remove();
    // restore existing keydown methods
    document.onkeydown = keydownCb;
    window.removeEventListener('hashchange', backButtonListener, false);

    // Clean up component in next clock tick so that in the onConfirm callback inside the modal
    // component, it can still access to the component's state and props
    setTimeout(function unmountNode() {
      ReactDOM.unmountComponentAtNode(dialog[0]);
    }, 0);
  });

  // when the back button is pressed, properly close the Modal.
  window.addEventListener('hashchange', backButtonListener, false);

  // lose focus from the button that opened the modal. Otherwise pressing space opens multiple
  // modals.
  document.activeElement.blur();

  // TODO(someone): use an event handler instead of overriding the callback
  document.onkeydown = function keypress(e) {
    e = (e || window.event);
    if (e.keyCode === ESC) {
      try {
        e.preventDefault(); // Non-IE
      } catch (x) {
        e.returnValue = false; // IE
      }
      dialog.modal('hide');
    }
    if (keydownCb) {
      keydownCb(e);
    }
  };
  ReactDOM.render(toShow, dialog[0]);
};

// Hides the modal from view without destroying it.
ReactModalUtils.hideModal = function hideModal() {
  $('.react-modal-place').hide();
  $('.modal-backdrop').hide();
};

// Shows the modal after it was hidden.
ReactModalUtils.showModal = function showModal() {
  $('.react-modal-place').show();
  $('.modal-backdrop').show();
};

// Destroy the modal
ReactModalUtils.destroyModal = function destroyModal() {
  $('.react-modal-place').modal('hide');
};

ReactModalUtils.hasActiveModal = function hasActiveModal() {
  return $('.modal:visible').length > 0;
};

module.exports = ReactModalUtils;
