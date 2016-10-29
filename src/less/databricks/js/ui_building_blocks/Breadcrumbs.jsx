import React from 'react';

function BreadcrumbItem({ text, link, className, divider }) {
  const content = link ? <a href={link}>{text}</a> : (text);
  return (
    <span className={className}>
      {content}
      {divider}
    </span>
  );
}

BreadcrumbItem.propTypes = {
  text: React.PropTypes.string,
  link: React.PropTypes.string,
  className: React.PropTypes.string,
  divider: React.PropTypes.element,
};

export function Breadcrumbs(props) {
  const content = props.links.map((link, i, arr) => {
    const divider = (i < arr.length - 1) ? <span className='divider'>{' / '}</span> : null;
    return <BreadcrumbItem key={i} {...link} divider={divider} />;
  });
  return (
    <span className='breadcrumbs'>{content}</span>
  );
}

Breadcrumbs.propTypes = {
  links: React.PropTypes.array.isRequired,
};
