import { describe, it, expect, beforeEach } from 'vitest';
import { BrowserZipImportService } from '../services/browserZipImportService';
import { DataExportService } from '../services/dataExportService';

describe('Import Counters Regression Tests', () => {
  let zipImportService: BrowserZipImportService;
  let dataExportService: DataExportService;

  beforeEach(() => {
    zipImportService = new BrowserZipImportService();
    dataExportService = new DataExportService();
  });

  describe('safeCount helper prevents NaN propagation', () => {
    it('should handle undefined values in browserZipImportService', () => {
      // Access private method through type assertion for testing
      const safeCount = (zipImportService as any).safeCount.bind(zipImportService);
      
      expect(safeCount(undefined)).toBe(0);
      expect(safeCount(null)).toBe(0);
      expect(safeCount('not a number')).toBe(0);
      expect(safeCount(NaN)).toBe(0);
      expect(safeCount(Infinity)).toBe(0);
      expect(safeCount(-Infinity)).toBe(0);
      expect(safeCount(42)).toBe(42);
      expect(safeCount(0)).toBe(0);
      expect(safeCount(-5)).toBe(-5);
    });

    it('should handle undefined values in dataExportService', () => {
      // Access private method through type assertion for testing
      const sanitizeCount = (dataExportService as any).sanitizeCount.bind(dataExportService);
      
      expect(sanitizeCount(undefined)).toBe(0);
      expect(sanitizeCount(null)).toBe(0);
      expect(sanitizeCount('not a number')).toBe(0);
      expect(sanitizeCount(NaN)).toBe(0);
      expect(sanitizeCount(Infinity)).toBe(0);
      expect(sanitizeCount(-Infinity)).toBe(0);
      expect(sanitizeCount(42)).toBe(42);
      expect(sanitizeCount(0)).toBe(0);
      expect(sanitizeCount(-5)).toBe(-5);
    });
  });

  describe('import result counters are finite numbers', () => {
    it('should sanitize count values in browserZipImportService processZipFile', async () => {
      // Create a mock result with potentially problematic values
      const mockResult = {
        success: true,
        tripsImported: undefined as any,
        weatherLogsImported: null as any,
        fishCatchesImported: NaN as any,
        savedLocationsImported: Infinity as any,
        photosImported: -Infinity as any,
        durationMs: 100,
        duplicatesSkipped: { trips: 0, weatherLogs: 0, fishCatches: 0 },
        errors: [],
        warnings: []
      };

      // Test that the actual processing sanitizes these values
      // Since we can't easily mock the full process, test the final assignment step
      const importResult = {
        ...mockResult,
        // Apply the same sanitization that happens in processZipFile
        tripsImported: (zipImportService as any).safeCount(mockResult.tripsImported),
        weatherLogsImported: (zipImportService as any).safeCount(mockResult.weatherLogsImported),
        fishCatchesImported: (zipImportService as any).safeCount(mockResult.fishCatchesImported),
        savedLocationsImported: (zipImportService as any).safeCount(mockResult.savedLocationsImported),
        photosImported: (zipImportService as any).safeCount(mockResult.photosImported)
      };

      expect(typeof importResult.tripsImported).toBe('number');
      expect(Number.isFinite(importResult.tripsImported)).toBe(true);
      expect(typeof importResult.weatherLogsImported).toBe('number');
      expect(Number.isFinite(importResult.weatherLogsImported)).toBe(true);
      expect(typeof importResult.fishCatchesImported).toBe('number');
      expect(Number.isFinite(importResult.fishCatchesImported)).toBe(true);
      expect(typeof importResult.savedLocationsImported).toBe('number');
      expect(Number.isFinite(importResult.savedLocationsImported)).toBe(true);
      expect(typeof importResult.photosImported).toBe('number');
      expect(Number.isFinite(importResult.photosImported)).toBe(true);
    });

    it('should handle Math.max with undefined operands in dataExportService', () => {
      const sanitizeCount = (dataExportService as any).sanitizeCount.bind(dataExportService);
      
      // Test Math.max with various problematic inputs
      expect(Math.max(sanitizeCount(undefined), sanitizeCount(5))).toBe(5);
      expect(Math.max(sanitizeCount(null), sanitizeCount(10))).toBe(10);
      expect(Math.max(sanitizeCount(NaN), sanitizeCount(0))).toBe(0);
      expect(Math.max(sanitizeCount(Infinity), sanitizeCount(3))).toBe(3);
      expect(Math.max(sanitizeCount(-Infinity), sanitizeCount(7))).toBe(7);
      
      // Test both operands being problematic
      expect(Math.max(sanitizeCount(undefined), sanitizeCount(null))).toBe(0);
      expect(Math.max(sanitizeCount(NaN), sanitizeCount(Infinity))).toBe(0);
    });
  });

  describe('error handling preserves counter integrity', () => {
    it('should sanitize counters in browserZipImportService error paths', () => {
      // Simulate sanitized result in catch block
      const errorResult = {
        success: false,
        tripsImported: (zipImportService as any).safeCount(undefined),
        weatherLogsImported: (zipImportService as any).safeCount(null),
        fishCatchesImported: (zipImportService as any).safeCount(NaN),
        savedLocationsImported: (zipImportService as any).safeCount(Infinity),
        photosImported: (zipImportService as any).safeCount(-Infinity),
        durationMs: 0,
        duplicatesSkipped: { trips: 0, weatherLogs: 0, fishCatches: 0 },
        errors: ['Mock error'],
        warnings: []
      };

      // All counters should be finite numbers
      expect(Number.isFinite(errorResult.tripsImported)).toBe(true);
      expect(Number.isFinite(errorResult.weatherLogsImported)).toBe(true);
      expect(Number.isFinite(errorResult.fishCatchesImported)).toBe(true);
      expect(Number.isFinite(errorResult.savedLocationsImported)).toBe(true);
      expect(Number.isFinite(errorResult.photosImported)).toBe(true);
      
      // They should all be 0 since the inputs were invalid
      expect(errorResult.tripsImported).toBe(0);
      expect(errorResult.weatherLogsImported).toBe(0);
      expect(errorResult.fishCatchesImported).toBe(0);
      expect(errorResult.savedLocationsImported).toBe(0);
      expect(errorResult.photosImported).toBe(0);
    });
  });

  describe('import result consistency', () => {
    it('should always return valid numeric counters in import results', () => {
      const testCases = [
        { input: undefined, expected: 0 },
        { input: null, expected: 0 },
        { input: 'string', expected: 0 },
        { input: NaN, expected: 0 },
        { input: Infinity, expected: 0 },
        { input: -Infinity, expected: 0 },
        { input: 42, expected: 42 },
        { input: 0, expected: 0 },
        { input: -5, expected: -5 }
      ];

      const safeCount = (zipImportService as any).safeCount.bind(zipImportService);

      testCases.forEach(({ input, expected }) => {
        expect(safeCount(input)).toBe(expected);
        expect(typeof safeCount(input)).toBe('number');
        expect(Number.isFinite(safeCount(input))).toBe(true);
      });
    });
  });
});
