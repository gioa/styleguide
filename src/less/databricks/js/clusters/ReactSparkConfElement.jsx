/* eslint react/prefer-es6-class: 0, max-depth: 0 */

import React from 'react';

import ReactFormElements from '../forms/ReactFormElements.jsx';

import { Tooltip } from '../ui_building_blocks/Tooltip.jsx';

import { DbGuideUrls } from '../urls/DbGuideUrls';
import DbGuideLinks from '../urls/DbGuideLinks';

const TextArea = ReactFormElements.TextArea;

const ReactSparkConfElement = React.createClass({

  propTypes: {
    defaultSparkConfBlob: React.PropTypes.string,
    onChange: React.PropTypes.func.isRequired,
    readOnly: React.PropTypes.bool,
  },

  getDefaultProps() {
    return {
      defaultSparkConfBlob: '',
    };
  },

  statics: {
    sparkConfInputId: 'sparkConfInput',

    getSparkConfMap(confBlob) {
      if (!window.settings.enableSparkConfUI) {
        return {};
      }
      const confMap = {};
      if (!confBlob || confBlob === '') {
        return confMap;
      }
      const options = confBlob.split('\n');
      for (const i in options) {
        if (!options.hasOwnProperty(i)) {
          continue;
        }
        const opt = options[i].trim();
        if (opt.length === 0) {
          continue;
        }
        const delimPos = opt.indexOf(' ');
        if (delimPos === -1) {
          confMap[opt] = '';
        } else {
          const key = opt.substring(0, delimPos).trim();
          const value = opt.substring(delimPos + 1).trim();
          confMap[key] = value;
        }
      }
      return confMap;
    },

    makeSparkConfString(sparkConf) {
      let confString = '';
      if (sparkConf !== null) {
        for (const k in sparkConf) {
          if (!sparkConf.hasOwnProperty(k)) {
            continue;
          }
          if (confString !== '') {
            confString += '\n';
          }
          confString += k + ' ' + sparkConf[k];
        }
      }
      return confString;
    },
  },

  getInitialState() {
    return {
      feedback: '',
      sparkConfBlob: this.props.defaultSparkConfBlob,
    };
  },

  setFeedback(feedback) {
    this.setState({
      feedback: feedback,
    });
  },

  validateSparkConf(confBlob) {
    if (!confBlob || confBlob === '') {
      this.setFeedback('');
      return true;
    }
    const confMap = ReactSparkConfElement.getSparkConfMap(confBlob);
    if (window.settings.enableSparkConfValidation) {
      for (const key in confMap) {
        if (!confMap.hasOwnProperty(key)) {
          continue;
        }
        const value = confMap[key];
        // find all specs that matches with the key/value pair
        const matchedSpecs = [];
        const specs = window.settings.configurableSparkOptionsSpec;
        for (const j in specs) {
          if (!specs.hasOwnProperty(j)) {
            continue;
          }
          const spec = specs[j];
          const keyRegEx = new RegExp('^' + spec.keyPattern + '$');
          const valueRegEx = new RegExp('^' + spec.valuePattern + '$');
          if (key.search(keyRegEx) === 0) {
            if (value.search(valueRegEx) === 0) {
              matchedSpecs.push(spec);
            } else {
              this.setFeedback('Invalid value ' +
                '<strong>' + value + '</strong> for ' +
                '<strong>' + key + '</strong>');
              return false;
            }
          }
        }
        if (matchedSpecs.length === 0) {
          this.setFeedback('Unsupported spark configuration option: ' +
            '<strong>' + key + '</strong>');
          return false;
        }
      }
    }
    this.setFeedback('');
    return true;
  },

  updateSparkConf(confBlob) {
    this.setState({ sparkConfBlob: confBlob });
    if (this.props.onChange) {
      this.props.onChange(ReactSparkConfElement.getSparkConfMap(confBlob));
    }
    this.validateSparkConf(confBlob);
  },

  render() {
    const tooltipText =
      (<span>
        For the list of Spark config options that we currently support, see the
        <a
          href={DbGuideUrls.getDbGuideUrl(DbGuideLinks.CLUSTERS_URL)}
          target='_blank'
        >Clusters section</a> of the Databricks Guide
      </span>);
    const feedback = (this.state.feedback === '' ? null :
      <div className={"spark-conf-feedback-tooltip"}>
        <Tooltip text={tooltipText}>
          <i className={"fa fa-fw fa-exclamation-circle"} />
        </Tooltip>
        <span
          className={"spark-conf-feedback cluster-dialog-element"}
          dangerouslySetInnerHTML={{ __html: this.state.feedback }}
        />
      </div>
    );

    // Make a string with the default value
    const placeHolder = 'Enter your Spark configuration options here.\nExample:\n' +
        'spark.speculation true\nspark.kryo.registrator my.package.MyRegistrator\n' +
        'spark.driver.extraJavaOptions -verbose:gc -XX:+PrintGCDetails';

    return (
      <div>
        <label className={"unclickable cluster-dialog-label"}>Spark Config</label>
        <div>
          <TextArea
            ref={"textArea"}
            textareaID={ReactSparkConfElement.sparkConfInputId}
            defaultValue={this.state.sparkConfBlob}
            placeholder={placeHolder}
            onChange={this.updateSparkConf}
            textareaClassName='control-field spark-conf-text-area'
            readOnly={this.props.readOnly ? this.props.readOnly : null}
          />
        </div>
        {feedback}
      </div>
    );
  },
});

module.exports = ReactSparkConfElement;
