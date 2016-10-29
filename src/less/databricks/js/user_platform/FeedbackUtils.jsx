import $ from 'jquery';
import '../../lib/feedback';

import DbGuideLinks from '../urls/DbGuideLinks';

function highlighterTemplate(title, intro) {
  return (
    '<div id="feedback-highlighter">\n' +
    '  <div class="feedback-logo">' + title + '</div>\n' +
    '  <p>' + intro + '</p>\n' +
    '  <p>\n' +
    '    Click and drag on the page to help us better understand your feedback.\n' +
    '    You can move this dialog if it\'s in the way.\n' +
    '  </p>\n' +
    '  <button class="feedback-sethighlight feedback-active">\n' +
    '    <div class="ico"></div>\n' +
    '    <span>Highlight</span>\n' +
    '  </button>\n' +
    '  <label>Highlight areas relevant to your feedback.</label>\n' +
    '  <button class="feedback-setblackout">\n' +
    '    <div class="ico"></div>\n' +
    '    <span>Black out</span>\n' +
    '  </button>\n' +
    '  <label class="lower">Black out any personal information.</label>\n' +
    '  <div class="feedback-buttons">\n' +
    '    <button id="feedback-highlighter-next" class="feedback-next-btn feedback-btn-gray">\n' +
    '      Next\n' +
    '    </button>\n' +
    '    <button id="feedback-highlighter-back" class="feedback-back-btn feedback-btn-gray">\n' +
    '      Back\n' +
    '    </button>\n' +
    '  </div>\n' +
    '  <div class="feedback-wizard-close"></div>\n' +
    '</div>\n'
  );
}

function overviewTemplate(title) {
  return (
    '<div id="feedback-overview">\n' +
    '  <div class="feedback-logo">' + title + '</div>\n' +
    '  <div id="feedback-overview-description">\n' +
    '    <div id="feedback-overview-description-text">\n' +
    '      <h3>Description</h3>\n' +
    '      <h3 class="feedback-additional">Additional info</h3>\n' +
    '      <div id="feedback-additional-none">\n' +
    '        <span>None</span>\n' +
    '      </div>\n' +
    '      <div id="feedback-browser-info">\n' +
    '        <span>&#10004; Browser Info</span>\n' +
    '      </div>\n' +
    '      <div id="feedback-page-info">\n' +
    '        <span>&#10004; Page Info</span>\n' +
    '      </div>\n' +
    '      <div id="feedback-user-info">\n' +
    '        <span>&#10004; Username</span>\n' +
    '      </div>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '  <div id="feedback-overview-screenshot">\n' +
    '    <h3>Screenshot</h3>\n' +
    '  </div>\n' +
    '  <div class="feedback-buttons">\n' +
    '    <button id="feedback-submit" class="feedback-submit-btn feedback-btn-blue">\n' +
    '      Submit\n' +
    '    </button>\n' +
    '    <button id="feedback-overview-back" class="feedback-back-btn feedback-btn-gray">\n' +
    '      Back\n' +
    '    </button>\n' +
    '  </div>\n' +
    '  <div id="feedback-overview-error">\n' +
    '    Please enter a description.\n' +
    '  </div>\n' +
    '  <div class="feedback-wizard-close"></div>\n' +
    '</div>\n'
  );
}

function submitSuccessTemplate(title, feedbackEmail) {
  return (
    '<div id="feedback-submit-success">\n' +
    '  <div class="feedback-logo">' + title + '</div>\n' +
    '  <p>\n' +
    '    Thank you for your feedback. You can also send feedback directly to\n' +
    '    <a href="mailto:' + feedbackEmail + '">' + feedbackEmail + '</a>.\n' +
    '  </p>\n' +
    '  <button class="feedback-close-btn feedback-btn-blue">\n' +
    '    OK\n' +
    '  </button>\n' +
    '  <div class="feedback-wizard-close"></div>\n' +
    '</div>\n'
  );
}

function submitErrorTemplate(title, feedbackEmail) {
  return (
    '<div id="feedback-submit-error">\n' +
    '  <div class="feedback-logo">' + title + '</div>\n' +
    '  <p>\n' +
    '    Oops! We failed to record your feedback. You can also send feedback directly to\n' +
    '    <a href="mailto:' + feedbackEmail + '">' + feedbackEmail + '</a>.\n' +
    '  </p>\n' +
    '  <button class="feedback-close-btn feedback-btn-blue">\n' +
    '    OK\n' +
    '  </button>\n' +
    '  <div class="feedback-wizard-close"></div>\n' +
    '</div>\n'
  );
}

export class FeedbackUtils {

  /**
   * Attach the "Send Feedback" widget to the document body.
   *
   * https://github.com/ivoviz/feedback
   *
   * @param {bool} isDevTier if true, shows text for CE, otherwise shows text for Pro customers
   * @param {string} feedbackEmail displayed for manual feedback in case of failure
   * @param {string} dbcForumURL used to link to the forum
   */
  static setupFeedbackWidget(isDevTier, feedbackEmail, dbcForumURL) {
    let intro;
    if (isDevTier) {
      intro = 'Please send us problem reports and comments ' +
        'about Databricks and Spark. If you want to know more about how to use Databricks ' +
        'or Spark, please first check our ' +
        '<a target="_blank" href="' + DbGuideLinks.INDEX_URL + '">User Guide</a>. ' +
        'If you still have questions, please use the ' +
        '<a target="_blank" href="' + dbcForumURL + '">Databricks Forum</a>.';
    } else {
      intro = 'You can contact support to send us problem reports and questions about ' +
        'Databricks and Spark. If you want to know more about how to use Databricks or ' +
        'Spark, please first check our ' +
        '<a target="_blank" href="' + DbGuideLinks.INDEX_URL + '">User Guide</a>.';
    }

    const title = isDevTier ? 'Feedback' : 'Email Support';

    const template = {
      highlighter: highlighterTemplate(title, intro),
      overview: overviewTemplate(title),
      submitSuccess: submitSuccessTemplate(title, feedbackEmail),
      submitError: submitErrorTemplate(title, feedbackEmail),
    };

    $.feedback({
      ajaxURL: '/feedback',
      html2canvasURL: '/lib/html2canvas.min.js',
      initButtonText: isDevTier ? 'Send Feedback' : 'Email Support',
      tpl: template,
    });
  }
}
