/**
 * Used to override the default route function in Backbone.Router
 * Wraps callback in timer to log the execution time of the route.
 * Must be bound to the scope where it is used!
 */
export function timedRoute(route, name, callback, defaultRoute) {
  if (!callback) {
    callback = this[name];
  }
  const f = function f(...args) {
    const start = Date.now();
    const out = callback.apply(this, args);
    const time = Date.now() - start;
    window.recordEvent('clientSideRoute', {
      route: route,
      routeName: name,
      routeTime: time,
    });
    return out;
  }.bind(this);
  return defaultRoute.call(this, route, name, f);
}
