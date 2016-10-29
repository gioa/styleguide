import React from 'react';

import { RouteConstants } from '../../controllers/ReactRouter.jsx';

import { Tooltip } from '../../ui_building_blocks/Tooltip.jsx';
import { Breadcrumbs } from '../../ui_building_blocks/Breadcrumbs.jsx';

const arnRegexr = /^arn:aws(-[^:]+)?:iam::(\d+):instance-profile\/(\S+)$/;


export class IamRolesUtils {
  /**
   * This method should be in sync with 'billing/web/js/helpers/Utils.jsx'
   */
  static isValidAccountId(accountId) {
    const accountIdReg = /^[0-9- ]{9,15}$/;
    return accountIdReg.test(accountId);
  }

  /**
   * Parses an ARN and returns the account id if it's valid.
   * If the ARN or account id is not valid, this will return null.
   */
  static parseIamRoleName(arn) {
    // An instance profile ARN should look like:
    // `arn:aws<partition>:iam::<account>:instance-profile/<role-name>`
    const parsed = arnRegexr.exec(arn);
    if (parsed && parsed.length === 4 && this.isValidAccountId(parsed[2])) {
      return parsed[3];
    }
    return null;
  }

  static getIamRoleUrl(arn, workerEnvId) {
    if (!arn) {
      console.error('IamRole arn must be provided');
      return IamRolesUtils.LIST_VIEW_ROUTE;
    }
    const encodedArn = encodeURIComponent(arn);
    if (workerEnvId) {
      return `${IamRolesUtils.LIST_VIEW_ROUTE}/${encodedArn}/${workerEnvId}`;
    }
    return `${IamRolesUtils.LIST_VIEW_ROUTE}/${encodedArn}`;
  }

  static get LIST_VIEW_ROUTE() {
    return '#' + RouteConstants.IAM_ROLE_ROUTE_ROOT;
  }

  static get invalidArnSyntaxMsg() {
    return (
      <div>
        <span>
          An instance profile ARN should look like:
        </span>
        <br />
        <span>
          {'"arn:aws<partition>:iam::<account>:instance-profile/<role-name>"'}
        </span>
      </div>
    );
  }
}

export function ArnTooltip() {
  const arnHelpMsg = `
    The instance profile ARN for an IAM role can be found in the AWS web UI by navigating to the
    IAM console, searching for the role name, and clicking on the role.`;
  return (
    <Tooltip text={arnHelpMsg} inlineAutoPosition={true}>
      <i className='fa fa-question-circle help-icon' />
    </Tooltip>
  );
}

/**
 * @param curBreadcrumbItemProps props passing to the last BreadcrumbItem in Breadcrumbs component
 */
export function IamRoleBreadcrumbsTitle(curBreadcrumbItemProps) {
  const titleLinks = [
    { text: 'Settings', link: '#setting/accounts/users' },
    { text: 'IAM roles', link: IamRolesUtils.LIST_VIEW_ROUTE },
    curBreadcrumbItemProps,
  ];

  return <Breadcrumbs links={titleLinks} />;
}
