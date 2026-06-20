/**
 * Minimal Promise.try polyfill for browsers that do not ship it yet.
 *
 * Some newer dependencies (notably PDF.js builds) can call Promise.try during
 * module evaluation. Safari 17.x does not provide Promise.try, which caused the
 * compressor to fail before any user-visible work could start. Keep this file
 * tiny and side-effect-only so it can be imported before those dependencies.
 */
if (typeof Promise.try !== 'function') {
  Promise.try = function promiseTry<T, U extends unknown[]>(
    callbackFn: (...args: U) => T | PromiseLike<T>,
    ...args: U
  ): Promise<Awaited<T>> {
    return new Promise<Awaited<T>>((resolve) => {
      resolve(callbackFn(...args) as Awaited<T> | PromiseLike<Awaited<T>>);
    });
  };
}

export {};
