/**
 * Helper functions for MapCodes
 */

import CountryCodeMap from '../visualizations/CountryCodeMap';
import StateCodeMap from '../visualizations/StateCodeMap';

const MapCodes = {};

// return fraction of items in the first column of "data" that are found in "codemap"
MapCodes.coverage = function coverage(data, codemap) {
  const inset = [];
  const outset = [];

  for (let i = 0; i < data.length; i++) {
    if (data[i][0].toUpperCase() in codemap) {
      inset.push(data[i][0]);
    } else {
      outset.push(data[i][0]);
    }
  }

  return { in: inset, out: outset };
};


// return fraction of items in the first column of "data" that are are US state postal codes
MapCodes.USStates = function USStates(codes) {
  return MapCodes.coverage(codes, StateCodeMap);
};

// return fraction of items in the first column of "data"
// that are country codes (ISO 3166-1 alpha-3)
MapCodes.World = function World(codes) {
  return MapCodes.coverage(codes, CountryCodeMap);
};

module.exports = MapCodes;
