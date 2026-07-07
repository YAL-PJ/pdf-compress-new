// PDF.js 5.x can call Promise.try inside its dedicated worker. Some supported
// browsers (notably Safari/iOS 18 and older Chrome builds) do not provide it yet,
// so install the tiny polyfill before evaluating the bundled PDF.js worker.
if (typeof Promise.try !== 'function') {
  Promise.try = function promiseTry(callbackFn, ...args) {
    return new Promise((resolve) => {
      resolve(callbackFn(...args));
    });
  };
}

await import('./pdf.worker.min.mjs');
