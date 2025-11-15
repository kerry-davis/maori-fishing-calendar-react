import type { FishCaught } from "../types";
import { databaseService } from "./databaseService";
import { firebaseDataService } from "./firebaseDataService";
import JSZip from "jszip";
import { DEV_LOG, PROD_ERROR } from '../utils/loggingHelpers';
import Papa from "papaparse";
import { auth, firestore } from "./firebase";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";

/**
 * Data Export Service for the Māori Fishing Calendar
 * Handles export/import of data in JSON and CSV formats
 * Maintains compatibility with existing vanilla JS data formats
 */
export class DataExportService {
  // Lightweight async pool to limit concurrency
  private async runWithConcurrency<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>): Promise<void> {
    const queue = items.map((item, index) => ({ item, index }));
    const runners: Promise<void>[] = [];
    const runNext = async (): Promise<void> => {
      const next = queue.shift();
      if (!next) return;
      try {
        await worker(next.item, next.index);
      } finally {
        await runNext();
      }
    };
    const size = Math.max(1, Math.min(limit, queue.length || limit));
    for (let i = 0; i < size; i++) {
      runners.push(runNext());
    }
    await Promise.all(runners);
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // class body
  // Utility to emit progress with ETA based on start time and completed units
  private emitProgress(
    onProgress: ((p: import("../types").ImportProgress) => void) | undefined,
    phase: string,
    current: number,
    total: number,
    startTs: number,
    message?: string
  ) {
    if (!onProgress) return;
    const now = performance.now?.() ?? Date.now();
    const elapsedSec = (now - startTs) / 1000;
    const ratio = total > 0 ? Math.min(1, Math.max(0, current / total)) : 0;
    const speed = elapsedSec > 0 ? current / elapsedSec : 0; // units per sec
    const remaining = Math.max(0, total - current);
    const eta = speed > 0 ? remaining / speed : undefined;
    onProgress({ phase, current, total, percent: Math.round(ratio * 100), etaSeconds: eta, message });
  }
  /**
   * Export all data as a ZIP file containing JSON data and photos
   */
  async exportDataAsZip(onProgress?: (p: import("../types").ImportProgress) => void): Promise<Blob> {
    DEV_LOG("Exporting data as a zip file...");
    const start = performance.now?.() ?? Date.now();
    this.emitProgress(onProgress, 'collecting', 0, 3, start, 'Collecting data…');

    try {
      // Get all data from Firebase (primary) with fallback to IndexedDB
      const [trips, weatherLogs, fishCaught, savedLocations] = await Promise.all([
        firebaseDataService.isReady() ? firebaseDataService.getAllTrips() : databaseService.getAllTrips(),
        firebaseDataService.isReady() ? firebaseDataService.getAllWeatherLogs() : databaseService.getAllWeatherLogs(),
        firebaseDataService.isReady() ? firebaseDataService.getAllFishCaught() : databaseService.getAllFishCaught(),
        firebaseDataService.isReady() ? firebaseDataService.getAllSavedLocationsForExport() : Promise.resolve([]),
      ]);
      this.emitProgress(onProgress, 'collecting', 1, 3, start, 'Collected data');

      // Get tackle box data
      const gearTypes = this.getLocalStorageData("gearTypes", []);
      const uid = auth?.currentUser?.uid;
      const norm = (v?: string) => (v || '').trim().toLowerCase();
      const mkKey = (d: any) => [norm(d.type), norm(d.brand), norm(d.name), norm(d.colour)].join('|');
      const hashFNV1a = (str: string) => { let h=0x811c9dc5; for (let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,0x01000193);} return ('0000000'+(h>>>0).toString(16)).slice(-8); };
      const stableNumericId = (str: string) => { let h=0x811c9dc5; for (let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,0x01000193);} return (h>>>0); };

      let tacklebox: any[] = [];
      try {
        if (uid && firestore) {
          // Authenticated export: read tackle items directly from Firestore to include gearId (doc.id)
          const snapshot = await getDocs(query(collection(firestore, 'tackleItems'), where('userId', '==', uid)));
          tacklebox = snapshot.docs.map(d => {
            const data: any = d.data();
            return {
              id: stableNumericId(d.id),
              gearId: d.id,
              name: data.name || '',
              brand: data.brand || '',
              type: data.type || '',
              colour: data.colour || ''
            };
          });
        } else {
          // Guest export: use localStorage and synthesize stable gearId matching catch gearIds
          const local = this.getLocalStorageData('tacklebox', []);
          tacklebox = Array.isArray(local) ? local.map((it: any) => ({
            ...it,
            gearId: it.gearId || `local-${hashFNV1a(mkKey(it))}`
          })) : [];
        }
      } catch (e) {
        // Fallback to localStorage if Firestore read fails
        const local = this.getLocalStorageData('tacklebox', []);
        tacklebox = Array.isArray(local) ? local : [];
      }

      // Create export data container matching original format
      const exportDataContainer = {
        indexedDB: {
          trips,
          weather_logs: weatherLogs,
          fish_caught: fishCaught,
          saved_locations: savedLocations,
        },
        localStorage: {
          tacklebox,
          gearTypes,
        },
      };

      // Create ZIP file
      const zip = new JSZip();
      const photosFolder = zip.folder("photos");

      // Add photos to ZIP if they exist (supports inline, Storage-backed, and encrypted photos)
      if (fishCaught && photosFolder) {
        const concurrency = 4;
        let done = 0;
        const total = fishCaught.length;
        await this.runWithConcurrency(fishCaught, concurrency, async (fish, index) => {
          try {
            // 1) Inline data URL
            if (fish.photo && typeof fish.photo === 'string' && fish.photo.startsWith('data:image')) {
              const [header, base64Data] = fish.photo.split(',');
              const mimeMatch = header.match(/data:image\/([^;]+)/);
              const extension = mimeMatch ? mimeMatch[1] : 'jpg';
              const filename = `fish_${fish.id || index}_${Date.now()}.${extension}`;
              photosFolder.file(filename, base64Data, { base64: true });
              (fish as any).photo = filename;
              return;
            }

            // 2) Storage-backed (possibly encrypted)
            const path = (fish as any).photoPath as string | undefined;
            const encryptedMetadata = (fish as any).encryptedMetadata as string | undefined;
            if (path) {
              try {
                const res = await firebaseDataService.getDecryptedPhoto(path, encryptedMetadata);
                if (res && res.data) {
                  const base64 = this.arrayBufferToBase64(res.data);
                  const mime = res.mimeType || 'image/jpeg';
                  const extension = mime.split('/')[1] || 'jpg';
                  const filename = `fish_${fish.id || index}_${Date.now()}.${extension}`;
                  photosFolder.file(filename, base64, { base64: true });
                  (fish as any).photo = filename;
                  return;
                }
              } catch (e) {
                // fall through to photoUrl fetch
              }
            }

            // 3) Public URL fallback
            const url = (fish as any).photoUrl as string | undefined;
            if (url) {
              try {
                const resp = await fetch(url);
                if (resp.ok) {
                  const buf = await resp.arrayBuffer();
                  const contentType = resp.headers.get('content-type') || 'image/jpeg';
                  const base64 = this.arrayBufferToBase64(buf);
                  const extension = contentType.split('/')[1] || 'jpg';
                  const filename = `fish_${fish.id || index}_${Date.now()}.${extension}`;
                  photosFolder.file(filename, base64, { base64: true });
                  (fish as any).photo = filename;
                  return;
                }
              } catch {/* ignore */}
            }
          } catch (error) {
            DEV_LOG(`Failed to process photo for fish ${fish.id}:`, error);
          } finally {
            done++; this.emitProgress(onProgress, 'photos', done, total, start, `Packing photos… (${done}/${total})`);
          }
        });
      }

      // Add JSON data to ZIP
      zip.file("data.json", JSON.stringify(exportDataContainer, null, 2));

      // Generate ZIP blob
      const content = await zip.generateAsync({ type: "blob" }, (meta) => {
        const pct = Math.max(0, Math.min(100, Math.round(meta.percent || 0)));
        this.emitProgress(onProgress, 'zipping', pct, 100, start, `Zipping… ${pct}%`);
      });
      this.emitProgress(onProgress, 'finalizing', 1, 1, start, 'Done');

      DEV_LOG("Data export completed successfully");
      return content;
    } catch (error) {
      PROD_ERROR("Error during data export:", error);
      throw new Error(
        `Failed to export data: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Export all data as CSV files in a ZIP archive
   */
  async exportDataAsCSV(onProgress?: (p: import("../types").ImportProgress) => void): Promise<Blob> {
    DEV_LOG("Exporting data as CSV...");
    const start = performance.now?.() ?? Date.now();
    this.emitProgress(onProgress, 'collecting', 0, 3, start, 'Collecting data…');

    try {
      // Get all data from Firebase (primary) with fallback to IndexedDB
      const [trips, weatherLogs, fishCaught] = await Promise.all([
        firebaseDataService.isReady() ? firebaseDataService.getAllTrips() : databaseService.getAllTrips(),
        firebaseDataService.isReady() ? firebaseDataService.getAllWeatherLogs() : databaseService.getAllWeatherLogs(),
        firebaseDataService.isReady() ? firebaseDataService.getAllFishCaught() : databaseService.getAllFishCaught(),
      ]);
      this.emitProgress(onProgress, 'collecting', 1, 3, start, 'Collected data');

      // Create ZIP file
      const zip = new JSZip();
      const photosFolder = zip.folder("photos");

      // Export trips as CSV
      if (trips.length > 0) {
        const tripsCsv = Papa.unparse(trips);
        zip.file("trips.csv", tripsCsv);
      }

      // Export weather logs as CSV
      if (weatherLogs.length > 0) {
        const weatherCsv = Papa.unparse(weatherLogs);
        zip.file("weather.csv", weatherCsv);
      }

      // Export fish caught as CSV (with photo handling from inline, Storage, or URL)
      if (fishCaught.length > 0) {
        // Preprocess photos with limited concurrency
        const concurrency = 4;
        const processed: any[] = new Array(fishCaught.length);

        let done = 0;
        const total = fishCaught.length;
        await this.runWithConcurrency(fishCaught, concurrency, async (fish, index) => {
          const fishCopy: any = { ...fish };
          // Gear stringification
          if (Array.isArray(fishCopy.gear)) {
            fishCopy.gear = fishCopy.gear.join(', ');
          }

          let fileAdded = false;
          try {
            if (fishCopy.photo && typeof fishCopy.photo === 'string' && fishCopy.photo.startsWith('data:image') && photosFolder) {
              const [header, base64Data] = fishCopy.photo.split(',');
              const mimeMatch = header.match(/data:image\/([^;]+)/);
              const extension = mimeMatch ? mimeMatch[1] : 'jpg';
              const filename = `fish_${fish.id || index}_${Date.now()}.${extension}`;
              photosFolder.file(filename, base64Data, { base64: true });
              fishCopy.photo_filename = filename;
              fileAdded = true;
            } else if (photosFolder) {
              const path = fishCopy.photoPath as string | undefined;
              const enc = fishCopy.encryptedMetadata as string | undefined;
              if (path) {
                try {
                  const res = await firebaseDataService.getDecryptedPhoto(path, enc);
                  if (res && res.data) {
                    const base64 = this.arrayBufferToBase64(res.data);
                    const mime = res.mimeType || 'image/jpeg';
                    const extension = mime.split('/')[1] || 'jpg';
                    const filename = `fish_${fish.id || index}_${Date.now()}.${extension}`;
                    photosFolder.file(filename, base64, { base64: true });
                    fishCopy.photo_filename = filename;
                    fileAdded = true;
                  }
                } catch {/* ignore */}
              }
              if (!fileAdded && fishCopy.photoUrl) {
                try {
                  const resp = await fetch(fishCopy.photoUrl);
                  if (resp.ok) {
                    const buf = await resp.arrayBuffer();
                    const ct = resp.headers.get('content-type') || 'image/jpeg';
                    const base64 = this.arrayBufferToBase64(buf);
                    const extension = ct.split('/')[1] || 'jpg';
                    const filename = `fish_${fish.id || index}_${Date.now()}.${extension}`;
                    photosFolder.file(filename, base64, { base64: true });
                    fishCopy.photo_filename = filename;
                    fileAdded = true;
                  }
                } catch {/* ignore */}
              }
            }
          } catch (e) {
            DEV_LOG(`Failed to process photo for fish ${fish.id}:`, e);
          }

          if (!fileAdded) fishCopy.photo_filename = '';
          delete fishCopy.photo; // remove inline base64 from CSV
          processed[index] = fishCopy;
          done++; this.emitProgress(onProgress, 'photos', done, total, start, `Packing photos… (${done}/${total})`);
        });

        const fishCsv = Papa.unparse(processed);
        zip.file('fish.csv', fishCsv);
      }

      // Generate ZIP blob
      const content = await zip.generateAsync({ type: "blob" }, (meta) => {
        const pct = Math.max(0, Math.min(100, Math.round(meta.percent || 0)));
        this.emitProgress(onProgress, 'zipping', pct, 100, start, `Zipping… ${pct}%`);
      });
      this.emitProgress(onProgress, 'finalizing', 1, 1, start, 'Done');

      DEV_LOG("CSV export completed successfully");
      return content;
    } catch (error) {
      PROD_ERROR("Error during CSV export:", error);
      throw new Error(
        `Failed to export CSV data: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Import data from a ZIP file or JSON file
   */
  async importData(file: File, onProgress?: (p: import("../types").ImportProgress) => void): Promise<ImportResult> {
    const filename = file.name;
    const isZipFile = filename.endsWith(".zip");

    if (isZipFile) {
      return await this.importFromZip(file, filename, onProgress);
    } else {
      return await this.importFromJson(file, filename, onProgress);
    }
  }

  /**
   * Import data from a ZIP file
   */
  private async importFromZip(file: File, filename: string, onProgress?: (p: import("../types").ImportProgress) => void): Promise<ImportResult> {
    try {
      const start = performance.now?.() ?? Date.now();
      this.emitProgress(onProgress, 'reading', 0, 1, start, 'Reading file…');
      const arrayBuffer = await file.arrayBuffer();
      this.emitProgress(onProgress, 'parsing', 0, 1, start, 'Parsing ZIP…');
      const zip = await JSZip.loadAsync(arrayBuffer);

      const dataFile = zip.file("data.json");
      const tripsCsvFile = zip.file("trips.csv");

      if (dataFile) {
        // Import from JSON format
        const content = await dataFile.async("string");
        this.emitProgress(onProgress, 'parsing', 1, 2, start, 'Parsing JSON…');
        const data = JSON.parse(content);

        // Pre-calc basic stats
        const preTrips = Array.isArray(data.indexedDB?.trips) ? data.indexedDB.trips.length : 0;
        const preWeather = Array.isArray(data.indexedDB?.weather_logs) ? data.indexedDB.weather_logs.length : 0;
        const preFish = Array.isArray(data.indexedDB?.fish_caught) ? data.indexedDB.fish_caught.length : 0;
        let photosCount = 0;

        // Handle photos
        const photoPromises: Promise<{ path: string; data: string }>[] = [];
        const photosFolder = zip.folder("photos");

        if (photosFolder) {
          const files: string[] = [];
          photosFolder.forEach((_relativePath, file) => {
            files.push(file.name);
            const promise = file.async("base64").then((base64) => {
              const fileExtension =
                file.name.split(".").pop()?.toLowerCase() || "jpg";
              const mimeType = `image/${fileExtension === "jpg" ? "jpeg" : fileExtension}`;
              return {
                path: file.name,
                data: `data:${mimeType};base64,${base64}`,
              };
            });
            photoPromises.push(promise);
          });
          // Progress for photos decoding
          this.emitProgress(onProgress, 'photos', 0, files.length, start, 'Decoding photos…');
          let done = 0;
          const wrapped = photoPromises.map(p => p.then(r => { done++; this.emitProgress(onProgress, 'photos', done, files.length, start, 'Decoding photos…'); return r; }));
          const photos = await Promise.all(wrapped);
          const photoMap = new Map(photos.map((p) => [p.path, p.data]));
          photosCount = files.length;

          // Restore photo data to fish records
          if (data.indexedDB?.fish_caught) {
            data.indexedDB.fish_caught.forEach((fish: FishCaught) => {
              if (fish.photo && photoMap.has(fish.photo)) {
                fish.photo = photoMap.get(fish.photo);
              }
              // Preserve encryptedMetadata if present
              // (it should already be in the fish record from export)
            });
          }

          this.emitProgress(onProgress, 'importing', 0, 1, start, 'Writing data…');
          await this.processImportData(data, filename, onProgress, start);
          this.emitProgress(onProgress, 'finalizing', 1, 1, start, 'Finalizing…');
          const end = performance.now?.() ?? Date.now();
          return {
            success: true,
            tripsImported: preTrips,
            weatherLogsImported: preWeather,
            fishCatchesImported: preFish,
            photosImported: photosCount,
            durationMs: Math.max(0, end - start),
            errors: [],
            warnings: []
          };
        }

        // No photos folder, proceed to import
        this.emitProgress(onProgress, 'importing', 0, 1, start, 'Writing data…');
        await this.processImportData(data, filename, onProgress, start);
        this.emitProgress(onProgress, 'finalizing', 1, 1, start, 'Finalizing…');
        const end = performance.now?.() ?? Date.now();
        // Photos might be embedded; count those
        const embeddedPhotos = Array.isArray(data.indexedDB?.fish_caught)
          ? (data.indexedDB.fish_caught as FishCaught[]).filter(f => typeof (f as any).photo === 'string' && (f as any).photo.startsWith('data:')).length
          : 0;
        return {
          success: true,
          tripsImported: Array.isArray(data.indexedDB?.trips) ? data.indexedDB.trips.length : 0,
          weatherLogsImported: Array.isArray(data.indexedDB?.weather_logs) ? data.indexedDB.weather_logs.length : 0,
          fishCatchesImported: Array.isArray(data.indexedDB?.fish_caught) ? data.indexedDB.fish_caught.length : 0,
          photosImported: embeddedPhotos,
          durationMs: Math.max(0, end - start),
          errors: [],
          warnings: []
        };
      } else if (tripsCsvFile) {
        // Import from CSV format
        return await this.importFromCsvZip(zip, filename, onProgress);
      } else {
        throw new Error("No valid data files found in ZIP archive");
      }
    } catch (error) {
      PROD_ERROR("Error importing from ZIP:", error);
      throw new Error(
        `Failed to import from ZIP file: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Import data from CSV files in ZIP
   */
  private async importFromCsvZip(zip: JSZip, filename: string, onProgress?: (p: import("../types").ImportProgress) => void): Promise<ImportResult> {
    const start = performance.now?.() ?? Date.now();
    const data: {
      indexedDB: {
        trips: any[];
        weather_logs: any[];
        fish_caught: any[];
      };
      localStorage: Record<string, unknown>;
    } = {
      indexedDB: { trips: [], weather_logs: [], fish_caught: [] },
      localStorage: {},
    };

    // Import CSV files
    const csvFiles = ["trips.csv", "weather.csv", "fish.csv"];
    const storeNames = ["trips", "weather_logs", "fish_caught"];

    this.emitProgress(onProgress, 'parsing', 0, csvFiles.length, start, 'Parsing CSV…');
    for (let i = 0; i < csvFiles.length; i++) {
      const csvFile = zip.file(csvFiles[i]);
      if (csvFile) {
        const csvContent = await csvFile.async("string");
        const parsed = Papa.parse(csvContent, {
          header: true,
          skipEmptyLines: true,
        });

        if (parsed.errors.length > 0) {
          DEV_LOG(`Errors parsing ${csvFiles[i]}:`, parsed.errors);
        }

        data.indexedDB[storeNames[i] as keyof typeof data.indexedDB] =
          parsed.data as any[];
      }
      this.emitProgress(onProgress, 'parsing', i + 1, csvFiles.length, start, 'Parsing CSV…');
    }

    // Handle photos for fish data
    const photosFolder = zip.folder("photos");
    let photosCount = 0;
    if (photosFolder && data.indexedDB.fish_caught.length > 0) {
      const photoPromises: Promise<{ filename: string; data: string }>[] = [];
      const files: string[] = [];

      photosFolder.forEach((relativePath, file) => {
        files.push(relativePath);
        const promise = file.async("base64").then((base64) => {
          const fileExtension =
            file.name.split(".").pop()?.toLowerCase() || "jpg";
          const mimeType = `image/${fileExtension === "jpg" ? "jpeg" : fileExtension}`;
          return {
            filename: relativePath,
            data: `data:${mimeType};base64,${base64}`,
          };
        });
        photoPromises.push(promise);
      });
      // Progress for photos decoding
      this.emitProgress(onProgress, 'photos', 0, files.length, start, 'Decoding photos…');
      let done = 0;
      const wrapped = photoPromises.map(p => p.then(r => { done++; this.emitProgress(onProgress, 'photos', done, files.length, start, 'Decoding photos…'); return r; }));
      const photos = await Promise.all(wrapped);
      const photoMap = new Map(photos.map((p) => [p.filename, p.data]));
  photosCount = files.length;

      // Restore photos to fish records
      data.indexedDB.fish_caught.forEach((fish: any) => {
        if (fish.photo_filename && photoMap.has(fish.photo_filename)) {
          fish.photo = photoMap.get(fish.photo_filename);
        }
        delete fish.photo_filename; // Remove CSV-specific field

        // Convert gear string back to array
        if (typeof fish.gear === "string") {
          fish.gear = fish.gear.split(", ").filter((g: string) => g.trim());
        }
      });
    }

    this.emitProgress(onProgress, 'importing', 0, 1, start, 'Writing data…');
    await this.processImportData(data, filename, onProgress, start);
    this.emitProgress(onProgress, 'finalizing', 1, 1, start, 'Finalizing…');
    const end = performance.now?.() ?? Date.now();
    return {
      success: true,
      tripsImported: data.indexedDB.trips.length,
      weatherLogsImported: data.indexedDB.weather_logs.length,
      fishCatchesImported: data.indexedDB.fish_caught.length,
      photosImported: photosCount,
      durationMs: Math.max(0, end - start),
      errors: [],
      warnings: []
    };
  }

  /**
   * Import data from a JSON file
   */
  private async importFromJson(file: File, filename: string, onProgress?: (p: import("../types").ImportProgress) => void): Promise<ImportResult> {
    try {
      const start = performance.now?.() ?? Date.now();
      this.emitProgress(onProgress, 'reading', 0, 1, start, 'Reading file…');
      const text = await file.text();
      this.emitProgress(onProgress, 'parsing', 1, 1, start, 'Parsing JSON…');
      const data = JSON.parse(text);
      this.emitProgress(onProgress, 'importing', 0, 1, start, 'Writing data…');
      await this.processImportData(data, filename, onProgress, start);
      this.emitProgress(onProgress, 'finalizing', 1, 1, start, 'Finalizing…');
      const end = performance.now?.() ?? Date.now();
      const photosEmbedded = Array.isArray(data.indexedDB?.fish_caught)
        ? (data.indexedDB.fish_caught as FishCaught[]).filter(f => typeof (f as any).photo === 'string' && (f as any).photo.startsWith('data:')).length
        : 0;
      return {
        success: true,
        tripsImported: Array.isArray(data.indexedDB?.trips) ? data.indexedDB.trips.length : 0,
        weatherLogsImported: Array.isArray(data.indexedDB?.weather_logs) ? data.indexedDB.weather_logs.length : 0,
        fishCatchesImported: Array.isArray(data.indexedDB?.fish_caught) ? data.indexedDB.fish_caught.length : 0,
        photosImported: photosEmbedded,
        durationMs: Math.max(0, end - start),
        errors: [],
        warnings: []
      };
    } catch (error) {
      PROD_ERROR("Error importing from JSON:", error);
      throw new Error(
        `Failed to import from JSON file: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Process and validate import data
   */
  private async processImportData(data: any, filename: string, onProgress?: (p: import("../types").ImportProgress) => void, startTs?: number): Promise<void> {
    try {
      // Validate data structure
      if (!this.validateImportData(data)) {
        throw new Error(
          "Invalid data format: 'indexedDB' and 'localStorage' properties must be objects.",
        );
      }

      // Trim strings in the data
      const cleanData = this.trimObjectStrings(data);

      // Import to Firebase only if an authenticated user is present; otherwise use local storage
      const useFirebase = firebaseDataService.isAuthenticated?.()
        ? firebaseDataService.isAuthenticated()
        : (firebaseDataService.isReady() && !(firebaseDataService as any).isGuest);

      if (useFirebase) {
        DEV_LOG("Importing data to Firebase (authenticated user)...");
        await this.importToFirebase(cleanData, onProgress, startTs);
      } else {
        DEV_LOG("Importing data to local storage (guest mode)...");
        await this.importToLocal(cleanData, onProgress, startTs);
      }

      DEV_LOG(`Successfully imported data from "${filename}"`);
    } catch (error) {
      PROD_ERROR("Error processing import data:", error);
      throw new Error(
        `Could not import data from "${filename}": ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Import data to Firebase
   */
  private async importToFirebase(data: any, onProgress?: (p: import("../types").ImportProgress) => void, startTs?: number): Promise<void> {
    // Defensive: if not authenticated, route to local import instead
    if (!firebaseDataService.isAuthenticated?.()) {
      DEV_LOG("importToFirebase called without an authenticated user. Falling back to local import.");
      await this.importToLocal(data, onProgress, startTs);
      return;
    }
    // Import tackle box data via Firebase hooks (this will handle localStorage too)
    if (data.localStorage?.tacklebox) {
      localStorage.setItem("tacklebox", JSON.stringify(data.localStorage.tacklebox));
    }
    if (data.localStorage?.gearTypes) {
      localStorage.setItem("gearTypes", JSON.stringify(data.localStorage.gearTypes));
    }

    // Additionally, persist gear types for authenticated users into Firestore userSettings
    try {
      const uid = auth?.currentUser?.uid;
      if (uid && firestore && Array.isArray(data.localStorage?.gearTypes)) {
        const settingsRef = doc(firestore, "userSettings", uid);
        await setDoc(
          settingsRef,
          {
            userId: uid,
            gearTypes: data.localStorage.gearTypes,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    } catch (e) {
      DEV_LOG("Failed to write gear types to Firestore userSettings during import:", e);
    }

    // If tacklebox items are present, mirror them into Firestore for authenticated users
    // Build a composite-key -> gearId mapping while inserting tackle items
    const keyToGearId = new Map<string, string>();
    const norm = (v?: string) => (v || '').trim().toLowerCase();
    const mkKey = (d: any) => [norm(d.type), norm(d.brand), norm(d.name), norm(d.colour)].join('|');
    const hashFNV1a = (str: string) => {
      let hash = 0x811c9dc5;
      for (let i = 0; i < str.length; i++) { hash ^= str.charCodeAt(i); hash = Math.imul(hash, 0x01000193); }
      return ('0000000' + (hash >>> 0).toString(16)).slice(-8);
    };
    try {
      const uid = auth?.currentUser?.uid;
      const items: any[] | undefined = data.localStorage?.tacklebox;
      if (uid && firestore && Array.isArray(items) && items.length > 0) {
        // Wipe existing user's tackleItems to avoid duplicates, then insert fresh set
        const q = query(collection(firestore, "tackleItems"), where("userId", "==", uid));
        const snapshot = await getDocs(q);

        // Delete in chunks to respect batch limits
        const DEL_CHUNK = 400;
        for (let i = 0; i < snapshot.docs.length; i += DEL_CHUNK) {
          const batch = writeBatch(firestore);
          for (const d of snapshot.docs.slice(i, i + DEL_CHUNK)) {
            batch.delete(d.ref);
          }
          await batch.commit();
        }

        // Insert new items in chunks
        const INS_CHUNK = 400;
        for (let i = 0; i < items.length; i += INS_CHUNK) {
          const batch = writeBatch(firestore);
          for (const item of items.slice(i, i + INS_CHUNK)) {
            const rest = { ...(item || {}) } as Record<string, unknown>;
            delete (rest as any).id;
            const ref = doc(collection(firestore, "tackleItems"));
            const payload = {
              ...rest,
              userId: uid,
              gearId: ref.id,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            } as any;
            batch.set(ref, payload);
            const key = mkKey(payload);
            if (key && !keyToGearId.has(key)) keyToGearId.set(key, ref.id);
          }
          await batch.commit();
        }
      }
    } catch (e) {
      DEV_LOG("Failed to import tackle items into Firestore during import:", e);
    }

    // Import database data to Firebase
    const dbData = data.indexedDB;

    const totalUnits =
      (Array.isArray(dbData.trips) ? dbData.trips.length : 0) +
      (Array.isArray(dbData.weather_logs) ? dbData.weather_logs.length : 0) +
      (Array.isArray(dbData.fish_caught) ? dbData.fish_caught.length : 0) +
      (Array.isArray(dbData.saved_locations) ? dbData.saved_locations.length : 0);
    let doneUnits = 0;

    if (dbData.trips && Array.isArray(dbData.trips)) {
      for (const trip of dbData.trips) {
        // Data cleaning for 'hours'
        if (trip.hours && typeof trip.hours === 'string') {
          const parsedHours = parseFloat(trip.hours);
          trip.hours = isNaN(parsedHours) ? undefined : Math.abs(parsedHours);
        } else if (typeof trip.hours === 'number' && trip.hours < 0) {
          trip.hours = Math.abs(trip.hours);
        } else if (trip.hours === null || trip.hours === '') {
          trip.hours = undefined;
        }

        // Use idempotent upsert to prevent duplicates on repeated imports
        await ((firebaseDataService as any).upsertTripFromImport?.(trip) ?? firebaseDataService.createTrip(trip));
        doneUnits++;
        this.emitProgress(onProgress, 'importing', doneUnits, totalUnits || 1, startTs ?? (performance.now?.() ?? Date.now()), 'Writing trips…');
      }
    }

    if (dbData.weather_logs && Array.isArray(dbData.weather_logs)) {
      for (const weather of dbData.weather_logs) {
        await ((firebaseDataService as any).upsertWeatherLogFromImport?.(weather) ?? firebaseDataService.createWeatherLog(weather));
        doneUnits++;
        this.emitProgress(onProgress, 'importing', doneUnits, totalUnits || 1, startTs ?? (performance.now?.() ?? Date.now()), 'Writing weather…');
      }
    }

    if (dbData.fish_caught && Array.isArray(dbData.fish_caught)) {
      for (const fish of dbData.fish_caught) {
        // Map legacy gear strings/composites to gearIds using newly inserted tackle items
        try {
          const selected: string[] = Array.isArray(fish.gear) ? fish.gear : [];
          const gearIds: string[] = [];
          for (const g of selected) {
            const s = norm(String(g));
            let gid: string | undefined;
            if (s.includes('|')) {
              // incoming composite may be name-first; normalize to type|brand|name|colour used by mkKey
              const parts = s.split('|').map(p => norm(p));
              const key = parts.length === 4 ? [parts[0], parts[1], parts[2], parts[3]].join('|')
                : s;
              gid = keyToGearId.get(key);
            } else {
              // name-only: find first matching by name across key map
              for (const [k, id] of keyToGearId.entries()) {
                const name = k.split('|')[2];
                if (name === s) { gid = id; break; }
              }
            }
            if (!gid) gid = `local-${hashFNV1a(s)}`;
            if (!gearIds.includes(gid)) gearIds.push(gid);
          }
          if (gearIds.length) (fish as any).gearIds = gearIds;
        } catch {/* ignore mapping failures */}
        await ((firebaseDataService as any).upsertFishCaughtFromImport?.(fish) ?? firebaseDataService.createFishCaught(fish));
        doneUnits++;
        this.emitProgress(onProgress, 'importing', doneUnits, totalUnits || 1, startTs ?? (performance.now?.() ?? Date.now()), 'Writing fish…');
      }
    }

    if (dbData.saved_locations && Array.isArray(dbData.saved_locations)) {
      for (const location of dbData.saved_locations) {
        try {
          // Attempt to create the saved location. The create method should handle duplicates.
          await firebaseDataService.createSavedLocation(location);
        } catch (error) {
          if (error instanceof Error && error.message.includes("already exists")) {
            DEV_LOG(`Skipping duplicate saved location: ${location.name}`);
          } else {
            PROD_ERROR(`Failed to import saved location "${location.name}":`, error);
          }
        }
        doneUnits++;
        this.emitProgress(onProgress, 'importing', doneUnits, totalUnits || 1, startTs ?? (performance.now?.() ?? Date.now()), 'Writing saved locations…');
      }
    }
  }

  /**
   * Import data to local storage (fallback)
   */
  private async importToLocal(data: any, onProgress?: (p: import("../types").ImportProgress) => void, startTs?: number): Promise<void> {
    // Clear existing data
    await this.clearAllData();

    // Import localStorage data
    if (data.localStorage?.tacklebox) {
      localStorage.setItem(
        "tacklebox",
        JSON.stringify(data.localStorage.tacklebox),
      );
    }
    if (data.localStorage?.gearTypes) {
      localStorage.setItem(
        "gearTypes",
        JSON.stringify(data.localStorage.gearTypes),
      );
    }

    // Import IndexedDB data
    const dbData = data.indexedDB;
    const totalUnits =
      (Array.isArray(dbData.trips) ? dbData.trips.length : 0) +
      (Array.isArray(dbData.weather_logs) ? dbData.weather_logs.length : 0) +
      (Array.isArray(dbData.fish_caught) ? dbData.fish_caught.length : 0) +
      (Array.isArray(dbData.saved_locations) ? dbData.saved_locations.length : 0);
    let doneUnits = 0;

    if (dbData.trips && Array.isArray(dbData.trips)) {
      for (const trip of dbData.trips) {
        // Data cleaning for 'hours'
        if (trip.hours && typeof trip.hours === 'string') {
          const parsedHours = parseFloat(trip.hours);
          trip.hours = isNaN(parsedHours) ? undefined : Math.abs(parsedHours);
        } else if (typeof trip.hours === 'number' && trip.hours < 0) {
          trip.hours = Math.abs(trip.hours);
        } else if (trip.hours === null || trip.hours === '') {
          trip.hours = undefined;
        }

        // If an ID is present, upsert to preserve original IDs, else create new
        if (typeof trip.id === 'number') {
          await databaseService.updateTrip(trip);
        } else {
          await databaseService.createTrip(trip);
        }
        doneUnits++;
        this.emitProgress(onProgress, 'importing', doneUnits, totalUnits || 1, startTs ?? (performance.now?.() ?? Date.now()), 'Writing trips…');
      }
    }

    if (dbData.weather_logs && Array.isArray(dbData.weather_logs)) {
      for (const weather of dbData.weather_logs) {
        if (typeof weather.id === 'string') {
          await databaseService.updateWeatherLog(weather);
        } else {
          await databaseService.createWeatherLog(weather);
        }
        doneUnits++;
        this.emitProgress(onProgress, 'importing', doneUnits, totalUnits || 1, startTs ?? (performance.now?.() ?? Date.now()), 'Writing weather…');
      }
    }

    if (dbData.fish_caught && Array.isArray(dbData.fish_caught)) {
      // Build local tackle mapping from provided tacklebox
      const items: any[] = Array.isArray(data.localStorage?.tacklebox) ? data.localStorage.tacklebox : [];
      const keyToGearId = new Map<string, string>();
      const nameToIds = new Map<string, string[]>();
      const norm = (v?: string) => (v || '').trim().toLowerCase();
      const mkKey = (d: any) => [norm(d.type), norm(d.brand), norm(d.name), norm(d.colour)].join('|');
      const hashFNV1a = (str: string) => { let hash = 0x811c9dc5; for (let i=0;i<str.length;i++){ hash ^= str.charCodeAt(i); hash = Math.imul(hash,0x01000193);} return ('0000000'+(hash>>>0).toString(16)).slice(-8); };
      for (const it of items) {
        const key = mkKey(it);
        const gid = it.gearId || `local-${hashFNV1a(key)}`;
        if (!keyToGearId.has(key)) keyToGearId.set(key, gid);
        const nm = norm(it.name);
        const arr = nameToIds.get(nm) || [];
        if (!arr.includes(gid)) arr.push(gid);
        nameToIds.set(nm, arr);
      }
      for (const fish of dbData.fish_caught) {
        try {
          const selected: string[] = Array.isArray(fish.gear) ? fish.gear : [];
          const gearIds: string[] = [];
          for (const g of selected) {
            const s = norm(String(g));
            let gid: string | undefined;
            if (s.includes('|')) {
              gid = keyToGearId.get(s);
            } else {
              const ids = nameToIds.get(s) || [];
              gid = ids.length === 1 ? ids[0] : (ids[0] || undefined);
            }
            if (!gid) gid = `local-${hashFNV1a(s)}`;
            if (!gearIds.includes(gid)) gearIds.push(gid);
          }
          if (gearIds.length) (fish as any).gearIds = gearIds;
        } catch {/* ignore mapping failures */}
        if (typeof fish.id === 'string') {
          await databaseService.updateFishCaught(fish);
        } else {
          await databaseService.createFishCaught(fish);
        }
        doneUnits++;
        this.emitProgress(onProgress, 'importing', doneUnits, totalUnits || 1, startTs ?? (performance.now?.() ?? Date.now()), 'Writing fish…');
      }
    }

    if (dbData.saved_locations && Array.isArray(dbData.saved_locations)) {
      for (const location of dbData.saved_locations) {
        try {
          await firebaseDataService.createSavedLocation(location);
        } catch (error) {
          if (error instanceof Error && error.message.includes("already exists")) {
            DEV_LOG(`Skipping duplicate saved location: ${location.name}`);
          } else {
            PROD_ERROR(`Failed to import saved location "${location.name}":`, error);
          }
        }
        doneUnits++;
        this.emitProgress(onProgress, 'importing', doneUnits, totalUnits || 1, startTs ?? (performance.now?.() ?? Date.now()), 'Writing saved locations…');
      }
    }
  }

  /**
   * Validate import data structure
   */
  private validateImportData(data: any): boolean {
    return (
      typeof data === "object" &&
      data !== null &&
      typeof data.indexedDB === "object" &&
      typeof data.localStorage === "object"
    );
  }

  /**
   * Clear all existing data
   */
  private async clearAllData(): Promise<void> {
    // Clear localStorage
    localStorage.removeItem("tacklebox");
    localStorage.removeItem("gearTypes");

    // Clear Firebase data if available
    if (firebaseDataService.isReady()) {
      await firebaseDataService.clearAllData();
    } else {
      // Clear IndexedDB as fallback
      await databaseService.clearAllData();
    }
  }

  /**
   * Recursively trim strings in an object/array
   */
  private trimObjectStrings(obj: any): any {
    if (obj === null || typeof obj !== "object") {
      return typeof obj === "string" ? obj.trim() : obj;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.trimObjectStrings(item));
    }
    const newObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[key] = this.trimObjectStrings(obj[key]);
      }
    }
    return newObj;
  }

  /**
   * Get data from localStorage with fallback
   */
  private getLocalStorageData(key: string, fallback: any): any {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch (error) {
      DEV_LOG(
        `Failed to parse localStorage data for key "${key}":`,
        error,
      );
      return fallback;
    }
  }

  /**
   * Download a blob as a file
   */
  downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

// Export a singleton instance
export const dataExportService = new DataExportService();

// Summary of a normal import operation (non-legacy zip importer)
export interface ImportResult {
  success: boolean;
  tripsImported: number;
  weatherLogsImported: number;
  fishCatchesImported: number;
  photosImported: number;
  durationMs: number;
  errors: string[];
  warnings: string[];
}
