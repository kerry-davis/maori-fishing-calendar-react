import type { FishCaught } from '../types';
import { firebaseDataService } from './firebaseDataService';
import { databaseService } from './databaseService';
import { DEV_LOG, DEV_WARN } from '../utils/loggingHelpers';

type GearRenameTask = {
  kind: 'gearRename';
  oldKeyLower: string;
  oldNameLower: string;
  newKeyCanonical: string;
  newKeyLower: string;
  description: string;
};

type GearTypeRenameTask = {
  kind: 'gearTypeRename';
  oldPrefixLower: string;
  newPrefixCanonical: string;
  newPrefixLower: string;
  description: string;
};

type Task = GearRenameTask | GearTypeRenameTask;

const queue: Task[] = [];
let processing = false;
let pendingTasks = 0;

type GearMaintenanceEvent =
  | { type: 'queue-size'; size: number }
  | { type: 'task-start'; label: string; total: number }
  | { type: 'task-progress'; label: string; processed: number; total: number }
  | { type: 'task-complete'; label: string; processed: number }
  | { type: 'gear-rename-applied'; oldKeyLower: string; oldNameLower: string; newKeyCanonical: string; newKeyLower: string }
  | { type: 'gear-type-rename-applied'; oldPrefixLower: string; newPrefixCanonical: string; newPrefixLower: string }
  | { type: 'task-error'; label: string; error: unknown };

const subscribers = new Set<(event: GearMaintenanceEvent) => void>();

function emit(event: GearMaintenanceEvent): void {
  subscribers.forEach(listener => {
    try {
      listener(event);
    } catch (err) {
      DEV_WARN('[GearMaintenance] subscriber error', err);
    }
  });
}

export function subscribeGearMaintenance(listener: (event: GearMaintenanceEvent) => void): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

export function enqueueGearItemRename(oldKeyLower: string, oldNameLower: string, newKeyCanonical: string, newKeyLower: string, description: string): void {
  queue.push({
    kind: 'gearRename',
    oldKeyLower: oldKeyLower.toLowerCase(),
    oldNameLower: oldNameLower.toLowerCase(),
    newKeyCanonical,
    newKeyLower: newKeyLower.toLowerCase(),
    description
  });
  pendingTasks += 1;
  emit({ type: 'queue-size', size: pendingTasks });
  scheduleProcessing();
}

export function enqueueGearTypeRename(oldPrefixLower: string, newPrefixCanonical: string, newPrefixLower: string, description: string): void {
  queue.push({
    kind: 'gearTypeRename',
    oldPrefixLower: oldPrefixLower.toLowerCase(),
    newPrefixCanonical,
    newPrefixLower: newPrefixLower.toLowerCase(),
    description
  });
  pendingTasks += 1;
  emit({ type: 'queue-size', size: pendingTasks });
  scheduleProcessing();
}

function scheduleProcessing(): void {
  if (!processing) {
    void processQueue();
  }
}

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;

  while (queue.length) {
    const task = queue.shift()!;
    try {
      await handleTask(task);
    } catch (error) {
      DEV_WARN('[GearMaintenance] task failed', error);
      emit({ type: 'task-error', label: task.description, error });
    }
    pendingTasks = Math.max(0, pendingTasks - 1);
    emit({ type: 'queue-size', size: pendingTasks });
    await yieldToEventLoop();
  }

  processing = false;
}

async function handleTask(task: Task): Promise<void> {
  const fishCaught = await getAllFishCaughtSafe();
  if (!fishCaught.length) {
    return;
  }

  if (task.kind === 'gearRename') {
    const updates: FishCaught[] = [];
    for (const fish of fishCaught) {
      const gear = Array.isArray(fish.gear) ? [...fish.gear] : [];
      if (!gear.length) continue;
      let changed = false;
      const next = gear.map(entry => {
        const lower = String(entry || '').toLowerCase();
        if (lower === task.oldKeyLower || lower === task.oldNameLower || lower === task.newKeyLower) {
          changed = true;
          return task.newKeyCanonical;
        }
        return entry;
      });
      if (changed) {
        const deduped = dedupeGearEntries(next);
        updates.push({ ...fish, gear: deduped });
      }
    }
    await persistUpdates(updates, task);
  } else {
    const updates: FishCaught[] = [];
    for (const fish of fishCaught) {
      const gear = Array.isArray(fish.gear) ? [...fish.gear] : [];
      if (!gear.length) continue;
      let changed = false;
      const next = gear.map(entry => {
        const value = String(entry || '');
        const lower = value.toLowerCase();
        if (lower.startsWith(task.oldPrefixLower)) {
          const separatorIndex = value.indexOf('|');
          const suffix = separatorIndex >= 0 ? value.slice(separatorIndex + 1) : '';
          changed = true;
          const normalizedSuffix = suffix ? suffix.replace(/^\|/, '') : '';
          return normalizedSuffix ? `${task.newPrefixCanonical}|${normalizedSuffix}` : task.newPrefixCanonical;
        }
        return entry;
      });
      if (changed) {
        const deduped = dedupeGearEntries(next);
        updates.push({ ...fish, gear: deduped });
      }
    }
    await persistUpdates(updates, task);
  }
}

async function getAllFishCaughtSafe(): Promise<FishCaught[]> {
  try {
    return await firebaseDataService.getAllFishCaught();
  } catch (error) {
    DEV_WARN('[GearMaintenance] falling back to local fish fetch', error);
    return await databaseService.getAllFishCaught();
  }
}

async function persistUpdates(updates: FishCaught[], task: Task): Promise<void> {
  const label = task.description;
  const total = updates.length;

  if (total === 0) {
    emitMutationEvent(task);
    emit({ type: 'task-complete', label, processed: 0 });
    DEV_LOG(`[GearMaintenance] ${label}: no records to update`);
    return;
  }

  emit({ type: 'task-start', label, total });
  let processed = 0;
  for (const record of updates) {
    await saveCatch(record);
    processed += 1;
    if (processed % 10 === 0 || processed === total) {
      emit({ type: 'task-progress', label, processed, total });
    }
    if (processed % 10 === 0) {
      await yieldToEventLoop();
    }
  }
  emitMutationEvent(task);
  emit({ type: 'task-complete', label, processed });
  DEV_LOG(`[GearMaintenance] ${label}: updated ${processed} record(s)`);
}

function emitMutationEvent(task: Task): void {
  if (task.kind === 'gearRename') {
    emit({
      type: 'gear-rename-applied',
      oldKeyLower: task.oldKeyLower,
      oldNameLower: task.oldNameLower,
      newKeyCanonical: task.newKeyCanonical,
      newKeyLower: task.newKeyLower
    });
  } else {
    emit({
      type: 'gear-type-rename-applied',
      oldPrefixLower: task.oldPrefixLower,
      newPrefixCanonical: task.newPrefixCanonical,
      newPrefixLower: task.newPrefixLower
    });
  }
}

async function saveCatch(record: FishCaught): Promise<void> {
  try {
    await firebaseDataService.updateFishCaught(record);
    try {
      await databaseService.updateFishCaught(record);
    } catch (dbErr) {
      DEV_WARN('[GearMaintenance] failed to sync local DB after Firebase update', dbErr);
    }
  } catch (error) {
    DEV_WARN('[GearMaintenance] firebase update failed, falling back to local DB', error);
    await databaseService.updateFishCaught(record);
  }
}

function dedupeGearEntries(entries: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of entries) {
    const key = String(entry || '').toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(String(entry || ''));
    }
  }
  return result;
}

function yieldToEventLoop(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}
