/* eslint complexity: 0, func-names: 0 */

/**
 * Utilities for parsing Hive schema strings (e.g. struct<a:int,b:string>) and applying them to
 * rows of data to give the fields names. This is used to "give back" schemas to the rows returned
 * by Spark SQL, which are sent as plain JSON arrays to avoid repeating column names.
 *
 * This file is used in some very old files outside of our tables component for parsing JSON data
 * for generic tables. Since that parsing is not HiveSchema-specific, we can have those components
 * stop using this file when we update them. For now, we will allow them to continue using this
 * file. However, we should not use HiveSchema for parsing generic JSON in any new code.
 */

const HiveSchema = {};

// Various data type classes we'll use to represent schemas

const StructType = function(fields) {
  this.fields = fields;
};

StructType.prototype.toString = function() {
  return 'struct<' + this.fields.join(',') + '>';
};

StructType.prototype.toJson = function() {
  return {
    type: 'struct',
    fields: this.fields.map(function(x) { return x.toJson(); }),
  };
};

const StructField = function(name, dataType) {
  this.name = name;
  this.dataType = dataType;
};

StructField.prototype.toString = function() {
  return this.name + ':' + this.dataType;
};

StructField.prototype.toJson = function() {
  return { name: this.name, type: this.dataType.toJson() };
};

const ArrayType = function(elementType) {
  this.elementType = elementType;
};

ArrayType.prototype.toString = function() {
  return 'array<' + this.elementType + '>';
};

ArrayType.prototype.toJson = function() {
  return { type: 'array', elementType: this.elementType.toJson() };
};

const MapType = function(keyType, valueType) {
  this.keyType = keyType;
  this.valueType = valueType;
};

MapType.prototype.toString = function() {
  return 'map<' + this.keyType + ',' + this.valueType + '>';
};

MapType.prototype.toJson = function() {
  return { type: 'map', keyType: this.keyType.toJson(), valueType: this.valueType.toJson() };
};

const UnionType = function(dataTypes) {
  this.dataTypes = dataTypes;
};

UnionType.prototype.toString = function() {
  return 'union<' + this.dataTypes.join(',') + '>';
};

// These are type mappings for atom types that differ between HiveSchema and the JSON schema.
const _jsonToHiveType = {
  'integer': 'int',
  'byte': 'tinyint',
  'short': 'smallint',
  'long': 'bigint',
};

// This is the inverse of _jsonToHiveType.
const _hiveTypeToJson = {};
for (const k in _jsonToHiveType) {
  if (!_jsonToHiveType.hasOwnProperty(k)) {
    continue;
  }
  const v = _jsonToHiveType[k];
  _hiveTypeToJson[v] = k;
}

const AtomType = function(typeName) {
  this.typeName = typeName;
};

AtomType.prototype.toString = function() {
  return _jsonToHiveType[this.typeName] || this.typeName;
};

AtomType.prototype.toJson = function() {
  return this.typeName;
};


HiveSchema.StructType = StructType;
HiveSchema.StructField = StructField;
HiveSchema.ArrayType = ArrayType;
HiveSchema.MapType = MapType;
HiveSchema.UnionType = UnionType;
HiveSchema.AtomType = AtomType;

const IDENTIFIER_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ01234567890_';

HiveSchema.parseJson = function(data) {
  if (data.type === 'struct') {
    const fields = data.fields || [];
    return new StructType(fields.map(function(field) {
      return new StructField(field.name, HiveSchema.parseJson(field.type));
    }));
  } else if (data.type === 'array') {
    return new ArrayType(HiveSchema.parseJson(data.elementType));
  } else if (data.type === 'map') {
    return new MapType(
      HiveSchema.parseJson(data.keyType), HiveSchema.parseJson(data.valueType));
  }
  // Note: invalid input will fall under this case and apply will just pass the object through.
  return new AtomType(data);
};

/**
 * Parse a schema string as returned by Hive and return one of the *Type classes in HiveSchema.
 * For example, given "struct<a:array<int>,b:string>" as the input, this would return
 * StructType(StructField(a,ArrayType(int)),StructField(b,string))
 */
HiveSchema.parse = function(input) {
  try {
    return HiveSchema._parseInternal(input);
  } catch (err) {
    // When we call apply, this will just pass the object through.
    return new HiveSchema.AtomType('invalid type');
  }
};

HiveSchema._parseInternal = function(input) {
  let pos = 0;  // Position we are at in parsing the string

  /** Parse the next identifier starting at pos in schemaString */
  const parseIdentifier = function() {
    const start = pos;
    while (pos < input.length && IDENTIFIER_CHARS.indexOf(input[pos]) !== -1) {
      pos++;
    }
    if (pos === start) {
      throw new Error(
        'Invalid schema string: ' + input + ', expected identifier at position ' + pos);
    }
    return input.substring(start, pos);
  };

  /** Consume a given character next, or raise an error if it's not there */
  const consume = function(char) {
    if (pos === input.length || input[pos] !== char) {
      throw new Error(
        'Invalid schema string: ' + input + ', expected ' + char + ' at position ' + pos);
    }
    pos++;
  };

  /** Parse the next data type starting at pos in schemaString */
  const parseType = function() {
    if (input.substring(pos, pos + 7) === 'struct<') {
      pos += 7;
      const fields = [];
      while (input[pos] !== '>') {
        const name = parseIdentifier();
        consume(':');
        const type = parseType();
        fields.push(new StructField(name, type));
        if (input[pos] !== '>') {
          consume(',');
        }
      }
      consume('>');
      return new StructType(fields);
    } else if (input.substring(pos, pos + 6) === 'array<') {
      pos += 6;
      const elementType = parseType();
      consume('>');
      return new ArrayType(elementType);
    } else if (input.substring(pos, pos + 4) === 'map<') {
      pos += 4;
      const keyType = parseType();
      consume(',');
      const valueType = parseType();
      consume('>');
      return new MapType(keyType, valueType);
    } else if (input.substring(pos, pos + 6) === 'union<') {
      pos += 6;
      const types = [];
      while (input[pos] !== '>') {
        types.push(parseType());
        if (input[pos] !== '>') {
          consume(',');
        }
      }
      consume('>');
      return new UnionType(types);
    } else if (input.substring(pos, pos + 8) === 'decimal(') {
      // com.databricks.backend.daemon.driver.JsonUtils.convertRowsToLists currently converts
      // decimals to doubles. Keep this parser in sync with that representation.
      pos += 8;
      const p = parseIdentifier();
      if (input[pos] === ')') {
        consume(')');
        return new AtomType('decimal(' + p + ')');
      }
      consume(',');
      const s = parseIdentifier();
      consume(')');
      return new AtomType('decimal(' + p + ',' + s + ')');
    }
    const id = parseIdentifier();
    return new AtomType(_hiveTypeToJson[id] || id);
  };

  const result = parseType();
  if (pos < input.length) {
    throw new Error('Invalid schema string: ' + input);
  }
  return result;
};

/**
 * Apply a given schema (one of our *Type objects) to a row represented as a raw array of
 * fields, as returned by our backend. Returns an object with the right field names for fields.
 * If the schema is for an atomic type, this method can also be called on atomic objects.
 *
 * For example, given the row [1, 2] and the schema struct<a:int,b:int>, this will return the
 * JavaScript object {a: 1, b: 2}.
 */
HiveSchema.apply = function(row, schema) {
  let i;
  if (!row) {
    return row;
  }
  if (schema instanceof StructType) {
    const obj = {};

    // TODO(Chaoyu): this is for handling unexpected data format from backend, see PROD-9827
    if (typeof row.values === 'object') {
      row = row.values;
    }

    for (i = 0; i < schema.fields.length; i++) {
      obj[schema.fields[i].name] = HiveSchema.apply(row[i], schema.fields[i].dataType);
    }
    return obj;
  } else if (schema instanceof ArrayType) {
    const arr = new Array(row.length);
    for (i = 0; i < row.length; i++) {
      arr[i] = HiveSchema.apply(row[i], schema.elementType);
    }
    return arr;
  } else if (schema instanceof MapType) {
    const map = {};
    for (const key in row) {
      if (row.hasOwnProperty(key)) {
        // Maps in Hive only have primitive keys so no need to convert the key
        map[key] = HiveSchema.apply(row[key], schema.valueType);
      }
    }
    return map;
  }
  // For both AtomType and UnionType, just return the original format of the data;
  // we might want to change this for UnionType but it's hard to infer the right type.
  return row;
};

module.exports = HiveSchema;
