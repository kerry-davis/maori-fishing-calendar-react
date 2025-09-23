import type { FishCaught } from "../types";
import { databaseService } from "./databaseService";
import { firebaseDataService } from "./firebaseDataService";
import JSZip from "jszip";
import Papa from "papaparse";

/**
 * Data Export Service for the Māori Fishing Calendar
 * Handles export/import of data in JSON and CSV formats
 * Maintains compatibility with existing vanilla JS data formats
 */
export class DataExportService {
  /**
   * Export all data as a ZIP file containing JSON data and photos
   */
  async exportDataAsZip(): Promise<Blob> {
    console.log("Exporting data as a zip file...");

    try {
      // Get all data from Firebase (primary) with fallback to IndexedDB
      const [trips, weatherLogs, fishCaught] = await Promise.all([
        firebaseDataService.isReady() ? firebaseDataService.getAllTrips() : databaseService.getAllTrips(),
        firebaseDataService.isReady() ? firebaseDataService.getAllWeatherLogs() : databaseService.getAllWeatherLogs(),
        firebaseDataService.isReady() ? firebaseDataService.getAllFishCaught() : databaseService.getAllFishCaught(),
      ]);

      // Get tackle box data from Firebase hooks (with localStorage fallback)
      const tacklebox = this.getLocalStorageData("tacklebox", []);
      const gearTypes = this.getLocalStorageData("gearTypes", []);

      // Create export data container matching original format
      const exportDataContainer = {
        indexedDB: {
          trips,
          weather_logs: weatherLogs,
          fish_caught: fishCaught,
        },
        localStorage: {
          tacklebox,
          gearTypes,
        },
      };

      // Create ZIP file
      const zip = new JSZip();
      const photosFolder = zip.folder("photos");

      // Add photos to ZIP if they exist
      if (fishCaught && photosFolder) {
        fishCaught.forEach((fish, index) => {
          if (fish.photo && fish.photo.startsWith("data:image")) {
            try {
              // Extract base64 data and determine file extension
              const [header, base64Data] = fish.photo.split(",");
              const mimeMatch = header.match(/data:image\/([^;]+)/);
              const extension = mimeMatch ? mimeMatch[1] : "jpg";

              // Create filename
              const filename = `fish_${fish.id || index}_${Date.now()}.${extension}`;

              // Add photo to ZIP
              photosFolder.file(filename, base64Data, { base64: true });

              // Update fish record to reference photo filename
              fish.photo = filename;
            } catch (error) {
              console.warn(
                `Failed to process photo for fish ${fish.id}:`,
                error,
              );
              // Remove invalid photo data
              delete fish.photo;
            }
          }
        });
      }

      // Add JSON data to ZIP
      zip.file("data.json", JSON.stringify(exportDataContainer, null, 2));

      // Generate ZIP blob
      const content = await zip.generateAsync({ type: "blob" });

      console.log("Data export completed successfully");
      return content;
    } catch (error) {
      console.error("Error during data export:", error);
      throw new Error(
        `Failed to export data: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Export all data as CSV files in a ZIP archive
   */
  async exportDataAsCSV(): Promise<Blob> {
    console.log("Exporting data as CSV...");

    try {
      // Get all data from Firebase (primary) with fallback to IndexedDB
      const [trips, weatherLogs, fishCaught] = await Promise.all([
        firebaseDataService.isReady() ? firebaseDataService.getAllTrips() : databaseService.getAllTrips(),
        firebaseDataService.isReady() ? firebaseDataService.getAllWeatherLogs() : databaseService.getAllWeatherLogs(),
        firebaseDataService.isReady() ? firebaseDataService.getAllFishCaught() : databaseService.getAllFishCaught(),
      ]);

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

      // Export fish caught as CSV (with photo handling)
      if (fishCaught.length > 0) {
        const fishDataForCsv = fishCaught.map((fish, index) => {
          const fishCopy = { ...fish };

          // Handle gear array - convert to string
          if (Array.isArray(fishCopy.gear)) {
            (fishCopy as any).gear = fishCopy.gear.join(", ");
          }

          // Handle photos
          if (
            fishCopy.photo &&
            fishCopy.photo.startsWith("data:image") &&
            photosFolder
          ) {
            try {
              // Extract base64 data and determine file extension
              const [header, base64Data] = fishCopy.photo.split(",");
              const mimeMatch = header.match(/data:image\/([^;]+)/);
              const extension = mimeMatch ? mimeMatch[1] : "jpg";

              // Create filename
              const filename = `fish_${fish.id || index}_${Date.now()}.${extension}`;

              // Add photo to ZIP
              photosFolder.file(filename, base64Data, { base64: true });

              // Set photo filename in CSV data
              (fishCopy as any).photo_filename = filename;
            } catch (error) {
              console.warn(
                `Failed to process photo for fish ${fish.id}:`,
                error,
              );
              (fishCopy as any).photo_filename = "";
            }
          } else {
            (fishCopy as any).photo_filename = "";
          }

          // Remove the large base64 string from CSV
          delete fishCopy.photo;

          return fishCopy;
        });

        const fishCsv = Papa.unparse(fishDataForCsv);
        zip.file("fish.csv", fishCsv);
      }

      // Generate ZIP blob
      const content = await zip.generateAsync({ type: "blob" });

      console.log("CSV export completed successfully");
      return content;
    } catch (error) {
      console.error("Error during CSV export:", error);
      throw new Error(
        `Failed to export CSV data: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Import data from a ZIP file or JSON file
   */
  async importData(file: File): Promise<void> {
    const filename = file.name;
    const isZipFile = filename.endsWith(".zip");

    if (isZipFile) {
      await this.importFromZip(file, filename);
    } else {
      await this.importFromJson(file, filename);
    }
  }

  /**
   * Import data from a ZIP file
   */
  private async importFromZip(file: File, filename: string): Promise<void> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      const dataFile = zip.file("data.json");
      const tripsCsvFile = zip.file("trips.csv");

      if (dataFile) {
        // Import from JSON format
        const content = await dataFile.async("string");
        const data = JSON.parse(content);

        // Handle photos
        const photoPromises: Promise<{ path: string; data: string }>[] = [];
        const photosFolder = zip.folder("photos");

        if (photosFolder) {
          photosFolder.forEach((_relativePath, file) => {
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
        }

        const photos = await Promise.all(photoPromises);
        const photoMap = new Map(photos.map((p) => [p.path, p.data]));

        // Restore photo data to fish records
        if (data.indexedDB?.fish_caught) {
          data.indexedDB.fish_caught.forEach((fish: FishCaught) => {
            if (fish.photo && photoMap.has(fish.photo)) {
              fish.photo = photoMap.get(fish.photo);
            }
          });
        }

        await this.processImportData(data, filename);
      } else if (tripsCsvFile) {
        // Import from CSV format
        await this.importFromCsvZip(zip, filename);
      } else {
        throw new Error("No valid data files found in ZIP archive");
      }
    } catch (error) {
      console.error("Error importing from ZIP:", error);
      throw new Error(
        `Failed to import from ZIP file: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Import data from CSV files in ZIP
   */
  private async importFromCsvZip(zip: JSZip, filename: string): Promise<void> {
    const data: {
      indexedDB: {
        trips: any[];
        weather_logs: any[];
        fish_caught: any[];
      };
      localStorage: {};
    } = {
      indexedDB: { trips: [], weather_logs: [], fish_caught: [] },
      localStorage: {},
    };

    // Import CSV files
    const csvFiles = ["trips.csv", "weather.csv", "fish.csv"];
    const storeNames = ["trips", "weather_logs", "fish_caught"];

    for (let i = 0; i < csvFiles.length; i++) {
      const csvFile = zip.file(csvFiles[i]);
      if (csvFile) {
        const csvContent = await csvFile.async("string");
        const parsed = Papa.parse(csvContent, {
          header: true,
          skipEmptyLines: true,
        });

        if (parsed.errors.length > 0) {
          console.warn(`Errors parsing ${csvFiles[i]}:`, parsed.errors);
        }

        data.indexedDB[storeNames[i] as keyof typeof data.indexedDB] =
          parsed.data as any[];
      }
    }

    // Handle photos for fish data
    const photosFolder = zip.folder("photos");
    if (photosFolder && data.indexedDB.fish_caught.length > 0) {
      const photoPromises: Promise<{ filename: string; data: string }>[] = [];

      photosFolder.forEach((relativePath, file) => {
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

      const photos = await Promise.all(photoPromises);
      const photoMap = new Map(photos.map((p) => [p.filename, p.data]));

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

    await this.processImportData(data, filename);
  }

  /**
   * Import data from a JSON file
   */
  private async importFromJson(file: File, filename: string): Promise<void> {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await this.processImportData(data, filename);
    } catch (error) {
      console.error("Error importing from JSON:", error);
      throw new Error(
        `Failed to import from JSON file: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Process and validate import data
   */
  private async processImportData(data: any, filename: string): Promise<void> {
    try {
      // Validate data structure
      if (!this.validateImportData(data)) {
        throw new Error(
          "Invalid data format: 'indexedDB' and 'localStorage' properties must be objects.",
        );
      }

      // Trim strings in the data
      const cleanData = this.trimObjectStrings(data);

      // Import to Firebase if user is authenticated, otherwise use local storage
      const useFirebase = firebaseDataService.isReady();

      if (useFirebase) {
        console.log("Importing data to Firebase...");
        await this.importToFirebase(cleanData);
      } else {
        console.log("Importing data to local storage...");
        await this.importToLocal(cleanData);
      }

      console.log(`Successfully imported data from "${filename}"`);
    } catch (error) {
      console.error("Error processing import data:", error);
      throw new Error(
        `Could not import data from "${filename}": ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Import data to Firebase
   */
  private async importToFirebase(data: any): Promise<void> {
    // Import tackle box data via Firebase hooks (this will handle localStorage too)
    if (data.localStorage?.tacklebox) {
      localStorage.setItem("tacklebox", JSON.stringify(data.localStorage.tacklebox));
    }
    if (data.localStorage?.gearTypes) {
      localStorage.setItem("gearTypes", JSON.stringify(data.localStorage.gearTypes));
    }

    // Import database data to Firebase
    const dbData = data.indexedDB;

    if (dbData.trips && Array.isArray(dbData.trips)) {
      for (const trip of dbData.trips) {
        await firebaseDataService.createTrip(trip);
      }
    }

    if (dbData.weather_logs && Array.isArray(dbData.weather_logs)) {
      for (const weather of dbData.weather_logs) {
        await firebaseDataService.createWeatherLog(weather);
      }
    }

    if (dbData.fish_caught && Array.isArray(dbData.fish_caught)) {
      for (const fish of dbData.fish_caught) {
        await firebaseDataService.createFishCaught(fish);
      }
    }
  }

  /**
   * Import data to local storage (fallback)
   */
  private async importToLocal(data: any): Promise<void> {
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

    if (dbData.trips && Array.isArray(dbData.trips)) {
      for (const trip of dbData.trips) {
        await databaseService.createTrip(trip);
      }
    }

    if (dbData.weather_logs && Array.isArray(dbData.weather_logs)) {
      for (const weather of dbData.weather_logs) {
        await databaseService.createWeatherLog(weather);
      }
    }

    if (dbData.fish_caught && Array.isArray(dbData.fish_caught)) {
      for (const fish of dbData.fish_caught) {
        await databaseService.createFishCaught(fish);
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
      console.warn(
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
