/* eslint max-depth: 0, func-names: 0 */

/**
 * Renders math equations in given element (and its children's) text
 */

const splitAtDelimiters = require('./SplitAtDelimiters.js');
const katex = require('katex');

const splitWithDelimiters = function(text, delimiters) {
  let data = [{ type: 'text', data: text }];
  for (let i = 0; i < delimiters.length; i++) {
    const delimiter = delimiters[i];
    data = splitAtDelimiters(data, delimiter.left, delimiter.right, delimiter.display || false);
  }
  return data;
};

const renderMathInText = function(text, delimiters) {
  const data = splitWithDelimiters(text, delimiters);

  const fragment = document.createDocumentFragment();

  for (let i = 0; i < data.length; i++) {
    if (data[i].type === 'text') {
      fragment.appendChild(document.createTextNode(data[i].data));
    } else {
      const span = document.createElement('span');
      const math = data[i].data;
      try {
        katex.render(math, span, { displayMode: data[i].display });
      } catch (e) {
        if (!(e instanceof katex.ParseError)) {
          throw e;
        }
        console.error('KaTeX auto-render: Failed to parse `' + data[i].data + '` with ', e);
        fragment.appendChild(document.createTextNode(data[i].rawData));
        continue;
      }
      fragment.appendChild(span);
    }
  }

  return fragment;
};

const renderElem = function(elem, delimiters, ignoredTags) {
  for (let i = 0; i < elem.childNodes.length; i++) {
    const childNode = elem.childNodes[i];
    if (childNode.nodeType === 3) {
      // Text node
      const frag = renderMathInText(childNode.textContent, delimiters);
      i += frag.childNodes.length - 1;
      elem.replaceChild(frag, childNode);
    } else if (childNode.nodeType === 1) {
      // Element node
      const shouldRender = ignoredTags.indexOf(childNode.nodeName.toLowerCase()) === -1;

      if (shouldRender) {
        renderElem(childNode, delimiters, ignoredTags);
      }
    }
    // Otherwise, it's something else, and ignore it.
  }
};

const defaultOptions = {
  delimiters: [
    { left: '$$', right: '$$', display: true },
    { left: '\\[', right: '\\]', display: true },
    { left: '\\(', right: '\\)', display: false },
    // TODO(PROD-8262): support $ as inline delimiter to be compatible with iPython
  ],

  ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
};

const renderMathInElement = function(elem) {
  if (!elem) {
    throw new Error('No element provided to render');
  }
  renderElem(elem, defaultOptions.delimiters, defaultOptions.ignoredTags);
};

module.exports = renderMathInElement;
