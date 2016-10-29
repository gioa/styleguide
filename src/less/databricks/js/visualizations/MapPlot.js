/* eslint default-case: 0, no-mixed-operators: 0, callback-return: 0, complexity: 0, max-depth: 0,
consistent-return: 0, func-names: 0 */

/**
 * Class for creating MapPlot
 */
import $ from 'jquery';
import _ from 'underscore';
import d3 from 'd3';

import { ResourceUrls } from '../urls/ResourceUrls';

import Chart from '../visualizations/Chart';
import CountryCodeMap from '../visualizations/CountryCodeMap';
import Legend from '../visualizations/Legend';
import LegendConstants from '../visualizations/LegendConstants';
import MapCodes from '../visualizations/MapCodes';
import MapPlotConstants from '../visualizations/MapPlotConstants';
import StateCodeMap from '../visualizations/StateCodeMap';

const MapPlot = Chart.extend({
  constructor(parentElement) {
    Chart.call(this);
    this.width = 650;
    this.height = 260;
    this.parentElement = parentElement;
    this.svg = d3.select(parentElement).append('svg').attr({
      width: this.width,
      height: this.height,
      'class': 'chart',
    });

    // zoomArea is used to intercept the zoom and drag events
    // to manipulate the map
    this.zoomArea = this.svg.append('g');
    // mapArea represents the area used to draw the map
    this.mapArea = this.zoomArea.append('g');
    // legendArea represents the are that contains the legend
    // by appending it last, we make sure that the legend will
    // be always rendered on to of the map
    this.legendArea = this.zoomArea.append('g');

    // Buttons to zoom in and out
    this.buttons = this.svg.append('g');
    this.plusButton = this.buttons.append('g')
      .attr('class', 'map-zoom-button')
      .attr('width', 20)
      .attr('height', 20)
      .on('click', _.bind(this.zoomIn, this));
    this.plusButton.append('rect')
      .attr('width', 20)
      .attr('height', 20)
      .attr('rx', 3)
      .attr('ry', 3);
    this.plusButton.append('text')
      .text('+')
      .attr('x', 4)
      .attr('y', 15);

    this.minusButton = this.buttons.append('g')
      .attr('class', 'map-zoom-button')
      .attr('transform', 'translate(0,26)')
      .attr('width', 20)
      .attr('height', 20)
      .on('click', _.bind(this.zoomOut, this));
    this.minusButton.append('rect')
      .attr('width', 20)
      .attr('height', 20)
      .attr('rx', 3)
      .attr('ry', 3);
    this.minusButton.append('text')
      .html('&#8722;')
      .attr('x', 4)
      .attr('y', 15);

    // Remember old size to detect when we resized
    this.oldWidth = null;
    this.oldHeight = null;
  },

  showText(message) {
    this.svg.append('text')
      .attr('class', 'warning-msg')
      .text(message)
      .attr('x', '0px')
      .attr('y', 20 + 'px');
  },

  showMultilineText(messageArray) {
    for (let i = 0; i < messageArray.length; i++) {
      const x = '0x';
      const y = (20 + i * MapPlotConstants.LABEL_FONT_SIZE * LegendConstants.LINE_SPACING) + 'px';
      this.svg.append('text')
        .attr('class', 'warning-msg')
        .text(messageArray[i])
        .attr('x', x)
        .attr('y', y);
    }
  },

  // delete all message texts created by showText, and showMultilineText
  removeText() {
    this.svg.selectAll('.warning-msg').remove();
  },

  getCode(mapType, d) {
    switch (mapType) {
      case MapPlotConstants.TYPE_US:
        return d.properties.postal;
      case MapPlotConstants.TYPE_WORLD:
        return d.properties.adm0_a3;
      default:
        return undefined;
    }
  },

  // get label of the unit to be shown on the map
  getLabel(mapType, d) {
    switch (mapType) {
      case MapPlotConstants.TYPE_US:
        return d.properties.postal;
      case MapPlotConstants.TYPE_WORLD:
        return CountryCodeMap[d.properties.adm0_a3];
      default:
        return undefined;
    }
  },

  // get text to be shown in tooltip
  getTooltipText(mapType, d, valueColumnNames, dataByArea) {
    let label = '';
    let line;
    let maxLineLength = 0;
    let key;
    let name;

    switch (mapType) {
      case MapPlotConstants.TYPE_US:
        key = d.properties.postal;
        name = StateCodeMap[key];
        break;
      case MapPlotConstants.TYPE_WORLD:
        key = d.properties.adm0_a3;
        name = CountryCodeMap[key];
        break;
    }

    label = name;
    if (key in dataByArea) {
      const dataForArea = dataByArea[key];
      for (let j = 1; j <= valueColumnNames.length; j++) {
        if (valueColumnNames.length === 1) {
          line = ': ' + this.roundNumber(dataForArea[j]);
        } else {
          line = ', ' + valueColumnNames[j - 1] + ': ' + this.roundNumber(dataForArea[j]);
        }
        if (line.length > maxLineLength) {
          maxLineLength = line.length;
        }
        label += line;
      }
    }

    return { maxLineLength: maxLineLength, label: label };
  },

  // convert the strings in the 2nd column in "data" into numbers;
  // the first column in "data" contain the country/state codes
  getValue(mapType, d, data) {
    let code;

    switch (mapType) {
      case MapPlotConstants.TYPE_US:
        code = d.properties.postal;
        break;
      case MapPlotConstants.TYPE_WORLD:
        code = d.properties.adm0_a3;
        break;
    }

    // convert strings containing numbers to numbers
    for (let i = 0; i < data.length; i++) {
      if (data[i][0].toUpperCase() === code) {
        return parseFloat(data[i][1]);
      }
    }
    return undefined;
  },

  // compute ticks that cover the range comprising the
  // numerical values in the second column of "data";
  // the tick values are rounded
  getRangeTicks(data) {
    let rangeTicks = [];
    let i;

    // convert strings containing numbers to numbers
    const values = data.map((d) => parseFloat(d[1]));
    const maxValue = _.max(values);

    if (maxValue === 0) {
      return [0, 0];
    }

    // use d3's scale element to get nice ticks
    const scale = d3.scale.linear()
        .domain([0, maxValue]).nice(MapPlotConstants.MAX_TICKS);

    for (i = MapPlotConstants.MAX_TICKS; i > 0; i--) {
      rangeTicks = scale.ticks(i);
      if (rangeTicks.length < MapPlotConstants.MAX_TICKS) {
        break;
      }
    }
    if (rangeTicks.length === 1) {
      for (i = 0; i <= MapPlotConstants.MAX_TICKS; i++) {
        rangeTicks[i] = i * maxValue / MapPlotConstants.MAX_TICKS;
      }
    }

    return rangeTicks;
  },

  // return index into MapPlotConstants.TEXT_COLOR_SCALE, and
  // MapPlotConstants.FILL_COLOR_SCALE, respectively
  getColorIdx(val, rangeTicks) {
    if (val === undefined) {
      return val;
    }

    if (val < rangeTicks[0]) {
      return 0;
    }
    for (let i = 0; i < rangeTicks.length; i++) {
      if (val < rangeTicks[i]) {
        return i;
      }
    }
    if (val >= rangeTicks[rangeTicks.length - 1]) {
      return rangeTicks.length - 1;
    }

    return 0;
  },

  // init map projection
  initMapProjection(mapType, width, height) {
    let initScale;
    let maxZoom;
    let projection;
    let filemap;

    switch (mapType) {
      case MapPlotConstants.TYPE_US:
        initScale = Math.min(
        MapPlotConstants.SCALE_HEIGHT_US_ALBERSUSA * height,
        MapPlotConstants.SCALE_WIDTH_US_ALBERSUSA * width);

        maxZoom = Math.floor(8000 / initScale); // max zoom

        projection = d3.geo.albersUsa()
        .scale(initScale)
        .translate([width / 2, height / 2]);

        filemap = ResourceUrls.getResourceUrl('data/us-map.json');
        break;

      case MapPlotConstants.TYPE_WORLD:
        initScale = Math.min(
        MapPlotConstants.SCALE_HEIGHT_WORLD_MERCATOR * height,
        MapPlotConstants.SCALE_WIDTH_WORLD_MERCATOR * width);

        maxZoom = Math.floor(1500 / initScale); // max zoom

        projection = d3.geo.mercator()
        .scale(initScale)
        .translate([width / 2, 0.7 * height]);

        filemap = ResourceUrls.getResourceUrl('data/world-map.json');
        break;

    }

    return { initScale: initScale, maxZoom: maxZoom, projection: projection, filemap: filemap };
  },


  // ToDo: this should go into an util library
  // round number f to within 1% if a fraction; otherwise let it as it is
  roundNumber(f) {
    if (f === Math.floor(f)) {
      return f;
    }

    if (f < 1) {
      return f.toFixed(2);
    } else if (f < 100) {
      return f.toFixed(1);
    }
    return f.toFixed(0);
  },

  // main function -- show a heat map and legend
  // - mapType: either MapPlotConstants.TYPE_US, or MapPlotConstants.TYPE_WORLD
  // - data: table to be shown as a heat map
  //   - data[0]: column containing the country/state codes (see mapcodes.js)
  //   - data[1]: column containing values that are mapped onto different colors (with are
  //     then shown on the heat map)
  // - valueColumnNames - column names
  // - width of the map area
  // - height of the map area
  plotMap(mapType, data, valueColumnNames, width, height) {
    let i;
    const rangeTicks = this.getRangeTicks(data);

    let resized = false;
    if (width !== this.oldWidth || height !== this.oldHeight) {
      this.oldWidth = width;
      this.oldHeight = height;
      resized = true;
    }

    // Build a hash map for data by country / state.
    // This is used to check quickly whether we have data for a country / state or not.
    const dataByArea = {};
    for (i = 0; i < data.length; i++) {
      dataByArea[data[i][0].toUpperCase()] = data[i];
    }

    // compute legend's labels
    const legendSeries = [];
    legendSeries[0] = 'N/A';
    for (i = 0; i < rangeTicks.length - 1; i++) {
      legendSeries[i + 1] = rangeTicks[i] + '-' + rangeTicks[i + 1];
    }

    // maximum lable width in pixels
    const maxLabelWidth =
        Legend.getMaxLabelWidth(this.svg, legendSeries, MapPlotConstants.LABEL_FONT_SIZE);

    width -= maxLabelWidth;
    width -= 2 * MapPlotConstants.LEGEND_BORDER;
    width -= 2 * MapPlotConstants.LABEL_FONT_SIZE;

    const res = this.initMapProjection(mapType, width, height);

    const path = d3.geo.path()
        .projection(res.projection);

    const _this = this;

    this.loadMap(res.filemap, function(error, crtmap) {
      if (error) {
        this.mapArea.html('');
        return console.warn(error);
      }

      _this.showMap();

      const mapunits = _this.mapArea.selectAll('g.mapunits').data(crtmap.features);
      const mapUnitsLabels = _this.mapArea.selectAll('.mapunit-label').data(crtmap.features);
      let labelFontSize = $('.mapunit-label').css('font-size');

      const zoomed = function() {
        mapunits.attr('transform',
                      'translate(' + d3.event.translate + ')scale(' + d3.event.scale + ')');
        mapunits.selectAll('path').style('stroke-width', (1 / d3.event.scale) + 'px');

        mapUnitsLabels
          .attr('transform', function(d) {
            const pos = _this.adjustPos(mapType, _this.getCode(mapType, d),
                                      path.bounds(d), path.centroid(d));
            if (d3.event.scale > 1) {
              const center = [
                d3.event.translate[0] / (1 - d3.event.scale),
                d3.event.translate[1] / (1 - d3.event.scale),
              ];
              pos[0] = center[0] + (pos[0] - center[0]) * d3.event.scale;
              pos[1] = center[1] + (pos[1] - center[1]) * d3.event.scale;
            } else {
              pos[0] += d3.event.translate[0];
              pos[1] += d3.event.translate[1];
            }
            return 'translate(' + pos + ')';
          })
          .style('display', function(d) {
            const label = _this.getLabel(mapType, d);
            if (label === undefined || !(d.properties.adm0_a3 in dataByArea)) {
              return 'none';
            }
            const myScale = d3.event.scale * _this.width / 600;
            return ((_this.getFontSize(path.bounds(d), label) * myScale >=
                     labelFontSize || myScale >= res.maxZoom - 0.1) ? 'inline' : 'none');
          });
      };

      _this.zoom = d3.behavior.zoom()
        .translate([0, 0])
        .scale(1)
        .scaleExtent([1, res.maxZoom])
        .on('zoom', zoomed);

      // Add the map-overlay rectangle only if it does not exist
      const overlay = _this.mapArea.select('.map-overlay');
      if (overlay.empty()) {
        _this.mapArea.append('rect')
          .attr('class', 'map-overlay')
          .attr('width', width)
          .attr('height', height);
      }

      // Add the zoom behavior to the map area, but without mouse wheel events because
      // those mess up scrolling in the shell
      _this.mapArea.call(_this.zoom)
        .on('wheel.zoom', null);

      // Redraw everything at our new size if the control was resized
      if (resized) {
        _this.mapArea.selectAll('g.mapunits').remove();
        _this.mapArea.selectAll('.mapunit-label').remove();
      }

      // Add g's for new mapunits
      mapunits.enter().append('g')
        .attr('class', 'mapunits')
        .append('path')
        .attr('d', path)
        .style('fill', function(d) {
          return MapPlotConstants.FILL_COLOR_SCALE(
            _this.getColorIdx(_this.getValue(mapType, d, data), rangeTicks));
        });

      // Smoothly animate colors on old mapunits
      mapunits.select('path')
        .transition()
        .style('fill', function(d) {
          return MapPlotConstants.FILL_COLOR_SCALE(
            _this.getColorIdx(_this.getValue(mapType, d, data), rangeTicks));
        });

      // Update the mapunits' event handlers (for tooltips) to deal with the current data
      mapunits.on('mousemove', function(d) {
        // Update the tooltip position and value
        const tooltipTextElem = _this.getTooltipText(mapType, d, valueColumnNames, dataByArea);
        const tooltipText = tooltipTextElem.label;
        let tooltipFontSize = $('#tooltip p').css('font-size');
        tooltipFontSize = parseFloat(tooltipFontSize.slice(0, tooltipFontSize.length - 2));
        d3.select('#tooltip')
          .style(
            'left',
            (d3.event.pageX - (tooltipFontSize * tooltipTextElem.maxLineLength / 3)) + 'px'
          )
          .style('top', (d3.event.pageY - 2 * tooltipFontSize) + 'px')
          .select('#value')
          .text(tooltipText);
        // Show the tooltip
        d3.select('#tooltip').classed('hidden', false);
      })
        .on('mouseout', function() {
          // Hide the tooltip
          d3.select('#tooltip').classed('hidden', true);
        });

      // Hide the old tooltip in case it's out of date
      d3.select('#tooltip').classed('hidden', true);

      // Add texts for all mapunit labels
      mapUnitsLabels.enter().append('text')
        .attr('class', 'mapunit-label')
        .attr('transform', function(d) {
          const pos =
              _this.adjustPos(mapType, _this.getCode(mapType, d), path.bounds(d),
                              path.centroid(d));
          return 'translate(' + pos + ')';
        })
        .attr('dy', '.35em')
        .text(function(d) {
          return _this.getLabel(mapType, d);
        })
        .style('fill', function(d) {
          return MapPlotConstants.TEXT_COLOR_SCALE(
            _this.getColorIdx(_this.getValue(mapType, d, data), rangeTicks));
        });

      // Smoothly animate colors on map unit labels, and update their text
      mapUnitsLabels.transition()
        .text(function(d) {
          return _this.getLabel(mapType, d);
        })
        .style('fill', function(d) {
          return MapPlotConstants.TEXT_COLOR_SCALE(
            _this.getColorIdx(_this.getValue(mapType, d, data), rangeTicks));
        });

      if (labelFontSize === undefined) {
        labelFontSize = MapPlotConstants.LABEL_FONT_SIZE;
      } else {
        labelFontSize = parseFloat(labelFontSize.slice(0, labelFontSize.length - 2));
      }

      mapUnitsLabels
        .style('display', function(d) {
          const label = _this.getLabel(mapType, d);
          if (label === undefined || !(d.properties.adm0_a3 in dataByArea)) {
            return 'none';
          }
          const scale = _this.width / 600;
          const shouldShow = _this.getFontSize(path.bounds(d), label) * scale >= labelFontSize;
          return (shouldShow ? 'inline' : 'none');
        });

      if (_this.legendArea.select('.map-legend')[0][0] === null) {
        _this.legendArea.append('rect')
          .attr('class', 'map-legend');
      }

      const legendHeight =
          legendSeries.length * MapPlotConstants.LABEL_FONT_SIZE * LegendConstants.LINE_SPACING;
      const roundingRadius = 4;
      _this.legendArea.select('.map-legend')
        .attr('x', width)
        .attr('y', -4)
        .attr('width', maxLabelWidth + 2 * MapPlotConstants.LEGEND_BORDER +
              2 * MapPlotConstants.LABEL_FONT_SIZE + 2 * roundingRadius)
        .attr('height', legendHeight + MapPlotConstants.LEGEND_BORDER + 2 + roundingRadius)
        .attr('rx', roundingRadius)
        .attr('ry', roundingRadius);

      Legend.plotVerticalLegend(
        _this.legendArea,
        legendSeries,
        0,
        width + MapPlotConstants.LEGEND_BORDER,
        MapPlotConstants.LEGEND_BORDER, // (height - legendHeight)/2,
        MapPlotConstants.LABEL_FONT_SIZE,
        MapPlotConstants.FILL_COLOR_SCALE,
        false);
    });
  },

  // get upperbound of the average character width of "name" giving the "bounds"
  // of the country where name should fit
  getFontSize(bounds, name) {
    return Math.max(bounds[1][0] - bounds[0][0], bounds[1][1] - bounds[0][1]) / name.length;
  },

  // adjust positions of labels for selected countries (by default the labels
  // are anchored to the centroid. The problem is that the centroid falls in unexpected places
  // for countries that have multiple disjointed territories
  adjustPos(mapType, code, bounds, pos) {
    // compute the x, y position to display the country name;
    // by default the country name is displayed at its centroid's position;
    // for selected countries (e.g., one that have disjoint areas), adjust the position
    switch (mapType) {
      case MapPlotConstants.TYPE_WORLD:
        switch (code) {
          case 'USA':
            pos[0] += (bounds[1][0] - bounds[0][0]) * 0.15;
            pos[1] += (bounds[1][1] - bounds[0][1]) * 0.2;
            break;
          case 'CAN':
            pos[0] -= (bounds[1][0] - bounds[0][0]) * 0.15;
            pos[1] += (bounds[1][1] - bounds[0][1]) * 0.2;
            break;
          case 'NOR':
            pos[0] -= (bounds[1][0] - bounds[0][0]) * 0.3;
            pos[1] += (bounds[1][1] - bounds[0][1]) * 0.45;
            break;
          case 'FRA':
            pos[0] += (bounds[1][0] - bounds[0][0]) * 0.05;
            pos[1] -= (bounds[1][1] - bounds[0][1]) * 0.05;
            break;
        }
    }
    return pos;
  },


  plot(data, key, valueColumnNames, width, height) {
    Chart.prototype.plot.call(this, data, key, valueColumnNames, width, height);
    let mapType = 0;

    this.removeText();

    this.buttons.attr('transform', 'translate(4.5,4.5)');

    if (data.length < 1) {
      this.hideMap();
      this.showText('No data to plot.');
      return;
    }

    if (data[0].length < 1) {
      this.hideMap();
      this.showText('Need at least two columns to create a map.');
      return;
    }

    if (valueColumnNames.length > 1) {
      this.showText(
        'More than two numerical columns. Only the values of the first one will be shown.');
      this.buttons.attr('transform', 'translate(4.5,28.5)'); // Move down to make room for text
    }

    const rus = MapCodes.USStates(data);
    let msg;
    let i;

    if (rus.in > rus.out) {
      mapType = MapPlotConstants.TYPE_US;

      if (rus.out.length) {
        this.removeText();
        msg = 'Following states were not found: ';
        for (i = 0; i < rus.out.length; i++) {
          msg += rus.out[i];
          if (i < rus.out.length - 1) {
            msg += ', ';
          }
        }
        this.showText(msg);
        this.buttons.attr('transform', 'translate(4.5,28.5)'); // To make room for text
      }
    } else {
      const rworld = MapCodes.World(data);

      if (rworld.in > rworld.out) {
        mapType = MapPlotConstants.TYPE_WORLD;

        if (rworld.out.length) {
          this.removeText();
          msg = 'Following countries were not found: ';
          for (i = 0; i < rworld.out.length; i++) {
            msg += rworld.out[i];
            if (i < rworld.out.length - 1) {
              msg += ', ';
            }
          }
          this.showText(msg);
          this.buttons.attr('transform', 'translate(4.5,28.5)'); // To make room for text
        }
      } else {
        const msgArray = [];

        this.removeText();
        msgArray[0] =
          'Unrecognizable values in the first column. The values should be either ';
        msgArray[1] =
          'country codes in ISO 3166-1 alpha-3 format or US state postal codes';
        this.hideMap();
        this.showMultilineText(msgArray);
        return;
      }
    }

    // convert strings containing numbers to numbers
    for (i = 0; i < data.length; i++) {
      data[i][1] = parseFloat(data[i][1]);
      if (isNaN(data[i][1])) {
        this.hideMap();
        this.showText('Second column must contain numerical values');
        return;
      }
    }

    this.plotMap(mapType, data, valueColumnNames, this.width, this.height);
  },

  // Hide the map and zoom buttons
  hideMap() {
    this.buttons.style('display', 'none');
    this.zoomArea.style('display', 'none');
    this.mapArea.html('');
    this.zoom = null;
  },

  // Hide the map and zoom buttons
  showMap() {
    this.buttons.style('display', 'inline');
    this.zoomArea.style('display', 'inline');
  },

  // Zoom the plot by a given factor (>1 for zooming in and <1 for zooming out).
  // Fires the D3 zoom event so that listeners on that, such as the one that moves our labels,
  // will also fire.
  zoomBy(factor) {
    if (this.zoom) {
      // Clamp zooming to the scale's range
      const scale = this.zoom.scale();
      const scaleBounds = this.zoom.scaleExtent();
      const newScale = Math.min(scaleBounds[1], Math.max(scaleBounds[0], scale * factor));

      // Figure out new X and Y translation offsets to keep the center of map in the same place
      const x = this.zoom.translate()[0];
      const deltaX = (this.width / 2 - x) / scale;
      const newX = this.width / 2 - (deltaX * newScale);
      const y = this.zoom.translate()[1];
      const deltaY = (this.height / 2 - y) / scale;
      const newY = this.height / 2 - (deltaY * newScale);

      // Apply the new translation and scale, and fire the D3 zoom event to re-render the map
      this.zoom.scale(newScale);
      this.zoom.translate([newX, newY]);
      this.zoom.event(this.mapArea);
    }
  },

  // Zoom in when the plus button is clicked
  zoomIn() {
    this.zoomBy(1.5);
  },

  zoomOut() {
    this.zoomBy(1.0 / 1.5);
  },

  // Load a map from a JSON file URL, and call the given user callback with (error, map)
  // parameters based on whether the map was loaded (same semantics as d3.json).
  loadMap(filename, callback) {
    if (MapPlot.mapCache[filename]) {
      callback(null, MapPlot.mapCache[filename]);
    } else {
      d3.json(filename, function(error, map) {
        if (!error) {
          MapPlot.mapCache[filename] = map;
        }
        callback(error, map);
      });
    }
  },
});

// A cache for JSON files of constious maps
MapPlot.mapCache = {};

module.exports = MapPlot;
