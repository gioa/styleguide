/* eslint no-mixed-operators: 0, complexity: 0, func-names: 0 */

/**
 * Pivot table functionality
 *
 * DEPENDENCIES: NONE
 */
import _ from 'underscore';

const Pivot = {};

Pivot.MAX_OUTPUT_SERIES = 10; // Keep in sync with the series limit in ExecutionPlanner.

Pivot.sum = function(values) {
  let result = 0.0;
  for (let i = 0; i < values.length; i += 1) {
    result += values[i];
  }
  return result;
};

Pivot.avg = function(values) {
  if (values.length === 0) {
    return 0.0;
  }
  return Pivot.sum(values) / values.length;
};

Pivot.max = function(values) {
  if (values.length === 0) {
    return 0.0;
  }
  let result = values[0];
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] > result) {
      result = values[i];
    }
  }
  return result;
};

Pivot.min = function(values) {
  if (values.length === 0) {
    return 0.0;
  }
  let result = values[0];
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] < result) {
      result = values[i];
    }
  }
  return result;
};

Pivot.count = function(values) {
  if (values) {
    return values.length;
  }
  return 0;
};

// Figure out if we need to use the column metadata or not
Pivot.shouldUseMetadata = function(schema) {
  const columnsWithAggRole = _.filter(schema, (column) =>
    column.metadata.hasOwnProperty('aggRole')
  );
  return columnsWithAggRole.length > 0;
};

/**
 * Build a pivot table out of "data" by selecting the given X and Y columns, as well as
 * pivot columns, and aggregating values with the given aggregation function.
 */
Pivot.pivot = function(data, schema, xColumns, yColumns, pivotColumns, aggregationFunction) {
  let seriesLimitReached = false;
  let i;
  let j;

  const useMetadata = this.shouldUseMetadata(schema);

  // First, find the indices of the X, Y and pivot columns
  const xIndices = this.findIndices(schema, xColumns, useMetadata ? 'groupBy' : '');
  const yIndices = this.findIndices(schema, yColumns, useMetadata ? 'agg' : '');
  const pivotIndices = this.findIndices(schema, pivotColumns, useMetadata ? 'groupBy' : '');

  // Now build up the value for each key and y-column combination
  const keys = _.uniq(data.map(function(r) { return Pivot.extractFields(r, xIndices); }));
  const pivotVals = _.uniq(data.map(function(r) { return Pivot.extractFields(r, pivotIndices); }));

  // A unique identifier for each series, that includes both the pivot values and Y indices.
  const seriesIds = [];
  let numSeries = 0;
  for (i = 0; i < pivotVals.length; i++) {
    for (j = 0; j < yIndices.length; j++) {
      const id = pivotVals[i] + ' ' + yColumns[j];
      seriesIds.push(id);
      numSeries += 1;
      if (numSeries >= Pivot.MAX_OUTPUT_SERIES) {
        break;
      }
    }
    if (numSeries >= Pivot.MAX_OUTPUT_SERIES) {
      break;
    }
  }
  if (pivotVals.length * yIndices.length > Pivot.MAX_OUTPUT_SERIES) {
    seriesLimitReached = true;
    console.log('Pivoting would create', pivotVals.length * yIndices.length,
      'series, showing only the first', Pivot.MAX_OUTPUT_SERIES);
  }

  const pivotValToIndex = {};
  for (i = 0; i < pivotVals.length; i++) {
    pivotValToIndex[pivotVals[i]] = i;
  }

  // Group up the values for each key and series so we can aggregate them
  const keyToIndex = {};
  const groupedValues = [];
  const returnEmptyArray = function() { return []; };
  let lists;
  for (i = 0; i < keys.length; i++) {
    keyToIndex[keys[i]] = i;
    lists = _.range(numSeries).map(returnEmptyArray);
    groupedValues.push(lists);
  }
  for (i = 0; i < data.length; i++) {
    const d = data[i];
    const key = this.extractFields(d, xIndices);
    lists = groupedValues[keyToIndex[key]];
    const pivotVal = this.extractFields(d, pivotIndices);
    for (j = 0; j < yColumns.length; j++) {
      const seriesIndex = pivotValToIndex[pivotVal] * yColumns.length + j;
      if (seriesIndex < Pivot.MAX_OUTPUT_SERIES) {
        lists[seriesIndex].push(d[yIndices[j]]);
      }
    }
  }

  // Aggregate the values for each key to compute the final rows
  const transformedData = [];
  for (i = 0; i < keys.length; i++) {
    const row = new Array(numSeries + 1);
    row[0] = keys[i];
    for (j = 0; j < numSeries; j++) {
      row[j + 1] = aggregationFunction(groupedValues[i][j]);
    }
    transformedData.push(row);
  }

  // Human-readable series names
  let seriesNames = [];

  if (pivotIndices.length === 0) {
    seriesNames = yColumns.slice(0, numSeries);
  } else if (yIndices.length === 1) {
    seriesNames = pivotVals.slice(0, numSeries);
  } else {
    seriesNames = seriesIds.slice(0, numSeries);
  }

  /*
  if (yIndices.length === 1) {
    seriesNames = pivotVals.slice(0, numSeries);
  } else if (pivotIndices.length === 0) {
    seriesNames = yColumns.slice(0, numSeries);
  } else {
    seriesNames = seriesIds.slice(0, numSeries);
  }
  */

  return {
    seriesLimitReached: seriesLimitReached,
    data: transformedData,
    columns: seriesNames.map(this.trimString),
    key: xColumns.join(', '),
  };
};

Pivot.trimString = function(string) {
  const maxLength = 40;
  if (string.length > maxLength) {
    return string.substr(0, maxLength) + '...';
  }
  return string;
};

Pivot.findIndices = function(schema, columnNames, aggRole) {
  const colNameToIndex = {};
  for (let i = 0; i < schema.length; i++) {
    const column = schema[i];
    const colType = column.metadata.aggRole || '';
    colNameToIndex[column.name + colType] = i;
  }
  return columnNames.map(function(name) {
    return colNameToIndex[name + aggRole];
  });
};

/**
 * Extract the given indices from a data row, returning them as a comma-separated string
 */
Pivot.extractFields = function(row, indices) {
  return indices.map(function(i) { return row[i]; }).join(', ');
};

/**
 * Extract the given indices from a data row, returning them as an array.
 */
Pivot.extractFieldsRaw = function(row, indices) {
  return indices.map(function(i) { return row[i]; });
};

module.exports = Pivot;
