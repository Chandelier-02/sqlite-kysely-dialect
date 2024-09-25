export function isFunction(
  maybeFunc: unknown,
): maybeFunc is (...args: unknown[]) => unknown {
  return typeof maybeFunc === 'function';
}

export function freeze<T>(obj: T): Readonly<T> {
  return Object.freeze(obj);
}
