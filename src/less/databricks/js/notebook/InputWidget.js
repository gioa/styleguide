/**
 * InputWidget class that extends Widget superclass
 */

import Widget from '../notebook/Widget';

const InputWidget = Widget.extend({
  initialize() {
    Widget.prototype.initialize.call(this);
    this.set('type', this.get('type') || 'input');
    this.setIfMissing('label', null);
    this.setIfMissing('binding', null);
    this.setIfMissing('controlType', 'text');
    this.setIfMissing('choices', []);
    this.setIfMissing('globalVar', false);

    // Indicates whether this widget was part of a parameterized query that was natively executed
    // in the notebook (versus as part of a 'run' command) to determine whether it should be
    // affected by creation of global arguments
    // TODO(tjh) This is probably deprecated now that we have moved execution to the backend?
    this.setIfMissing('notebookNative', true);
  },
});

module.exports = InputWidget;
