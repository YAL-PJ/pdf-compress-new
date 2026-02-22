import { describe, it, expect } from 'vitest';
import { PRESETS, getPresetForCurrentSettings, type PresetId } from '../presets';
import { DEFAULT_COMPRESSION_OPTIONS, DEFAULT_IMAGE_SETTINGS } from '../types';

describe('presets', () => {
  const presetIds: PresetId[] = ['aggressive', 'balanced', 'minimal', 'custom'];

  it('all expected preset IDs exist', () => {
    for (const id of presetIds) {
      expect(PRESETS[id]).toBeDefined();
      expect(PRESETS[id].id).toBe(id);
    }
  });

  it('each preset has all required CompressionOptions keys', () => {
    const expectedKeys = Object.keys(DEFAULT_COMPRESSION_OPTIONS).sort();
    for (const id of presetIds) {
      const presetKeys = Object.keys(PRESETS[id].options).sort();
      expect(presetKeys).toEqual(expectedKeys);
    }
  });

  it('each preset has all required ImageCompressionSettings keys', () => {
    const expectedKeys = Object.keys(DEFAULT_IMAGE_SETTINGS).sort();
    for (const id of presetIds) {
      const settingsKeys = Object.keys(PRESETS[id].imageSettings).sort();
      expect(settingsKeys).toEqual(expectedKeys);
    }
  });

  it('custom preset uses DEFAULT_COMPRESSION_OPTIONS unchanged', () => {
    expect(PRESETS.custom.options).toEqual(DEFAULT_COMPRESSION_OPTIONS);
  });

  it('custom preset uses DEFAULT_IMAGE_SETTINGS unchanged', () => {
    expect(PRESETS.custom.imageSettings).toEqual(DEFAULT_IMAGE_SETTINGS);
  });

  describe('preset quality ordering', () => {
    it('aggressive has the lowest image quality', () => {
      expect(PRESETS.aggressive.imageSettings.quality).toBeLessThan(
        PRESETS.balanced.imageSettings.quality
      );
    });

    it('balanced has lower quality than minimal', () => {
      expect(PRESETS.balanced.imageSettings.quality).toBeLessThan(
        PRESETS.minimal.imageSettings.quality
      );
    });

    it('aggressive has the lowest DPI', () => {
      expect(PRESETS.aggressive.imageSettings.targetDpi).toBeLessThanOrEqual(
        PRESETS.balanced.imageSettings.targetDpi
      );
    });

    it('balanced has lower or equal DPI to minimal', () => {
      expect(PRESETS.balanced.imageSettings.targetDpi).toBeLessThanOrEqual(
        PRESETS.minimal.imageSettings.targetDpi
      );
    });
  });

  describe('getPresetForCurrentSettings', () => {
    it('detects aggressive preset', () => {
      expect(
        getPresetForCurrentSettings(PRESETS.aggressive.options, PRESETS.aggressive.imageSettings)
      ).toBe('aggressive');
    });

    it('detects balanced preset', () => {
      expect(
        getPresetForCurrentSettings(PRESETS.balanced.options, PRESETS.balanced.imageSettings)
      ).toBe('balanced');
    });

    it('detects minimal preset', () => {
      expect(
        getPresetForCurrentSettings(PRESETS.minimal.options, PRESETS.minimal.imageSettings)
      ).toBe('minimal');
    });

    it('returns custom for non-matching settings', () => {
      const modified = { ...PRESETS.minimal.options, removeBookmarks: true };
      expect(
        getPresetForCurrentSettings(modified, PRESETS.minimal.imageSettings)
      ).toBe('custom');
    });

    it('returns custom when only image settings differ', () => {
      const modifiedImg = { ...PRESETS.balanced.imageSettings, quality: 99 };
      expect(
        getPresetForCurrentSettings(PRESETS.balanced.options, modifiedImg)
      ).toBe('custom');
    });
  });

  describe('preset method enablement', () => {
    it('minimal enables recompressImages but not downsampleImages', () => {
      expect(PRESETS.minimal.options.recompressImages).toBe(true);
      expect(PRESETS.minimal.options.downsampleImages).toBe(false);
    });

    it('balanced enables downsampleImages', () => {
      expect(PRESETS.balanced.options.downsampleImages).toBe(true);
    });

    it('aggressive enables downsampleImages', () => {
      expect(PRESETS.aggressive.options.downsampleImages).toBe(true);
    });

    it('all presets enable useObjectStreams and stripMetadata', () => {
      for (const id of ['aggressive', 'balanced', 'minimal'] as PresetId[]) {
        expect(PRESETS[id].options.useObjectStreams).toBe(true);
        expect(PRESETS[id].options.stripMetadata).toBe(true);
      }
    });

    it('no preset enables destructive methods by default', () => {
      for (const id of ['aggressive', 'balanced', 'minimal'] as PresetId[]) {
        expect(PRESETS[id].options.convertToGrayscale).toBe(false);
        expect(PRESETS[id].options.convertToMonochrome).toBe(false);
        expect(PRESETS[id].options.flattenForms).toBe(false);
        expect(PRESETS[id].options.flattenAnnotations).toBe(false);
        expect(PRESETS[id].options.rasterizePages).toBe(false);
      }
    });
  });
});
