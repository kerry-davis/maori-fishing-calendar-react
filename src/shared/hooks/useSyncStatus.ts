import { useSyncStatusContext } from '@app/providers/SyncStatusContext';

/**
 * Thin wrapper around the shared SyncStatus context for legacy consumers.
 */
export function useSyncStatus() {
  return useSyncStatusContext();
}