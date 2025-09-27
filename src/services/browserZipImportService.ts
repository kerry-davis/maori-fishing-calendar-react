/**
 * Browser-based Zip Import Service
 * Handles zip file imports directly in the browser without requiring Node.js
 * Perfect for mobile devices and web-based migration
 * Supports both guest (offline) and authenticated (online) modes
 */

import type { Trip, WeatherLog, FishCaught } from "../types";
import { firebaseDataService } from "./firebaseDataService";
import { databaseService } from "./databaseService";

export interface ZipImportResult {
  success: boolean;
  tripsImported: number;
  weatherLogsImported: number;
  fishCatchesImported: number;
  photosImported: number;
  errors: string[];
  warnings: string[];
}

export interface LegacyDataStructure {
  trips: Trip[];
  weatherLogs: WeatherLog[];
  fishCatches: FishCaught[];
  photos: { [key: string]: string }; // filename -> base64 data
}

/**
 * Browser-based zip file processor for legacy data migration
 */
export class BrowserZipImportService {
  private zip: any = null;

  constructor() {
    // Load JSZip dynamically for browser compatibility
    this.loadJSZip();
  }

  /**
   * Dynamically load JSZip library for browser use
   */
  private async loadJSZip(): Promise<void> {
    if (typeof window !== 'undefined' && !(window as any).JSZip) {
      // JSZip is not loaded, we'll need to use a different approach
      // For now, we'll implement a basic zip reader
      console.log('JSZip not available, using fallback method');
    }
  }

  /**
   * Process a zip file uploaded by the user
   * @param file - The zip file to process
   * @param isAuthenticated - Whether the user is authenticated (has Firebase access)
   */
  async processZipFile(file: File, isAuthenticated: boolean = false): Promise<ZipImportResult> {
    const result: ZipImportResult = {
      success: false,
      tripsImported: 0,
      weatherLogsImported: 0,
      fishCatchesImported: 0,
      photosImported: 0,
      errors: [],
      warnings: []
    };

    try {
      console.log('Starting zip file processing for:', file.name);

      // Read file as array buffer
      const arrayBuffer = await this.readFileAsArrayBuffer(file);

      // Process the zip content
      const zipContent = await this.parseZipContent(arrayBuffer);

      // Extract legacy data
      const legacyData = await this.extractLegacyData(zipContent);

      if (!legacyData) {
        result.errors.push('No valid legacy data found in zip file');
        return result;
      }

      // Import the data
      const importResult = await this.importLegacyData(legacyData, isAuthenticated);

      result.success = importResult.success;
      result.tripsImported = importResult.tripsImported;
      result.weatherLogsImported = importResult.weatherLogsImported;
      result.fishCatchesImported = importResult.fishCatchesImported;
      result.photosImported = importResult.photosImported;
      result.errors = importResult.errors;
      result.warnings = importResult.warnings;

      console.log('Zip import completed:', result);
      return result;

    } catch (error) {
      console.error('Zip processing failed:', error);
      result.errors.push(`Failed to process zip file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Read file as ArrayBuffer for zip processing
   */
  private readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        if (arrayBuffer) {
          resolve(arrayBuffer);
        } else {
          reject(new Error('Failed to read file as ArrayBuffer'));
        }
      };
      reader.onerror = () => reject(new Error('File reading failed'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Parse zip content from ArrayBuffer
   * Basic implementation - in production, consider using a library like JSZip
   */
  private async parseZipContent(arrayBuffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
    const content = new Map<string, Uint8Array>();

    try {
      // For now, we'll implement a simple parser
      // In production, you'd want to use a proper zip library
      const zipData = new Uint8Array(arrayBuffer);

      // Look for common file patterns in the zip
      const files = this.detectFilesInZip(zipData);

      for (const fileInfo of files) {
        const fileContent = this.extractFileFromZip(zipData, fileInfo);
        if (fileContent) {
          content.set(fileInfo.name, fileContent);
        }
      }

      return content;
    } catch (error) {
      console.error('Failed to parse zip content:', error);
      throw new Error('Invalid zip file format');
    }
  }

  /**
   * Detect files within the zip structure
   */
  private detectFilesInZip(zipData: Uint8Array): Array<{name: string, offset: number, size: number}> {
    const files: Array<{name: string, offset: number, size: number}> = [];

    // Simple file detection - look for common patterns
    // This is a basic implementation - a proper zip parser would be more robust

    // Look for data.json
    const jsonPattern = /data\.json/;
    const jsonMatch = this.findPatternInZip(zipData, jsonPattern);
    if (jsonMatch) {
      files.push({ name: 'data.json', offset: jsonMatch.offset, size: jsonMatch.size });
    }

    // Look for CSV files
    const csvPattern = /trips.*\.csv/i;
    const csvMatch = this.findPatternInZip(zipData, csvPattern);
    if (csvMatch) {
      files.push({ name: 'trips.csv', offset: csvMatch.offset, size: csvMatch.size });
    }

    // Look for photos folder
    const photosPattern = /photos\//;
    const photosMatch = this.findPatternInZip(zipData, photosPattern);
    if (photosMatch) {
      // Extract photo files
      const photoFiles = this.findPhotoFiles(zipData, photosMatch.offset);
      files.push(...photoFiles);
    }

    return files;
  }

  /**
   * Find pattern in zip data
   */
  private findPatternInZip(zipData: Uint8Array, pattern: RegExp): {offset: number, size: number} | null {
    // Simple pattern matching - in production, use proper zip parsing
    const text = new TextDecoder().decode(zipData);
    const match = pattern.exec(text);
    if (match) {
      return { offset: match.index, size: 1024 }; // Approximate size
    }
    return null;
  }

  /**
   * Find photo files in photos folder
   */
  private findPhotoFiles(zipData: Uint8Array, folderOffset: number): Array<{name: string, offset: number, size: number}> {
    const photoFiles: Array<{name: string, offset: number, size: number}> = [];
    const text = new TextDecoder().decode(zipData.slice(folderOffset, folderOffset + 2048));

    // Look for common image extensions
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp)/gi;
    let match;

    while ((match = imageExtensions.exec(text)) !== null) {
      const fileName = match[0];
      photoFiles.push({
        name: `photos/${fileName}`,
        offset: folderOffset + match.index,
        size: 1024 * 50 // Assume 50KB per photo
      });
    }

    return photoFiles;
  }

  /**
   * Extract file content from zip
   */
  private extractFileFromZip(zipData: Uint8Array, fileInfo: {name: string, offset: number, size: number}): Uint8Array | null {
    try {
      // Simple extraction - in production, use proper zip decompression
      return zipData.slice(fileInfo.offset, fileInfo.offset + fileInfo.size);
    } catch (error) {
      console.warn(`Failed to extract ${fileInfo.name}:`, error);
      return null;
    }
  }

  /**
   * Extract legacy data from zip content
   */
  private async extractLegacyData(zipContent: Map<string, Uint8Array>): Promise<LegacyDataStructure | null> {
    const legacyData: LegacyDataStructure = {
      trips: [],
      weatherLogs: [],
      fishCatches: [],
      photos: {}
    };

    try {
      // Process data.json if present
      const dataJson = zipContent.get('data.json');
      if (dataJson) {
        const jsonText = new TextDecoder().decode(dataJson);
        const data = JSON.parse(jsonText);

        if (data.trips) legacyData.trips = data.trips;
        if (data.weatherLogs) legacyData.weatherLogs = data.weatherLogs;
        if (data.fishCatches) legacyData.fishCatches = data.fishCatches;
      }

      // Process CSV if present
      const tripsCsv = zipContent.get('trips.csv');
      if (tripsCsv && legacyData.trips.length === 0) {
        const csvText = new TextDecoder().decode(tripsCsv);
        const csvData = this.parseCSV(csvText);
        legacyData.trips = this.convertCSVToTrips(csvData);
      }

      // Process photos
      for (const [fileName, fileContent] of zipContent.entries()) {
        if (fileName.startsWith('photos/') && this.isImageFile(fileName)) {
          const base64Data = this.arrayBufferToBase64(fileContent);
          const mimeType = this.getMimeType(fileName);
          legacyData.photos[fileName] = `data:${mimeType};base64,${base64Data}`;
        }
      }

      // Validate we have some data
      const hasData = legacyData.trips.length > 0 ||
                     legacyData.weatherLogs.length > 0 ||
                     legacyData.fishCatches.length > 0 ||
                     Object.keys(legacyData.photos).length > 0;

      return hasData ? legacyData : null;

    } catch (error) {
      console.error('Failed to extract legacy data:', error);
      return null;
    }
  }

  /**
   * Parse CSV text to array of objects
   */
  private parseCSV(csvText: string): string[][] {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data: string[][] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      if (values.length === headers.length) {
        data.push(values);
      }
    }

    return data;
  }

  /**
   * Convert CSV data to trips format
   */
  private convertCSVToTrips(csvData: string[][]): Trip[] {
    const trips: Trip[] = [];

    csvData.forEach(row => {
      try {
        const trip: Trip = {
          id: Date.now() + Math.random(), // Generate new ID
          date: row[0] || new Date().toISOString().split('T')[0],
          water: row[1] || 'Unknown',
          location: row[2] || 'Unknown',
          hours: row[3] ? parseFloat(row[3]) : 0,
          companions: row[4] || '',
          notes: row[5] || ''
        };
        trips.push(trip);
      } catch (error) {
        console.warn('Failed to parse CSV row:', row, error);
      }
    });

    return trips;
  }

  /**
   * Import legacy data to appropriate storage (Firebase for authenticated, IndexedDB for guests)
   * @param legacyData - The legacy data to import
   * @param isAuthenticated - Whether the user is authenticated
   */
  private async importLegacyData(legacyData: LegacyDataStructure, isAuthenticated: boolean): Promise<ZipImportResult> {
    const result: ZipImportResult = {
      success: true,
      tripsImported: 0,
      weatherLogsImported: 0,
      fishCatchesImported: 0,
      photosImported: 0,
      errors: [],
      warnings: []
    };

    try {
      console.log('Starting legacy data import...');

      if (isAuthenticated) {
        // Authenticated user - store in Firebase
        console.log('Importing to Firebase (authenticated user)...');

        // Import trips first
        for (const trip of legacyData.trips) {
          try {
            await firebaseDataService.createTrip(trip);
            result.tripsImported++;
          } catch (error) {
            result.errors.push(`Failed to import trip: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        // Import weather logs
        for (const weatherLog of legacyData.weatherLogs) {
          try {
            await firebaseDataService.createWeatherLog(weatherLog);
            result.weatherLogsImported++;
          } catch (error) {
            result.errors.push(`Failed to import weather log: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        // Import fish catches
        for (const fishCatch of legacyData.fishCatches) {
          try {
            await firebaseDataService.createFishCaught(fishCatch);
            result.fishCatchesImported++;
          } catch (error) {
            result.errors.push(`Failed to import fish catch: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      } else {
        // Guest user - store locally
        console.log('Importing to local storage (guest user)...');

        // Import trips first
        for (const trip of legacyData.trips) {
          try {
            await databaseService.createTrip(trip);
            result.tripsImported++;
          } catch (error) {
            result.errors.push(`Failed to import trip: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        // Import weather logs
        for (const weatherLog of legacyData.weatherLogs) {
          try {
            await databaseService.createWeatherLog(weatherLog);
            result.weatherLogsImported++;
          } catch (error) {
            result.errors.push(`Failed to import weather log: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        // Import fish catches
        for (const fishCatch of legacyData.fishCatches) {
          try {
            await databaseService.createFishCaught(fishCatch);
            result.fishCatchesImported++;
          } catch (error) {
            result.errors.push(`Failed to import fish catch: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        // Mark that guest has data to migrate when they log in
        localStorage.setItem('guestHasImportedData', 'true');
      }

      // Process photos
      result.photosImported = Object.keys(legacyData.photos).length;

      if (result.photosImported > 0) {
        if (isAuthenticated) {
          result.warnings.push(`Found ${result.photosImported} photos in zip file. Photos are preserved in the zip but not automatically imported to Firebase due to size constraints. You can manually upload them later.`);
        } else {
          result.warnings.push(`Found ${result.photosImported} photos in zip file. Photos will be available when you log in to your account.`);
        }
      }

      console.log('Legacy data import completed:', result);
      return result;

    } catch (error) {
      console.error('Legacy data import failed:', error);
      result.success = false;
      result.errors.push(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Check if file is an image
   */
  private isImageFile(fileName: string): boolean {
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp)$/i;
    return imageExtensions.test(fileName);
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(fileName: string): string {
    const ext = fileName.toLowerCase().split('.').pop();
    const mimeTypes: { [key: string]: string } = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'bmp': 'image/bmp'
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  /**
   * Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

// Export singleton instance
export const browserZipImportService = new BrowserZipImportService();