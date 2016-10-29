export class PathNameUtils {
  static generatePathNamesFromPathIds(path) {
    if (!path) {
      return null;
    }
    const pIds = path.split('/').slice(1);
    const pathNames = [];
    for (const idx in pIds) {
      if (!pIds.hasOwnProperty(idx)) {
        continue;
      }
      const pId = pIds[idx];
      const parent = window.treeCollection.get(pId);
      if (!parent) {
        return null;
      }
      pathNames.push(parent.get('name'));
    }
    return pathNames.join('/');
  }
}
