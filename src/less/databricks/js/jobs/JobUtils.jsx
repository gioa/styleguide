import $ from 'jquery';

import DeprecatedDialogBox from '../ui_building_blocks/dialogs/DeprecatedDialogBox';

export const TriggerType = { };
TriggerType.PERIODIC = 'PERIODIC';
TriggerType.ONE_TIME = 'ONE_TIME';
TriggerType.RETRY = 'RETRY';

export class JobUtils {
  static formatRunTriggerString(trigger) {
    if (trigger === TriggerType.PERIODIC) {
      return 'By scheduler';
    } else if (trigger === TriggerType.RETRY) {
      return 'By retry scheduler';
    }
    return 'Manually';
  }

  /**
   * This function is an onClick handler that deletes a job
   */
  static getDeleteJobClickHandler(id, name) {
    return (e) => {
      e.preventDefault();
      DeprecatedDialogBox.confirm({
        message: `Are you sure you want to delete '${name}'? This action cannot be undone.`,
        confirm: () => {
          $.ajax('/jobs/remove', {
            type: 'POST',
            data: id.toString(),
            error(xhr, status, error) {
              $(e.target).removeClass('link-active');
              DeprecatedDialogBox.alert('Request failed: ' + error);
            },
          });
          $(e.target).addClass('link-active');
          window.router.navigate('#joblist', { trigger: true });
        },
      });
    };
  }
}
