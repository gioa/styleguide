/**
 * This component is deprecated. For any new tables, we should be using ReactTable's
 * Table and Column components. See ClusterDetailsLibrariesList and ClusterDetailsLibrariesListView
 * for an example of usage.
 */

import React from 'react';

/**
 * @deprecated
 * Creates a table. Provide headers and rows as arrays. An id can be provided as bodyId.
 */
export function TableView({ headers, content, bodyId, moreProps }) {
  if (moreProps) {
    if (moreProps.hasOwnProperty('headers')) {
      headers = headers.concat(moreProps.headers);
    }
    if (moreProps.hasOwnProperty('content')) {
      content = content.concat(moreProps.content);
    }
  }
  return (
    <div>
      <table className='table table-bordered-outer'>
        <thead>
          <tr>
            {headers}
          </tr>
        </thead>
        <tbody id={bodyId}>
          {content}
        </tbody>
      </table>
    </div>
  );
}

TableView.propTypes = {
  headers: React.PropTypes.array.isRequired,
  content: React.PropTypes.array.isRequired,
  bodyId: React.PropTypes.string,
  moreProps: React.PropTypes.object,
};

/**
 * This component is deprecated. Instead, use ui_building_blocks/Collapsible.jsx with
 * ui_building_blocks/tables/ReactTable.jsx.
 */
export class CollapsibleTableView extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      collapsed: props.collapseByDefault,
    };

    this.toggle = this.toggle.bind(this);
  }

  toggle() {
    this.setState({ collapsed: !this.state.collapsed });
  }

  render() {
    const headerIcon = this.state.collapsed ?
      (<i className='fa fa-caret-right' />) : (<i className='fa fa-caret-down' />);
    // @NOTE(lauren) PROD-12497 two headers were rendering because even though an empty array is
    // passed to TableView for the headers prop, it was still rendering a header because headers
    // was also contained in this.props, passed as moreProps. Since this component is deprecated
    // and needs to be refactored to the new table components, for now we are just deleting the
    // extra header
    const moreProps = Object.assign({}, this.props);
    delete moreProps.headers;
    const tableView = (
      <TableView
        headers={[]}
        content={this.state.collapsed ? [] : this.props.content}
        bodyId={this.props.bodyId || undefined}
        moreProps={moreProps}
      />
    );
    return (
      <div>
        <div onClick={this.toggle} className='header'>{headerIcon} {this.props.headers}</div>
        {this.state.collapsed ? null : tableView}
      </div>
    );
  }
}

CollapsibleTableView.propTypes = {
  headers: React.PropTypes.array.isRequired,
  content: React.PropTypes.array.isRequired,
  bodyId: React.PropTypes.string,
  collapseByDefault: React.PropTypes.bool,
};

CollapsibleTableView.defaultProps = {
  collapseByDefault: false,
};

