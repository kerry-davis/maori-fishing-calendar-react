# Phase 2: Photo Migration Strategy Design

## Overview
Phase 2 implements background migration of existing legacy photos to encrypted format while maintaining system stability and user experience.

## Migration Strategy Requirements

### 1. Detection Strategy
**Photo Discovery:**
- Scan all `fishCaught` records for photos that need migration
- Identify photos by checking for absence of `encryptedMetadata` field
- Support both inline photos (data URLs) and existing Firebase Storage URLs
- Handle mixed scenarios (some photos encrypted, some not)

**Detection Query:**
```typescript
// Find fish records with photos but no encryption metadata
const unencryptedPhotos = await firebaseDataService.getFishCaughtNeedingMigration();
```

### 2. Batching Strategy
**Batch Sizing:**
- **Small Batches**: 5-10 photos per batch to minimize memory usage
- **Time-based Limiting**: Process for max 30 seconds per session
- **Progress Persistence**: Save progress after each batch completion
- **Resume Capability**: Continue from last successful batch

**Batch Processing:**
```typescript
interface MigrationBatch {
  batchId: string;
  photoIds: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  error?: string;
}
```

### 3. Progress Tracking
**User Feedback:**
- Real-time progress bar showing percentage complete
- Current batch information (e.g., "Processing photos 15-20 of 150")
- Estimated time remaining based on average processing speed
- Pause/resume functionality for user control

**Progress Storage:**
```typescript
interface MigrationProgress {
  totalPhotos: number;
  processedPhotos: number;
  currentBatch: number;
  totalBatches: number;
  startTime: Date;
  estimatedCompletion?: Date;
  status: 'not_started' | 'in_progress' | 'paused' | 'completed' | 'failed';
  lastError?: string;
}
```

### 4. Failure Recovery
**Error Handling:**
- **Individual Photo Failures**: Continue processing other photos in batch
- **Batch Failures**: Mark batch as failed but allow retry
- **Network Failures**: Automatic retry with exponential backoff
- **Storage Failures**: Graceful fallback to unencrypted storage

**Recovery Mechanisms:**
- **Retry Logic**: 3 retry attempts per photo with increasing delays
- **Partial Success**: Track which photos succeeded/failed in each batch
- **Rollback**: Ability to revert failed migrations if needed
- **User Notification**: Clear error messages with actionable recovery steps

### 5. Performance Considerations
**Resource Management:**
- **Memory Efficient**: Process photos in streams, not load all at once
- **Network Aware**: Reduce batch size during slow connections
- **Storage Quotas**: Monitor Firebase Storage usage during migration
- **Background Processing**: Use Web Workers for CPU-intensive operations

**Optimization Strategies:**
- **Parallel Processing**: Encrypt multiple photos simultaneously
- **Caching**: Cache encryption results to avoid re-processing
- **Deduplication**: Skip already-processed photos
- **Priority Queues**: Process newest photos first

## Implementation Architecture

### Background Migration Service
```typescript
class PhotoMigrationService {
  // Detection
  async detectUnencryptedPhotos(): Promise<FishCaught[]>
  async getMigrationCandidates(): Promise<MigrationBatch[]>

  // Processing
  async processBatch(batch: MigrationBatch): Promise<MigrationResult>
  async migrateSinglePhoto(fishId: string): Promise<boolean>

  // Progress Tracking
  async getMigrationProgress(): Promise<MigrationProgress>
  async updateProgress(progress: Partial<MigrationProgress>): Promise<void>

  // Error Recovery
  async retryFailedBatch(batchId: string): Promise<MigrationResult>
  async rollbackFailedMigration(fishId: string): Promise<boolean>
}
```

### UI Components
**Migration Status Component:**
- Progress bar with percentage and ETA
- Start/pause/resume controls
- Error display with retry options
- Completion celebration

**Gallery Updates:**
- Show migration status for individual photos
- Graceful handling of in-progress migrations
- Fallback to original photos during migration failures

### Data Flow
```
1. Detection → 2. Batching → 3. Encryption → 4. Upload → 5. Metadata Storage → 6. Progress Update
    ↓              ↓            ↓           ↓           ↓                      ↓
User scans    Group into   Encrypt     Upload to   Store metadata         Update UI
for legacy    5-10 photo   photo data  Firebase    in Firestore           with progress
photos        batches      with AES-   Storage     fish record
                          GCM
```

## Migration States

### Photo States
- **legacy**: Original unencrypted photo
- **migrating**: Currently being processed
- **encrypted**: Successfully migrated with metadata
- **failed**: Migration failed, requires retry
- **skipped**: Intentionally skipped (e.g., corrupted data)

### Batch States
- **pending**: Waiting to be processed
- **processing**: Currently being worked on
- **completed**: All photos in batch migrated successfully
- **failed**: Batch encountered errors, needs retry
- **cancelled**: User cancelled migration

## Safety Measures

### Data Protection
- **Backup Originals**: Keep original photos until migration verification
- **Atomic Operations**: Use Firestore transactions for metadata updates
- **Rollback Support**: Ability to revert to original photos if needed
- **Integrity Verification**: SHA-256 verification of migrated photos

### User Experience
- **Non-blocking**: Migration runs in background, doesn't block app usage
- **Pause/Resume**: Users can pause migration and resume later
- **Progress Visibility**: Clear indication of what's happening
- **Error Recovery**: Easy retry mechanisms for failed operations

## Success Metrics

### Performance Targets
- **Processing Speed**: 10-20 photos per minute (depending on size)
- **Success Rate**: >95% successful migrations
- **Memory Usage**: <100MB additional memory usage
- **Network Efficiency**: Minimal redundant data transfer

### User Experience Goals
- **Transparency**: Users always know migration status
- **Control**: Users can pause/resume/cancel migration
- **Reliability**: Failed migrations can be easily retried
- **Performance**: Migration doesn't significantly impact app responsiveness

This migration strategy ensures safe, reliable, and user-friendly transition from legacy photos to encrypted format.