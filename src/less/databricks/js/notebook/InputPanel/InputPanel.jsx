
import _ from 'lodash';
import $ from 'jquery';
import React from 'react';
import ReactDOM from 'react-dom';
import ClassNames from 'classnames';

import { LabeledCheckbox, Select } from '../../forms/ReactFormElements.jsx';
import ReactFormFooter from '../../forms/ReactFormFooter.jsx';

import LocalUserPreference from '../../local_storage/LocalUserPreference';

import InputWidgetManager from '../InputWidgetManager';
import NotebookConstants from '../NotebookConstants';
import WidgetView from './WidgetView.jsx';

import ReactModal from '../../ui_building_blocks/dialogs/ReactModal.jsx';
import ReactModalUtils from '../../ui_building_blocks/dialogs/ReactModalUtils';

const AUTO_RUN_OPTIONS = [
  { label: 'Run Notebook', value: NotebookConstants.AUTO_RUN_ALL },
  { label: 'Run Accessed Commands', value: NotebookConstants.AUTO_RUN_ACCESSED_COMMAND },
  { label: 'Do Nothing', value: NotebookConstants.AUTO_RUN_NO_OP },
];

/**
 * Render the input widgets as list items
 *
 * @param  {InputWidgetManager} inputMgr
 * @param String autRunOption
 * @return {HTMLElement[]} An array of <li> elements.
 */
export function renderWidgetLists(inputsMgr, autoRunOption) {
  const inputWidgets = inputsMgr.getAllInputWidgetsList();
  return (<ul>{
    _.map(inputWidgets, (widget) => {
      const argName = widget.widgetInfo && widget.widgetInfo.name;
      if (!argName) {
        console.error('Wrong input widget format: ', widget);
        return null;
      }
      return (<li key={`widget-widget-li-${argName}`}>
        <WidgetView
          inputsMgr={inputsMgr}
          argName={argName}
          widget={widget}
          autoRunOption={autoRunOption}
        />
      </li>);
    })
  }</ul>);
}

export class NotebookInputPanel extends React.Component {
  constructor(props) {
    super(props);

    this.togglePinned = this.togglePinned.bind(this);
    this.updateAutoRunOption = this.updateAutoRunOption.bind(this);
    this.configInputPanel = this.configInputPanel.bind(this);

    this.localPrefs = new LocalUserPreference(this.props.inputsMgr.notebookGuid());
    // default pinned: true
    const pinned = this.localPrefs.get('pinInputPanel') !== false;
    this.state = {
      pinned: pinned,
      autoRun: this.localPrefs.get('autoRunOnWidgetChange') ||
        NotebookConstants.AUTO_RUN_ACCESSED_COMMAND,
    };
  }

  getDisplayHeight() {
    return this.isEmpty() ? 0 : $(ReactDOM.findDOMNode(this)).outerHeight();
  }

  togglePinned() {
    const pinned = !this.state.pinned;
    this.localPrefs.set('pinInputPanel', pinned);
    this.setState({ 'pinned': pinned });
  }

  updateAutoRunOption(newAutoRunOption) {
    this.localPrefs.set('autoRunOnWidgetChange', newAutoRunOption);
    this.setState({ 'autoRun': newAutoRunOption });
  }

  isEmpty() {
    return this.props.inputsMgr.isEmpty();
  }

  configInputPanel() {
    const body = (
      <div className='input-widget-panel-settings-modal'>
        <span className='select-label'>On Widget Change:</span>
        <Select
          selectID='input-widget-panel-on-widget-update'
          defaultValue={this.state.autoRun}
          options={AUTO_RUN_OPTIONS}
          onChange={this.updateAutoRunOption}
        />
        <LabeledCheckbox
          checkboxID='input-widget-panel-pinned-checkbox'
          label='Pinned to top'
          defaultChecked={this.state.pinned}
          onChange={this.togglePinned}
        />
      </div>);
    const header = <h3>Widgets Panel Settings</h3>;
    const footer = <ReactFormFooter showCancel={false} confirmButton='OK' />;

    ReactModalUtils.createModal(
      <ReactModal header={header} body={body} footer={footer} />
    );
  }

  render() {
    const isEmpty = this.isEmpty();
    const classes = ClassNames({
      'input-widget-panel': true,
      'empty': isEmpty,
      'pinned': this.state.pinned,
    });

    return (
      <div id='notebook-input-widget-panel' className={classes}>
        {renderWidgetLists(this.props.inputsMgr, this.state.autoRun)}
        <div className='widget-panel-settings'>
          <i className='settings fa fa-cog' onClick={this.configInputPanel}></i>
          <i className={'pinning fa fa-thumb-tack' + (this.state.pinned ? ' pinned' : '')}
            onClick={this.togglePinned}
          ></i>
        </div>
      </div>
    );
  }
}

NotebookInputPanel.propTypes = {
  inputsMgr: React.PropTypes.instanceOf(InputWidgetManager).isRequired,
};

export function DashboardInputPanel(props) {
  const isEmpty = props.inputsMgr.isEmpty();
  const classes = ClassNames({
    'input-widget-panel': true,
    'empty': isEmpty,
  });

  return (
    <div id='dashboard-input-widget-panel' className={classes}>
      {renderWidgetLists(props.inputsMgr)}
    </div>
  );
}

DashboardInputPanel.propTypes = {
  inputsMgr: React.PropTypes.instanceOf(InputWidgetManager).isRequired,
};
