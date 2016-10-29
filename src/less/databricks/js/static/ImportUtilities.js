const ImportUtilities = {};

/**
 * IMPORTANT: Keep this file in sync with ExternalSchemaV1.scala
 */

/**
 * Convert a notebook exported as an ExternalNotebookV1 json to the current internal json
 * schema (as understood by the frontend).
 *
 * Note: this method mutates the input argument. If you wish to preserve it, clone it first.
 *
 * @return {notebook: internalNotebookJson, commands: [internalCommandJson, ... ]}
 */
ImportUtilities.importNotebookV1 = function importNotebookV1(externalNotebookV1Json) {
  const commands = externalNotebookV1Json.commands || [];
  commands.forEach((command) => ImportUtilities.importCommandV1(command));
  const dashboards = externalNotebookV1Json.dashboards || [];
  dashboards.forEach((dashboard) => ImportUtilities.importDashboardViewV1(dashboard));

  const notebook = externalNotebookV1Json;
  notebook.id = notebook.origId;
  notebook.type = 'shell';
  notebook.commands = null;
  notebook.dashboards = null;

  return {
    notebook: notebook,
    commands: commands,
    dashboards: dashboards,
  };
};

/**
 * Convert a command exported as an ExternalCommandV1 json to the current internal json
 * schema (as understood by the frontend).
 *
 * Note: this method mutates the input argument. If you wish to preserve it, clone it first.
 */
ImportUtilities.importCommandV1 = function importCommandV1(externalCommandV1Json) {
  externalCommandV1Json.id = externalCommandV1Json.origId;
  externalCommandV1Json.type = 'command';
  // we don't assign a new guid to the command so that %run subnode references don't break
  return externalCommandV1Json;
};

/**
 * Convert a dashboard exported as an ExternalDashboardV1 json to the current internal json
 * schema (as understood by the frontend).
 *
 * Note: this method mutates the input argument. If you wish to preserve it, clone it first.
 */
ImportUtilities.importDashboardViewV1 = function importDashboardViewV1(json) {
  json.id = json.origId;
  json.type = 'dashboardView';
  return json;
};

module.exports = ImportUtilities;
