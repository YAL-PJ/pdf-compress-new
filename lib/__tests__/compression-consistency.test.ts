/**
 * Compression consistency tests
 *
 * These tests verify that the simple (preset) and pro (target-size) compression
 * modes produce internally consistent settings and that all parts of the system
 * agree on method classification, option shapes, and ordering guarantees.
 */

import { describe, it, expect } from 'vitest';
import { PRESETS, getPresetForCurrentSettings } from '../presets';
import { settingsForTargetPercent, getEscalationTier, MAX_ESCALATION_TIERS } from '../target-size';
import {
  calculateCompressionPotential,
  selectMethodsForTarget,
} from '../compression-potential';
import {
  ALL_METHOD_KEYS,
  SAFE_METHOD_KEYS,
  MEDIUM_METHOD_KEYS,
  HIGH_METHOD_KEYS,
  METHOD_RISK_LEVELS,
  allMethodsEnabled,
} from '../method-categories';
import {
  DEFAULT_COMPRESSION_OPTIONS,
  DEFAULT_IMAGE_SETTINGS,
  type CompressionOptions,
  type MethodResult,
} from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Count enabled methods in an options object */
function countEnabled(opts: CompressionOptions): number {
  return ALL_METHOD_KEYS.filter(k => opts[k]).length;
}

/** Create a mock MethodResult */
function mockResult(key: keyof CompressionOptions, savedBytes: number): MethodResult {
  return { key, savedBytes, compressedSize: 10000 - savedBytes };
}

// ---------------------------------------------------------------------------
// 1. Option shape consistency: all settings objects have the same keys
// ---------------------------------------------------------------------------

describe('option shape consistency', () => {
  const expectedOptionKeys = new Set(Object.keys(DEFAULT_COMPRESSION_OPTIONS));
  const expectedImageKeys = new Set(Object.keys(DEFAULT_IMAGE_SETTINGS));

  it('every preset has exactly the same option keys as DEFAULT_COMPRESSION_OPTIONS', () => {
    for (const [id, preset] of Object.entries(PRESETS)) {
      const keys = new Set(Object.keys(preset.options));
      expect(keys, `preset ${id} options mismatch`).toEqual(expectedOptionKeys);
    }
  });

  it('every preset has exactly the same image settings keys as DEFAULT_IMAGE_SETTINGS', () => {
    for (const [id, preset] of Object.entries(PRESETS)) {
      const keys = new Set(Object.keys(preset.imageSettings));
      expect(keys, `preset ${id} imageSettings mismatch`).toEqual(expectedImageKeys);
    }
  });

  it('settingsForTargetPercent returns the same option keys for all targets', () => {
    for (const pct of [10, 15, 30, 50, 70, 100]) {
      const { options, imageSettings } = settingsForTargetPercent(pct);
      expect(new Set(Object.keys(options)), `target ${pct}% options`).toEqual(expectedOptionKeys);
      expect(new Set(Object.keys(imageSettings)), `target ${pct}% imageSettings`).toEqual(expectedImageKeys);
    }
  });

  it('allMethodsEnabled() returns the same keys as DEFAULT_COMPRESSION_OPTIONS', () => {
    expect(new Set(Object.keys(allMethodsEnabled()))).toEqual(expectedOptionKeys);
  });

  it('escalation tiers return the same option keys', () => {
    const base = settingsForTargetPercent(50);
    for (let tier = 1; tier <= MAX_ESCALATION_TIERS; tier++) {
      const result = getEscalationTier(tier, base.options, base.imageSettings);
      expect(new Set(Object.keys(result.options)), `tier ${tier}`).toEqual(expectedOptionKeys);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Method category coverage
// ---------------------------------------------------------------------------

describe('method category coverage', () => {
  it('every CompressionOptions key appears in exactly one risk tier', () => {
    const optionKeys = Object.keys(DEFAULT_COMPRESSION_OPTIONS) as (keyof CompressionOptions)[];
    for (const key of optionKeys) {
      const inSafe = SAFE_METHOD_KEYS.includes(key);
      const inMedium = MEDIUM_METHOD_KEYS.includes(key);
      const inHigh = HIGH_METHOD_KEYS.includes(key);
      const count = [inSafe, inMedium, inHigh].filter(Boolean).length;
      expect(count, `${key} should be in exactly one tier`).toBe(1);
    }
  });

  it('METHOD_RISK_LEVELS has an entry for every CompressionOptions key', () => {
    const optionKeys = Object.keys(DEFAULT_COMPRESSION_OPTIONS) as (keyof CompressionOptions)[];
    for (const key of optionKeys) {
      expect(METHOD_RISK_LEVELS[key], `missing risk level for ${key}`).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Monotonicity: more aggressive settings never reduce compression capability
// ---------------------------------------------------------------------------

describe('monotonicity guarantees', () => {
  it('lower target percent enables at least as many methods as higher', () => {
    const percents = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    let prevCount = Infinity;

    // Going from low % (aggressive) to high % (minimal), enabled methods should decrease
    for (const pct of percents) {
      const { options } = settingsForTargetPercent(pct);
      const count = countEnabled(options);
      // At the same or lower target, should have >= methods
      if (pct > 10) {
        expect(count, `pct ${pct} should have <= methods than lower pcts`).toBeLessThanOrEqual(prevCount);
      }
      prevCount = count;
    }
  });

  it('lower target percent produces lower or equal image quality', () => {
    const percents = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    let prevQuality = 0;

    for (const pct of percents) {
      const { imageSettings } = settingsForTargetPercent(pct);
      expect(imageSettings.quality).toBeGreaterThanOrEqual(prevQuality);
      prevQuality = imageSettings.quality;
    }
  });

  it('escalation tiers get progressively more aggressive', () => {
    const base = settingsForTargetPercent(50);
    const tiers = [];
    for (let i = 1; i <= MAX_ESCALATION_TIERS; i++) {
      tiers.push(getEscalationTier(i, base.options, base.imageSettings));
    }

    for (let i = 1; i < tiers.length; i++) {
      const prev = tiers[i - 1];
      const curr = tiers[i];
      // Quality should decrease or stay the same
      expect(curr.imageSettings.quality).toBeLessThanOrEqual(prev.imageSettings.quality);
      // Methods enabled should increase or stay the same
      expect(countEnabled(curr.options)).toBeGreaterThanOrEqual(countEnabled(prev.options));
    }
  });

  it('preset aggressiveness order: minimal < balanced < aggressive', () => {
    const minMethods = countEnabled(PRESETS.minimal.options);
    const balMethods = countEnabled(PRESETS.balanced.options);
    const aggMethods = countEnabled(PRESETS.aggressive.options);

    expect(minMethods).toBeLessThanOrEqual(balMethods);
    expect(balMethods).toBeLessThanOrEqual(aggMethods);

    expect(PRESETS.minimal.imageSettings.quality).toBeGreaterThan(PRESETS.balanced.imageSettings.quality);
    expect(PRESETS.balanced.imageSettings.quality).toBeGreaterThan(PRESETS.aggressive.imageSettings.quality);
  });
});

// ---------------------------------------------------------------------------
// 4. Simple/pro mode consistency
// ---------------------------------------------------------------------------

describe('simple vs pro mode consistency', () => {
  it('presets only enable methods from the correct risk levels', () => {
    // Minimal and balanced should not enable high-risk methods
    for (const id of ['minimal', 'balanced'] as const) {
      const opts = PRESETS[id].options;
      for (const key of HIGH_METHOD_KEYS) {
        expect(opts[key], `preset ${id} should not enable high-risk method ${key}`).toBe(false);
      }
    }
  });

  it('aggressive preset does not enable high-risk methods either', () => {
    // Aggressive still keeps high-risk methods off in simple mode
    const opts = PRESETS.aggressive.options;
    for (const key of HIGH_METHOD_KEYS) {
      expect(opts[key], `aggressive should not enable high-risk method ${key}`).toBe(false);
    }
  });

  it('settingsForTargetPercent at ~90% is similar in spirit to minimal preset', () => {
    const target90 = settingsForTargetPercent(90);
    // Both should have recompressImages enabled
    expect(target90.options.recompressImages).toBe(true);
    // Neither should have aggressive methods at 90%
    expect(target90.options.pngToJpeg).toBe(false);
    expect(target90.options.flattenForms).toBe(false);
  });

  it('settingsForTargetPercent at ~10% enables all methods (most aggressive)', () => {
    const target10 = settingsForTargetPercent(10);
    // At 10%, all methods should be on (nuclear zone)
    for (const key of ALL_METHOD_KEYS) {
      expect(target10.options[key], `method ${key} should be on at 10%`).toBe(true);
    }
  });

  it('selectMethodsForTarget respects the safe→medium→high priority order', () => {
    // Provide one method per tier, each saving 2000 bytes
    const results: MethodResult[] = [
      mockResult(SAFE_METHOD_KEYS[0], 2000),
      mockResult(MEDIUM_METHOD_KEYS[0], 2000),
      mockResult(HIGH_METHOD_KEYS[0], 2000),
    ];
    const originalSize = 10000;

    // Target needing only 2000 savings — should use safe only
    const selected1 = selectMethodsForTarget(originalSize, 8000, results);
    expect(selected1.has(SAFE_METHOD_KEYS[0])).toBe(true);
    expect(selected1.has(MEDIUM_METHOD_KEYS[0])).toBe(false);
    expect(selected1.has(HIGH_METHOD_KEYS[0])).toBe(false);

    // Target needing 4000 savings — should use safe + medium
    const selected2 = selectMethodsForTarget(originalSize, 6000, results);
    expect(selected2.has(SAFE_METHOD_KEYS[0])).toBe(true);
    expect(selected2.has(MEDIUM_METHOD_KEYS[0])).toBe(true);
    expect(selected2.has(HIGH_METHOD_KEYS[0])).toBe(false);

    // Target needing 6000 savings — should use all
    const selected3 = selectMethodsForTarget(originalSize, 4000, results);
    expect(selected3.has(SAFE_METHOD_KEYS[0])).toBe(true);
    expect(selected3.has(MEDIUM_METHOD_KEYS[0])).toBe(true);
    expect(selected3.has(HIGH_METHOD_KEYS[0])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Potential calculator consistency
// ---------------------------------------------------------------------------

describe('compression potential calculator consistency', () => {
  const originalSize = 100000;

  it('safeFloor >= mediumFloor >= absoluteFloor', () => {
    const results: MethodResult[] = [
      mockResult(SAFE_METHOD_KEYS[0], 5000),
      mockResult(MEDIUM_METHOD_KEYS[0], 10000),
      mockResult(HIGH_METHOD_KEYS[0], 20000),
    ];

    const potential = calculateCompressionPotential(originalSize, results);
    expect(potential.safeFloor).toBeGreaterThanOrEqual(potential.mediumFloor);
    expect(potential.mediumFloor).toBeGreaterThanOrEqual(potential.absoluteFloor);
  });

  it('mediumSavings includes safe savings', () => {
    const results: MethodResult[] = [
      mockResult(SAFE_METHOD_KEYS[0], 5000),
      mockResult(MEDIUM_METHOD_KEYS[0], 10000),
    ];

    const potential = calculateCompressionPotential(originalSize, results);
    expect(potential.mediumSavings).toBe(15000); // safe + medium
    expect(potential.mediumSavings).toBeGreaterThanOrEqual(potential.safeSavings);
  });

  it('totalSavings >= mediumSavings >= safeSavings', () => {
    const results: MethodResult[] = ALL_METHOD_KEYS.map((key, i) =>
      mockResult(key, (i + 1) * 100)
    );

    const potential = calculateCompressionPotential(originalSize, results);
    expect(potential.totalSavings).toBeGreaterThanOrEqual(potential.mediumSavings);
    expect(potential.mediumSavings).toBeGreaterThanOrEqual(potential.safeSavings);
  });
});

// ---------------------------------------------------------------------------
// 6. Round-trip consistency
// ---------------------------------------------------------------------------

describe('round-trip consistency', () => {
  it('getPresetForCurrentSettings detects all named presets round-trip', () => {
    for (const id of ['aggressive', 'balanced', 'minimal'] as const) {
      const preset = PRESETS[id];
      const detected = getPresetForCurrentSettings(preset.options, preset.imageSettings);
      expect(detected, `round-trip detection failed for ${id}`).toBe(id);
    }
  });

  it('settingsForTargetPercent is deterministic', () => {
    for (const pct of [10, 30, 50, 70, 100]) {
      const a = settingsForTargetPercent(pct);
      const b = settingsForTargetPercent(pct);
      expect(a).toEqual(b);
    }
  });

  it('getEscalationTier is deterministic', () => {
    const base = settingsForTargetPercent(50);
    for (let tier = 1; tier <= MAX_ESCALATION_TIERS; tier++) {
      const a = getEscalationTier(tier, base.options, base.imageSettings);
      const b = getEscalationTier(tier, base.options, base.imageSettings);
      expect(a).toEqual(b);
    }
  });
});
