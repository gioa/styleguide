import $ from 'jquery';
import _ from 'lodash';

const OPTION_METHOD = '(rpc).endpoints.method';
const OPTION_PATH = '(rpc).endpoints.path';
const OPTION_API_VERSION_MAJOR = '(rpc).endpoints.since.major';
const OPTION_API_VERSION_MINOR = '(rpc).endpoints.since.minor';
const API_BASE_ENDPOINT = '/ajax-api';

/*
 * Example Usage:
 *
 * import { InstanceProfilesProtos } from '../proto';
 * import { ProtoService } from '../requests/ProtoApi';
 *
 * const myProtoService = new ProtoService(InstanceProfilesProtos.InstanceProfilesService)
 * myProtoService.rpc('listInstanceProfiles')(null, (response) => {
 *   const protoResponse = new InstanceProfilesProtos.ListInstanceProfiles.Response(response);
 *   protoResponse.instance_profiles.forEach(...);
 * });
 *
 * const addRpcProto = new InstanceProfilesProtos.AddInstanceProfile(
 *   new InstanceProfilesProtos.InstanceProfile().setInstanceProfileArn("my-arn")
 * )
 * myProtoService.rpc('addInstanceProfile')(addRpcProto)
 */
export class ProtoService {
  constructor(serviceProto) {
    if (!serviceProto) {
      console.error('ServiceProto not found, proto file may be outdated');
    } else {
      this._service = new serviceProto();
    }
  }

  // recursively process (json_inline) option in proto RPC argument
  static flattenInlineAttributes(rpcProto, depth = 5) {
    if (depth < 0) {
      // the maximum recursion depth here is a safety check, in case people manually construct or
      // modified pbjs class instances to contain circular reference. Instead of throwing maximum
      // call stack size exceeded exception, we set the default maximum depth to 5 and log the
      // following error, assuming most RPC argument will not be deeper than that.
      console.error('Proto RPC Error: maximum recursion depth exceeded when flattening RPC arg');
      return null;
    }

    if (!rpcProto || !rpcProto.$type) {
      // return directly for 1) null/undefined; 2) primitive types(string, number); 3) non pbjs
      // generated objects
      return rpcProto;
    }

    if (!rpcProto.$type._fields) {
      console.error('Error parsing RPC proto object, rpcProto.$type._fields does not exist');
      return null;
    }

    const result = {};
    rpcProto.$type._fields.forEach((field) => {
      const name = field.name;
      // recursively process json_inline in sub fields
      result[name] = ProtoService.flattenInlineAttributes(rpcProto[name], depth - 1);

      // flatten child fields with json_inline option
      if (field.options && field.options['(json_inline)'] === true) {
        const copy = result[name];
        delete result[name];
        _.extend(result, copy);
      }
    });

    return result;
  }

  static encodeRpcJson(rpcProto) {
    if (!rpcProto) return null;
    // If rpcProto is not an instance of pbjs generated class
    if (!rpcProto.$type || !rpcProto.$type._fields) return JSON.stringify(rpcProto);
    // process inline_json attributes in pbjs instance
    return JSON.stringify(ProtoService.flattenInlineAttributes(rpcProto));
  }

  /**
   * @typedef {Function} rpcMethod
   * @param {object} rpcArg rpc argument, it should be an instance backed by pbjs generated class.
   *  Note that flattenInlineAttributes will recursively iterate through the fields in this object
   *  and the current maximum recursion depth is set to 5
   *
   * @param {Function} success RPC on success callback
   * @param {Function} error  RPC on error callback
   */

  /**
   * @param {String} rpcName name of the defined rpc in this proto service
   * @returns {rpcMethod}
   */
  rpc(rpcName) {
    if (!this._service || !this._service[rpcName]) {
      return () => {
        console.error(`RPC: ${rpcName} not found, proto file may be outdated`);
      };
    }

    // Note: Protobuf.js have not implement 'Service', thus parsing the rpc options and
    // convert to a ajax request
    const rpcOptions = this._service[rpcName].$options;
    const method = rpcOptions[OPTION_METHOD];
    const apiVersionMajor = rpcOptions[OPTION_API_VERSION_MAJOR];
    const apiVersionMinor = rpcOptions[OPTION_API_VERSION_MINOR];
    const basePath = `${API_BASE_ENDPOINT}/${apiVersionMajor}.${apiVersionMinor}`;
    const rpcPath = basePath + rpcOptions[OPTION_PATH];

    return (rpcArg, onSuccess, onFailure) =>
      $.ajax(rpcPath, {
        type: method,
        dataType: 'json',
        data: ProtoService.encodeRpcJson(rpcArg),
        success: onSuccess,
        error: onFailure,
      });
  }
}
