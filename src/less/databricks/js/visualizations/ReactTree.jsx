/* eslint react/prefer-es6-class: 0, func-names: 0 */

import _ from 'underscore';
import d3 from 'd3';

import React from 'react';

const ReactTree = React.createClass({

  propTypes: {
    // The data for the tree, stored in a tabular form
    tabularData: React.PropTypes.array.isRequired,
  },

  statics: {
    createD3(parentElement, boxWidth, boxHeight) {
      const margin = { top: 25, right: 5, bottom: 5, left: 5 };
      const width = boxWidth - margin.right - margin.left;
      const height = boxHeight - margin.top - margin.bottom;

      const svg = d3.select(parentElement).append('svg').attr({
        width: boxWidth,
        height: boxHeight,
        'class': 'chart ml-tree',
      }).append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      const tree = d3.layout.tree().size([height, width]);

      return {
        d3Tree: tree,
        svg: svg };
    },

  },

  componentWillReceiveProps(nextProps) {
    this.updateData(nextProps);
    this.updateD3();
  },

  componentDidMount() {
    this.updateData();
    const elems = ReactTree.createD3(this.getDOMNode(), this.treeWidth, this.treeHeight);
    this.svg = elems.svg;
    this.d3Tree = elems.d3Tree;
    this.updateD3();
  },

  // Updates the data.
  updateData(props) {
    if (!this.treeHeight) {
      this.treeHeight = 1000;
      this.treeWidth = 1600;
    }
    if (!this.tree) {
      props = this.props;
    }
    if (props) {
      this.tree = this.reconstructTree(props.tabularData);
      this.nodeCount = 0;
    }
  },

  componentDidUpdate() {
    this.componentDidMount();
  },

  shouldComponentUpdate() { return false; },

  reconstructTree(tabularData) {
    const nodes = _.map(tabularData, function(r) {
      return JSON.parse(r[0]);
    });
    return this.reconstructTreeHelper(nodes);
  },

  // Builds the D3 tree that contains the data
  reconstructTreeHelper(nodes) {
    if (nodes.length === 0) {
      console.error('missing data when reconstructing the tree');
      return null;
    }
    const node = nodes[0];
    // This is a leaf node
    if (nodes.length === 1) {
      return {
        name: d3.format('g')(node.prediction),
      };
    }
    // Split into the left and the right nodes
    const leftNodes = _.filter(nodes, function(n) {
      return n.index < node.index;
    });
    const rightNodes = _.filter(nodes, function(n) {
      return n.index > node.index;
    });
    const children = [];
    if (leftNodes.length > 0) {
      children.push(this.reconstructTreeHelper(leftNodes));
    }
    if (rightNodes.length > 0) {
      children.push(this.reconstructTreeHelper(rightNodes));
    }
    let split = '';
    let categorical = false;
    if (node.threshold !== undefined && node.threshold !== null) {
      split = d3.format('.2e')(node.threshold);
    }
    if (node.categories) {
      categorical = true;
      console.error('categories', node.categories);
      split = String(node.categories);
    }
    return {
      name: 'feature: ' + node.feature,
      split: split,
      children: children,
      categorical: categorical,
    };
  },

  updateD3() {
    if (!this.tree) {
      return;
    }
    this.tree.x0 = this.treeHeight / 2;
    this.tree.y0 = 0;
    this.updateD3Tree(this.tree);
  },

  updateD3Tree(dataTree) {
    const self = this;
    const duration = 0;
    const diagonal = d3.svg.diagonal()
      .projection(function(d) { return [d.x, d.y]; });


    const nodes = this.d3Tree.nodes(this.tree).reverse();
    const links = this.d3Tree.links(nodes);

    // Normalize for fixed-depth.
    nodes.forEach(function(d) { d.y = d.depth * 100; });

    const maxDepth = function() {
      let m = 0;
      nodes.forEach(function(d) { m = Math.max(m, d.depth); });
      return m;
    };

    const maxWidth = function() {
      const arities = {};
      nodes.forEach(function(d) {
        if (!arities[d.depth]) {
          arities[d.depth] = 1;
        } else {
          arities[d.depth] += 1;
        }
      });
      let res = 0;
      _.each(arities, function(x) { res = Math.max(x, res); });
      return res;
    };

    const updateNodeText = function(d3Elem) {
      return d3Elem.attr('y', function(d) { return d.children ? -15 : 15; })
        .text(function(d) { return d.name; });
    };

    d3.select(this.getDOMNode()).selectAll('svg')
      .attr('height', function() {
        const d = maxDepth();
        return Math.max((d * 110) + 100, 300);
      }).attr('width', function() {
        const d = maxWidth();
        return Math.max((d * 50) + 200, 1000);
      });

    // Update the nodes…
    const node = this.svg.selectAll('g.node')
      .data(nodes, function(d) {
        if (d.id) {
          return d.id;
        }
        self.nodeCount++;
        d.id = self.nodeCount;
        return d.id;
      });

    // Enter any new nodes at the parent's previous position.
    const nodeEnter = node.enter().append('g')
      .attr('class', 'node')
      .attr('transform', function() {
        return 'translate(' + dataTree.x0 + ',' + dataTree.y0 + ')';
      });

    nodeEnter.append('circle')
      .attr('class', 'ml-circle')
      .attr('r', 1e-6);

    updateNodeText(nodeEnter.append('text'));

    // Transition nodes to their new position.
    const nodeUpdate = node.transition()
      .duration(duration)
      .attr('transform', function(d) { return 'translate(' + d.x + ',' + d.y + ')'; });

    nodeUpdate.select('circle')
      .attr('class', function(d) { return d.children ? 'internal' : 'leaf'; })
      .attr('r', 7);

    updateNodeText(nodeUpdate.select('text')
      .style('fill-opacity', 1));


    // Transition exiting nodes to the parent's new position.
    const nodeExit = node.exit().transition()
      .duration(duration)
      .remove();

    nodeExit.select('circle')
      .attr('r', 1e-6);

    nodeExit.select('text');

    // Update the links…
    const link = this.svg.selectAll('path.link')
      .data(links, function(d) { return d.target.id; });

    const linklabel = this.svg.selectAll('.linklabel')
      .data(links, function(d) { return d.target.id; });

    // Enter any new links at the parent's previous position.
    link.enter().insert('path', 'g')
      .attr('class', 'link')
      .attr('id', function(d) { return 'link-' + d.source.id + '-' + d.target.id; })
      .attr('d', function() {
        const o = { x: dataTree.x0, y: dataTree.y0 };
        return diagonal({ source: o, target: o });
      });

    const labels = linklabel.enter()
      .append('text');


    const fillLabels = function(d3Elem) {
      return d3Elem.attr('x', function(d) {
        const l = d.source.split.length | 2;
        const dx = -0.5 * l * 5; // 3 px / letter
        return ((d.source.x + d.target.x) / 2) + dx;
      }).attr('y', function(d) {
        // To prevent overlaps of the label, wiggle up or down depending on the direction of the
        // label.
        // Is it a link going to the left?
        const isLeft = d.source.x > d.target.x;
        const dy = isLeft ? 8 : -8;
        return ((d.source.y + d.target.y) / 2) + dy;
      }).text(function(d) {
        // The split may be a useless split; in which case there is no need to display a label.
        if (d.source.children[0].name === d.source.children[1].name) {
          return '';
        }
        if (d.source.children[0].name === d.target.name &&
            (d.target.split === undefined || d.source.children[0].split === d.target.split)) {
          if (d.source.categorical) {
            return '\u2208 [' + d.source.split + ']';
          }
          return '<=' + d.source.split;
        }
        if (d.source.categorical) {
          return '\u2209 [' + d.source.split + ']';
        }
        return '>' + d.source.split;
      });
    };


    fillLabels(labels.attr('class', 'linklabel')
      .attr('id', function(d) { return 'linklabel' + d.source.id + '-' + d.target.id; }));

    // Transition links to their new position.
    link.transition()
      .duration(duration)
      .attr('d', diagonal);

    fillLabels(linklabel.transition());

    // Transition exiting nodes to the parent's new position.
    link.exit().transition()
      .attr('d', function() {
        const o = { x: dataTree.x, y: dataTree.y };
        return diagonal({ source: o, target: o });
      })
      .remove();

    linklabel.exit().remove();

    // Stash the old positions for transition.
    nodes.forEach(function(d) {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  },

  render() {
    return (<div />);
  },
});

module.exports = ReactTree;
