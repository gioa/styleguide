import React from 'react';
import _ from 'lodash';

import { ClusterTagsFallbackConstants, ClusterTagsConstants } from './ClusterTagsConstants';
import { EditableAwsTagListView } from './EditableAwsTagListView.jsx';
import { UneditableAwsTagListView } from './UneditableAwsTagListView.jsx';

import { CompareTos } from '../../ui_building_blocks/tables/ReactTableUtils.jsx';

export class AwsTagList extends React.Component {
  constructor(props) {
    super(props);

    this.addTag = this.addTag.bind(this);
    this.deleteTag = this.deleteTag.bind(this);
    this.keyInputValidator = this.keyInputValidator.bind(this);
    this.valueInputValidator = this.valueInputValidator.bind(this);
    this.keyOnChange = this.keyOnChange.bind(this);
    this.keyOnBlur = this.keyOnBlur.bind(this);
    this.valueOnChange = this.valueOnChange.bind(this);
    this.valueOnBlur = this.valueOnBlur.bind(this);
    this.keyKeyDownHandler = this.keyKeyDownHandler.bind(this);
    this.valueKeyDownHandler = this.valueKeyDownHandler.bind(this);

    this.MIN_KEY_LENGTH = (window.settings && window.settings.minClusterTagKeyLength) ||
      ClusterTagsFallbackConstants.minClusterTagKeyLength;
    this.MAX_KEY_LENGTH = (window.settings && window.settings.maxClusterTagKeyLength) ||
      ClusterTagsFallbackConstants.maxClusterTagKeyLength;
    this.MIN_VALUE_LENGTH = ClusterTagsFallbackConstants.minClusterTagValueLength;
    this.MAX_VALUE_LENGTH = (window.settings && window.settings.maxClusterTagValueLength) ||
      ClusterTagsFallbackConstants.maxClusterTagValueLength;

    this.shouldShowDefaultTags = window.settings && window.settings.enableUserVisibleDefaultTags;

    this.keySortFunc = this.getSortFunc((id) => this.state.awsTags[id].key);
    this.valueSortFunc = this.getSortFunc((id) => this.state.awsTags[id].value);

    this.tagIdGenerator = 0;

    const [awsTags, sortedEditableTagIds, sortedUneditableTagIds] = this.getInitialTags();
    this.state = {
      awsTags: awsTags,
      sortedEditableTagIds: sortedEditableTagIds,
      sortedUneditableTagIds: sortedUneditableTagIds,
    };
  }

  /**
   * Takes custom tags/default tags props and creates tags objects out of them
   * Custom tags/default tags props are always Arrays.
   * This creates an object out of them that is managed with
   * IDs.
   * @returns {Array} tuple of unsorted and sorted tags
   */
  getInitialTags() {
    const awsTags = {};
    const sortedEditableTagIds = [];
    const sortedUneditableTagIds = [];

    const defaultTags = this.shouldShowDefaultTags ? this.getDefaultTags() : [];

    defaultTags.forEach((tag) => {
      tag.isEditable = false;
      this.incrementTagIdAndAddTag(tag, awsTags, sortedUneditableTagIds);
    });
    this.props.customTags.forEach((tag) => {
      tag.isEditable = true;
      this.incrementTagIdAndAddTag(
        tag,
        awsTags,
        this.props.editable ? sortedEditableTagIds : sortedUneditableTagIds
      );
    });
    return [awsTags, sortedEditableTagIds, sortedUneditableTagIds];
  }

  /**
   * If default tags props exists, return it
   * Otherwise, construct default tags and returns it
   * @returns {Array} default tags array
   */
  getDefaultTags() {
    if (this.props.defaultTags) {
      return this.props.defaultTags;
    }

    const defaultTags = _.cloneDeep(ClusterTagsConstants.defaultTags);
    // PLEASE NOTE THAT THIS INDEX MUST BE KEPT CONSISTENT WITH THE defaultTags
    // HARDCODED OBJECT IN ClusterTagsConstants. IT SHOULD BE THE INDEX OF THE
    // TAG WITH KEY 'Creator'
    defaultTags[1].value = window.settings && window.settings.user;

    return defaultTags;
  }

  /**
   * Sets state and report changes to parent component
   * This should be unnecessary once we switch over to real HTML5 forms
   * @param changes {Object} mapping of state changes to set and report
   */
  setStateAndReportChanges(changes) {
    this.setState(changes);

    const awsTags = changes.awsTags || this.state.awsTags;

    // We only want to tell the parent about the CUSTOM tags
    const reportedChanges = {};
    reportedChanges.customTags = Object.keys(awsTags).filter((tagId) =>
      awsTags[tagId].isEditable
    ).map((tagId) => awsTags[tagId]);

    this.props.onChange(reportedChanges);
  }

  /**
   * Add tag and report changes
   * @param tag {Object} tag to be added
   */
  addTag(tag) {
    const awsTags = _.cloneDeep(this.state.awsTags);
    const sortedEditableTagIds = _.cloneDeep(this.state.sortedEditableTagIds);

    tag.isEditable = true;
    this.incrementTagIdAndAddTag(tag, awsTags, sortedEditableTagIds);
    this.setStateAndReportChanges({
      awsTags: awsTags,
      sortedEditableTagIds: sortedEditableTagIds,
    });
  }

  /**
   * Delete tag and report changes
   * @param tag {Object} tag to be removed
   */
  deleteTag(tag) {
    const awsTags = _.cloneDeep(this.state.awsTags);
    const sortedEditableTagIds = _.cloneDeep(this.state.sortedEditableTagIds);

    const id = tag.id;
    delete awsTags[id];
    _.remove(sortedEditableTagIds, (rowId) => rowId === id);
    this.setStateAndReportChanges({
      awsTags: awsTags,
      sortedEditableTagIds: sortedEditableTagIds,
    });
  }

  /**
   * Increments the global tag ID and adds tag to the tagsObj object and the sortedTagIds array.
   * @param tag {Object} tag object to be given ID and added
   * @param tagsObj {Object} managed tags object in which tag will be added to
   * @param sortedTagIds {Array} ordered array for tag IDs (what order to display tags)
   */
  incrementTagIdAndAddTag(tag, tagsObj, sortedTagIds) {
    tag.id = this.tagIdGenerator;
    tagsObj[this.tagIdGenerator] = tag;
    sortedTagIds.push(tag.id);
    this.tagIdGenerator++;
  }

  /**
   * Validates key by checking for key length, duplicate key names (including reserved key names),
   * key prefix, and allowed characters. Assumes that trailing and leading whitespace is already
   * trimmed.
   * @param key {string} new tag key to validate
   * @returns {boolean}
   */
  keyInputValidator(key) {
    const tags = this.state.awsTags;
    const keyNotUsed = _.every(Object.keys(tags), (objKey) =>
      tags[objKey].key !== key
    );
    const reservedTags =
      ClusterTagsConstants.defaultTagIds.concat(ClusterTagsConstants.internalTagIds);
    const beginsWithAws = key.startsWith(ClusterTagsConstants.awsPrefix);
    const matchesAllowableCharacters = ClusterTagsConstants.allowedCharactersRegex.test(key);
    return key.length >= this.MIN_KEY_LENGTH && key.length <= this.MAX_KEY_LENGTH && keyNotUsed &&
      !reservedTags.includes(key) && !beginsWithAws && matchesAllowableCharacters;
  }

  /**
   * Validates value by checking for value length, value prefix, and allowed characters
   * @param value {string} new tag value to validate. Assumes that trailing and leading whitespace
   * is already trimmed.
   * @returns {boolean}
   */
  valueInputValidator(value) {
    const beginsWithAws = value.startsWith(ClusterTagsConstants.awsPrefix);
    const matchesAllowableCharacters = ClusterTagsConstants.allowedCharactersRegex.test(value);
    return value.length >= this.MIN_VALUE_LENGTH && value.length <= this.MAX_VALUE_LENGTH &&
      !beginsWithAws && matchesAllowableCharacters;
  }

  changeKeyAndGetAwsTagsState(key, row) {
    const awsTags = _.cloneDeep(this.state.awsTags);
    awsTags[row.id].key = key;
    awsTags[row.id].keyInvalid = !this.keyInputValidator(key);
    return awsTags;
  }

  /**
   * On change handler for already-added keys
   * @param e {event} the key on change event
   * @param row {Object} row for which to change key
   */
  keyOnChange(e, row) {
    const key = e.target.value;
    const awsTags = this.changeKeyAndGetAwsTagsState(key, row);
    if (awsTags[row.id].keyInvalid) {
      this.editableView.showKeyTooltip();
    } else {
      this.editableView.hideKeyTooltip();
    }
    this.setState({
      awsTags: awsTags,
      // set old tags to revert to in case key is invalid on blur
      oldTags: this.state.oldTags ? this.state.oldTags : this.state.awsTags,
    });
  }

  /**
   * On blur handler for already-added keys
   * @param e {event} the key on blur event
   * @param row {Object} row for which to change key
   */
  keyOnBlur(e, row) {
    // if we need to trim key, update this.state.awsTags with trimmed key
    const trimmedKey = row.key.trim();
    const needToTrimKey = row.key !== trimmedKey;
    const newAwsTagsState = needToTrimKey ?
      this.changeKeyAndGetAwsTagsState(trimmedKey, row) : this.state.awsTags;
    const invalid = newAwsTagsState[row.id].keyInvalid;

    this.setStateAndReportChanges({
      // if the value is invalid, revert the change. otherwise, keep it.
      awsTags: invalid ? this.state.oldTags : newAwsTagsState,
      // get rid of old tags, no need after blur
      oldTags: undefined,
    });

    this.editableView.hideKeyTooltip();
  }

  changeValueAndGetAwsTagsState(value, row) {
    const awsTags = _.cloneDeep(this.state.awsTags);
    awsTags[row.id].value = value;
    awsTags[row.id].valueInvalid = !this.valueInputValidator(value);
    return awsTags;
  }

  /**
   * On change handler for already-added values
   * @param e {event} the value on change event
   * @param row {Object} row for which to change key
   */
  valueOnChange(e, row) {
    const value = e.target.value;
    const awsTags = this.changeValueAndGetAwsTagsState(value, row);
    if (awsTags[row.id].valueInvalid) {
      this.editableView.showValueTooltip();
    } else {
      this.editableView.hideValueTooltip();
    }
    this.setState({
      awsTags: awsTags,
      // set old tags to revert to in case value is invalid on blur
      oldTags: this.state.oldTags ? this.state.oldTags : this.state.awsTags,
    });
  }

  /**
   * On blur handler for already-added values
   * @param e {event} the value on blur change event
   * @param row {Object} row for which to change value
   */
  valueOnBlur(e, row) {
    // if we need to trim value, update this.state.awsTags with trimmed value
    const trimmedValue = row.value.trim();
    const needToTrimValue = row.value !== trimmedValue;
    const newAwsTagsState = needToTrimValue ?
      this.changeValueAndGetAwsTagsState(trimmedValue, row) : this.state.awsTags;
    const invalid = newAwsTagsState[row.id].valueInvalid;

    this.setStateAndReportChanges({
      // if the value is invalid, revert the change. otherwise, keep it.
      awsTags: invalid ? this.state.oldTags : newAwsTagsState,
      // get rid of old tags, no need after blur
      oldTags: undefined,
    });

    this.editableView.hideValueTooltip();
  }

  keyKeyDownHandler(e, row) {
    if (e.keyCode === 13) { // enter
      this.keyOnBlur(e, row);
      this.editableView.hideKeyTooltip();
      e.target.blur();
    }
  }

  valueKeyDownHandler(e, row) {
    if (e.keyCode === 13) { // enter
      this.valueOnBlur(e, row);
      this.editableView.hideValueTooltip();
      e.target.blur();
    }
  }

  /**
   * Gets a sort function for a value getter
   * @param valueGetter {function} the value getter of a row
   * @returns {function} sort function
   */
  getSortFunc(valueGetter) {
    return (dir) => {
      const sortedEditableTagIds = _.cloneDeep(this.state.sortedEditableTagIds);
      const sortedUneditableTagIds = _.cloneDeep(this.state.sortedUneditableTagIds);

      const actuallySortedEditableTagIds = sortedEditableTagIds.sort(
        CompareTos.getSimpleCompareTo(valueGetter, dir)
      );
      const actuallySortedUneditableTagIds = sortedUneditableTagIds.sort(
        CompareTos.getSimpleCompareTo(valueGetter, dir)
      );
      this.setState({
        sortedEditableTagIds: actuallySortedEditableTagIds,
        sortedUneditableTagIds: actuallySortedUneditableTagIds,
      });
    };
  }

  render() {
    if (this.props.editable) {
      const refFunc = (ref) => this.editableView = ref;
      return (
        <EditableAwsTagListView
          ref={refFunc}
          rows={this.state.awsTags}
          rowOrder={this.state.sortedUneditableTagIds.concat(this.state.sortedEditableTagIds)}
          addTagFunc={this.addTag}
          deleteFunc={this.deleteTag}
          keyInputValidator={this.keyInputValidator}
          keyOnChangeHandler={this.keyOnChange}
          keyOnBlurHandler={this.keyOnBlur}
          keyKeyDownHandler={this.keyKeyDownHandler}
          valueKeyDownHandler={this.valueKeyDownHandler}
          keySortFunc={this.keySortFunc}
          valueInputValidator={this.valueInputValidator}
          valueOnChangeHandler={this.valueOnChange}
          valueOnBlurHandler={this.valueOnBlur}
          valueSortFunc={this.valueSortFunc}
          minKeyLength={this.MIN_KEY_LENGTH}
          maxKeyLength={this.MAX_KEY_LENGTH}
          minValueLength={this.MIN_VALUE_LENGTH}
          maxValueLength={this.MAX_VALUE_LENGTH}
          enableUserVisibleDefaultTags={this.shouldShowDefaultTags}
        />
      );
    }
    return (
      <UneditableAwsTagListView
        rows={this.state.awsTags}
        rowOrder={this.state.sortedUneditableTagIds}
        keySortFunc={this.keySortFunc}
        valueSortFunc={this.valueSortFunc}
      />
    );
  }
}

AwsTagList.propTypes = {
  editable: React.PropTypes.bool,
  customTags: React.PropTypes.array.isRequired,
  defaultTags: React.PropTypes.array,
  onChange: React.PropTypes.func,
};

AwsTagList.defaultProps = {
  editable: false,
};
