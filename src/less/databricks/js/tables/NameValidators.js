/**
 * Tests if a given name is valid Hive table name. Valid hive table names can have
 * alphanumeric characters and underscore, and must start with a letter or underscore.
 */
export function isValidHiveTableName(tableName) {
  const revMatcher = /^[A-Za-z_][A-Za-z0-9_]*$/;
  return revMatcher.test(tableName) === true;
}

/**
 * Tests whether the given string name can be used as column name in table import.
 * While we support all characters that won't trigger errors in escaped form, it's
 * easier to provide supported set of commonly used ones than list all forbidden
 * characters.
 */
export function isValidTableColumnName(columnName) {
  const revMatcher = /[,`"';]/;
  return revMatcher.test(columnName) === false;
}
