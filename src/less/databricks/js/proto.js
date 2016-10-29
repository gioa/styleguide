import ProtoBufJs from 'protobufjs';

const builder = ProtoBufJs.newBuilder();
if (window.customProtoJson) {
  // When in test-mode load the protobuf.json from a special location. See js_tests.bzl for the
  // protobuf.json setup as well as the HTML file that sets the window.jsTestMode flag.
  ProtoBufJs.loadJsonFile(window.customProtoJson, builder);
} else {
  ProtoBufJs.loadJsonFile('../proto/protobuf.json', builder);
}
const root = builder.build();

export const Protos = root.central;
export const NotebookProtos = root.notebook;
export const InstanceProfilesProtos = root.instanceProfiles;
