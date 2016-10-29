/* eslint no-case-declarations: 0, import/newline-after-import: 0, complexity: 0, max-depth: 0,
global-require: 0, func-names: 0 */

import _ from 'underscore';
import $ from 'jquery';
import React from 'react';

import FileTree from '../../filetree/FileTree';

import { DropzoneUtils } from '../../forms/DropzoneUtils';
import ReactCustom from '../../forms/ReactCustom.jsx';

import dialogBaseTemplate from '../../templates/dialogBaseTemplate.html';

import ReactDialogBox from '../../ui_building_blocks/dialogs/ReactDialogBox.jsx';
import ReactModalUtils from '../../ui_building_blocks/dialogs/ReactModalUtils';

require('../../../lib/jquery-cron'); // jquery-cron
require('../../../lib/jquery-ui-bundle'); // jquery-ui
require('../../../lib/jquery.ajaxQueue'); // jquery-ajax-queue
require('../../../lib/bootstrap');


/**
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 * !!! Do not use this class! If you do, @denise will hunt you down. !!!
 * !!! Use the appropriate method from ReactDialogBox instead.       !!!
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 */
const DeprecatedDialogBox = {

  /**
   * Show an alert box, similar to window.alert().
   *
   * @param message alert message.
   * @param allowHTML whether to allow html in the message.
   * @param button If specified, overrides button text.
   * @param callback If specified, runs this callback after the button is clicked.
   * @param className If specified, the alert box will have this class
   */
  alert(message, allowHTML, button, callback, className) {
    return ReactDialogBox.alert(message, allowHTML, button, callback, className);
  },

  /**
   * Show a confirm dialog, similar to window.confirm(). Example usage:
   *
   *   DeprecatedDialogBox.confirm({
   *     message: "Are you sure you want to confirm?",
   *     messageHTML: "<b>Overrides message if present.</b>",
   *     confirmButton: "Yes, I confirm",
   *     cancelButton: "No, cancel",
   *     confirm: function(){ console.log("confirm!"); },
   *     cancel: function(){ console.log("cancel"); }
   *   });
   *
   * Only "message" is required. Every other attribute is optional.
   */
  confirm(options) {
    return ReactDialogBox.confirm(options);
  },

  /**
   * Show a prompt modal, asking the user for input. Example usage:
   *
   *   DeprecatedDialogBox.prompt({
   *     message: "Rename the table to",
   *     defaultValue: "newTable",
   *     confirmButton: "Rename",
   *     cancelButton: "Cancel",
   *     confirm: function(input){ console.log(input); },
   *     cancel: function(){ console.log("cancel"); },
   *     validate: function() { return true; },
   *     focusRange: [0, 0]
   *   });
   *
   * Only "message" is required. Every other attribute is optional.
   */
  prompt(options) {
    return ReactDialogBox.prompt(options);
  },

  /**
   * Show a custom modal, with an interior UI defined by the
   * options and html paramters.
   *
   * Items in the options parameter will be added first, then
   * the html will be appended after that.
   *
   * The options.topHtml string is appended to the top of the modal body.
   *
   *   DeprecatedDialogBox.custom({
   *     title: "A Rename Dialog You Can't Cancel",
   *     confirmButton: "Rename",
   *     showConfirmButton: true,
   *     showCancelButton: false,
   *     controls: [
   *      {
   *        controlType: "select",
   *        label: "Pick a new name",
   *        class: "newNameSelector", //optional
   *        id: "myNameSelector",     //optional
   *
   *        //the 'value' attributes of the options are
   *        //simply the displayed text forced to lower case.
   *        options: [ "Alice", "Bob", "Carol"]
   *      },
   *      {
   *        controlType: "input",
   *        type: "text",
   *        label: "Please input some useless stuff here",
   *        value: "Default Value",
   *        class: "uselessTextInput",
   *        id: "myUselessId",
   *        placeholder: "Placeholder Text",
   *        required: false,
   *        focus: true, // optional, indicates this input will get focus
   *        validate: function(value) { value !== ""; }
   *      },
   *      {
   *        //the "text" controltype is simply a div
   *        //with the message text in it
   *        controlType: "text",
   *        message: "'I know kung fu' - Neo, The Matrices"
   *      }
   *     ],
   *     confirm: function(outerDiv){ console.log(input); },
   *     cancel: function(){ console.log("cancel"); },
   *     topHtml: "<div>Stuff for the top of the modal</div>",
   *     class: "class-for-modal-div"
   *     },
   *     "<input type='number' id='foo' value='default value'></input>",
   *     false
   *     });
   *
   *   Both options and controls may be null.
   *
   *
   *   The argument to confirm is a reference to the dialog element itself.
   *   Look up the input values using the classes and IDs you passed in.
   *
   *   If the last argument, supressAutoShow, is true, the dialog will not be shown.
   *   The function also returns the dialog element.
   *
   *   If you need to tweak the dialog further than the other args allows,
   *   Set the supressAutoShow to true and call modal() on the return value
   *   after you're done tinkering.
   *
   */
  custom(options, html, supressAutoShow) {
    const dialog = $(dialogBaseTemplate());

    const title = dialog.find('.modal-header');
    const body = dialog.find('.modal-body');
    title.append($('<h3/>').text(options.title));

    // set the button text and visibility
    this.setupButtons(
        dialog,
        '.cancel-button',
        options.cancelButton,
        options.showCancelButton !== undefined ? options.showCancelButton : true
    );
    this.setupButtons(
        dialog,
        '.confirm-button',
        options.confirmButton,
        options.showConfirmButton !== undefined ? options.showConfirmButton : true
    );

    const updateFormValidity = function() {
      let valid = true;
      if (options.validateForm) {
        // use a custom form validator to validate the entire form
        valid = options.validateForm(dialog);
      } else {
        dialog.find('.control-field').each(function() {
          if ($(this).hasClass('invalid-form')) {
            valid = false;
          }
        });
      }
      if (valid) {
        dialog.find('.confirm-button').removeAttr('disabled');
      } else {
        dialog.find('.confirm-button').attr('disabled', true);
      }
    };

    const updateFieldValidityFunc = function(control, $element) {
      return function() {
        $element.toggleClass('invalid-form', !control.validate($element.val(), dialog));
        updateFormValidity();
      };
    };

    const updateTreeValidityFunc = function(control, fileTree, $element) {
      return function() {
        $element.toggleClass('invalid-form', !control.validate(fileTree.selectedNode(), dialog));
        updateFormValidity();
      };
    };

    const updateDropzoneValidityFunc = function(control, $element) {
      return function() {
        const dropzone = $element[0].dropzone;
        const invalid =
          control.validate ? !control.validate(dropzone) : dropzone.getAcceptedFiles().length === 0;
        $element.toggleClass('invalid-form', invalid);
        updateFormValidity();
      };
    };

    const confirmOnEnterFunc = function(dialogElem) {
      return function(event) {
        if (event.which === 13 && !dialogElem.find('.confirm-button').attr('disabled')) {
          event.preventDefault();
          dialogElem.find('.confirm-button').click();
        }
      };
    };

    const setProps = function(ctrl, props) {
      _.each(props, function(v, k) { ctrl.prop(k, v); });
    };

    let setFileTreePathChangeCallback = null;

    // add the controls, if any
    let controlWithFocus = null;

    if (options.controls !== undefined) {
      const topDiv = $('<div></div>');

      for (let i = 0; i < options.controls.length; ++i) {
        const control = options.controls[i];
        if (control === null) {
          continue;
        }
        let j;

        const outerDiv = $('<div></div>');

        if (control.label !== undefined) {
          const labelDiv = $('<label></label>').text(control.label);
          if (control.title !== undefined) {
            labelDiv.prop('title', control.title);
          }
          outerDiv.append(labelDiv);
        }

        let newControl;
        switch (control.controlType) {
          case 'select':
            newControl = $('<select></select>');
            for (j = 0; j < control.options.length; ++j) {
              let optval;
              if (control.options[j].toLowerCase !== undefined) {
                optval = control.options[j].toLowerCase();
              } else {
                optval = control.options[j];
              }

              newControl.append($('<option/>').prop('value', optval).text(control.options[j]));
            }
            if (control.disabled) {
              newControl.attr('disabled', true);
            }
            if (control.title) {
              newControl.attr('title', control.title);
            }
            break;

          case 'selectWithValue':
            newControl = $('<select></select>');
            for (let idx = 0; idx < control.options.length; ++idx) {
              const label = control.options[idx].label;
              const value = control.options[idx].value;
              const selected = (control.value === control.options[idx].value);
              newControl.append(
                $('<option/>')
                  .prop('value', value)
                  .attr('data-label', label)
                  .attr('selected', selected)
                  .text(label));
            }
            if (control.disabled) {
              newControl.attr('disabled', true);
            }
            if (control.title) {
              newControl.attr('title', control.title);
            }
            break;

          case 'input':
            if (control.type === 'textarea') {
              newControl = $('<textarea/>');
            } else {
              newControl = $('<input/>').prop('type', control.type);
            }
            if (control.required) {
              newControl.attr('required', 'true');
            }

            if (control.props !== undefined) {
              setProps(newControl, control.props);
            }
            if (control.title !== undefined) {
              newControl.attr('title', control.title);
            }
            if (control.value !== undefined) {
              newControl.attr('value', control.value);
            }
            if (control.placeholder) {
              newControl.attr('placeholder', control.placeholder);
            }

            if (control.max) {
              newControl.attr('max', control.max);
            } else if (control.min) {
              newControl.attr('min', control.min);
            }

            break;

          case 'text':
            newControl = $('<div/>').text(control.message);
            break;

          case 'html':
            newControl = $('<div/>').html(control.message);
            break;

          case 'dropzone':
            newControl = $('<div></div>');
            newControl.addClass('dropzone');
            DropzoneUtils.installDropzone(newControl, control.options);

            if (control.required || control.validate) {
              const updateValidity = updateDropzoneValidityFunc(control, newControl);
              newControl[0].dropzone.on('success', updateValidity);
              newControl[0].dropzone.on('error', updateValidity);
              newControl[0].dropzone.on('removedfile', updateValidity);
              updateValidity();
            }

            break;

          case 'filetreePath':
            newControl = $('<div/>').html(control.pathlabel +
                                          "<span class='filetree-path'></span>");

            setFileTreePathChangeCallback = function(fileTree) {
              const updatePath = function(node) {
                const NavFunc = require('../../filetree/NavFunc.jsx');
                let selectedPath = NavFunc.getFSPath(node.id);
                selectedPath = selectedPath === '/' ? selectedPath : selectedPath + '/';
                body.find('span.filetree-path').html(selectedPath);
              };
              fileTree.treeProvider.selectionChanged = updatePath;
            };

            const fileTreeContainer = $('.dialog-filetree-container')[0];
            // if fileTree control is already initialized, set callback now. other wise this will
            // be set when initializing the filetree control
            if (fileTreeContainer) {
              setFileTreePathChangeCallback(fileTreeContainer.fileTree);
            }

            break;

          case 'filetree':
            newControl = $('<div class="dialog-filetree-container">');
            const treeDiv = $('<div>');
            newControl.append(treeDiv);
            const fileTree = new FileTree(
              treeDiv,
              window.fileBrowserView.getReadOnlyTreeProvider(
                control.nodeType, control.hideExamples),
              { scrollElement: newControl[0] });

            // Add the FileTree to the DOM element so clients can get it; this is kind of ugly
            // but it's the way other types of controls send values back
            newControl[0].fileTree = fileTree;

            if (setFileTreePathChangeCallback) {
              setFileTreePathChangeCallback(fileTree);
            }

            // Make dialog wider to fit file tree
            dialog.addClass('file-picker-dialog');

            // Add a validation function, if given
            if (control.validate !== undefined) {
              const validFunc = updateTreeValidityFunc(control, fileTree, newControl);
              // TODO(Chaoyu): validFunc and filetree path can not coexist now because they both
              // use the treeProvider.selectionChanged callback, should consolidate this
              fileTree.treeProvider.selectionChanged = validFunc;
              validFunc();
            }

            break;

          case 'cron':
            newControl = $('<div class="dialog-cron-container"></div>');
            try {
              newControl.cron({
                initial: control.initialSched === null ? undefined : control.initialSched,
                initialTimeZone: control.initialTimeZone,
                onChange: control.onChange,
              });
            } catch (error) {
              console.warn('Could not create control, retrying with no cron expr.', error);
              newControl.html('');
              newControl.cron({
                onChange: control.onChange,
              });
              newControl.find('select').addClass('cron-widget-invalid');
            }

            // Make dialog wider to fit the cron widget
            dialog.css('width', '600px');

            break;

          case 'multifield':
            newControl = $('<div class="dialog-multifield-container"></div>');
            for (j = 0; j < control.subfields.length; j++) {
              const field = control.subfields[j];
              if (field.type === 'html') {
                newControl.append($('<span/>').html(field.html));
              } else if (field.type === 'select') {
                const select = $('<select></select>').appendTo(newControl);
                if (field.width) {
                  select.css('width', field.width);
                }
                if (field.id) {
                  select.prop('id', field.id);
                }
                for (let k = 0; k < field.options.length; k++) {
                  const opt = field.options[k];
                  if (opt[1] === field.value) {
                    select.append($('<option selected/>').prop('value', opt[1]).text(opt[0]));
                  } else {
                    select.append($('<option/>').prop('value', opt[1]).text(opt[0]));
                  }
                }
              } else {
                throw new Error('Unknown field type: ' + field.type);
              }
            }
            break;

          default:
            console.warn('Unknown type of control: ' + control.controlType);
            break;
        }

        // Add some common options
        newControl.addClass('control-field');
        if (control.class !== undefined) {
          newControl.addClass(control.class);
        }
        if (control.id !== undefined) {
          newControl.attr('id', control.id);
        }
        if (control.focus) {
          controlWithFocus = newControl;
        }

        // Add validation function if this is a form field
        if (control.validate !== undefined &&
            (control.controlType === 'input' || control.controlType === 'select')) {
          const validationFunc = updateFieldValidityFunc(control, newControl);
          validationFunc();
          newControl.on('change paste keyup focus keypress', validationFunc);
        }

        if (control.confirmOnEnter === true) {
          const confirmOnEnter = confirmOnEnterFunc(dialog);
          newControl.on('keypress', confirmOnEnter);
        }

        // Append from inside out
        const wrapperDiv = $('<div></div>'); // ugh so many divs
        wrapperDiv.append(newControl);
        if (control.labelLeft) {
          outerDiv.prepend(wrapperDiv);
        } else {
          outerDiv.append(wrapperDiv);
        }
        const otherOuterDiv = $("<div class='multi-input-row'></div>");
        if (control.id) {
          otherOuterDiv.attr('data-row-for', control.id);
        }
        if (control.hidden) {
          otherOuterDiv.hide();
        }
        otherOuterDiv.append(outerDiv);
        topDiv.append(otherOuterDiv);
      }

      // Append the whole thing to the body of the dialog
      body.append(topDiv);
    }

    if (html !== undefined) {
      const div = document.createElement('div');
      div.innerHTML = html;
      body.append(div);
    }

    if (options.topHtml !== undefined) {
      const topHtmlDiv = document.createElement('div');
      topHtmlDiv.innerHTML = options.topHtml;
      body.prepend(topHtmlDiv);
    }

    if (options.class !== undefined) {
      dialog.addClass(options.class);
    }

    function confirmCallback() {
      if (!supressAutoShow) {
        dialog.remove();
      }
      if (options.confirm) {
        options.confirm(dialog);
      }
      return false;
    }

    // always remove backdrop when dialog is removed
    dialog.on('remove', function() {
      $('.modal-backdrop').remove();
    });

    // add listener to confirm button
    dialog.find('.confirm-button').unbind('click');
    dialog.find('.confirm-button').on('click', confirmCallback);

    // Remove the modal from the DOM when it is hidden.
    dialog.on('hidden', function() {
      dialog.remove();
      if (options.cancel) {
        options.cancel();
      }
      return false;
    });

    updateFormValidity();

    dialog.modal();
    if (controlWithFocus !== null) {
      controlWithFocus.focus();
    }

    return dialog;
  },

  /**
   * This function takes the same arguments as custom() above. It uses ReactCustom, which
   * currently only supports control types input (non-text-area) and select.
   */
  reactCustom(options, html, supressAutoShow) {
    const factory = React.createFactory(ReactCustom);
    let dialog;
    if (html !== undefined) {
      const div = React.createElement('div', { dangerouslySetInnerHTML: {
        __html: html,
      } });
      const props = options;
      options.children = div;
      dialog = factory(props);
    } else {
      dialog = factory(options);
    }
    if (!supressAutoShow) {
      ReactModalUtils.createModal(dialog);
    }
    return dialog;
  },

  setupButtons(dialog, button, text, show) {
    const btnElt = dialog.find(button);
    if (show) {
      // If you use show, it adds "display: inline" which causes it to be about 8 px
      // shorter than it does with no display styling.
      btnElt.css('display', '');
      btnElt.text(text);
    } else {
      btnElt.hide();
    }
  },
};

module.exports = DeprecatedDialogBox;
