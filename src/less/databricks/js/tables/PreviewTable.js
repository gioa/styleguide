import Backbone from 'backbone';

const TablePreview = Backbone.Model.extend({
  defaults: {
    rows: [],
    // Schema is the parsed HiveSchema.
    schema: {},
    colNames: [],
    colTypes: [],
    canModifySchema: false,
    cTypes: ['STRING',
      'TIMESTAMP',
      'BOOLEAN',
      'BINARY',
      'TINYINT',
      'SMALLINT',
      'INT',
      'BIGINT',
      'FLOAT',
      'DOUBLE'],
  },

  /**
   * Updates rows of the preview, as well as column names and data types.
   */
  updateRowsAndSchema(rows, schema) {
    const names = [];
    const types = [];

    for (let i = 0; i < schema.length; i++) {
      names[i] = schema[i].name;
      // The UI for column types deals with the Hive type string.
      types[i] = schema[i].type.toString();
    }

    this.set({
      'rows': rows,
      'schema': schema,
      'colNames': names,
      'colTypes': types,
    });
  },

  /**
   * Called by the view to update column names with user input
   */
  updateColNames(cols) {
    this.set({ colNames: cols }, { silent: true });
  },

  /**
   * Called by the view to update column types with user input
   */
  updateColTypes(cols) {
    this.set({ colTypes: cols }, { silent: true });
  },
});

module.exports = TablePreview;
