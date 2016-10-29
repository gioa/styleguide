/* eslint consistent-return: 0, func-names: 0 */

/**
 * Renders markdown text.
 * It strips one '%md' character from the raw markdown text if it can find one.
 */

import sanitizeHtml from 'sanitize-html';

import renderMathInElement from '../../notebook/commands/RenderMath';

import marked from '../../../lib/marked.min';

const sanitizeHtmlOptions = {
  allowedTags: ['h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'a', 'ul', 'ol',
    'nl', 'li', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div',
    'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre',
    // non-default tags that we added to sanitize-html
    'img', 'tt', 'font', 'h1', 'h2'],
  allowedAttributes: {
    a: ['href', 'name', 'target'],
    // non-default attributes that we added to sanitize-html
    img: ['src', 'width', 'height'],
    '*': ['style'],
  },
  selfClosing: ['img', 'br', 'hr', 'area', 'base', 'basefont', 'input', 'link', 'meta'],
  allowedSchemes: ['http', 'https', 'ftp', 'mailto'],
  allowedSchemesByTag: {},
};

let initialized = false;

// we have to lazily initialize the conf since window.settings is not set when this file is loaded
function initialize() {
  const allowSanitizedHtml = window.settings && window.settings.sanitizeMarkdownHtml;

  marked.setOptions({
    // If conf enabled, the HTML in the markdown is sanitized in Markdown.render by santizeHtml
    // Else we let markd escape the HTML by setting sanitize = true
    sanitize: !allowSanitizedHtml,
    headerPrefix: 'databricks-markdown-header-',
  });
  initialized = true;
}

/**
 * Strip one '%md' word from the raw markdown text if one is found
 */
function stripMDSign(cmd) {
  if (cmd.length > 0) {
    const firstWord = cmd.trim().split(/\s/)[0];
    if (firstWord === '%md') {
      return cmd.replace(/^\s*%md/, '');
    }
  }
  return cmd;
}

const Markdown = function(elem) {
  this.elem = elem;
  if (!initialized) {
    initialize();
  }
};

/** Renders markdown, sanitizes HTML, and renders latex in the DOM element */
Markdown.prototype.render = function(text) {
  if (text !== null && text !== undefined) {
    this.elem.html(this.renderToString(text));
    renderMathInElement(this.elem[0]);
  }
};

/**
 * Render markdown & sanitize HTML, but does not render latex. Returns result as a string.
 *
 * This is a legacy method. Use render() instead, except in testing.
 */
Markdown.prototype.renderToString = function(text) {
  const allowSanitizedHtml = window.settings && window.settings.sanitizeMarkdownHtml;

  if (text !== null && text !== undefined) {
    const stripped = stripMDSign(text);
    const rendered = marked(stripped);
    return allowSanitizedHtml ? sanitizeHtml(rendered, sanitizeHtmlOptions) : rendered;
  }
};

module.exports = Markdown;
