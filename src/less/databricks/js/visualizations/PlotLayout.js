/* eslint no-mixed-operators: 0, complexity: 0, func-names: 0 */

/**
 * Layout functionality for plots
 *
 * DEPENDENCIES: NONE
 */

const PlotLayout = {};

/**
 * Generates a square grid. The space between outer square
 * and the inner grid of squares is Gap.
 * The space between between grid cells is margin.
 * To guarantee that the resulting grid is completely symmetric and square it pick the
 * smaller one.
 * Generated using <http://www.asciiflow.com/>
 *
 *
 * <----------------------- Width ------------------------->
 * +-------------------------------------------------------+  ^
 * |                       ^                               |  |
 * |                       | Gap                           |  |
 * |                       v                               |  |
 * |    +---------------------------------------------+    |  |
 * |    | +------------------+   +------------------+ |    |  |
 * |    | |                  | M |                  | |    |  |
 * |    | |                  | a |                  | |    |  |
 * |    | |                  | r |                  | |    |  |
 * |    | |                  | g |                  | |    |  |
 * |    | |                  | i |                  | |    |  |
 * |    | |                  | n |                  | |    |  |
 * |    | |                  |   |                  | |    |  |
 * |<-> | +------------------+   +------------------+ |<-> |  Height
 * |Gap | +------------------+   +------------------+ |Gap |  |
 * |    | |                  |   |                  | |    |  |
 * |    | |                  |   |                  | |    |  |
 * |    | |                  |   |                  | |    |  |
 * |    | |                  |   |                  | |    |  |
 * |    | |                  |   |                  | |    |  |
 * |    | |                  |   |                  | |    |  |
 * |    | |                  |   |                  | |    |  |
 * |    | +------------------+   +------------------+ |    |  |
 * |    +---------------------------------------------+    |  |
 * |                            ^                          |  |
 * |                        Gap |                          |  |
 * |                            v                          |  v
 * +-------------------------------------------------------+
 * @param dimensions
 * @param width
 * @param height
 * @param margin
 * @param gap
 * @returns {Array}
 */
PlotLayout.getSquareGridLayout = function(dimensions, width, height, margin, gap) {
  const side = (width > height) ? height : width;
  const w = side - 2 * gap;

  const pCells = []; // each element in this array contains the coordinates of a grid cell.
  const cellDim = w / dimensions - margin;

  for (let row = 0; row < dimensions; row++) {
    for (let col = 0; col < dimensions; col++) {
      const cell = {
        index: pCells.length,
        row: row,
        col: col,
        x: gap + row * (cellDim + margin),
        y: gap + col * (cellDim + margin),
        width: cellDim,
        height: cellDim,
      };
      pCells.push(cell);
    }
  }
  return pCells;
};

/**
 * Generates the following grid.
 *                                              width
 * +------------------------------------------------------------------------------------------+
 * |       +-------------------------------------------------------------------------------+  |
 * |       |                                     ypad                                      |  |
 * |       |                                                                               |  |
 * |       +-------------------------------------------------------------------------------+  |
 * |+------+                                    gap                                           |
 * ||      |   +-------------------+      +---------------------+    +---------------------+  |
 * ||      |   |                   |  m   |                     |    |                     |  |
 * ||      |   |                   |  a   |                     |    |                     |  | h
 * ||      |   |                   |  r   |                     |    |                     |  | e
 * ||      |   |                   |  g   |                     |    |                     |  | i
 * ||      |   |                   |  i   |                     |    |                     |  | g
 * ||      |   +-------------------+  n   +---------------------+    +---------------------+  | h
 * ||  x   |                                                                                  | t
 * ||  p   |                                                                                  |
 * ||  a   |   +-------------------+      +---------------------+    +---------------------+  |
 * ||  d   |   |                   |      |                     |    |                     |  |
 * ||      |   |                   |      |                     |    |                     |  |
 * ||      |   |                   |      |                     |    |                     |  |
 * ||      |   |                   |      |                     |    |                     |  |
 * ||      |   |                   |      |                     |    |                     |  |
 * ||      |   |                   |      |                     |    |                     |  |
 * ||      |   +-------------------+      +---------------------+    +---------------------+  |
 * ||      |                                                                                  |
 * |+------+                                                                                  |
 * +------------------------------------------------------------------------------------------+
 *
 * @param n Number of panels in each row
 * @param m Number of panels in each column
 * @param xPad  Padding to the left of all panels
 * @param yPad  Padding to the top of all panels
 * @param width Width of the grid
 * @param height Height of the grid
 * @param margin Margin between panels (both horizontal and vertical)
 * @param gap  Space between panels and border of the grid
 * @returns {Array}
 */
PlotLayout.getGridLayout = function(n, m, xPad, yPad, width, height, margin, gap) {
  const w = width - 2 * gap - xPad;
  const h = height - 2 * gap - yPad;

  const pCells = []; // each element in this array contains the coordinates of a grid cell.
  const xDim = w / n - margin;
  const yDim = h / m - margin;

  for (let row = 0; row < m; row++) {
    for (let col = 0; col < n; col++) {
      const cell = {
        index: pCells.length,
        row: row,
        col: col,
        x: xPad + gap + col * (xDim + margin),
        y: yPad + gap + row * (yDim + margin),
        width: xDim,
        height: yDim,
      };
      pCells.push(cell);
    }
  }
  return pCells;
};


/**
 * Get the layout of up to four plots in a given rectangular area.
 * The dimension of all plots are identical.
 * Input arguments:
 * - numPlots: number of plots being displayed
 * - width: width of the display area
 * - height: height of the display area
 * - ar: aspect ratio, i.e., the ratio between the width and
 *   the height of the graph showed by a plot
 * - xMargin: total margin between the graph and the edges of the
 *   plot on x axis
 * - yMargin: total margin between the graph and the edges of the
 *   plot on y axis
 * - xGap: horizontal gap between a plot and the display area, or
 *   between two consecutive areas.
 * - yGap: vertical gap between a plot and the display area, or
 *   between two consecutive areas.
 * This function return an array of coordinates for each plot
 * Below is an example showing two
 *
 *                          width
 * ----------------------------------------------------------
 * |              ^                        ^                |
 * |              | yGap                   |yGap            |
 * |              v                        v                |
 * |    ----------------------     --------------------     |h
 * |    |            ^       |     |                  |     |e
 * |    |            |YMargin|     |                  |     |i
 * |    |            v       |     |            w     |     |g
 * |xGap|        ----------- |xGap |       -----------|xGap |h
 * |<-->|xMargin|            |<--->|      |           |<--->|t
 * |    |<----->|            |     |    h | ar = w/h  |     |
 * |    |       |            |     |      |           |     |
 * |    |       |            |     |      |           |     |
 * |    ----------------------     --------------------     |
 * |               ^                                        |
 * |               | yGap                                   |
 * |               v                                        |
 * ----------------------------------------------------------
 *
 */
PlotLayout.getLayout = function(numPlots, width, height, ar,
                                 xMargin, yMargin, xGap, yGap) {
  const pCells = []; // each element in this array contains the coordinates of a plot
  let i;

  if (numPlots === 1) {
    const w = ((width - 2 * xGap - xMargin) > ar * (height - 2 * yGap - yMargin) ?
      (height - 2 * yGap - yMargin) * ar : width - 2 * xGap - xMargin);

    pCells[0] = {
      x: (width - w - xMargin) / 2,  // center the plot on x...
      y: (height - w / ar - yMargin) / 2, // and y axes
      width: w + xMargin,
      height: w / ar + yMargin,
    };
  }


  let w1;
  let w2;
  let w3 = 0;

  if (numPlots === 2) {
    // try a horizontal layout...
    w1 = Math.min(ar * (height - 2 * yGap - yMargin), (width - 3 * xGap - 2 * xMargin) / 2);
    // ... and then a vertical layout
    w2 = Math.min(ar * (height - 3 * yGap - 2 * yMargin) / 2, width - 2 * xGap - xMargin);

    if (w1 > w2) { // horizontal layout provides biggest plots
      for (i = 0; i < numPlots; i++) {
        pCells[i] = {
          x: (width - 2 * w1 - 2 * xMargin - yGap) / 2,  // center the plot on x...
          y: (height - w1 / ar - yMargin) / 2, // and y axes
          width: w1 + xMargin,
          height: w1 / ar + yMargin,
        };
      }
      pCells[1].x = pCells[0].x + w1 + xMargin + xGap;
    } else { // vertical layout provides biggest plots
      for (i = 0; i < numPlots; i++) {
        pCells[i] = {
          x: (width - w2 - xMargin) / 2,  // center the plot on x...
          y: (height - 2 * w2 / ar - 2 * yMargin - yGap) / 2, // and y axes
          width: w2 + xMargin,
          height: w2 / ar + yMargin,
        };
      }
      pCells[1].y = pCells[0].y + w2 / ar + yMargin + yGap;
    }
  }

  if (numPlots === 3 || numPlots === 4) {
    // we try three layouts:
    // (1) a row of three/four plots
    w1 = Math.min(
      (height - yMargin - 2 * yGap),
      (width - numPlots * xMargin - (numPlots + 1) * xGap) / (ar * numPlots));
    // (2) two rows, the first containing one plot and the second
    // row showing two plots (if three plots), and two plots per row (if four plots)
    w2 = Math.min(
      (height - 2 * yMargin - 3 * yGap) / 2, (width - 2 * xMargin - 3 * xGap) / (2 * ar));
    // (3) three/four rows, each one containing on plot
    w3 = Math.min(
      (height - numPlots * yMargin - (numPlots + 1) * yGap) / numPlots,
      (width - xMargin - 2 * xGap) / ar);

    if (w1 >= Math.max(w2, w3)) { // horizontal layout provides biggest plots
      for (i = 0; i < numPlots; i++) {
        pCells[i] = {
          x: (width - numPlots * w1 * ar - numPlots * xMargin - (numPlots - 1) * xGap) / numPlots,
          y: (height - w1 - yMargin) / 2,
          width: w1 * ar + xMargin,
          height: w1 + yMargin,
        };
      }
      for (i = 1; i < numPlots; i++) {
        pCells[i].x = pCells[i - 1].x + w1 * ar + xMargin + xGap;
      }
    }

    if (w3 >= Math.max(w1, w2)) { // three rows layout provides biggest plots
      for (i = 0; i < numPlots; i++) {
        pCells[i] = {
          x: (width - w3 * ar - xMargin) / 2,
          y: (height - numPlots * w3 - numPlots * yMargin - (numPlots - 1) * yGap) / numPlots,
          width: w3 * ar + xMargin,
          height: w3 + yMargin,
        };
      }
      for (i = 1; i < numPlots; i++) {
        pCells[i].y = pCells[i - 1].y + w3 + yMargin + yGap;
      }
    }

    if (w2 >= Math.max(w1, w3)) { // two rows layout provides biggest plots
      for (i = 0; i < numPlots; i++) {
        pCells[i] = {
          x: (width - w2 * ar - xMargin) / 2,  // center the plot on x; assume numPlots == 3...
          y: (height - 2 * w2 - 2 * yMargin - yGap) / 2, // and y axes
          width: w2 * ar + xMargin,
          height: w2 + yMargin,
        };
      }

      pCells[numPlots - 2].x = (width - 2 * w2 * ar - 2 * xMargin - xGap) / 2;
      pCells[numPlots - 1].x = pCells[numPlots - 2].x + w2 * ar + xMargin + xGap;
      pCells[numPlots - 1].y = pCells[numPlots - 2].y = pCells[0].y + w2 + yMargin + yGap;

      if (numPlots === 4) {
        pCells[0].x = (width - 2 * w2 * ar - 2 * xMargin - xGap) / 2;
        pCells[1].x = pCells[0].x + w2 * ar + xMargin + xGap;
      }
    }
  }
  return pCells;
};

module.exports = PlotLayout;
