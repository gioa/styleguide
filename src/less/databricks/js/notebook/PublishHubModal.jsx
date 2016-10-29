import _ from 'lodash';
import $ from 'jquery';

import React from 'react';
import ReactModal from '../ui_building_blocks/dialogs/ReactModal.jsx';
import ReactModalUtils from '../ui_building_blocks/dialogs/ReactModalUtils';
import { Input, Select, TextArea } from '../forms/ReactFormElements.jsx';


import { NotebookProtos } from '../proto.js';
import { PublishNotebookConfirmed } from '../notebook/PublishNotebookConfirmed.jsx';


export class PublishHubModal extends React.Component {

  constructor() {
    super();
    this.state = {
      submitEnabled: false,
    };
    this.onConfirm = this.onConfirm.bind(this);
  }

  _getSparkVersions() {
    return _.uniq(window.settings.sparkVersions.map((c) => c.displayName))
      .sort()
      .reverse();
  }

  checkEnableSubmit() {
    const formValid = (
      !!this.refs.title.value()
      && !!this.refs.description.value()
      && !!this.refs.tags.value()
    );

    this.setState({ submitEnabled: formValid });
  }

  _getPublishRequestProto() {
    const publishId = new NotebookProtos.PublishId({
      workspace_id: window.settings.orgId,
      node_id: this.props.notebookId,
      publish_type: NotebookProtos.PublishType.NOTEBOOKHUB,
    });

    const userMetadata = new NotebookProtos.UserPublishMetadata({
      title: this.refs.title.value(),
      description: this.refs.description.value(),
      tags: this.refs.tags.value().split(','),
    });

    const publishRequest = new NotebookProtos.PublishRequest({
      publish_id: publishId,
      user_metadata: userMetadata,
    });

    return publishRequest;
  }

  onConfirm(e) {
    e.preventDefault();

    const publishRequest = this._getPublishRequestProto();

    $.ajax({
      url: '/serialize/publish_hub/',
      dataType: 'json',
      method: 'POST',
      data: publishRequest.encodeJSON(),
      success: (response) => {
        ReactModalUtils.destroyModal();
        const confirmed = (
          <PublishNotebookConfirmed
            url={response.url}
            isDashboard={this.props.isDashboard}
          />
        );
        ReactModalUtils.createModal(confirmed);
      },
      error(jqXHR, textStatus, errorThrown) {
        window.oops('Error publishing to hub. ' + errorThrown);
      },
    });
  }

  renderCancel() {
    const cancel = (
      <a href='#' ref='cancel'
        className='btn cancel-button'
        data-dismiss='modal'
        onClick={ReactModalUtils.destroyModal}
        tabIndex='2'
        style={{ float: 'left' }}
      >
        Cancel
      </a>
    );
    return cancel;
  }

  renderPublish() {
    const confirm = (
      <a href='#' ref='confirm'
        className='btn btn-primary confirm-button'
        onClick={this.onConfirm}
        tabIndex='1'
        disabled={!this.state.submitEnabled}
      >
        Publish
      </a>
    );
    return confirm;
  }

  renderFooter() {
    return (
      <div>
        {this.renderCancel()}
        {this.renderPublish()}
    </div>
    );
  }

  renderBody() {
    const _checkEnableSubmit = this.checkEnableSubmit.bind(this);

    return (
      <div>
        <p>Publishing to <a href='#'>NotebookHub</a> lets you to share your code
          and results with the broader Apache Spark community.
        </p>
        <div>
          <label>Title</label>
          <Input
            type='text'
            defaultValue={this.props.notebookName}
            ref='title'
            inputID='title'
            onChange={_checkEnableSubmit}
          />
        </div>
        <div>
          <label>Description</label>
          <TextArea
            type='textarea'
            ref='description'
            textareaID='description'
            onChange={_checkEnableSubmit}
          />
        </div>
        <div>
          <label>Tags</label>
          <Input
            type='text'
            ref='tags'
            inputID='tags'
            placeholder='tag1,tag2,...'
            onChange={_checkEnableSubmit}
          />
        </div>
        <div>
          <label>Spark Version</label>
          <Select
            options={this._getSparkVersions()}
            selectID='spark-version'
            selectClassName='spark-version'
            optionClassName='spark-version-opt'
            onChange={null}
          />
        </div>
      </div>
    );
  }

  render() {
    const footer = this.renderFooter();
    const body = this.renderBody();
    return (
      <ReactModal
        modalName='publish-hub-notebook-modal'
        header={<h3>Publish to NotebookHub</h3>}
        body={body}
        footer={footer}
        ref={'dialog'}
      />);
  }
}

PublishHubModal.propTypes = {
  notebookId: React.PropTypes.number.isRequired,
  isDashboard: React.PropTypes.bool,
  notebookName: React.PropTypes.string,
};
