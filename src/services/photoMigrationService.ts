/**
 * Photo Migration Service
 * Handles background migration of existing legacy photos to encrypted format
 *
 * Features:
 * - Batch processing with configurable batch sizes
 * - Progress tracking and persistence
 * - Failure recovery with retry mechanisms
 * - Real-time status updates
 * - Pause/resume functionality
 */

import type { FishCaught } from '../types';
import { firebaseDataService } from './firebaseDataService';
import { photoEncryptionService } from './photoEncryptionService';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

interface MigrationProgress {
  totalPhotos: number;
  processedPhotos: number;
  currentBatch: number;
  totalBatches: number;
  startTime: Date;
  estimatedCompletion?: Date;
  status: 'not_started' | 'in_progress' | 'paused' | 'completed' | 'failed';
  lastError?: string;
  failedPhotos: string[];
  successfulPhotos: string[];
}

interface MigrationBatch {
  batchId: string;
  photoIds: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  error?: string;
  processedCount: number;
  failedCount: number;
  // Track per-photo outcome ids for accurate accounting
  processedPhotos?: string[];
  failedPhotos?: string[];
  successfulPhotos?: string[];
}

interface MigrationResult {
  success: boolean;
  processedCount: number;
  failedCount: number;
  errors: string[];
  // Per-photo outcomes to allow caller to update global progress accurately
  perPhotoOutcomes: Array<{ id: string; success: boolean; error?: string }>;
  nextBatch?: string;
}

class PhotoMigrationService {
  private isRunning = false;
  private progress: MigrationProgress = this.getDefaultProgress();
  private currentBatch: MigrationBatch | null = null;
  private readonly BATCH_SIZE = 5;
  private readonly MAX_PROCESSING_TIME = 30000; // 30 seconds
  private readonly STORAGE_KEY = 'photoMigrationProgress';

  /**
   * Get default progress state
   */
  private getDefaultProgress(): MigrationProgress {
    return {
      totalPhotos: 0,
      processedPhotos: 0,
      currentBatch: 0,
      totalBatches: 0,
      startTime: new Date(),
      status: 'not_started',
      failedPhotos: [],
      successfulPhotos: []
    };
  }


  /**
   * Save progress to localStorage
   */
  private saveProgress(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.progress));
    } catch (error) {
      console.warn('[Photo Migration] Failed to save progress:', error);
    }
  }

  /**
   * Detect photos that need migration
   */
  async detectUnencryptedPhotos(): Promise<FishCaught[]> {
    if (!firebaseDataService.isReady()) {
      throw new Error('Firebase service not initialized');
    }

    try {
      const allFish = await firebaseDataService.getAllFishCaught();
      const unencryptedPhotos: FishCaught[] = [];

      for (const fish of allFish) {
        // Check if fish has photos that need migration
        if (fish.photo && !fish.encryptedMetadata) {
          // Has photo but no encryption metadata - needs migration
          unencryptedPhotos.push(fish);
        } else if (fish.photoPath && !fish.encryptedMetadata) {
          // Has photo path but no encryption metadata - needs migration
          unencryptedPhotos.push(fish);
        }
      }

      this.progress.totalPhotos = unencryptedPhotos.length;
      this.saveProgress();

      return unencryptedPhotos;
    } catch (error) {
      console.error('[Photo Migration] Detection failed:', error);
      throw error;
    }
  }

  /**
   * Create migration batches from detected photos
   */
  private createBatches(photos: FishCaught[]): MigrationBatch[] {
    const batches: MigrationBatch[] = [];

    for (let i = 0; i < photos.length; i += this.BATCH_SIZE) {
      const batchPhotos = photos.slice(i, i + this.BATCH_SIZE);
      const batch: MigrationBatch = {
        batchId: `batch_${Date.now()}_${i}`,
        photoIds: batchPhotos.map(fish => fish.id),
        status: 'pending',
        startTime: new Date(),
        processedCount: 0,
        failedCount: 0
        ,processedPhotos: [],
        failedPhotos: [],
        successfulPhotos: []
      };
      batches.push(batch);
    }

    this.progress.totalBatches = batches.length;
    this.saveProgress();

    return batches;
  }

  /**
   * Start the migration process
   */
  async startMigration(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Migration already in progress');
    }

    if (!photoEncryptionService.isReady()) {
      throw new Error('Encryption service not ready');
    }

    // Mark running early to prevent concurrent starts; perform initialization synchronously
    this.isRunning = true;

    let photosToMigrate: FishCaught[];
    try {
      photosToMigrate = await this.detectUnencryptedPhotos();
    } catch (err) {
      // initialization failed - clear running flag and rethrow so caller can handle
      this.isRunning = false;
      this.progress.status = 'failed';
      this.progress.lastError = err instanceof Error ? err.message : String(err);
      this.saveProgress();
      throw err;
    }

    // Preserve detected totals so UI remains accurate
    const detectedTotal = photosToMigrate.length;

    this.progress = this.getDefaultProgress();
    this.progress.totalPhotos = detectedTotal;
    this.progress.status = 'in_progress';
    this.progress.startTime = new Date();
    this.saveProgress();

    // Start background migration loop without awaiting it so callers see isRunning=true
    this.runMigrationLoop(photosToMigrate).catch(err => {
      console.error('[Photo Migration] Background migration failed:', err);
      this.progress.status = 'failed';
      this.progress.lastError = err instanceof Error ? err.message : String(err);
      this.saveProgress();
      this.isRunning = false;
    });
  }

  private async runMigrationLoop(photosToMigrate?: FishCaught[]): Promise<void> {
    try {
      // Use provided photosToMigrate (from startMigration) or detect if absent
      const photos = photosToMigrate ?? await this.detectUnencryptedPhotos();

      if (photos.length === 0) {
        this.progress.status = 'completed';
        this.saveProgress();
        return;
      }

  // Create batches
  const batches = this.createBatches(photos);

      // Process batches
      for (let i = 0; i < batches.length; i++) {
        if (!this.isRunning) break; // Check if cancelled

        const batch = batches[i];
        this.currentBatch = batch;
        this.progress.currentBatch = i + 1;

        try {
          batch.status = 'processing';
          this.saveProgress();

          const result = await this.processBatch(batch);

          // Update progress using per-photo outcomes to ensure accurate accounting
          for (const outcome of result.perPhotoOutcomes) {
            // Only increment processedPhotos for successful migrations
            if (outcome.success) {
              if (!this.progress.processedPhotos) this.progress.processedPhotos = 0;
              this.progress.processedPhotos += 1;
            }

            // ensure deduped arrays
            if (outcome.success) {
              if (!this.progress.successfulPhotos.includes(outcome.id)) this.progress.successfulPhotos.push(outcome.id);
              this.progress.failedPhotos = this.progress.failedPhotos.filter(id => id !== outcome.id);
            } else {
              if (!this.progress.failedPhotos.includes(outcome.id)) this.progress.failedPhotos.push(outcome.id);
              this.progress.successfulPhotos = this.progress.successfulPhotos.filter(id => id !== outcome.id);
            }
          }

          if (result.failedCount === 0) {
            batch.status = 'completed';
          } else if (result.processedCount === batch.photoIds.length) {
            batch.status = 'completed';
            batch.error = result.errors.join('; ');
          } else {
            batch.status = 'failed';
            batch.error = result.errors.join('; ');
          }

          batch.endTime = new Date();
          this.saveProgress();

          // Small delay between batches to prevent overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          batch.status = 'failed';
          batch.error = error instanceof Error ? error.message : 'Unknown error';
          this.progress.lastError = batch.error;
          this.progress.failedPhotos.push(...batch.photoIds);
          this.saveProgress();
        }
      }

      // Finalize migration
      this.finalizeMigration();

    } catch (error) {
      this.progress.status = 'failed';
      this.progress.lastError = error instanceof Error ? error.message : 'Unknown error';
      this.saveProgress();
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process a single batch of photos
   */
  private async processBatch(batch: MigrationBatch): Promise<MigrationResult> {
    const errors: string[] = [];
    let processedCount = 0;
    let failedCount = 0;
    const perPhotoOutcomes: Array<{ id: string; success: boolean; error?: string }> = [];

    const startTime = Date.now();

    for (const photoId of batch.photoIds) {
      // Check if we've been running too long
      if (Date.now() - startTime > this.MAX_PROCESSING_TIME) {
        console.log(`[Photo Migration] Batch ${batch.batchId} timed out after ${this.MAX_PROCESSING_TIME}ms`);
        break;
      }

      try {
        const outcome = await this.migrateSinglePhoto(photoId);
        // outcome: { success: boolean, error?: string }
        perPhotoOutcomes.push({ id: photoId, success: outcome.success, error: outcome.error });

        if (outcome.success) {
          processedCount++;
          batch.processedCount++;
          batch.successfulPhotos = batch.successfulPhotos || [];
          if (!batch.successfulPhotos.includes(photoId)) batch.successfulPhotos.push(photoId);
          // ensure not in failedPhotos
          batch.failedPhotos = (batch.failedPhotos || []).filter(id => id !== photoId);
        } else {
          failedCount++;
          batch.failedCount++;
          errors.push(`Failed to migrate photo ${photoId}: ${outcome.error || 'Unknown'}`);
          batch.failedPhotos = batch.failedPhotos || [];
          if (!batch.failedPhotos.includes(photoId)) batch.failedPhotos.push(photoId);
          // ensure not in successfulPhotos
          batch.successfulPhotos = (batch.successfulPhotos || []).filter(id => id !== photoId);
        }
      } catch (error) {
        failedCount++;
        batch.failedCount++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Photo ${photoId}: ${errorMsg}`);
        perPhotoOutcomes.push({ id: photoId, success: false, error: errorMsg });
        batch.failedPhotos = batch.failedPhotos || [];
        if (!batch.failedPhotos.includes(photoId)) batch.failedPhotos.push(photoId);
      }
    }

    return {
      success: failedCount === 0,
      processedCount,
      failedCount,
      errors,
      perPhotoOutcomes
    };
  }

  /**
   * Migrate a single photo
   */
  private async migrateSinglePhoto(fishId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get the fish record
      const fish = await firebaseDataService.getFishCaughtById(fishId);
      if (!fish) {
        console.warn(`[Photo Migration] Fish ${fishId} not found`);
        return { success: false, error: 'Fish not found' };
      }

      // Check if already migrated
      if (fish.encryptedMetadata) {
        console.log(`[Photo Migration] Photo ${fishId} already migrated`);
        return { success: true };
      }

      // Get photo data
      let photoData: ArrayBuffer | null = null;
      let mimeType = 'image/jpeg';

      if (fish.photo && fish.photo.startsWith('data:')) {
        // Inline photo - convert to binary
        const dataUrlMatch = fish.photo.match(/^data:([^;]+);base64,(.+)$/);
        if (dataUrlMatch) {
          mimeType = dataUrlMatch[1];
          const base64Data = dataUrlMatch[2];
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          photoData = bytes.buffer;
        }
      } else if (fish.photoPath) {
        // Firebase Storage photo - download and decrypt if needed
        const decrypted = await firebaseDataService.getDecryptedPhoto(fish.photoPath, fish.encryptedMetadata);
        if (decrypted) {
          photoData = decrypted.data;
          mimeType = decrypted.mimeType;
        }
      }

      if (!photoData) {
        console.warn(`[Photo Migration] No photo data found for fish ${fishId}`);
        return { success: false, error: 'No photo data' };
      }

      // Get current user ID from firebaseDataService
      const currentUserId = (firebaseDataService as any).userId || 'unknown';

      // Encrypt the photo
      const encryptionResult = await photoEncryptionService.encryptPhoto(
        photoData,
        mimeType,
        currentUserId,
        fishId
      );

      // Upload encrypted photo to Firebase Storage
      const ref = storageRef(storage, encryptionResult.storagePath);
      await uploadBytes(ref, encryptionResult.encryptedData, {
        contentType: 'application/octet-stream',
        customMetadata: {
          encrypted: 'true',
          originalMime: mimeType,
          version: '1'
        }
      });

      // Get download URL
      const photoUrl = await getDownloadURL(ref);

      // Update fish record with encrypted photo metadata
      await firebaseDataService.updateFishCaught({
        ...fish,
        photoHash: fish.photoHash || `migrated_${Date.now()}`,
        photoPath: encryptionResult.storagePath,
        photoMime: mimeType,
        photoUrl,
        encryptedMetadata: photoEncryptionService.serializeMetadata(encryptionResult.metadata),
        // Remove the old inline photo
        photo: undefined
      });

      console.log(`[Photo Migration] Successfully migrated photo ${fishId}`);
      return { success: true };

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Photo Migration] Failed to migrate photo ${fishId}:`, message);
      return { success: false, error: message };
    }
  }

  /**
   * Pause the migration
   */
  pauseMigration(): void {
    this.isRunning = false;
    this.progress.status = 'paused';
    this.saveProgress();
  }

  /**
   * Resume the migration
   */
  async resumeMigration(): Promise<void> {
    if (this.progress.status === 'paused') {
      await this.startMigration();
    }
  }

  /**
   * Cancel the migration
   */
  cancelMigration(): void {
    this.isRunning = false;
    this.progress.status = 'not_started';
    this.currentBatch = null;
    this.saveProgress();
  }

  /**
   * Get current migration progress
   */
  getProgress(): MigrationProgress {
    return { ...this.progress };
  }

  /**
   * Get current batch information
   */
  getCurrentBatch(): MigrationBatch | null {
    return this.currentBatch ? { ...this.currentBatch } : null;
  }

  /**
   * Check if migration is currently running
   */
  isMigrationRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Finalize migration and clean up
   */
  private finalizeMigration(): void {
    this.progress.status = this.progress.failedPhotos.length > 0 ? 'failed' : 'completed';
    this.currentBatch = null;
    this.saveProgress();

    if (this.progress.status === 'completed') {
      // Clear progress after successful completion
      localStorage.removeItem(this.STORAGE_KEY);
      console.log(`[Photo Migration] Migration completed successfully. Migrated ${this.progress.successfulPhotos.length} photos.`);
    } else {
      console.warn(`[Photo Migration] Migration completed with errors. ${this.progress.failedPhotos.length} photos failed.`);
    }
  }

  /**
   * Retry failed photos
   */
  async retryFailedPhotos(): Promise<void> {
    if (this.progress.failedPhotos.length === 0) {
      return;
    }

    const failedBatch: MigrationBatch = {
      batchId: `retry_${Date.now()}`,
      photoIds: [...this.progress.failedPhotos],
      status: 'pending',
      startTime: new Date(),
      processedCount: 0,
      failedCount: 0
    };

    this.progress.failedPhotos = [];
    this.progress.status = 'in_progress';
    this.saveProgress();

    try {
      const result = await this.processBatch(failedBatch);

      // Update progress based on per-photo outcomes
      for (const outcome of result.perPhotoOutcomes) {
        if (outcome.success) {
          if (!this.progress.successfulPhotos.includes(outcome.id)) this.progress.successfulPhotos.push(outcome.id);
          this.progress.failedPhotos = this.progress.failedPhotos.filter(id => id !== outcome.id);
          // increment processed counter for successful retry
          if (!this.progress.processedPhotos) this.progress.processedPhotos = 0;
          this.progress.processedPhotos += 1;
        } else {
          if (!this.progress.failedPhotos.includes(outcome.id)) this.progress.failedPhotos.push(outcome.id);
          this.progress.successfulPhotos = this.progress.successfulPhotos.filter(id => id !== outcome.id);
        }
      }

      this.finalizeMigration();
    } catch (error) {
      this.progress.status = 'failed';
      this.progress.lastError = error instanceof Error ? error.message : 'Retry failed';
      this.saveProgress();
    }
  }

  /**
   * Clean up migration progress (for testing or manual reset)
   */
  clearProgress(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.progress = this.getDefaultProgress();
    this.currentBatch = null;
    this.isRunning = false;
  }
}

export const photoMigrationService = new PhotoMigrationService();
export type { MigrationProgress, MigrationBatch, MigrationResult };