/**
 * Browser-based Zip Import Service
 * Handles zip file imports directly in the browser without requiring Node.js
 * Perfect for mobile devices and web-based migration
 * Supports both guest (offline) and authenticated (online) modes
 *
 * Uses JSZip for proper zip file parsing and handles large files with streaming
 */

import type { Trip, WeatherLog, FishCaught, ImportProgress } from "../types";
import { firebaseDataService } from "./firebaseDataService";
import { databaseService } from "./databaseService";
import { photoCacheService } from "./photoCacheService";

// Dynamically import JSZip to avoid bundling it if not needed
let JSZip: any = null;

export interface ZipImportResult {
  success: boolean;
  tripsImported: number;
  weatherLogsImported: number;
  fishCatchesImported: number;
  photosImported: number;
  durationMs: number;
  duplicatesSkipped: {
    trips: number;
    weatherLogs: number;
    fishCatches: number;
  };
  compressionStats?: {
    imagesProcessed: number;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
  };
  errors: string[];
  warnings: string[];
}

export interface LegacyDataStructure {
  trips: Trip[];
  weatherLogs: WeatherLog[];
  fishCatches: FishCaught[];
  photos: { [key: string]: string }; // filename -> base64 data
}

type ImportStrategy = 'wipe' | 'merge';

/**
 * Browser-based zip file processor for legacy data migration
 */
export class BrowserZipImportService {
  constructor() {
    // Load JSZip dynamically for browser compatibility
    this.loadJSZip();
  }

  /**
   * Dynamically load JSZip library for browser use
   */
  private async loadJSZip(): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('JSZip can only be loaded in browser environment');
    }

    if ((window as any).JSZip) {
      JSZip = (window as any).JSZip;
      return;
    }

    try {
      // Load JSZip from CDN
      await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
      JSZip = (window as any).JSZip;

      if (!JSZip) {
        throw new Error('JSZip failed to load');
      }

      console.log('✅ JSZip loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load JSZip:', error);
      throw new Error('Failed to load zip processing library. Please check your internet connection and try again.');
    }
  }

  /**
   * Load external script dynamically
   */
  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  /**
   * Process a zip file uploaded by the user
   * @param file - The zip file to process
   * @param isAuthenticated - Whether the user is authenticated (has Firebase access)
   */
  async processZipFile(
    file: File,
    isAuthenticated: boolean = false,
    options?: { strategy?: ImportStrategy },
    onProgress?: (p: ImportProgress) => void
  ): Promise<ZipImportResult> {
    const result: ZipImportResult = {
      success: false,
      tripsImported: 0,
      weatherLogsImported: 0,
      fishCatchesImported: 0,
      photosImported: 0,
      durationMs: 0,
      duplicatesSkipped: {
        trips: 0,
        weatherLogs: 0,
        fishCatches: 0
      },
      errors: [],
      warnings: []
    };

    try {
    console.log('Starting zip file processing for:', file.name);
    onProgress?.({ phase: 'reading', current: 0, total: 1, percent: 0, message: 'Reading file…' });

  performance.mark('zip-start');
  // Read file as array buffer
      const arrayBuffer = await this.readFileAsArrayBuffer(file);
    onProgress?.({ phase: 'parsing', current: 0, total: 1, percent: 0, message: 'Parsing ZIP…' });

  // Process the zip content
      const zipContent = await this.parseZipContent(arrayBuffer);

  // Extract legacy data
    let extractResult = await this.extractLegacyData(zipContent, onProgress);
  performance.mark('zip-extracted');

      if (!extractResult.data) {
        console.log('No legacy data found, trying alternative parsing methods...');

        // Try alternative parsing for different zip structures
        const alternativeData = this.extractLegacyDataAlternative(zipContent);
        if (alternativeData) {
          extractResult = { data: alternativeData, warnings: [], compressionStats: undefined };
        }
      }

      if (!extractResult.data) {
        result.errors.push('No valid legacy data found in zip file');
        return result;
      }

      // Add any warnings from extraction
      result.warnings.push(...extractResult.warnings);

      // Store compression stats if available
      if (extractResult.compressionStats) {
        result.compressionStats = extractResult.compressionStats;
        console.log('✅ Compression stats stored:', {
          imagesProcessed: extractResult.compressionStats.imagesProcessed,
          originalSize: extractResult.compressionStats.originalSize,
          compressedSize: extractResult.compressionStats.compressedSize,
          compressionRatio: extractResult.compressionStats.compressionRatio
        });
      } else {
        console.log('⚠️ No compression stats available');
      }

      // Validate data before importing
      const validationResult = this.validateLegacyData(extractResult.data);
      if (!validationResult.isValid) {
        result.errors.push(...validationResult.errors);
        return result;
      }

      // Add validation warnings
      result.warnings.push(...validationResult.warnings);

  // Import the data (clear existing data first)
  const strategy: ImportStrategy = options?.strategy ?? 'wipe';
  performance.mark('import-start');
  onProgress?.({ phase: 'importing', current: 0, total: 1, percent: 0, message: 'Writing data…' });
  const importResult = await this.importLegacyData(extractResult.data, isAuthenticated, strategy);
  performance.mark('import-end');

      result.success = importResult.success;
      result.tripsImported = importResult.tripsImported;
      result.weatherLogsImported = importResult.weatherLogsImported;
      result.fishCatchesImported = importResult.fishCatchesImported;
      result.photosImported = importResult.photosImported;
      result.errors.push(...importResult.errors);
      result.warnings.push(...importResult.warnings);

  const zipTime = performance.measure('zip-total', 'zip-start', 'zip-extracted').duration;
  const importTime = performance.measure('import-total', 'import-start', 'import-end').duration;
  const totalMs = Math.round(zipTime + importTime);
  result.durationMs = totalMs;
  onProgress?.({ phase: 'finalizing', current: 1, total: 1, percent: 100, etaSeconds: 0, message: `Done in ${totalMs}ms` });
  console.log('Zip import completed:', { result, timings: { zipMs: Math.round(zipTime), importMs: Math.round(importTime) } });
      return result;

    } catch (error) {
      console.error('Zip processing failed:', error);

      // Provide specific error messages based on error type
      let errorMessage = 'Failed to process zip file';

      if (error instanceof Error) {
        if (error.message.includes('JSZip')) {
          errorMessage = 'Failed to load zip processing library. Please check your internet connection and try again.';
        } else if (error.message.includes('Invalid zip')) {
          errorMessage = 'The selected file is not a valid zip archive. Please ensure you selected the correct export file.';
        } else if (error.message.includes('FileReader')) {
          errorMessage = 'Failed to read the selected file. The file may be corrupted or too large.';
        } else if (error.message.includes('memory') || error.message.includes('Memory')) {
          errorMessage = 'The zip file is too large to process in the browser. Try importing without photos first, or use a smaller export file.';
        } else {
          errorMessage = `Failed to process zip file: ${error.message}`;
        }
      }

      result.errors.push(errorMessage);

      // Add recovery suggestions
      result.warnings.push('Try these solutions:');
      result.warnings.push('• Ensure the file was exported from the legacy Māori Fishing Calendar app');
      result.warnings.push('• Check that the file is not corrupted or password-protected');
      result.warnings.push('• Try exporting fresh data from the legacy app');
      result.warnings.push('• If the file is very large, try importing without photos first');

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
   * Parse zip content from ArrayBuffer using JSZip
   */
  private async parseZipContent(arrayBuffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
    const content = new Map<string, Uint8Array>();

    try {
      console.log('Parsing zip content with JSZip, arrayBuffer size:', arrayBuffer.byteLength);

      // Ensure JSZip is loaded
      if (!JSZip) {
        await this.loadJSZip();
      }

      // Load zip file
      const zip = await JSZip.loadAsync(arrayBuffer);
      console.log('✅ Zip file loaded successfully');

      // Process each file in the zip
      const filePromises: Promise<void>[] = [];

      zip.forEach((relativePath: string, zipEntry: any) => {
        const promise = (async () => {
          try {
            console.log('Processing file:', relativePath, 'size:', zipEntry._data?.uncompressedSize || 'unknown');

            // Skip directories
            if (zipEntry.dir) {
              console.log('Skipping directory:', relativePath);
              return;
            }

            // Get file content
            const fileContent = await zipEntry.async('uint8array');
            content.set(relativePath, fileContent);

            console.log('✅ Successfully extracted:', relativePath, 'content length:', fileContent.length);
          } catch (error) {
            console.error(`❌ Failed to extract ${relativePath}:`, error);
            // Don't throw here - continue with other files
          }
        })();

        filePromises.push(promise);
      });

      // Wait for all files to be processed
      await Promise.all(filePromises);

      console.log('✅ Zip parsing complete. Files extracted:', Array.from(content.keys()));
      return content;
    } catch (error) {
      console.error('❌ Failed to parse zip content:', error);
      throw new Error(`Invalid zip file format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }


  /**
   * Extract legacy data from zip content
   */
  private async extractLegacyData(zipContent: Map<string, Uint8Array>, onProgress?: (p: ImportProgress) => void): Promise<{ data: LegacyDataStructure | null, warnings: string[], compressionStats?: any }> {
    let legacyData: LegacyDataStructure = {
      trips: [],
      weatherLogs: [],
      fishCatches: [],
      photos: {}
    };

    const photoWarnings: string[] = [];
    let photoResult: { photos: { [key: string]: string }, compressionStats: any } | undefined = undefined;

    try {
      console.log('Extracting legacy data from zip content...');
      console.log('Available files in zip:', Array.from(zipContent.keys()));

      // Process data.json if present
      const dataJson = zipContent.get('data.json');
      if (dataJson) {
        console.log('Found data.json, processing...');
        const jsonText = new TextDecoder().decode(dataJson);
        console.log('JSON content length:', jsonText.length);
        console.log('JSON preview:', jsonText.substring(0, 200) + '...');

        try {
          const data = JSON.parse(jsonText);
          console.log('Parsed JSON data structure:', Object.keys(data));

          // Handle the actual structure: data.indexedDB and data.localStorage
          if (data.indexedDB) {
            if (data.indexedDB.trips) {
              legacyData.trips = data.indexedDB.trips;
              console.log('Found trips in indexedDB:', legacyData.trips.length);
            }
            if (data.indexedDB.weather_logs) {
              legacyData.weatherLogs = data.indexedDB.weather_logs;
              console.log('Found weather logs in indexedDB:', legacyData.weatherLogs.length);
            }
            if (data.indexedDB.fish_caught) {
              legacyData.fishCatches = data.indexedDB.fish_caught;
              console.log('Found fish catches in indexedDB:', legacyData.fishCatches.length);
            }
          }

          if (data.localStorage) {
            if (data.localStorage.tacklebox) {
              console.log('Found tacklebox in localStorage:', data.localStorage.tacklebox.length);
            }
            if (data.localStorage.gearTypes) {
              console.log('Found gearTypes in localStorage:', data.localStorage.gearTypes.length);
            }
          }

          console.log('Final extracted data summary:', {
            trips: legacyData.trips.length,
            weatherLogs: legacyData.weatherLogs.length,
            fishCatches: legacyData.fishCatches.length
          });

        } catch (jsonError) {
          console.error('Failed to parse JSON:', jsonError);
        }
      } else {
        console.log('No data.json found in zip');
      }

      // Process CSV if present
      const tripsCsv = zipContent.get('trips.csv');
      if (tripsCsv && legacyData.trips.length === 0) {
        console.log('Found trips.csv, processing...');
        const csvText = new TextDecoder().decode(tripsCsv);
        console.log('CSV content length:', csvText.length);
        console.log('CSV preview:', csvText.substring(0, 200) + '...');

        const csvData = this.parseCSV(csvText);
        console.log('Parsed CSV rows:', csvData.length);
        legacyData.trips = this.convertCSVToTrips(csvData);
        console.log('Converted to trips:', legacyData.trips.length);
      } else if (!tripsCsv) {
        console.log('No trips.csv found in zip');
      }

      // Process photos that are actually referenced by fish catches to minimize work/memory
      console.log('Looking for referenced photo files...');
      const referencedPhotoKeys = new Set<string>();
      for (const fc of legacyData.fishCatches) {
        if (fc && typeof (fc as any).photo === 'string') {
          const key = (fc as any).photo.startsWith('photos/') || (fc as any).photo.startsWith('images/')
            ? (fc as any).photo
            : `photos/${(fc as any).photo}`;
          if (zipContent.has(key)) referencedPhotoKeys.add(key);
        }
      }
      const totalPhotos = referencedPhotoKeys.size;
      console.log(`Photos referenced by fish: ${totalPhotos}`);

      // Check total size to warn about memory usage
      const totalImageSize = Array.from(zipContent.entries())
        .filter(([fileName]) => referencedPhotoKeys.has(fileName))
        .reduce((total, [, content]) => total + (content?.length || 0), 0);

      console.log(`Total image size: ${(totalImageSize / 1024 / 1024).toFixed(2)} MB`);

      const photoWarnings: string[] = [];

      // Determine compression strategy based on total size
  // Compress only when extremely large to avoid CPU spikes on typical imports
  const shouldCompress = totalImageSize > 100 * 1024 * 1024; // >100MB

      if (totalImageSize > 100 * 1024 * 1024) { // 100MB limit
        console.warn('⚠️ Large image files detected. Will compress images to reduce size.');
        photoWarnings.push('Large image files detected. Images will be automatically compressed to 1080px max width with 85% quality to ensure successful import.');
      } else if (shouldCompress) {
        console.log('ℹ️ Images will be compressed for optimal import performance.');
        photoWarnings.push('Images will be compressed for better import performance while maintaining quality.');
      } else {
        console.log('ℹ️ Images are small enough, using original quality.');
        photoWarnings.push('Images will be imported at original quality.');
      }

      // Process photos with compression
      const compressionOptions = {
        enabled: shouldCompress,
        maxWidth: shouldCompress ? 1080 : 1920, // Use smaller size if compressing
        maxHeight: shouldCompress ? 1080 : 1920,
        quality: shouldCompress ? 0.85 : 0.95, // Higher quality if not compressing
        format: 'jpeg' as const
      };

    console.log('Starting photo processing with compression settings:', compressionOptions);

    const photoResult = await this.processImagesWithCompression(zipContent, compressionOptions, onProgress, referencedPhotoKeys);

      // Attach photos directly to fish catches to avoid keeping a large photos map in memory
      if (totalPhotos > 0) {
        const photoMap = photoResult.photos; // fileName -> dataUri
        for (const fc of legacyData.fishCatches) {
          if (fc && typeof (fc as any).photo === 'string') {
            const key = (fc as any).photo.startsWith('photos/') || (fc as any).photo.startsWith('images/')
              ? (fc as any).photo
              : `photos/${(fc as any).photo}`;
            const dataUri = photoMap[key];
            if (dataUri) {
              (fc as any).photo = dataUri;
            }
          }
        }
        // Clear photos map to free memory
        legacyData.photos = {};
      }

      // Add compression statistics to warnings
      if (photoResult.compressionStats.imagesProcessed > 0) {
        const compressionPercent = photoResult.compressionStats.averageCompressionRatio.toFixed(1);
        const originalMB = (photoResult.compressionStats.totalOriginalSize / 1024 / 1024).toFixed(2);
        const compressedMB = (photoResult.compressionStats.totalCompressedSize / 1024 / 1024).toFixed(2);

        photoWarnings.push(`Photos compressed: ${originalMB}MB → ${compressedMB}MB (${compressionPercent}% size reduction)`);
      }

  console.log('Total referenced photos processed:', totalPhotos);

      // Validate we have some data
      const hasData = legacyData.trips.length > 0 ||
                     legacyData.weatherLogs.length > 0 ||
                     legacyData.fishCatches.length > 0 ||
                     Object.keys(legacyData.photos).length > 0;

      console.log('Data validation - hasData:', hasData);
      console.log('Data summary:', {
        trips: legacyData.trips.length,
        weatherLogs: legacyData.weatherLogs.length,
        fishCatches: legacyData.fishCatches.length,
        photos: totalPhotos
      });

      return hasData ? { data: legacyData, warnings: photoWarnings, compressionStats: photoResult.compressionStats } : { data: null, warnings: photoWarnings, compressionStats: photoResult.compressionStats };

    } catch (error) {
      console.error('Failed to extract legacy data:', error);
      return { data: null, warnings: [...photoWarnings, `Failed to extract legacy data: ${error instanceof Error ? error.message : 'Unknown error'}`], compressionStats: (photoResult as any)?.compressionStats };
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
  private async importLegacyData(legacyData: LegacyDataStructure, isAuthenticated: boolean, strategy: ImportStrategy): Promise<ZipImportResult> {
    const result: ZipImportResult = {
      success: true,
      tripsImported: 0,
      weatherLogsImported: 0,
      fishCatchesImported: 0,
      photosImported: 0,
      durationMs: 0,
      duplicatesSkipped: {
        trips: 0,
        weatherLogs: 0,
        fishCatches: 0
      },
      errors: [],
      warnings: []
    };

    try {
      console.log('Starting legacy data import...');

      // Clear existing data first (as requested)
  console.log('Clearing existing data before import...');
  await this.clearExistingData(isAuthenticated, strategy);

      // Use all data from the zip file (no duplicate checking)
      const tripsToImport = legacyData.trips;
      const weatherLogsToImport = legacyData.weatherLogs;
      const fishCatchesToImport = legacyData.fishCatches;

      console.log(`Import summary: ${tripsToImport.length} trips, ${weatherLogsToImport.length} weather logs, ${fishCatchesToImport.length} fish catches`);

      if (isAuthenticated) {
        // Authenticated user - store in Firebase
        console.log('Importing to Firebase (authenticated user)...');

        // Import trips first
        for (const trip of tripsToImport) {
          try {
            // Normalize hours coming from legacy formats (could be string/empty/negative)
            if (typeof (trip as any).hours === 'string') {
              const parsed = parseFloat((trip as any).hours);
              (trip as any).hours = isNaN(parsed) ? undefined : Math.abs(parsed);
            } else if ((trip as any).hours === null || (trip as any).hours === '') {
              (trip as any).hours = undefined;
            } else if (typeof (trip as any).hours === 'number' && (trip as any).hours < 0) {
              (trip as any).hours = Math.abs((trip as any).hours);
            }
            // Idempotent upsert to prevent duplicates on repeated imports
            if (strategy === 'merge') {
              await firebaseDataService.upsertTripFromImport(trip as any);
            } else {
              await firebaseDataService.createTrip(trip);
            }
            result.tripsImported++;
          } catch (error) {
            result.errors.push(`Failed to import trip: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        // Import weather logs
        for (const weatherLog of weatherLogsToImport) {
          try {
            if (strategy === 'merge') {
              await firebaseDataService.upsertWeatherLogFromImport(weatherLog as any);
            } else {
              await firebaseDataService.createWeatherLog(weatherLog);
            }
            result.weatherLogsImported++;
          } catch (error) {
            result.errors.push(`Failed to import weather log: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        // Import fish catches with photo data
        for (const fishCatch of fishCatchesToImport) {
          try {
            // If fish catch has a photo reference, try to find and attach the actual photo data
            if (fishCatch.photo && typeof fishCatch.photo === 'string') {
              // Look for the photo in the imported photos collection
              const photoKey = fishCatch.photo.startsWith('photos/') ? fishCatch.photo : `photos/${fishCatch.photo}`;
              const actualPhotoData = legacyData.photos[photoKey] || legacyData.photos[fishCatch.photo];

              if (actualPhotoData) {
                // Replace the photo reference with the actual base64 data
                fishCatch.photo = actualPhotoData;
                console.log(`✅ Attached photo to fish catch: ${fishCatch.species}`);
              } else {
                console.warn(`⚠️ Photo reference found but data not available: ${fishCatch.photo}`);
                // Keep the original reference if photo data not found
              }
            }

            if (strategy === 'merge') {
              await firebaseDataService.upsertFishCaughtFromImport(fishCatch as any);
            } else {
              await firebaseDataService.createFishCaught(fishCatch);
            }
            result.fishCatchesImported++;
          } catch (error) {
            result.errors.push(`Failed to import fish catch: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      } else {
        // Guest user - store locally
        console.log('Importing to local storage (guest user)...');

        // Import trips first
        for (const trip of tripsToImport) {
          try {
            // Normalize hours for local imports as well
            if (typeof (trip as any).hours === 'string') {
              const parsed = parseFloat((trip as any).hours);
              (trip as any).hours = isNaN(parsed) ? undefined : Math.abs(parsed);
            } else if ((trip as any).hours === null || (trip as any).hours === '') {
              (trip as any).hours = undefined;
            } else if (typeof (trip as any).hours === 'number' && (trip as any).hours < 0) {
              (trip as any).hours = Math.abs((trip as any).hours);
            }

            await databaseService.createTrip(trip);
            result.tripsImported++;
          } catch (error) {
            result.errors.push(`Failed to import trip: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        // Import weather logs
        for (const weatherLog of weatherLogsToImport) {
          try {
            await databaseService.createWeatherLog(weatherLog);
            result.weatherLogsImported++;
          } catch (error) {
            result.errors.push(`Failed to import weather log: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        // Import fish catches with photo data
        for (const fishCatch of fishCatchesToImport) {
          try {
            // If fish catch has a photo reference, try to find and attach the actual photo data
            if (fishCatch.photo && typeof fishCatch.photo === 'string') {
              // Look for the photo in the imported photos collection
              const photoKey = fishCatch.photo.startsWith('photos/') ? fishCatch.photo : `photos/${fishCatch.photo}`;
              const actualPhotoData = legacyData.photos[photoKey] || legacyData.photos[fishCatch.photo];

              if (actualPhotoData) {
                // Replace the photo reference with the actual base64 data
                fishCatch.photo = actualPhotoData;
                console.log(`✅ Attached photo to fish catch: ${fishCatch.species}`);
              } else {
                console.warn(`⚠️ Photo reference found but data not available: ${fishCatch.photo}`);
                // Keep the original reference if photo data not found
              }
            }

            await databaseService.createFishCaught(fishCatch);
            result.fishCatchesImported++;
          } catch (error) {
            result.errors.push(`Failed to import fish catch: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        // Mark that guest has data to migrate when they log in
        localStorage.setItem('guestHasImportedData', 'true');
      }

      // Compute photos imported as those fish catches that have a photo string (data URL)
      const photosAttached = legacyData.fishCatches.filter(fc => typeof (fc as any).photo === 'string' && (fc as any).photo.startsWith('data:')).length;
      result.photosImported = photosAttached;
      if (photosAttached > 0) {
        result.warnings.push(`✅ Successfully attached ${photosAttached} photo(s) to fish catches. Photos are now visible in the app.`);
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
   * Extract legacy data using alternative parsing methods with enhanced format support
   */
  private extractLegacyDataAlternative(_zipContent: Map<string, Uint8Array>): LegacyDataStructure | null {
    const legacyData: LegacyDataStructure = {
      trips: [],
      weatherLogs: [],
      fishCatches: [],
      photos: {}
    };

    console.log('Trying alternative parsing methods for multiple formats...');

    // Try different parsing strategies
    const parsingStrategies = [
      this.parseAsIndexedDBFormat.bind(this),
      this.parseAsNestedFormat.bind(this),
      this.parseAsFlatFormat.bind(this),
      this.parseAsCSVMixedFormat.bind(this)
    ];

    for (const strategy of parsingStrategies) {
      try {
        const result = strategy(_zipContent);
        if (result) {
          Object.assign(legacyData, result);
          console.log('✅ Successfully parsed using strategy:', strategy.name);
          break;
        }
      } catch (error) {
        console.warn('❌ Strategy failed:', strategy.name, error);
      }
    }

    // Process any image files as photos
    this.processImageFiles(_zipContent, legacyData);

    // Check if we found any data
    const hasData = legacyData.trips.length > 0 ||
                   legacyData.weatherLogs.length > 0 ||
                   legacyData.fishCatches.length > 0 ||
                   Object.keys(legacyData.photos).length > 0;

    console.log('Alternative parsing results:', {
      hasData,
      trips: legacyData.trips.length,
      weatherLogs: legacyData.weatherLogs.length,
      fishCatches: legacyData.fishCatches.length,
      photos: Object.keys(legacyData.photos).length
    });

    return hasData ? legacyData : null;
  }

  /**
   * Parse as IndexedDB format (data.indexedDB.trips, etc.)
   */
  private parseAsIndexedDBFormat(zipContent: Map<string, Uint8Array>): LegacyDataStructure | null {
    for (const [fileName, fileContent] of zipContent.entries()) {
      if (fileName.toLowerCase().endsWith('.json')) {
        const jsonText = new TextDecoder().decode(fileContent);
        const data: any = JSON.parse(jsonText);

        if (data.indexedDB) {
          return {
            trips: data.indexedDB.trips || [],
            weatherLogs: data.indexedDB.weather_logs || [],
            fishCatches: data.indexedDB.fish_caught || [],
            photos: {}
          };
        }
      }
    }
    return null;
  }

  /**
   * Parse as nested format (data.data.trips, etc.)
   */
  private parseAsNestedFormat(zipContent: Map<string, Uint8Array>): LegacyDataStructure | null {
    for (const [fileName, fileContent] of zipContent.entries()) {
      if (fileName.toLowerCase().endsWith('.json')) {
        const jsonText = new TextDecoder().decode(fileContent);
        let data: any = JSON.parse(jsonText);

        // Try different nesting levels
        if (data.data) data = data.data;
        if (data.fishingData) data = data.fishingData;
        if (data.exportData) data = data.exportData;

        if (data.trips || data.weatherLogs || data.fishCatches) {
          return {
            trips: data.trips || [],
            weatherLogs: data.weatherLogs || [],
            fishCatches: data.fishCatches || [],
            photos: {}
          };
        }
      }
    }
    return null;
  }

  /**
   * Parse as flat format (data.trips at root level)
   */
  private parseAsFlatFormat(zipContent: Map<string, Uint8Array>): LegacyDataStructure | null {
    for (const [fileName, fileContent] of zipContent.entries()) {
      if (fileName.toLowerCase().endsWith('.json')) {
        const jsonText = new TextDecoder().decode(fileContent);
        const data: any = JSON.parse(jsonText);

        if (data.trips || data.weather_logs || data.fish_caught) {
          return {
            trips: data.trips || [],
            weatherLogs: data.weather_logs || [],
            fishCatches: data.fish_caught || [],
            photos: {}
          };
        }
      }
    }
    return null;
  }

  /**
   * Parse as CSV mixed format
   */
  private parseAsCSVMixedFormat(zipContent: Map<string, Uint8Array>): LegacyDataStructure | null {
    const csvFiles = Array.from(zipContent.entries()).filter(([fileName]) =>
      fileName.toLowerCase().endsWith('.csv')
    );

    if (csvFiles.length === 0) return null;

    const result: LegacyDataStructure = {
      trips: [],
      weatherLogs: [],
      fishCatches: [],
      photos: {}
    };

    for (const [fileName, fileContent] of csvFiles) {
      const csvText = new TextDecoder().decode(fileContent);

      if (fileName.toLowerCase().includes('trip')) {
        const csvData = this.parseCSV(csvText);
        result.trips = this.convertCSVToTrips(csvData);
      } else if (fileName.toLowerCase().includes('weather')) {
        const csvData = this.parseCSV(csvText);
        result.weatherLogs = this.convertCSVToWeatherLogs(csvData);
      } else if (fileName.toLowerCase().includes('fish')) {
        const csvData = this.parseCSV(csvText);
        result.fishCatches = this.convertCSVToFishCatches(csvData);
      }
    }

    return result.trips.length > 0 || result.weatherLogs.length > 0 || result.fishCatches.length > 0 ? result : null;
  }

  /**
   * Process image files with memory management
   */
  private processImageFiles(zipContent: Map<string, Uint8Array>, legacyData: LegacyDataStructure): void {
    const imageFiles = Array.from(zipContent.entries()).filter(([fileName]) =>
      this.isImageFile(fileName)
    );

    console.log(`Processing ${imageFiles.length} image files...`);

    for (const [fileName, fileContent] of imageFiles) {
      try {
        const base64Data = this.arrayBufferToBase64(fileContent);
        const mimeType = this.getMimeType(fileName);
        legacyData.photos[fileName] = `data:${mimeType};base64,${base64Data}`;
      } catch (error) {
        console.warn('Failed to process image file:', fileName, error);
      }
    }
  }

  /**
   * Convert CSV data to weather logs
   */
  private convertCSVToWeatherLogs(csvData: string[][]): WeatherLog[] {
    const weatherLogs: WeatherLog[] = [];

    csvData.forEach(row => {
      try {
        const weatherLog: WeatherLog = {
          id: String(Date.now() + Math.random()),
          tripId: parseInt(row[0]) || 0,
          timeOfDay: row[1] || '',
          sky: row[2] || '',
          windCondition: row[3] || '',
          windDirection: row[4] || '',
          waterTemp: row[5] || '',
          airTemp: row[6] || ''
        };
        weatherLogs.push(weatherLog);
      } catch (error) {
        console.warn('Failed to parse weather CSV row:', row, error);
      }
    });

    return weatherLogs;
  }

  /**
   * Convert CSV data to fish catches
   */
  private convertCSVToFishCatches(csvData: string[][]): FishCaught[] {
    const fishCatches: FishCaught[] = [];

    csvData.forEach(row => {
      try {
        const fishCatch: FishCaught = {
          id: String(Date.now() + Math.random()),
          tripId: parseInt(row[0]) || 0,
          species: row[1] || '',
          length: row[2] || '',
          weight: row[3] || '',
          time: row[4] || '',
          gear: row[5] ? row[5].split(',').map(s => s.trim()) : [],
          details: row[6] || ''
        };
        fishCatches.push(fishCatch);
      } catch (error) {
        console.warn('Failed to parse fish CSV row:', row, error);
      }
    });

    return fishCatches;
  }

  /**
   * Validate legacy data structure and content
   */
  private validateLegacyData(data: LegacyDataStructure): { isValid: boolean, errors: string[], warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required structure
    if (!data) {
      errors.push('No data provided');
      return { isValid: false, errors, warnings };
    }

    // Validate trips
    if (data.trips && Array.isArray(data.trips)) {
      data.trips.forEach((trip, index) => {
        if (!trip.date) {
          errors.push(`Trip ${index + 1}: missing date`);
        }
        if (!trip.water) {
          warnings.push(`Trip ${index + 1}: missing water body`);
        }
        if (!trip.location) {
          warnings.push(`Trip ${index + 1}: missing location`);
        }
      });
    } else {
      warnings.push('No trips data found or invalid format');
    }

    // Validate weather logs
    if (data.weatherLogs && Array.isArray(data.weatherLogs)) {
      data.weatherLogs.forEach((weather, index) => {
        if (!weather.tripId) {
          errors.push(`Weather log ${index + 1}: missing tripId`);
        }
      });
    }

    // Validate fish catches
    if (data.fishCatches && Array.isArray(data.fishCatches)) {
      data.fishCatches.forEach((fish, index) => {
        if (!fish.tripId) {
          errors.push(`Fish catch ${index + 1}: missing tripId`);
        }
        if (!fish.species) {
          errors.push(`Fish catch ${index + 1}: missing species`);
        }
      });
    }

    // Validate photos
    if (data.photos) {
      let totalPhotoSize = 0;
      for (const [fileName, photoData] of Object.entries(data.photos)) {
        if (typeof photoData === 'string' && photoData.startsWith('data:')) {
          // Estimate base64 size
          totalPhotoSize += photoData.length * 0.75; // base64 is ~4/3 larger than binary
        } else {
          errors.push(`Invalid photo data for ${fileName}`);
        }
      }

      if (totalPhotoSize > 100 * 1024 * 1024) { // 100MB
        warnings.push(`Large total photo size (${(totalPhotoSize / 1024 / 1024).toFixed(2)}MB) may cause memory issues`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Clear all existing data before import
   * @param isAuthenticated - Whether the user is authenticated
   */
  private async clearExistingData(isAuthenticated: boolean, strategy: ImportStrategy): Promise<void> {
    try {
      console.log('Clearing existing data before import...');

      if (isAuthenticated) {
        if (strategy === 'wipe') {
          await firebaseDataService.clearFirestoreUserData();
          console.log('✅ Firebase user - cloud data wiped successfully');
        } else {
          console.log('ℹ️ Firebase user - merge mode: preserving existing cloud data');
        }
      } else {
        if (strategy === 'wipe') {
          await databaseService.clearAllData();
          console.log('✅ Local data cleared successfully');
        } else {
          console.log('ℹ️ Guest user - merge mode: preserving existing local data');
        }
      }
    } catch (error) {
      console.error('Failed to clear existing data:', error);
      throw new Error(`Failed to clear existing data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Compress image data with configurable settings
   * @param imageData - Raw image data as Uint8Array
   * @param fileName - Original filename for format detection
   * @param options - Compression options
   */
  private async compressImage(
    imageData: Uint8Array,
    fileName: string,
    options: {
      maxWidth?: number;
      maxHeight?: number;
      quality?: number;
      format?: 'jpeg' | 'png' | 'webp';
    } = {}
  ): Promise<{ compressedData: Uint8Array; originalSize: number; compressedSize: number; compressionRatio: number }> {

    const defaultOptions = {
      maxWidth: 1080,
      maxHeight: 1080,
      quality: 0.85,
      format: 'jpeg' as const
    };

    const config = { ...defaultOptions, ...options };

    // Fallback for non-DOM environments (e.g., Vitest jsdom without Canvas/Image)
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      // Return original data unchanged; caching still benefits perf in tests
      const originalSize = imageData.length;
      const compressedSize = imageData.length;
      return Promise.resolve({
        compressedData: imageData,
        originalSize,
        compressedSize,
        compressionRatio: 0,
      });
    }

    return new Promise((resolve) => {
      const resolveIdentity = () => {
        const originalSize = imageData.length;
        const compressedSize = imageData.length;
        resolve({
          compressedData: imageData,
          originalSize,
          compressedSize,
          compressionRatio: 0,
        });
      };

      try {
        // Create blob from image data
        const blob = new Blob([imageData as unknown as ArrayBuffer], { type: this.getMimeType(fileName) });

        // Create image element for processing
        const img = new Image();
        const canvas = document.createElement('canvas');
        let ctx: CanvasRenderingContext2D | null = null;
        try {
          ctx = canvas.getContext('2d');
        } catch {
          // jsdom may throw "Not implemented"; fall back to identity
          return resolveIdentity();
        }

        if (!ctx) return resolveIdentity();

        img.onload = () => {
          try {
            // Calculate new dimensions
            const { width: newWidth, height: newHeight } = this.calculateDimensions(
              img.width,
              img.height,
              config.maxWidth,
              config.maxHeight
            );

            // Set canvas dimensions
            canvas.width = newWidth;
            canvas.height = newHeight;

            // Draw and compress image
            ctx.drawImage(img, 0, 0, newWidth, newHeight);

            // Convert to desired format
            const compressedBlob = canvas.toDataURL(`image/${config.format}`, config.quality);

            // Convert back to Uint8Array
            const base64Data = compressedBlob.split(',')[1];
            const binaryString = atob(base64Data);
            const compressedArray = new Uint8Array(binaryString.length);

            for (let i = 0; i < binaryString.length; i++) {
              compressedArray[i] = binaryString.charCodeAt(i);
            }

            const originalSize = imageData.length;
            const compressedSize = compressedArray.length;
            const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

            console.log(`Image compressed: ${fileName}`);
            console.log(`  Original: ${(originalSize / 1024).toFixed(2)} KB`);
            console.log(`  Compressed: ${(compressedSize / 1024).toFixed(2)} KB`);
            console.log(`  Ratio: ${compressionRatio.toFixed(1)}% reduction`);
            console.log(`  Dimensions: ${img.width}x${img.height} → ${newWidth}x${newHeight}`);

            resolve({
              compressedData: compressedArray,
              originalSize,
              compressedSize,
              compressionRatio
            });

          } catch {
            return resolveIdentity();
          }
        };

        img.onerror = () => resolveIdentity();

        // Create object URL for the image
        const objectUrl = URL.createObjectURL(blob);
        img.src = objectUrl;

        // Clean up object URL after processing
        setTimeout(() => {
          URL.revokeObjectURL(objectUrl);
        }, 1000);

      } catch {
        // Any setup failure -> identity
        return resolveIdentity();
      }
    });
  }

  /**
   * Calculate optimal dimensions maintaining aspect ratio
   */
  private calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {

    // If image is already within bounds, return original dimensions
    if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
      return { width: originalWidth, height: originalHeight };
    }

    const aspectRatio = originalWidth / originalHeight;

    let newWidth = maxWidth;
    let newHeight = maxWidth / aspectRatio;

    // If calculated height exceeds maxHeight, recalculate based on height
    if (newHeight > maxHeight) {
      newHeight = maxHeight;
      newWidth = maxHeight * aspectRatio;
    }

    return {
      width: Math.round(newWidth),
      height: Math.round(newHeight)
    };
  }

  /**
   * Process images with compression
   */
  private async processImagesWithCompression(
    zipContent: Map<string, Uint8Array>,
    compressionOptions: {
      enabled: boolean;
      maxWidth: number;
      maxHeight: number;
      quality: number;
      format: 'jpeg' | 'png' | 'webp';
    } = {
      enabled: true,
      maxWidth: 1080,
      maxHeight: 1080,
      quality: 0.85,
      format: 'jpeg'
    },
    onProgress?: (p: ImportProgress) => void,
    referencedPhotoKeys?: Set<string>
  ): Promise<{ photos: { [key: string]: string }, compressionStats: any }> {

    let imageFiles = Array.from(zipContent.entries()).filter(([fileName]) =>
      this.isImageFile(fileName)
    );
    if (referencedPhotoKeys && referencedPhotoKeys.size > 0) {
      imageFiles = imageFiles.filter(([fileName]) => referencedPhotoKeys.has(fileName));
    }

  console.log(`Processing ${imageFiles.length} images with compression...`);
  onProgress?.({ phase: 'photos', current: 0, total: imageFiles.length, percent: 0, message: 'Processing photos…' });

    const photos: { [key: string]: string } = {};
    const compressionStats = {
      totalOriginalSize: 0,
      totalCompressedSize: 0,
      imagesProcessed: 0,
      averageCompressionRatio: 0
    };

  // Process images in chunks to avoid browser memory issues
  const cores = (typeof navigator !== 'undefined' && (navigator as any).hardwareConcurrency) ? (navigator as any).hardwareConcurrency : 4;
  const chunkSize = Math.max(2, Math.min(cores, 4)); // keep conservative parallelism to reduce lockups

    for (let i = 0; i < imageFiles.length; i += chunkSize) {
      const chunk = imageFiles.slice(i, i + chunkSize);
      console.log(`Processing image chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(imageFiles.length / chunkSize)}`);

      const chunkPromises = chunk.map(async ([fileName, fileContent]) => {
        try {
          // Compute content hash for cache key
          const hash = await this.sha256Hex(fileContent);
          const optionsKey = `${compressionOptions.enabled ? '1' : '0'}:${compressionOptions.maxWidth}x${compressionOptions.maxHeight}:${compressionOptions.quality}:${compressionOptions.format}`;
          const cacheKey = `${hash}|${optionsKey}`;

          // Try cache first
          const cached = await photoCacheService.get(cacheKey);
          if (cached) {
            // Update stats using cached sizes
            compressionStats.totalOriginalSize += cached.originalSize;
            compressionStats.totalCompressedSize += cached.compressedSize;
            compressionStats.imagesProcessed++;
            return { fileName, data: cached.dataUri };
          }

          if (compressionOptions.enabled) {
            // Compress the image
            const compressionResult = await this.compressImage(fileContent, fileName, {
              maxWidth: compressionOptions.maxWidth,
              maxHeight: compressionOptions.maxHeight,
              quality: compressionOptions.quality,
              format: compressionOptions.format
            });

            // Update compression stats
            compressionStats.totalOriginalSize += compressionResult.originalSize;
            compressionStats.totalCompressedSize += compressionResult.compressedSize;
            compressionStats.imagesProcessed++;

            // Convert compressed data to base64
            const base64Data = this.arrayBufferToBase64(compressionResult.compressedData);
            const mimeType = `image/${compressionOptions.format}`;
            const dataUri = `data:${mimeType};base64,${base64Data}`;

            // Store in cache
            await photoCacheService.set({
              key: cacheKey,
              dataUri,
              mimeType,
              originalSize: compressionResult.originalSize,
              compressedSize: compressionResult.compressedSize,
              createdAt: Date.now(),
            });

            return { fileName, data: dataUri };
          } else {
            // No compression - use original
            const base64Data = this.arrayBufferToBase64(fileContent);
            const mimeType = this.getMimeType(fileName);
            compressionStats.totalOriginalSize += fileContent.length;
            compressionStats.totalCompressedSize += fileContent.length;
            compressionStats.imagesProcessed++;
            const dataUri = `data:${mimeType};base64,${base64Data}`;
            // Store uncompressed in cache as well to skip recomputation
            await photoCacheService.set({
              key: cacheKey,
              dataUri,
              mimeType,
              originalSize: fileContent.length,
              compressedSize: fileContent.length,
              createdAt: Date.now(),
            });
            return { fileName, data: dataUri };
          }
        } catch (error) {
          console.error(`Failed to process image ${fileName}:`, error);
          return { fileName, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);

      // Process results
      for (const result of chunkResults) {
        if (result.error) {
          console.error(`Skipping image ${result.fileName}: ${result.error}`);
        } else if (result.data) {
          photos[result.fileName] = result.data;
        }
      }

      // Yield to UI to avoid long main-thread blocks
      await new Promise(resolve => setTimeout(resolve, 0));

      const processed = Math.min(imageFiles.length, i + chunk.length);
      const percent = imageFiles.length > 0 ? Math.round((processed / imageFiles.length) * 100) : 100;
      onProgress?.({ phase: 'photos', current: processed, total: imageFiles.length, percent, message: `Processing photos… (${processed}/${imageFiles.length})` });
    }

    // Calculate final stats
    if (compressionStats.imagesProcessed > 0) {
      compressionStats.averageCompressionRatio =
        ((compressionStats.totalOriginalSize - compressionStats.totalCompressedSize) / compressionStats.totalOriginalSize) * 100;
    } else {
      compressionStats.averageCompressionRatio = 0;
    }

    console.log('Image compression completed:');
    console.log(`  Total original size: ${(compressionStats.totalOriginalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Total compressed size: ${(compressionStats.totalCompressedSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Average compression ratio: ${compressionStats.averageCompressionRatio.toFixed(1)}%`);
    console.log(`  Images processed: ${compressionStats.imagesProcessed}/${imageFiles.length}`);

    // Ensure compressionRatio is properly set
    const finalCompressionStats = {
      ...compressionStats,
      compressionRatio: compressionStats.averageCompressionRatio
    };

    return { photos, compressionStats: finalCompressionStats };
  }

  // TEST-ONLY: expose image processing for smoke/perf tests without needing a real browser zip
  // Not used in production code paths
  public async __test_processImages(zipContent: Map<string, Uint8Array>, enableCompression = false) {
    return this.processImagesWithCompression(zipContent, {
      enabled: enableCompression,
      maxWidth: 1080,
      maxHeight: 1080,
      quality: 0.85,
      format: 'jpeg'
    });
  }

  /** Compute SHA-256 hex for a Uint8Array */
  private async sha256Hex(data: Uint8Array): Promise<string> {
    try {
      if (globalThis.crypto?.subtle) {
        // Create a real ArrayBuffer to satisfy TS DOM typings (avoid SharedArrayBuffer)
        const ab = new ArrayBuffer(data.byteLength);
        new Uint8Array(ab).set(data);
        const digest = await globalThis.crypto.subtle.digest('SHA-256', ab);
        const bytes = new Uint8Array(digest);
        let hex = '';
        for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
        return hex;
      }
      throw new Error('subtle crypto unavailable');
    } catch {
      // Fallback: FNV-1a over bytes (fast, adequate for cache keys in tests)
      let hash1 = 0x811c9dc5;
      let hash2 = 0x811c9dc5 ^ 0xabcdef01; // mix into two lanes for 64-bit like output
      for (let i = 0; i < data.length; i++) {
        const c = data[i];
        hash1 ^= c; hash1 = Math.imul(hash1, 0x01000193);
        hash2 ^= (c ^ 0xa5); hash2 = Math.imul(hash2, 0x01000193);
      }
      const h1 = (hash1 >>> 0).toString(16).padStart(8, '0');
      const h2 = (hash2 >>> 0).toString(16).padStart(8, '0');
      return h1 + h2;
    }
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