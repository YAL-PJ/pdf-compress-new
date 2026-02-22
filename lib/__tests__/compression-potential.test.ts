import { describe, it, expect } from 'vitest';
import {
  calculateCompressionPotential,
  selectMethodsForTarget,
} from '../compression-potential';
import type { MethodResult } from '../types';
import { SAFE_METHOD_KEYS, MEDIUM_METHOD_KEYS, HIGH_METHOD_KEYS } from '../method-categories';

function makeResult(
  key: string,
  savedBytes: number,
  opts?: { pending?: boolean; savingsRange?: { min: number; max: number } }
): MethodResult {
  return {
    key: key as MethodResult['key'],
    savedBytes,
    compressedSize: 1000 - savedBytes,
    pending: opts?.pending,
    savingsRange: opts?.savingsRange,
  };
}

describe('calculateCompressionPotential', () => {
  const originalSize = 10000;

  it('returns zero savings with no method results', () => {
    const result = calculateCompressionPotential(originalSize, []);
    expect(result.safeSavings).toBe(0);
    expect(result.mediumSavings).toBe(0);
    expect(result.totalSavings).toBe(0);
    expect(result.safeFloor).toBe(originalSize);
    expect(result.mediumFloor).toBe(originalSize);
    expect(result.absoluteFloor).toBe(originalSize);
  });

  it('groups savings by risk level correctly', () => {
    const results: MethodResult[] = [
      makeResult(SAFE_METHOD_KEYS[0], 100),
      makeResult(SAFE_METHOD_KEYS[1], 200),
      makeResult(MEDIUM_METHOD_KEYS[0], 500),
      makeResult(HIGH_METHOD_KEYS[0], 1000),
    ];

    const potential = calculateCompressionPotential(originalSize, results);
    expect(potential.safeSavings).toBe(300);
    expect(potential.mediumSavings).toBe(800); // safe + medium
    expect(potential.totalSavings).toBe(1800); // all
  });

  it('calculates floor sizes correctly', () => {
    const results: MethodResult[] = [
      makeResult(SAFE_METHOD_KEYS[0], 1000),
      makeResult(MEDIUM_METHOD_KEYS[0], 2000),
      makeResult(HIGH_METHOD_KEYS[0], 3000),
    ];

    const potential = calculateCompressionPotential(originalSize, results);
    expect(potential.safeFloor).toBe(9000);
    expect(potential.mediumFloor).toBe(7000);
    expect(potential.absoluteFloor).toBe(4000);
  });

  it('floors never go below zero', () => {
    const results: MethodResult[] = [
      makeResult(SAFE_METHOD_KEYS[0], 50000), // more than original
    ];

    const potential = calculateCompressionPotential(originalSize, results);
    expect(potential.safeFloor).toBe(0);
    expect(potential.mediumFloor).toBe(0);
    expect(potential.absoluteFloor).toBe(0);
  });

  it('skips pending results and counts them', () => {
    const results: MethodResult[] = [
      makeResult(SAFE_METHOD_KEYS[0], 100),
      makeResult(SAFE_METHOD_KEYS[1], 200, { pending: true }),
      makeResult(MEDIUM_METHOD_KEYS[0], 300, { pending: true }),
    ];

    const potential = calculateCompressionPotential(originalSize, results);
    expect(potential.safeSavings).toBe(100);
    expect(potential.hasPending).toBe(true);
    expect(potential.pendingCount).toBe(2);
  });

  it('uses savingsRange.max when available', () => {
    const results: MethodResult[] = [
      makeResult(MEDIUM_METHOD_KEYS[0], 100, {
        savingsRange: { min: 50, max: 500 },
      }),
    ];

    const potential = calculateCompressionPotential(originalSize, results);
    // Should use max (500), not savedBytes (100)
    expect(potential.mediumSavings).toBe(500);
  });

  it('ignores methods with zero or negative savings', () => {
    const results: MethodResult[] = [
      makeResult(SAFE_METHOD_KEYS[0], 0),
      makeResult(SAFE_METHOD_KEYS[1], -10),
      makeResult(SAFE_METHOD_KEYS[2], 100),
    ];

    const potential = calculateCompressionPotential(originalSize, results);
    expect(potential.safeSavings).toBe(100);
  });
});

describe('selectMethodsForTarget', () => {
  const originalSize = 10000;

  it('returns empty set when target is already met', () => {
    const results: MethodResult[] = [
      makeResult(SAFE_METHOD_KEYS[0], 100),
    ];

    const selected = selectMethodsForTarget(originalSize, originalSize, results);
    expect(selected.size).toBe(0);
  });

  it('selects safe methods first', () => {
    const results: MethodResult[] = [
      makeResult(SAFE_METHOD_KEYS[0], 3000),
      makeResult(MEDIUM_METHOD_KEYS[0], 5000),
    ];

    // Target requires 3000 savings — safe method alone is enough
    const selected = selectMethodsForTarget(originalSize, 7000, results);
    expect(selected.has(SAFE_METHOD_KEYS[0])).toBe(true);
    expect(selected.has(MEDIUM_METHOD_KEYS[0])).toBe(false);
  });

  it('escalates to medium methods when safe is insufficient', () => {
    const results: MethodResult[] = [
      makeResult(SAFE_METHOD_KEYS[0], 1000),
      makeResult(MEDIUM_METHOD_KEYS[0], 3000),
    ];

    // Target requires 3500 savings — need both safe and medium
    const selected = selectMethodsForTarget(originalSize, 6500, results);
    expect(selected.has(SAFE_METHOD_KEYS[0])).toBe(true);
    expect(selected.has(MEDIUM_METHOD_KEYS[0])).toBe(true);
  });

  it('escalates to high methods when medium is insufficient', () => {
    const results: MethodResult[] = [
      makeResult(SAFE_METHOD_KEYS[0], 500),
      makeResult(MEDIUM_METHOD_KEYS[0], 500),
      makeResult(HIGH_METHOD_KEYS[0], 5000),
    ];

    // Target requires 4000 savings — need all tiers
    const selected = selectMethodsForTarget(originalSize, 6000, results);
    expect(selected.has(SAFE_METHOD_KEYS[0])).toBe(true);
    expect(selected.has(MEDIUM_METHOD_KEYS[0])).toBe(true);
    expect(selected.has(HIGH_METHOD_KEYS[0])).toBe(true);
  });

  it('within a tier, selects highest-savings methods first', () => {
    const results: MethodResult[] = [
      makeResult(SAFE_METHOD_KEYS[0], 100), // small
      makeResult(SAFE_METHOD_KEYS[1], 5000), // large
      makeResult(SAFE_METHOD_KEYS[2], 200), // medium
    ];

    // Target requires only 3000 savings — only the biggest safe method needed
    const selected = selectMethodsForTarget(originalSize, 7000, results);
    expect(selected.has(SAFE_METHOD_KEYS[1])).toBe(true);
    // Shouldn't need the smaller ones
    expect(selected.size).toBe(1);
  });

  it('uses savingsRange.max for selection', () => {
    const results: MethodResult[] = [
      makeResult(MEDIUM_METHOD_KEYS[0], 100, {
        savingsRange: { min: 50, max: 5000 },
      }),
    ];

    // Target requires 3000 savings — savedBytes is only 100, but range.max is 5000
    const selected = selectMethodsForTarget(originalSize, 7000, results);
    expect(selected.has(MEDIUM_METHOD_KEYS[0])).toBe(true);
  });

  it('skips pending methods', () => {
    const results: MethodResult[] = [
      makeResult(SAFE_METHOD_KEYS[0], 5000, { pending: true }),
      makeResult(MEDIUM_METHOD_KEYS[0], 3000),
    ];

    const selected = selectMethodsForTarget(originalSize, 7000, results);
    expect(selected.has(SAFE_METHOD_KEYS[0])).toBe(false);
    expect(selected.has(MEDIUM_METHOD_KEYS[0])).toBe(true);
  });
});
