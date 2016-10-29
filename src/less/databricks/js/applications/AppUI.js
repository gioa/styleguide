
import Backbone from 'backbone';

const AppUI = Backbone.Model.extend({
  defaults: {
    applicationInstName: '',
    applicationType: '',
    id: '',
    uiUrl: '',
    state: '',
    session: '',
  },

  parse(response) {
    if (response) {
      const appInfo = response.applicationInfo;
      return {
        applicationInstName: appInfo.applicationInstName,
        applicationType: appInfo.applicationType.value,
        id: appInfo.id,
        logo: appInfo.logo,
        uiUrl: appInfo.instance ? appInfo.instance.uiUrl : '',
        state: appInfo.state.state.value,
        hostname: appInfo.instance ? appInfo.instance.uiUrl : '',
        session: response.session,
      };
    }
    return {};
  },

  url() {
    return '/appui/' + this.get('id');
  },
});

module.exports = AppUI;
