/**
 * Basic controls for visualization of plots
 *
 * DEPENDENCIES: None
 */

const PlotControls = {
  displayTypeIcons: {
    table: 'fa fa-table',
    barChart: 'icon-db-bar',
    lineChart: 'icon-db-line',
    areaChart: 'fa fa-area-chart',
    pieChart: 'icon-db-pie',
    scatterPlot: 'icon-db-scatter',
    mapPlot: 'icon-db-map',
    quantilePlot: 'icon-db-quantile',
    histogram: 'icon-db-histogram',
    boxPlot: 'icon-db-boxplot',
    qqPlot: 'icon-db-qq',
    pivotTable: 'icon-db-pivot',
  },

  displayTypeNames: {
    table: 'Raw table',
    barChart: 'Bar chart',
    lineChart: 'Line chart',
    areaChart: 'Area chart',
    pieChart: 'Pie chart',
    scatterPlot: 'Scatter plot',
    mapPlot: 'World map',
    quantilePlot: 'Quantile plot',
    histogram: 'Histogram plot',
    boxPlot: 'Box plot',
    qqPlot: 'Q-Q plot',
    pivotTable: 'Pivot table',
  },

  displayTypeShortNames: {
    table: 'Raw',
    barChart: 'Bar',
    lineChart: 'Line',
    areaChart: 'Area',
    pieChart: 'Pie',
    scatterPlot: 'Scatter',
    mapPlot: 'Map',
    quantilePlot: 'Quantile',
    histogram: 'Histogram',
    boxPlot: 'Box plot',
    qqPlot: 'Q-Q plot',
    pivotTable: 'Pivot',
  },

  complexPlotTypes: ['barChart', 'lineChart', 'areaChart', 'pieChart', 'scatterPlot',
    'mapPlot', 'quantilePlot', 'histogram', 'boxPlot', 'pivotTable', 'qqPlot'],
};

module.exports = PlotControls;
