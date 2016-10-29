/* eslint no-shadow: 0, callback-return: 0, complexity: 0, consistent-return: 0, func-names: 0 */

import $ from 'jquery';
import d3 from 'd3';

/**
 * Internal class that represents an opened node in the tree: a node object and an array of its
 * children (which we requested from the TreeProvider).
 *
 * @param node our TreeNode
 * @param children list of children (all TreeNode objects)
 * @param selectedChild ID of currently selected child (optional, undefined means "none")
 */
function OpenNode(node, children, selectedChild) {
  this.node = node;
  this.children = children;
  this.id = node.id;
  this.selectedChild = selectedChild;
}

/**
 * A file tree control that can be fed data, possibly asynchronously, from a variety of sources.
 *
 * Each FileTree will have a root node, which is not rendered, and will render an expanding menu
 * of nodes under that. Nodes can optionally have icons, dropdown menus and an action on click.
 *
 * To discover the nodes and react to them being clicked, the FileTree gets its data from an
 * object called a TreeProvider. The TreeProvider needs to implement two methods:
 *
 * - getRootNode(): Return a node object for the root (see details below on what this contains)
 * - getChildren(node, callback): Find the children of the given node ID, and when done, call the
 *   given callback function with them. This allows providers to function asynchronously.
 *
 * The following methods are optional:
 *
 * - getParent(node, callback): Find the parent of the given node ID, and when done, call the
 *   given callback function with it (the parent may be undefined).
 * - nodeClicked(node): Called when any node in the tree is clicked.
 * - dropdownClicked(node): Called when a node's dropdown icon is clicked (if it has one).
 * - nodeDropped(node, target): Called when a node is dropped onto another node (if draggable).
 * - dragStarted(node): Called when a node started being dragged.
 * - selectionChanged(node): Called when the selected node is changed (or unselected).
 *
 * Each node passed between the TreeProvider and the FileTree needs to be a JavaScript object,
 * which can have the following fields (not all required):
 * - id: a unique ID within the whole file tree
 * - name: a name to show on the UI
 * - hasChildren (optional): true if the node has children
 * - hasMenu (optional): true if the node should have a dropdown menu
 * - icon (optional): FontAwesome icon to show
 * - openIcon (optional): different FontAwesome icon to show when open (if node has children)
 * - domAttributes (optional): extra DOM attributes
 * - annotationText (optional): text to annotate the right side of the node with
 * - url (optional): URL to put on the <a> element generated for the node
 * - selectable (optional): can the node be selected?
 * - display (optional): special display modes; currently supports:
 *   "heading" for non-clickable headings (e.g. Recent Items in sidebar),
 *   "top-link" for special coloured links at the top such as Create Table,
 *   "multiline" for multiline items.
 * - draggable: can the element be dragged onto folders in the tree?
 * - droppable: can the element accept drops? (only applicable to elements with hasChildren)
 *
 * The FileTree.Node class can be used to quickly construct nodes.
 *
 * The whole tree can be refreshed with refreshAllNodes() if the data in an open node changes.
 * In the future, we may extend TreeProvider to allow watching and unwatching nodes.
 *
 * @param $element JQuery wrapper around element to render the tree within
 * @param treeProvider tree provider object (described above)
 * @param options supports the following display options:
 *                - pushElement: a DOM element to push to the right as we expand
 *                - scrollElement: if set, provides a DOM element to scroll as we expand
 *                - pinnable: if true, show a pin icon in the first panel to toggle pinning
 */
const FileTree = function($element, treeProvider, options) {
  const self = this;
  this.$element = $element;
  this.treeProvider = treeProvider;

  // Set specific options
  options = options !== undefined ? options : {};
  this.pushElement = options.pushElement || null;
  this.scrollElement = options.scrollElement || null;
  this.pinnable = options.pinnable || false;

  // Initialize and clear our DOM element
  this.$element.addClass('filetree');
  this.$element.empty();
  this.$inner = $('<div class="inner">');
  this.$inner.appendTo(this.$element);

  // Root node; this will be a dummy node that does not get shown directly, but can contain
  // multiple top-level nodes, e.g. the Notebooks / Clusters / Jobs "folders" in the workspace
  this.rootNode = this.treeProvider.getRootNode();

  // During drag and drop, save the element being dragged even if its panel gets removed because
  // JQuery UI stops the drag if the source element gets removed. We detect when we remove it
  // it in render() and add it back as a hidden child of this.$element when that occurs.
  this.elementBeingDragged = null;
  this.nodeBeingDragged = null;

  // The last node ID that we are navigated to or are in the process of navigating to (either due
  // to user click or via openToNode). We remember the target so that we can cancel previous
  // navigations if the tree starts navigating to a different node.
  this.currentTargetNodeId = null;

  // Only enable drag-and-drop and dropdowns if the treeProvider handles them
  this.hasDragDrop = this.treeProvider.nodeDropped !== undefined;
  this.hasDropdowns = this.treeProvider.dropdownClicked !== undefined;

  // List of nodes that are currently open; we fetch them asynchronously
  this.openNodes = [];
  this.treeProvider.getChildren(this.rootNode, function(children) {
    self.openNodes = [new OpenNode(self.rootNode, children)];
    self.render();
  });

  this.pinned = false;

  // TODO: watch the tree
};

/**
 * A utility class that implements the node interface expected by FileTree. You can also pass
 * plain JavaScript objects instead.
 */
FileTree.Node = function(id, name, icon, hasChildren, domAttr, annotationText) {
  this.id = id;
  this.name = name || id.toString();
  this.icon = icon || 'file';
  this.hasChildren = hasChildren || false;
  this.domAttributes = domAttr || {};
  this.annotationText = annotationText || '';
};

FileTree.prototype.render = function() {
  const self = this;

  // Have the key be the node id and draggability, because we want to re-render if the
  // draggability changes
  function getKey(obj) { return [obj.id, obj.draggable]; }
  // append the displayName, should be used in span.each() that contains the display name
  function appendDisplayName(d) {
    /* jshint validthis: true */
    const span = d3.select(this);
    span.classed('filetree-display-name', true);
    if (!d.isHomeFolder) {
      span.text(d.name);
    } else {
      const emailIdx = d.name.indexOf('@');
      if (emailIdx >= 0) {
        const username = d.name.substring(0, emailIdx);
        const rest = d.name.substring(emailIdx);
        span.selectAll('span').remove();
        span.append('span').attr('class', 'email-name').text(username);
        span.append('span').attr('class', 'email-domain').text(rest);
      } else {
        span.text(d.name);
      }
    }
  }

  const panels = d3.select(this.$inner[0]).selectAll('.ft-panel').data(this.openNodes);

  const newPanels = panels.enter().append('div')
    .attr('class', 'ft-panel');
  newPanels.append('ul').attr('class', 'ft-panel-list');
  newPanels.style('width', 0)
    .transition()
    .style('width', '196px');

  const highlight = function() {
    d3.select(this).transition()
    .duration(190)
    .ease('in')
    .style('background-color', '#F7F7F7')
    .transition()
    .ease('out')
    .duration(260)
    .style('background-color', 'white');
  };

  newPanels.on('contextmenu', function(openNode) {
    if (openNode.id < 0 || !self.hasDropdowns) { return; }

    d3.event.preventDefault();
    d3.event.stopPropagation();
    const x = d3.event.pageX;
    const y = d3.event.pageY;
    highlight.call(this);
    self.onDropdownClicked(openNode.node, { left: x, top: y, isPanelContext: true });
  }).on('click', function(openNode) {
    // when click on empty space of a panel, deselect current selected node
    if ($(d3.event.target).hasClass('ft-panel') && openNode.selectedChild) {
      let selectedChild;
      openNode.children.forEach(function(child) {
        if (child.id === openNode.selectedChild) {
          selectedChild = child;
        }
      });
      if (!selectedChild || !selectedChild.hasChildren) {
        return; // exit if current selected node don't have children nodes
      }

      d3.event.preventDefault();
      self.openToNode(openNode.node);
      highlight.call(this);
    }
  });

  panels.each(function(openNode, idx) {
    const panelElement = this;

    if (openNode.node.hasChildren && openNode.node.droppable && self.hasDragDrop) {
      $(panelElement).droppable({
        scope: self,
        hoverClass: 'drop-hover',
        drop() { self.onDrop(openNode.node); },
      });
      $(panelElement).resizable({
        minWidth: 150,
        maxWidth: 500,
        handles: 'e', // only resize width from right side
        resize() {
          // Move any element to the right of us that we needed pushed as the tree expands.
          if (self.pushElement !== null) {
            const newWidth = FileTree.calculateShiftOfContent(panels[0]);
            d3.selectAll(self.pushElement).style('left', newWidth + 'px');
          }
        },
      });
      $(panelElement).scroll(function() {
        const newTop = $(this).scrollTop() + (parseInt($(this).css('height'), 10) * 0.5);
        $(panelElement).find('.ui-resizable-handle').css('top', newTop + 'px');
      });
    }

    const items = d3.select(this).select('ul').selectAll('li').data(openNode.children, getKey);

    const newItems = items.enter().append('li')
      .attr('class', function(d) { return d.classes; })
      .classed('filetree-list-item', true)
      .append('a')
      .attr('href', function(d) { return d.url || '#'; })
      .attr('data-name', function(d) { return d.name; })
      .classed('home-folder', function(d) { return d.isHomeFolder; })
      .classed('filetree-link', true);

    // Enable dragging and dropping on the new items
    newItems.each(function(d) {
      const domElement = this;
      if (d.draggable && self.hasDragDrop) {
        $(domElement).draggable({
          scope: self,
          helper: 'clone',
          refreshPositions: true,  // Recalculate drop targets as we drag
          appendTo: self.$element,
          start(event, ui) {
            self.elementBeingDragged = this;
            self.nodeBeingDragged = d;
            self.treeProvider.dragStarted(d);
            $(this).closest('li').addClass('being-dragged');
            ui.helper.focus();
            ui.helper.keyup(function(e) {
              if (e.which === FileTree.ESCAPE) {
                // Cancel dragging. This is hacky in JQuery UI: you have to send a mouseup event.
                // (i.e. "drop"). We later realize it's a cancel since we set nodeDragged to null.
                self.elementBeingDragged = null;
                self.nodeBeingDragged = null;
                ui.helper.trigger('mouseup');
              }
            });
          },
          stop() {
            self.elementBeingDragged = null;
            self.nodeBeingDragged = null;
            $(this).closest('li').removeClass('being-dragged');
          },
        });
      }
      if (d.droppable && d.hasChildren && self.hasDragDrop) {
        $(domElement).droppable({
          scope: self,
          hoverClass: 'drop-hover',
          greedy: true,
          accept() {
            return self.nodeBeingDragged !== null && d.id !== self.nodeBeingDragged.id;
          },
          over() {
            self.onDraggingOver(d, domElement, idx);
          },
          drop() { self.onDrop(d); },
        });
      }
    });

    newItems.append('i');
    newItems.append('span').each(appendDisplayName);
    newItems.filter(function(d) { return d.disabled; }).style('opacity', '0.5');
    newItems.filter(function(d) { return d.tooltip; }).each(function(d) {
      $(this).tooltip({
        trigger: 'hover',
        title: d.tooltip,
        placement: 'bottom',
        html: true,
      });
    });
    newItems.on('click', function(d) { self.onItemClicked(d, this, idx); });
    if (self.hasDropdowns) {
      const nodesWithMenu = newItems.filter(function(d) {
        return d.hasMenu === true;
      });
      const dropdownDivs = nodesWithMenu.append('div').attr('class', 'dropdown');
      dropdownDivs.append('i').attr('class', function(d) {
        if (d.display === 'top-link') {
          return 'fa fa-chevron-down';
        }
        return 'fa fa-caret-down';
      });
      dropdownDivs.on('click', function(d) {
        d3.event.preventDefault();
        d3.event.stopPropagation();
        self.onDropdownClicked(d);
      });
      nodesWithMenu.on('contextmenu', function(d) {
        d3.event.preventDefault();
        d3.event.stopPropagation();
        self.onRightClicked(d);
      });
    }

    // Update the icon and title of all items
    items.select('a')
      .attr('data-name', function(d) { return d.name; })
      .attr('title', function(d) {
        // Don't set the title if we have a tooltip, otherwise both will appear on hover.
        if (!d.tooltip) {
          return d.name;
        }
      })
      .classed('home-folder', function(d) { return d.isHomeFolder; });
    items.select('span').each(appendDisplayName);
    items.classed('heading', function(d) { return d.display === 'heading'; });
    items.classed('multiline', function(d) { return d.display === 'multiline'; });
    items.classed('top-link', function(d) { return d.display === 'top-link'; });
    items.classed('has-menu', function(d) { return d.hasMenu; });
    items.classed('selected', function(d) { return d.id === openNode.selectedChild; });
    items.classed('being-dragged', function(d) {
      return self.nodeBeingDragged !== null && d.id === self.nodeBeingDragged.id;
    });

    items.select('i').attr('class', function(d) {
      let icon = d.icon || 'file-alt';
      if (d.openIcon && d.id === self.openNodes[idx].selectedChild) {
        icon = d.openIcon;
      }
      return 'fa fa-' + icon + ' fa-fw';
    });
    items.select('i').each(function(d) {
      const curItem = d3.select(this);
      d3.keys(d.domAttributes).forEach(function(key) {
        curItem.attr(key, d.domAttributes[key]);
      });
    });

    items.each(function(d) {
      const curItem = d3.select(this).select('a');
      curItem.classed('has-annotation', d.annotationText);
      const annotation = d.annotationText ? [1] : [];
      const annotItem = curItem.selectAll('div.fb-annotation').data(annotation);
      annotItem.enter().append('div').attr('class', 'fb-annotation');
      annotItem.text(d.annotationText);
      annotItem.exit().remove();
    });

    items.exit().remove();
    items.order();
  });

  d3.select(this.$inner[0]).selectAll('.ft-panel').attr({
    'data-panel'(panel) { return panel.node.name; },
  });

  const deletedPanels = panels.exit();
  deletedPanels.transition()
    .style('width', '0px')
    .remove();

  // Show pin button
  if (this.pinnable && this.openNodes.length > 0) {
    d3.select(this.$inner[0]).selectAll('.ft-pin-button').remove();
    const pinIcon = d3.select(this.$inner[0]).append('a')
      .classed('ft-pin-button', true)
      .classed('active', this.pinned)
      .attr('href', '#')
      .attr('title', 'Pin menu open');
    pinIcon.append('i').classed('fa fa-thumb-tack', true);
    pinIcon.on('click', function() {
      self.pinned = !self.pinned;
      pinIcon.classed('active', self.pinned);
      d3.event.preventDefault();
    });
  }

  const newWidth = FileTree.calculateShiftOfContent(panels[0], newPanels[0]);
  // Move any element to the right that we need to push as the tree expands.
  if (this.pushElement !== null) {
    d3.selectAll(this.pushElement).transition().style('left', newWidth + 'px');
  }

  // If the elementBeingDragged was removed from the actual tree, put it back into the DOM as a
  // hidden child of our top-level element to let JQuery keep on dragging it. Otherwise, JQuery
  // stops as soon as the source element is removed from the page.
  if (this.elementBeingDragged !== null &&
      !$.contains(this.$inner[0], this.elementBeingDragged)) {
    $(this.elementBeingDragged).appendTo(this.$element);
    $(this.elementBeingDragged).css('display', 'none');
  }
};

FileTree.prototype.onRightClicked = function(node) {
  const x = d3.event.pageX;
  const y = d3.event.pageY;
  this.onDropdownClicked(node, { left: x, top: y });
};

FileTree.prototype.onItemClicked = function(node, domElement, panelIdx) {
  const self = this;
  this.currentTargetNodeId = node.id;

  // If this is a heading node, always prevent clicks
  if (node.display === 'heading') {
    d3.event.preventDefault();
    return;
  }

  // If the user has shift-clicked or cmd-clicked a link with a valid URL, this means
  // "open in new tab" in browsers, so let the browser handle the event.
  if (node.url && (d3.event.metaKey || d3.event.shiftKey || d3.event.ctrlKey)) {
    return;
  }

  d3.event.preventDefault();

  if (node.id === this.openNodes[panelIdx].selectedChild) {
    // Unselect just this node
    this.openNodes[panelIdx].selectedChild = undefined;
    this.openNodes = this.openNodes.slice(0, panelIdx + 1);
    this.render();
    if (this.treeProvider.selectionChanged) {
      this.treeProvider.selectionChanged(this.openNodes[this.openNodes.length - 1]);
    }
    return;
  }

  // Update the tree: change selected node, remove panels after this due to previous selection
  this.openNodes[panelIdx].selectedChild = (node.selectable !== false ? node.id : undefined);
  const oldNodeHadChildren = this.openNodes.length > panelIdx + 1;
  this.openNodes = this.openNodes.slice(0, panelIdx + 1);
  if (node.hasChildren && oldNodeHadChildren) {
    // Leave an empty panel there instead of closing and reopening one
    this.openNodes.push(new OpenNode(node, []));
  }
  this.render();

  if (node.hasChildren) {
    this.treeProvider.getChildren(node, function(children) {
      // Check that we're still selected in case user quickly clicked something else
      const openNodes = self.openNodes;
      if (openNodes.length > panelIdx && openNodes[panelIdx].selectedChild === node.id) {
        openNodes[panelIdx + 1] = new OpenNode(node, children);
        self.render();
      }
    });
  }

  if (this.treeProvider.nodeClicked) {
    this.treeProvider.nodeClicked(node);
  }

  if (this.treeProvider.selectionChanged) {
    this.treeProvider.selectionChanged(node);
  }
};

/**
 * Calculate how much the content view has to be shifted to the right, when a new panel is opened
 * or a panel is re-sized.
 */
FileTree.calculateShiftOfContent = function(existingPanels, newPanels) {
  // 75px is the width of the sidebar panel fixed on the left
  let newWidth = 75;
  if (!newPanels) {
    $.each(existingPanels, function() {
      newWidth += $(this).width();
    });
  } else {
    // The first panel is sometimes not rendered in time, so the width turns
    // out to be less than 196. Therefore we separate that from the list and
    // manually add it in at the end.
    const tailPanels = existingPanels.slice(1);
    $.each(tailPanels, function(idx, element) {
      if (!newPanels[idx + 1]) {
        // existing panel
        newWidth += $(element).width();
      } else {
        // the new panel is not rendered yet, therefore the width turns out to be 0.
        newWidth += 196;
      }
    });
    newWidth += 196;
  }

  return newWidth;
};

/**
 * Open the FileTree to a specified node in the tree. If there is not a path to the root
 * node via following the node and its ancestors' parentIds, this function does nothing.
 *
 * @param {TreeNode} node Tree node object(expect to have at least 'id' and 'hasChildren' attribute)
 */
FileTree.prototype.openToNode = function(node) {
  const self = this;

  this.currentTargetNodeId = node.id;

  // Populate this array with the ancestors of node. After population, the array will contain
  // the path from the root to the node (inclusive) in order
  const nodesToOpen = [];

  function addAncestors(node, selectedChild, callback) {
    function recurse(node) {
      // base case: this is the root
      if (node.id === self.treeProvider.getRootNode().id) {
        callback(true);
        return;
      }
      // recursive case: process the node's parent
      if (!self.treeProvider.getParent) {
        callback(false);
      } else {
        self.treeProvider.getParent(node, function(parent) {
          if (!parent) {
            callback(false);
            return;
          }
          addAncestors(parent, node.id, callback);
        });
      }
    }

    if (node.hasChildren) {
      // open all nodes that have children
      self.treeProvider.getChildren(node, function(children) {
        const openNode = new OpenNode(node, children);
        openNode.selectedChild = selectedChild;
        nodesToOpen.unshift(openNode);
        recurse(node);
      });
    } else {
      // leaf nodes don't need to be open nodes
      recurse(node);
    }
  }

  addAncestors(node, undefined, function(foundRoot) {
    // Check that we're still navigating to this node in case user quickly clicked something else
    if (foundRoot && self.currentTargetNodeId === node.id) {
      // if the node to open in each panel is the same as the one already there mutate it rather
      // than replacing it because the OpenNode is tied to a d3 DOM selector
      for (let i = 0; i < nodesToOpen.length; i++) {
        if (self.openNodes.length <= i) {
          self.openNodes.push(nodesToOpen[i]);
        } else if (self.openNodes[i].id === nodesToOpen[i].id) {
          // same node, just modify the selected node
          self.openNodes[i].selectedChild = nodesToOpen[i].selectedChild;
        } else {
          self.openNodes[i] = nodesToOpen[i];
        }
      }
      if (self.openNodes.length > nodesToOpen.length) {
        self.openNodes = self.openNodes.slice(0, nodesToOpen.length);
      }
      if (self.treeProvider.selectionChanged) {
        self.treeProvider.selectionChanged(node);
      }
      self.render();
    } else {
      console.debug("node doesn't have path to root");
    }
  });
};

FileTree.prototype.onDropdownClicked = function(node, options) {
  if (this.hasDropdowns) {
    this.treeProvider.dropdownClicked(node, options);
  }
};

FileTree.prototype.onDraggingOver = function(node, domElement, panelIdx) {
  const self = this;

  // Don't open children if we're dragging a node over itself, as you can't drop it inside itself
  if (node.id === this.nodeBeingDragged.id) {
    return;
  }

  // Update the tree: unselect previous nodes, remove panels after this due to previous selection
  this.openNodes[panelIdx].selectedChild = node.id;
  const oldNodeHadChildren = this.openNodes.length > panelIdx + 1;
  this.openNodes = this.openNodes.slice(0, panelIdx + 1);
  if (node.hasChildren && oldNodeHadChildren) {
    // Leave an empty panel there instead of closing and reopening one
    this.openNodes.push(new OpenNode(node, []));
  }
  this.render();

  this.treeProvider.getChildren(node, function(children) {
    // Check that we're still being dropped over in case user quickly clicked something else
    if ($(domElement).hasClass('drop-hover')) {
      self.openNodes[panelIdx + 1] = new OpenNode(node, children);
      self.render();
    }
  });
};

/**
 * Have this FileTree push another element to the right as it expands. Used for the sidebar
 * file browser to push the content div right.
 */
FileTree.prototype.setPushElement = function(element) {
  this.pushElement = element;
};

/**
 * Re-query all open nodes from the TreeProvider and update the display.
 */
FileTree.prototype.refreshAllNodes = function() {
  const self = this;
  function updateNode(index, node, children) {
    const oldSelectedChild = self.openNodes[index].selectedChild;
    self.openNodes[index] = new OpenNode(node, children, oldSelectedChild);
    if (index + 1 < self.openNodes.length) {
      // See whether the next node is still available
      const nextId = self.openNodes[index + 1].id;
      let foundNext = false;
      const callback = function(node, result) {
        updateNode(index + 1, node, result);
      };
      for (let i = 0; i < children.length; i++) {
        if (children[i].id === nextId) {
          const childNode = children[i];
          self.treeProvider.getChildren(childNode, callback.bind(this, childNode));
          foundNext = true;
          break;
        }
      }
      if (!foundNext) {
        // Next nodes are gone, remove their panels
        self.openNodes = self.openNodes.slice(0, index + 1);
        self.render();
      }
    } else {
      self.render();
    }
  }
  if (this.openNodes.length > 0) {
    this.treeProvider.getChildren(this.rootNode, function(children) {
      updateNode(0, self.rootNode, children);
    });
  }
};

FileTree.prototype.onDrop = function(targetNode) {
  if (this.nodeBeingDragged !== null) {   // Might set to null if we cancelled drop
    const droppedNode = this.nodeBeingDragged;
    this.elementBeingDragged = null;
    this.nodeBeingDragged = null;
    this.treeProvider.nodeDropped(droppedNode, targetNode);
  }
};

/**
 * Return the selected leaf node as a TreeNode object, or undefined if none is selected
 */
FileTree.prototype.selectedNode = function() {
  if (this.openNodes.length > 0) {
    const node = this.openNodes[this.openNodes.length - 1];
    for (let i = 0; i < node.children.length; i++) {
      if (node.children[i].id === node.selectedChild) {
        return node.children[i];
      }
    }
  }
  return undefined;
};

/**
 * Return the selected folder as a TreeNode object, or undefined if none is selected
 */
FileTree.prototype.selectedFolder = function() {
  if (this.openNodes.length > 0) {
    return this.openNodes[this.openNodes.length - 1];
  }
  return undefined;
};

FileTree.prototype.remove = function() {
  // TODO: stop watching the tree
};

FileTree.prototype.isPinned = function() {
  return this.pinned;
};

// Key code for escape
FileTree.ESCAPE = 27;

module.exports = FileTree;
