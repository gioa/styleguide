/**
 * We'll just use an empty model to represent the bindings in a dashboard, adding properties
 * and listeners to them through Backbone's standard mechanisms.
 *
 * DEPENDENCIES: Backbone
 */

import Backbone from 'backbone';

const Bindings = Backbone.Model.extend({});

module.exports = Bindings;
