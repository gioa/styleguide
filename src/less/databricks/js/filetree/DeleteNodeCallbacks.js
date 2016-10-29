import $ from 'jquery';

import ReactDialogBox from '../ui_building_blocks/dialogs/ReactDialogBox.jsx';

export class DeleteNodeCallbacks {
  /**
   * @param {LibraryModel} model: the model of the library to delete
   * @param {function} success: a success callback for the deletion ajax call
   * @return {function} ajax call to delete the given library
   */
  static getLibraryCallback(model, success) {
    const id = model.get('id');
    return () => {
      $.ajax('/libraries/' + id + '/delete', {
        contentType: 'application/json; charset=UTF-8',
        type: 'POST',
        data: '',
        error(jqXHR, textStatus, errorThrown) {
          const msg = 'An error happened while removing library ' + id + ':\n' + errorThrown;
          ReactDialogBox.alert(msg, false, 'OK');
        },
        success() {
          console.log('Successfully deleted library node ', id);
          // Call the specified callback if one is given
          if (success) {
            success();
          }
        },
      });
      model.destroy();
    };
  }

  static getTableCallback(model) {
    return () => {
      model.set({ icon: 'spinner fa fa-spin' });
      window.conn.wsClient.sendRPC('query', {
        data: {
          bindings: {},
          language: 'sql',
          query: 'drop table `' + model.get('name') + '`',
        },
      });
      window.router.navigate('', { trigger: true });
    };
  }
}
