import React from 'react';

/**
 * Commonly used icons.
 */
export class Icons {
  /* Creates a circle with the given digit inside. Styling for this is in common.less **/
  static getNum(num) {
    return (<span className='fa-stack fa-lg'>
      <i className='fa fa-circle-thin fa-stack-1x num-icon-circle'></i>
      <i className='fa fa-stack-1x num-icon-digit'>{num}</i>
    </span>);
  }
}
