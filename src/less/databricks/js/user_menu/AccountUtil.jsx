import $ from 'jquery';

export default class AccountUtil {
  static addUser(addUserProto, onSuccess, onFailure) {
    $.ajax('/accounts', {
      type: 'POST',
      data: addUserProto.encodeJSON(),
      success: onSuccess,
      error: onFailure,
    });
  }

  static inviteUser(inviteUserProto, onSuccess, onFailure) {
    $.ajax('/accounts/sendinvite', {
      type: 'POST',
      data: inviteUserProto.encodeJSON(),
      success: onSuccess,
      error: onFailure,
    });
  }
}
