/**
 * Utility for interactive display of nested data. Given DOM nodes with JSON text inside them,
 * turns them into clickable / expandable nodes. To use, call Nestify.enable on a parent element
 * that contains children with class nestify and data attached to them; all descendants with these
 * properties will be made interactive. To attach data to an element for display, either set its
 * text to a JSON string or attach the property __nfData__ to it.
 *
 * This class works by tracking a field called __nfData__ on each DOM element representing data.
 * This field is a JSON representation of all the data nested at that element. When the element is
 * expanded (via a click), new child elements with their own __nfData__ are created for each
 * property on the parent object. When it's collapsed, we simply remove those and render it back as
 * one JSON string. Finally, elements will also optionally have a __nfKey__ field if they represent
 * a key in some parent object; this is used to draw a label in front of the element's value.
 */
import $ from 'jquery';

import { StringRenderers } from '../ui_building_blocks/text/StringRenderers';

const Nestify = {};

/** Is a JSON data item expandable into children? */
const isExpandable = function isExpandable(data) {
  if (data === null || typeof data !== 'object') {
    return false;
  }
  // Make sure it has at least one property
  for (const k in data) {
    if (data.hasOwnProperty(k)) {
      return true;
    }
  }
  return false;
};

Nestify.initializeCollapsedHTML = function initializeCollapsedHTML(data, __nfData__) {
  if (!isExpandable(__nfData__)) {
    return StringRenderers.renderString(data, 1000);
  }

  const icon = '<i class="nestify-expand fa fa-caret-right"></i>';
  // @WARNING(jengler) 2016-02-08: This uses .html() because renderString already escapes the
  // output. If it is changed to no longer escape, then this should be changed to use .text().
  const div = $('<div/>').html(StringRenderers.renderString(__nfData__));

  return icon + div.html();
};

/** Render an element in its collapsed form (as one JSON string) using its __nfData__ */
const fillCollapsed = function fillCollapsed($element) {
  const data = $element[0].__nfData__;
  const key = $element[0].__nfKey__;
  $element.empty();
  const label = $('<span class="nestify-key"/>');
  const colon = $('<span class="nestify-colon"/>');
  if (key) {
    label.text(key);
    colon.text(': ');
  }
  const div = $('<div/>').text(
    StringRenderers.htmlEscape(StringRenderers.renderString(data, 1000)));
  let icon;
  const expandable = isExpandable(data);
  if (expandable) {
    icon = $('<i class="nestify-expand fa fa-caret-right"></i>');
  } else {
    icon = $('<i>&nbsp;</i>');
  }
  $element.append(icon);
  $element.append(label);
  $element.append(colon);
  $element.append(div);
  $element.removeClass('nestify-collapsible');
  if (expandable) {
    $element.addClass('nestify-expandable');
  }
};

/** Render an element in its expanded form (as a list of children) using its __nfData__ */
const fillExpanded = function fillExpanded($element) {
  const data = $element[0].__nfData__;
  const key = $element[0].__nfKey__;
  $element.empty();
  const icon = $('<i class="nestify-collapse fa fa-caret-down"></i>');
  const label = $('<span class="nestify-key"/>');
  const colon = $('<span class="nestify-colon"/>');
  if (key) {
    label.text(key);
    colon.text(': ');
  } else {
    label.text(Array.isArray(data) ? 'array' : 'object');
    label.addClass('nestify-object');
  }
  const ul = $('<ul/>');
  for (const k in data) {
    if (data.hasOwnProperty(k)) {
      const li = $('<li/>');
      const div = $('<div class="nestify"/>');
      div[0].__nfData__ = data[k];
      div[0].__nfKey__ = k;
      if (Array.isArray(data)) {
        div.addClass('nestify-array');
      }
      fillCollapsed(div);
      li.append(div);
      ul.append(li);
    }
  }
  $element.append(icon);
  $element.append(label);
  $element.append(colon);
  $element.append(ul);
  $element.removeClass('nestify-expandable');
  $element.addClass('nestify-collapsible');
};

/** Handle a click on a nestify-enabled parent, by expanding / collapsing elements */
const handleNestifyClick = function handleNestifyClick(e) {
  const $target = $(e.target);
  if ($target.is('i')) {
    const $closest = $target.closest('.nestify');
    if ($closest.hasClass('nestify-expandable')) {
      fillExpanded($closest);
    } else if ($closest.hasClass('nestify-collapsible')) {
      fillCollapsed($closest);
    }
  }
};

/**
 * Entry point for Nesitfy. Enable clicking to view nested data on all children of $parent that
 * have the nestify class (and on $parent itself if it has this class). These elements are
 * expected to either have a __nfData__ property with their JSON data, or contain valid JSON as
 * their text. In both cases they will be augmented with expand buttons that users can click.
 *
 * This method should only be called once on any DOM element, and should not be called on both
 * an element and one of its descendants, otherwise we'll get duplicate listeners.
 */
Nestify.enable = function enable($parent, initialized) {
  // Select all .nestify children as well as the parent if it has .nestify
  const elements = $parent.find('.nestify').addBack('.nestify');
  let i;

  if (!initialized) {
    for (i = 0; i < elements.length; i++) {
      const $element = $(elements[i]);
      if (!$element[0].__nfData__) {
        $element[0].__nfData__ = JSON.parse($element.text());
      }
      fillCollapsed($element);
    }
  }
  $parent.click(handleNestifyClick);
};

module.exports = Nestify;
