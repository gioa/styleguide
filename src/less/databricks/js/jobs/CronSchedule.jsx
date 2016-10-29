/* eslint react/no-did-mount-set-state: 0 */

import React from 'react';
import ReactDOM from 'react-dom';
import $ from 'jquery';
import '../../lib/jquery-cron';
import { Input, LabeledCheckbox } from '../forms/ReactFormElements.jsx';
import ElasticUtil from '../jobs/ElasticUtil';

/**
 * CronSchedule
 * Used to render a cron/timezone schedule selector dialog. It has three main components:
 *  1. A button row created by jquery-cron
 *  2. A button for choosing the show/hide a manual entry field.
 *  3. A manual entry field for modifying the cron syntax.
 *
 * It exposes a value() method that will return the currently selected cron value and timezone.
 */
export class CronSchedule extends React.Component {
  constructor(props) {
    super(props);

    this.onManualCronChange = this.onManualCronChange.bind(this);

    // Lock used to prevent the dialog and manual input from creating an update callback cycle
    // when one updates the other. This is needed because updating the cron dialog boxes causes
    // an onChange event to be fired.
    this.updateInProgress = false;

    this.state = {
      currentQuartz: this.props.currentQuartz || undefined,
      currentTimeZone: this.props.currentTimeZone || undefined,

      showCronSyntax: false,
      canCronDialogDisplay: true,
    };
  }

  componentDidMount() {
    let cronSchedule;
    if (this.state.currentQuartz) {
      cronSchedule = ElasticUtil.fromQuartzCronExpression(this.state.currentQuartz);
    }

    /**
     * @WARNING(jengler) 2016-03-03: We must allow the user to still submit crons even if the
     * cron jquery plugin does not recognize them. This is because we support "Quartz" cron and
     * not the more limited set supported by the plugin. So this is in a try/catch so we can detect
     * that the dialog does not support the cron value.
     * @see {@link http://www.quartz-scheduler.org/generated/2.2.2/html/qtz-all/}
     * @see {@link https://databricks.atlassian.net/browse/ES-56}
     */
    try {
      $(this._cronDialogContainer).cron({
        initial: cronSchedule,
        initialTimeZone: this.props.currentTimeZone || undefined,
        onChange: () => {
          const $dialog = $(this._cronDialogContainer);
          this.onDialogChange($dialog.cron('value'), $dialog.cron('timezone'));
        },
      });
    } catch (e) {
      // @HACK(jengler) 2016-03-03: This is to prevent the first "onChange" callback from the jquery
      // cron library from overriding the users quartz setting if they provided a prop.
      let ignoreFirstChange = Boolean(this.props.currentQuartz);
      $(this._cronDialogContainer).cron({
        onChange: () => {
          if (ignoreFirstChange) {
            ignoreFirstChange = false;
            return;
          }
          const $dialog = $(this._cronDialogContainer);
          this.onDialogChange($dialog.cron('value'), $dialog.cron('timezone'));
        },
      });

      this.setState({ canCronDialogDisplay: false });
    }
  }

  /**
   * @typedef {Object} CronScheduleValues
   * @property {string} quartzCronExpression - The quartz value of the current cron setting. Will
   *                                         will return empty string if none set.
   * @property {string} timeZoneId - The timeZone value of the current setting. Will
   *                                         will return empty string if none set.
   */
  /**
   * Get the currently set values for the dialog.
   *
   * @return {CronScheduleValues} The currently set schedule.
   */
  value() {
    return {
      // The return value names are to match the Job set schedule API names.
      quartzCronExpression: this.state.currentQuartz || '',
      timeZoneId: this.getCanonicalTimezone(this.state.currentTimeZone),
    };
  }

  /**
   * Get our canonical representation for the given timeZone. If no timeZone is provided, the
   * default US/Pacific timeZone will be returned. For Java compatibility, all UTC timeZones will
   * be changed to GMT.
   *
   * @param  {string} timeZone The timeZone to canonize
   * @return {string}          The timeZone string
   */
  getCanonicalTimezone(timeZone) {
    return timeZone ?
        timeZone.replace('UTC', 'GMT' /* for java compatibility */) : 'US/Pacific';
  }

  /**
   * Attempt to acquire the update lock. Used to prevent update cycles between event handlers.
   * If lockUpdates returns false, the caller should not attempt to update.
   * @WARNING(jengler) 2016-02-19: Make sure to call unlockUpdates() when finished updating or else
   * no one else can update.
   *
   * @return {bool} True if no update is already in progress, false if an update is in progress.
   */
  lockUpdates() {
    if (this.updateInProgress) {
      return false;
    }

    this.updateInProgress = true;
    return true;
  }

  /**
   * Unlock the updates lock.
   *
   * @return {none}
   */
  unlockUpdates() {
    this.updateInProgress = false;
  }

  /**
   * Helper for updating the value in the manual cron input text field. Makes sure that the field
   * is visible before trying to update.
   *
   * @param  {string} quartzExpr The new quartz express to put in the manual input.
   * @return {none}
   */
  updateManualInput(quartzExpr) {
    const manualInput = $(ReactDOM.findDOMNode(this)).find('#manualCronExpr');
    if (manualInput.length) {
      // We have to manually update the manual input if it is rendered. This is because the user
      // may have already changed the value and so it will not re-render when "defaultValue" is
      // changed. If the manual input is not visible, then we do not need to update since it will
      // get the correct "defaultValue" the next time it is rendered.
      manualInput.val(quartzExpr);
    }
  }

  /**
   * Callback for when the nice pretty dropdown menu dialog is changed. Responsible for converting
   * the value from the dialog into a quartzExpression, updating the manual input and then setting
   * the state with the new values.
   *
   * @param  {string} cronValue     The cron value to set as current state
   * @param  {string} timeZoneValue The timeZone value to set as current state
   *
   * @return {none}
   */
  onDialogChange(cronValue, timeZoneValue) {
    if (!this.lockUpdates()) {
      return;
    }

    const quartzExpr = ElasticUtil.toQuartzCronExpression(cronValue);

    this.updateManualInput(quartzExpr);

    const newState = {
      currentQuartz: quartzExpr,
      currentTimeZone: timeZoneValue,
      canCronDialogDisplay: true, // Assumes the inputs always output a valid cron syntax
    };
    this.setState(newState);

    this.unlockUpdates();
  }

  /**
   * Event handler for changes to the manual cron input text box. Will update the jquery cron
   * dialogs. If the given cron value is not supported by the jquery plugin, it will set the
   * canCronDialogDisplay state to false.
   *
   * @param  {string} value The cron string from the text input
   * @return {none}
   */
  onManualCronChange(value) {
    if (!this.lockUpdates()) {
      return;
    }

    // Have to use try/catch because the jquery-cron library throws exception for crons that it
    // does not support.
    try {
      // If we are able to update the cron dialog, then it is considered valid. This has
      // the side-effect of also updating the dialog to the current values.
      $(this._cronDialogContainer).cron(
        'value',
        ElasticUtil.fromQuartzCronExpression(value),
        this.state.currentTimeZone);

      this.setState({
        currentQuartz: value,
        canCronDialogDisplay: true,
      });
    } catch (error) {
      /**
       * @WARNING(jengler) 2016-03-03: We must allow the user to still submit crons even if the
       * cron jquery plugin does not recognize them. This is because we support "Quartz" cron and
       * not the more limited set supported by the plugin.
       * @see {@link http://www.quartz-scheduler.org/generated/2.2.2/html/qtz-all/}
       * @see {@link https://databricks.atlassian.net/browse/ES-56}
       */
      this.setState({
        currentQuartz: value,
        canCronDialogDisplay: false,
      });
    }

    this.unlockUpdates();
  }

  render() {
    const containerClasses =
      'dialog-cron-container' + (!this.state.canCronDialogDisplay ? ' cron-widget-invalid' : '');
    const refFunc = (ref) => this._cronDialogContainer = ref;
    const flipShowCronSyntax = () => this.setState({ showCronSyntax: !this.state.showCronSyntax });

    return (
      <div className='dialog-cron-wrapper'>
        <label htmlFor='cronDialogContainer'>
          Schedule
        </label>
        <div
          id='cronDialogContainer'
          ref={refFunc}
          className={containerClasses}
        >
        </div>
        <LabeledCheckbox
          ref='showManualCronExpr'
          checkboxID='showManualCronExpr'
          label={"Show Cron Syntax"}
          checkboxClassName='show-manual-cron'
          onChange={flipShowCronSyntax}
          defaultChecked={false}
        />
        {
          this.state.showCronSyntax ?
            <Input
              ref='manualCronExpr'
              type='text'
              inputID='manualCronExpr'
              defaultValue={this.state.currentQuartz}
              placeholder='Quartz cron syntax (e.g. * * * * * ?)'
              onChange={this.onManualCronChange}
            />
          :
            null
        }
      </div>
    );
  }
}
CronSchedule.propTypes = {
  currentQuartz: React.PropTypes.string,
  currentTimeZone: React.PropTypes.string,
};
