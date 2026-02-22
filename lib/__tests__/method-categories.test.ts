import { describe, it, expect } from 'vitest';
import {
  SAFE_METHOD_KEYS,
  MEDIUM_METHOD_KEYS,
  HIGH_METHOD_KEYS,
  ALL_METHOD_KEYS,
  METHOD_RISK_LEVELS,
  allMethodsEnabled,
} from '../method-categories';
import { DEFAULT_COMPRESSION_OPTIONS, type CompressionOptions } from '../types';

describe('method-categories', () => {
  const allOptionsKeys = Object.keys(DEFAULT_COMPRESSION_OPTIONS) as (keyof CompressionOptions)[];

  it('ALL_METHOD_KEYS covers every key in CompressionOptions', () => {
    const missing = allOptionsKeys.filter(k => !ALL_METHOD_KEYS.includes(k));
    expect(missing).toEqual([]);
  });

  it('ALL_METHOD_KEYS has no extra keys not in CompressionOptions', () => {
    const extra = ALL_METHOD_KEYS.filter(k => !(k in DEFAULT_COMPRESSION_OPTIONS));
    expect(extra).toEqual([]);
  });

  it('no duplicate keys across risk tiers', () => {
    const all = [...SAFE_METHOD_KEYS, ...MEDIUM_METHOD_KEYS, ...HIGH_METHOD_KEYS];
    const unique = new Set(all);
    expect(all.length).toBe(unique.size);
  });

  it('ALL_METHOD_KEYS equals the union of all tiers', () => {
    const union = [...SAFE_METHOD_KEYS, ...MEDIUM_METHOD_KEYS, ...HIGH_METHOD_KEYS];
    expect(new Set(ALL_METHOD_KEYS)).toEqual(new Set(union));
    expect(ALL_METHOD_KEYS.length).toBe(union.length);
  });

  it('METHOD_RISK_LEVELS maps every option to a valid risk level', () => {
    for (const key of allOptionsKeys) {
      const risk = METHOD_RISK_LEVELS[key];
      expect(['safe', 'medium', 'high']).toContain(risk);
    }
  });

  it('METHOD_RISK_LEVELS is consistent with the tier arrays', () => {
    for (const key of SAFE_METHOD_KEYS) {
      expect(METHOD_RISK_LEVELS[key]).toBe('safe');
    }
    for (const key of MEDIUM_METHOD_KEYS) {
      expect(METHOD_RISK_LEVELS[key]).toBe('medium');
    }
    for (const key of HIGH_METHOD_KEYS) {
      expect(METHOD_RISK_LEVELS[key]).toBe('high');
    }
  });

  it('allMethodsEnabled() returns all keys set to true', () => {
    const enabled = allMethodsEnabled();
    for (const key of allOptionsKeys) {
      expect(enabled[key]).toBe(true);
    }
  });

  it('allMethodsEnabled() has the same keys as DEFAULT_COMPRESSION_OPTIONS', () => {
    const enabled = allMethodsEnabled();
    expect(new Set(Object.keys(enabled))).toEqual(new Set(allOptionsKeys));
  });
});
