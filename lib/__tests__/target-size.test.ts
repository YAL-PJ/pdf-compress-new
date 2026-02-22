import { describe, it, expect } from 'vitest';
import {
  settingsForTargetPercent,
  getEscalationTier,
  MAX_ESCALATION_TIERS,
  TARGET_SIZE_STEPS,
} from '../target-size';
import { DEFAULT_COMPRESSION_OPTIONS, DEFAULT_IMAGE_SETTINGS } from '../types';
import { ALL_METHOD_KEYS } from '../method-categories';

describe('target-size', () => {
  describe('settingsForTargetPercent', () => {
    it('returns valid options and imageSettings for any valid percent', () => {
      for (const pct of [10, 25, 40, 50, 70, 85, 100]) {
        const result = settingsForTargetPercent(pct);
        expect(result.options).toBeDefined();
        expect(result.imageSettings).toBeDefined();
        expect(result.imageSettings.quality).toBeGreaterThanOrEqual(5);
        expect(result.imageSettings.quality).toBeLessThanOrEqual(100);
      }
    });

    it('clamps values below 10 to 10', () => {
      const at5 = settingsForTargetPercent(5);
      const at10 = settingsForTargetPercent(10);
      expect(at5).toEqual(at10);
    });

    it('clamps values above 100 to 100', () => {
      const at105 = settingsForTargetPercent(105);
      const at100 = settingsForTargetPercent(100);
      expect(at105).toEqual(at100);
    });

    it('lower target percent produces lower quality', () => {
      const low = settingsForTargetPercent(20);
      const high = settingsForTargetPercent(80);
      expect(low.imageSettings.quality).toBeLessThan(high.imageSettings.quality);
    });

    it('lower target percent produces lower or equal DPI', () => {
      const low = settingsForTargetPercent(20);
      const high = settingsForTargetPercent(80);
      expect(low.imageSettings.targetDpi).toBeLessThanOrEqual(high.imageSettings.targetDpi);
    });

    describe('zone-specific behavior', () => {
      it('aggressive zone (<=40%) uses 72 DPI', () => {
        for (const pct of [10, 20, 30, 40]) {
          const result = settingsForTargetPercent(pct);
          expect(result.imageSettings.targetDpi).toBe(72);
        }
      });

      it('minimal zone (70-100%) uses DPI >= 150', () => {
        for (const pct of [70, 80, 90, 100]) {
          const result = settingsForTargetPercent(pct);
          expect(result.imageSettings.targetDpi).toBeGreaterThanOrEqual(150);
        }
      });
    });

    describe('method escalation', () => {
      it('at <=15% (nuclear), all methods are enabled', () => {
        const result = settingsForTargetPercent(10);
        for (const key of ALL_METHOD_KEYS) {
          expect(result.options[key]).toBe(true);
        }
      });

      it('at 100%, fewer methods are enabled than at 10%', () => {
        const low = settingsForTargetPercent(10);
        const high = settingsForTargetPercent(100);
        const lowEnabled = ALL_METHOD_KEYS.filter(k => low.options[k]);
        const highEnabled = ALL_METHOD_KEYS.filter(k => high.options[k]);
        expect(lowEnabled.length).toBeGreaterThan(highEnabled.length);
      });

      it('aggressive methods enabled at <=50%, not at >50%', () => {
        const at40 = settingsForTargetPercent(40);
        const at60 = settingsForTargetPercent(60);
        // pngToJpeg is an aggressive method
        expect(at40.options.pngToJpeg).toBe(true);
        expect(at60.options.pngToJpeg).toBe(false);
      });

      it('max compression methods enabled at <=30%, not at >30%', () => {
        const at25 = settingsForTargetPercent(25);
        const at50 = settingsForTargetPercent(50);
        // flattenForms is a max compression method
        expect(at25.options.flattenForms).toBe(true);
        expect(at50.options.flattenForms).toBe(false);
      });
    });

    it('result options have the same keys as DEFAULT_COMPRESSION_OPTIONS', () => {
      const expectedKeys = new Set(Object.keys(DEFAULT_COMPRESSION_OPTIONS));
      for (const pct of [10, 20, 50, 80, 100]) {
        const result = settingsForTargetPercent(pct);
        const resultKeys = new Set(Object.keys(result.options));
        expect(resultKeys).toEqual(expectedKeys);
      }
    });

    it('result imageSettings have the same keys as DEFAULT_IMAGE_SETTINGS', () => {
      const expectedKeys = new Set(Object.keys(DEFAULT_IMAGE_SETTINGS));
      for (const pct of [10, 20, 50, 80, 100]) {
        const result = settingsForTargetPercent(pct);
        const resultKeys = new Set(Object.keys(result.imageSettings));
        expect(resultKeys).toEqual(expectedKeys);
      }
    });
  });

  describe('getEscalationTier', () => {
    const baseOptions = DEFAULT_COMPRESSION_OPTIONS;
    const baseImageSettings = DEFAULT_IMAGE_SETTINGS;

    it('tier 1 reduces quality by 50%', () => {
      const result = getEscalationTier(1, baseOptions, baseImageSettings);
      const expectedQuality = Math.max(5, Math.round(baseImageSettings.quality * 0.5));
      expect(result.imageSettings.quality).toBe(expectedQuality);
    });

    it('tier 2 reduces quality by 70%', () => {
      const result = getEscalationTier(2, baseOptions, baseImageSettings);
      const expectedQuality = Math.max(5, Math.round(baseImageSettings.quality * 0.3));
      expect(result.imageSettings.quality).toBe(expectedQuality);
    });

    it('tier 3 (nuclear) uses quality 5 and enables all methods', () => {
      const result = getEscalationTier(3, baseOptions, baseImageSettings);
      expect(result.imageSettings.quality).toBe(5);
      for (const key of ALL_METHOD_KEYS) {
        expect(result.options[key]).toBe(true);
      }
    });

    it('each escalation tier is at least as aggressive as the previous', () => {
      const tier1 = getEscalationTier(1, baseOptions, baseImageSettings);
      const tier2 = getEscalationTier(2, baseOptions, baseImageSettings);
      const tier3 = getEscalationTier(3, baseOptions, baseImageSettings);

      expect(tier1.imageSettings.quality).toBeGreaterThanOrEqual(tier2.imageSettings.quality);
      expect(tier2.imageSettings.quality).toBeGreaterThanOrEqual(tier3.imageSettings.quality);

      // Tier 2 should enable at least as many methods as tier 1
      const tier1Enabled = ALL_METHOD_KEYS.filter(k => tier1.options[k]).length;
      const tier2Enabled = ALL_METHOD_KEYS.filter(k => tier2.options[k]).length;
      const tier3Enabled = ALL_METHOD_KEYS.filter(k => tier3.options[k]).length;
      expect(tier2Enabled).toBeGreaterThanOrEqual(tier1Enabled);
      expect(tier3Enabled).toBeGreaterThanOrEqual(tier2Enabled);
    });

    it('tier >= 3 falls through to nuclear (default case)', () => {
      const tier3 = getEscalationTier(3, baseOptions, baseImageSettings);
      const tier99 = getEscalationTier(99, baseOptions, baseImageSettings);
      expect(tier3).toEqual(tier99);
    });

    it('all tiers set DPI to 72 and enable downsampling', () => {
      for (let tier = 1; tier <= MAX_ESCALATION_TIERS; tier++) {
        const result = getEscalationTier(tier, baseOptions, baseImageSettings);
        expect(result.imageSettings.targetDpi).toBe(72);
        expect(result.imageSettings.enableDownsampling).toBe(true);
      }
    });
  });

  describe('constants', () => {
    it('MAX_ESCALATION_TIERS is 3', () => {
      expect(MAX_ESCALATION_TIERS).toBe(3);
    });

    it('TARGET_SIZE_STEPS has correct range', () => {
      expect(TARGET_SIZE_STEPS.min).toBe(10);
      expect(TARGET_SIZE_STEPS.max).toBe(100);
      expect(TARGET_SIZE_STEPS.step).toBe(1);
    });
  });
});
