import { describe, expect, it } from 'vitest';

import '../promise-try-polyfill';

describe('Promise.try polyfill', () => {
  it('resolves synchronous return values with arguments', async () => {
    await expect(Promise.try((value: number) => value + 1, 41)).resolves.toBe(42);
  });

  it('turns synchronous throws into rejections', async () => {
    await expect(Promise.try(() => {
      throw new Error('boom');
    })).rejects.toThrow('boom');
  });
});
