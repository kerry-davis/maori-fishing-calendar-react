import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataExportService } from '../dataExportService';
import { databaseService } from '../databaseService';
import JSZip from 'jszip';
import Papa from 'papaparse';

// Mock dependencies
vi.mock('../databaseService');
vi.mock('jszip');
vi.mock('papaparse');

describe('DataExportService', () => {
  let service: DataExportService;
  let mockDatabaseService: any;
  let mockJSZip: any;
  let mockPapa: any;

  beforeEach(() => {
    service = new DataExportService();
    mockDatabaseService = vi.mocked(databaseService);
    mockJSZip = vi.mocked(JSZip);
    mockPapa = vi.mocked(Papa);

    // Reset localStorage
    localStorage.clear();
    
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('exportDataAsZip', () => {
    it('should export data as ZIP with JSON format', async () => {
      // Mock data
      const mockTrips = [{ id: 1, date: '2024-01-01', water: 'Lake', location: 'Test', hours: 2, companions: '', notes: '' }];
      const mockWeatherLogs = [{ id: 1, tripId: 1, timeOfDay: 'morning', sky: 'clear', windCondition: 'calm', windDirection: 'N', waterTemp: '15', airTemp: '20' }];
      const mockFishCaught = [{ id: 1, tripId: 1, species: 'Trout', length: '30', weight: '1', time: '10:00', gear: ['rod'], details: '', photo: 'data:image/jpeg;base64,test123' }];

      mockDatabaseService.getAllTrips.mockResolvedValue(mockTrips);
      mockDatabaseService.getAllWeatherLogs.mockResolvedValue(mockWeatherLogs);
      mockDatabaseService.getAllFishCaught.mockResolvedValue(mockFishCaught);

      // Mock localStorage
      localStorage.setItem('tacklebox', JSON.stringify([{ id: 1, name: 'Rod', brand: 'Test', type: 'rod', colour: 'blue' }]));
      localStorage.setItem('gearTypes', JSON.stringify(['rod', 'reel']));

      // Mock JSZip
      const mockZip = {
        folder: vi.fn().mockReturnValue({
          file: vi.fn()
        }),
        file: vi.fn(),
        generateAsync: vi.fn().mockResolvedValue(new Blob(['test']))
      };
      mockJSZip.mockImplementation(() => mockZip);

      const result = await service.exportDataAsZip();

      expect(result).toBeInstanceOf(Blob);
      expect(mockDatabaseService.getAllTrips).toHaveBeenCalled();
      expect(mockDatabaseService.getAllWeatherLogs).toHaveBeenCalled();
      expect(mockDatabaseService.getAllFishCaught).toHaveBeenCalled();
      expect(mockZip.file).toHaveBeenCalledWith('data.json', expect.stringContaining('indexedDB'));
    });

    it('should handle photos in fish caught records', async () => {
      const mockFishCaught = [
        { id: 1, tripId: 1, species: 'Trout', length: '30', weight: '1', time: '10:00', gear: ['rod'], details: '', photo: 'data:image/jpeg;base64,test123' },
        { id: 2, tripId: 1, species: 'Bass', length: '25', weight: '0.8', time: '11:00', gear: ['lure'], details: '' } // No photo
      ];

      mockDatabaseService.getAllTrips.mockResolvedValue([]);
      mockDatabaseService.getAllWeatherLogs.mockResolvedValue([]);
      mockDatabaseService.getAllFishCaught.mockResolvedValue(mockFishCaught);

      const mockPhotosFolder = { file: vi.fn() };
      const mockZip = {
        folder: vi.fn().mockReturnValue(mockPhotosFolder),
        file: vi.fn(),
        generateAsync: vi.fn().mockResolvedValue(new Blob(['test']))
      };
      mockJSZip.mockImplementation(() => mockZip);

      await service.exportDataAsZip();

      expect(mockPhotosFolder.file).toHaveBeenCalledWith(
        expect.stringMatching(/fish_1_\d+\.jpeg/),
        'test123',
        { base64: true }
      );
    });

    it('should handle export errors gracefully', async () => {
      mockDatabaseService.getAllTrips.mockRejectedValue(new Error('Database error'));

      await expect(service.exportDataAsZip()).rejects.toThrow('Failed to export data: Database error');
    });
  });

  describe('exportDataAsCSV', () => {
    it('should export data as CSV files in ZIP', async () => {
      const mockTrips = [{ id: 1, date: '2024-01-01', water: 'Lake', location: 'Test', hours: 2, companions: '', notes: '' }];
      const mockWeatherLogs = [{ id: 1, tripId: 1, timeOfDay: 'morning', sky: 'clear', windCondition: 'calm', windDirection: 'N', waterTemp: '15', airTemp: '20' }];
      const mockFishCaught = [{ id: 1, tripId: 1, species: 'Trout', length: '30', weight: '1', time: '10:00', gear: ['rod', 'reel'], details: '' }];

      mockDatabaseService.getAllTrips.mockResolvedValue(mockTrips);
      mockDatabaseService.getAllWeatherLogs.mockResolvedValue(mockWeatherLogs);
      mockDatabaseService.getAllFishCaught.mockResolvedValue(mockFishCaught);

      mockPapa.unparse.mockReturnValue('csv,data');

      const mockZip = {
        folder: vi.fn().mockReturnValue({ file: vi.fn() }),
        file: vi.fn(),
        generateAsync: vi.fn().mockResolvedValue(new Blob(['test']))
      };
      mockJSZip.mockImplementation(() => mockZip);

      const result = await service.exportDataAsCSV();

      expect(result).toBeInstanceOf(Blob);
      expect(mockPapa.unparse).toHaveBeenCalledTimes(3); // trips, weather, fish
      expect(mockZip.file).toHaveBeenCalledWith('trips.csv', 'csv,data');
      expect(mockZip.file).toHaveBeenCalledWith('weather.csv', 'csv,data');
      expect(mockZip.file).toHaveBeenCalledWith('fish.csv', 'csv,data');
    });

    it('should convert gear arrays to strings for CSV', async () => {
      const mockFishCaught = [{ id: 1, tripId: 1, species: 'Trout', length: '30', weight: '1', time: '10:00', gear: ['rod', 'reel'], details: '' }];

      mockDatabaseService.getAllTrips.mockResolvedValue([]);
      mockDatabaseService.getAllWeatherLogs.mockResolvedValue([]);
      mockDatabaseService.getAllFishCaught.mockResolvedValue(mockFishCaught);

      mockPapa.unparse.mockImplementation((data) => {
        // Verify that gear array was converted to string
        expect(data[0].gear).toBe('rod, reel');
        return 'csv,data';
      });

      const mockZip = {
        folder: vi.fn().mockReturnValue({ file: vi.fn() }),
        file: vi.fn(),
        generateAsync: vi.fn().mockResolvedValue(new Blob(['test']))
      };
      mockJSZip.mockImplementation(() => mockZip);

      await service.exportDataAsCSV();

      expect(mockPapa.unparse).toHaveBeenCalled();
    });
  });

  describe('importData', () => {
    it('should import from ZIP file', async () => {
      // Create a proper File mock
      const mockFile = {
        name: 'data.zip',
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0))
      } as any;
      
      // Mock JSZip.loadAsync
      const mockDataFile = {
        async: vi.fn().mockResolvedValue('{"indexedDB":{"trips":[],"weather_logs":[],"fish_caught":[]},"localStorage":{}}')
      };
      
      const mockZip = {
        file: vi.fn().mockReturnValue(mockDataFile),
        folder: vi.fn().mockReturnValue(null)
      };
      
      mockJSZip.loadAsync = vi.fn().mockResolvedValue(mockZip);
      
      // Mock database operations
      mockDatabaseService.clearAllData.mockResolvedValue(undefined);

      await service.importData(mockFile);

      expect(mockJSZip.loadAsync).toHaveBeenCalled();
      expect(mockDatabaseService.clearAllData).toHaveBeenCalled();
    });

    it('should import from JSON file', async () => {
      const mockFile = {
        name: 'data.json',
        text: vi.fn().mockResolvedValue('{"indexedDB":{"trips":[],"weather_logs":[],"fish_caught":[]},"localStorage":{}}')
      } as any;
      
      mockDatabaseService.clearAllData.mockResolvedValue(undefined);

      await service.importData(mockFile);

      expect(mockDatabaseService.clearAllData).toHaveBeenCalled();
    });

    it('should validate import data format', async () => {
      const mockFile = {
        name: 'data.json',
        text: vi.fn().mockResolvedValue('{"invalid": "data"}')
      } as any;

      await expect(service.importData(mockFile)).rejects.toThrow('Invalid data format');
    });
  });

  describe('downloadBlob', () => {
    it('should create download link and trigger download', () => {
      const mockBlob = new Blob(['test'], { type: 'text/plain' });
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn()
      };

      // Mock DOM methods
      vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);
      
      // Mock URL methods
      global.URL = {
        createObjectURL: vi.fn().mockReturnValue('blob:test'),
        revokeObjectURL: vi.fn()
      } as any;

      service.downloadBlob(mockBlob, 'test.txt');

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockLink.download).toBe('test.txt');
      expect(mockLink.click).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
    });
  });

  describe('trimObjectStrings', () => {
    it('should trim strings in nested objects', () => {
      const testData = {
        string: '  test  ',
        number: 123,
        array: ['  item1  ', '  item2  '],
        nested: {
          prop: '  nested  '
        }
      };

      const result = (service as any).trimObjectStrings(testData);

      expect(result.string).toBe('test');
      expect(result.number).toBe(123);
      expect(result.array).toEqual(['item1', 'item2']);
      expect(result.nested.prop).toBe('nested');
    });
  });
});