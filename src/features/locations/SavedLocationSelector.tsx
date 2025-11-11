import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@shared/components/Button';
import ConfirmationDialog from '@shared/components/ConfirmationDialog';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@features/modals/Modal';
import { useLocationContext } from '@app/providers/LocationContext';
import type { SavedLocation, SavedLocationCreateInput } from '@shared/types';

interface SavedLocationSelectorProps {
  selectedId?: string | null;
  onSelect?: (location: SavedLocation | null) => void;
  allowManage?: boolean;
  showSaveCurrentButton?: boolean;
  placeholder?: string;
  className?: string;
}

type FormMode = 'add' | 'edit' | 'save-current';

interface FormState {
  name: string;
  water: string;
  location: string;
  lat: string;
  lon: string;
  notes: string;
}

const DEFAULT_FORM_STATE: FormState = {
  name: '',
  water: '',
  location: '',
  lat: '',
  lon: '',
  notes: '',
};

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }
  return fallback;
}

function buildFormState(location: SavedLocation | null): FormState {
  if (!location) {
    return { ...DEFAULT_FORM_STATE };
  }

  return {
    name: location.name || '',
    water: location.water || '',
    location: location.location || '',
    lat: location.lat != null ? String(location.lat) : '',
    lon: location.lon != null ? String(location.lon) : '',
    notes: location.notes || '',
  };
}

function trimOrUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseCoordinate(value: string, label: string, min: number, max: number): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be a number between ${min} and ${max}`);
  }
  return parsed;
}

export const SavedLocationSelector: React.FC<SavedLocationSelectorProps> = ({
  selectedId,
  onSelect,
  allowManage = true,
  showSaveCurrentButton = false,
  placeholder = 'Select a saved location',
  className = '',
}) => {
  const {
    savedLocations,
    savedLocationsLoading,
    createSavedLocation,
    updateSavedLocation,
    deleteSavedLocation,
    selectSavedLocation,
    savedLocationsLimit,
    userLocation,
  } = useLocationContext();

  const [internalSelectedId, setInternalSelectedId] = useState<string>(selectedId ?? '');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectorError, setSelectorError] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>({ ...DEFAULT_FORM_STATE });
  const [formMode, setFormMode] = useState<FormMode>('add');
  const [editingLocation, setEditingLocation] = useState<SavedLocation | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SavedLocation | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  useEffect(() => {
    setInternalSelectedId(selectedId ?? '');
  }, [selectedId]);

  const limitReached = savedLocations.length >= savedLocationsLimit;
  const shouldShowSearch = allowManage || savedLocations.length > 5;

  const filteredLocations = useMemo(() => {
    if (!searchTerm.trim()) {
      return savedLocations;
    }
    const query = searchTerm.trim().toLowerCase();
    return savedLocations.filter((location) => {
      const haystack = [location.name, location.water, location.location]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [savedLocations, searchTerm]);

  const openForm = useCallback((mode: FormMode, location: SavedLocation | null = null) => {
    setFormMode(mode);
    setEditingLocation(mode === 'edit' ? location : null);
    if (mode === 'save-current' && userLocation) {
      setFormState({
        name: userLocation.name || 'Current Location',
        water: '',
        location: '',
        lat: userLocation.lat != null ? String(userLocation.lat) : '',
        lon: userLocation.lon != null ? String(userLocation.lon) : '',
        notes: '',
      });
    } else {
      setFormState(buildFormState(location));
    }
    setFormError(null);
    setIsFormOpen(true);
  }, [userLocation]);

  const closeForm = useCallback(() => {
    if (isSubmitting) {
      return;
    }
    setIsFormOpen(false);
    setEditingLocation(null);
    setFormState({ ...DEFAULT_FORM_STATE });
    setFormMode('add');
    setFormError(null);
  }, [isSubmitting]);

  const handleSelection = useCallback(async (id: string) => {
    if (!id) {
      setSelectorError(null);
      setInternalSelectedId('');
      onSelect?.(null);
      return;
    }

    setIsSelecting(true);
    try {
      const location = await selectSavedLocation(id);
      if (!location) {
        throw new Error('Saved location not found');
      }
      setSelectorError(null);
      setInternalSelectedId(id);
      onSelect?.(location);
    } catch (error) {
      const message = resolveErrorMessage(error, 'Failed to select saved location.');
      setSelectorError(message);
    } finally {
      setIsSelecting(false);
    }
  }, [onSelect, selectSavedLocation]);

  const handleFormStateChange = useCallback((field: keyof FormState, value: string) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const buildPayload = useCallback((state: FormState): SavedLocationCreateInput => {
    const name = state.name.trim();
    if (!name) {
      throw new Error('Location name is required');
    }

    const payload: SavedLocationCreateInput = {
      name,
    };

    const water = trimOrUndefined(state.water);
    const specificLocation = trimOrUndefined(state.location);
    const notes = trimOrUndefined(state.notes);

    if (water) {
      payload.water = water;
    }
    if (specificLocation) {
      payload.location = specificLocation;
    }
    if (notes) {
      payload.notes = notes;
    }

    const lat = parseCoordinate(state.lat, 'Latitude', -90, 90);
    const lon = parseCoordinate(state.lon, 'Longitude', -180, 180);

    if (lat !== undefined) {
      payload.lat = lat;
    }
    if (lon !== undefined) {
      payload.lon = lon;
    }

    return payload;
  }, []);

  const handleFormSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const payload = buildPayload(formState);

      if (editingLocation) {
        await updateSavedLocation(editingLocation.id, payload);
        await handleSelection(editingLocation.id);
      } else {
        const created = await createSavedLocation(payload);
        await handleSelection(created.id);
      }

      closeForm();
    } catch (error) {
      console.error('[SavedLocationSelector] Form submission error:', error);
      const message = resolveErrorMessage(error, 'Failed to save location.');
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [buildPayload, closeForm, createSavedLocation, editingLocation, formState, handleSelection, updateSavedLocation]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }
    try {
      await deleteSavedLocation(deleteTarget.id);
      if (internalSelectedId === deleteTarget.id) {
        setInternalSelectedId('');
        onSelect?.(null);
      }
      setDeleteTarget(null);
    } catch (error) {
      const message = resolveErrorMessage(error, 'Failed to delete saved location.');
      setSelectorError(message);
    }
  }, [deleteSavedLocation, deleteTarget, internalSelectedId, onSelect]);

  const renderFormTitle = () => {
    if (formMode === 'edit') {
      return 'Edit Saved Location';
    }
    if (formMode === 'save-current') {
      return 'Save Current Location';
    }
    return 'Add Saved Location';
  };

  if (!allowManage && savedLocations.length === 0) {
    return null;
  }

  return (
    <div className={`saved-location-selector space-y-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <label className="text-sm font-medium" style={{ color: 'var(--secondary-text)' }}>
          Saved Locations ({savedLocations.length}/{savedLocationsLimit})
        </label>
        <div className="flex flex-wrap gap-2">
          {showSaveCurrentButton && (
            <Button
              type="button"
              onClick={() => openForm('save-current', null)}
              disabled={limitReached || !userLocation}
              variant="secondary"
            >
              Save Current Location
            </Button>
          )}
          {allowManage && (
            <Button
              type="button"
              onClick={() => openForm('add', null)}
              disabled={limitReached}
            >
              Add Location
            </Button>
          )}
        </div>
      </div>

      {limitReached && allowManage && (
        <p className="text-xs" style={{ color: 'var(--secondary-text)' }}>
          You have reached the maximum of {savedLocationsLimit} saved locations. Delete one to add another.
        </p>
      )}

      {shouldShowSearch && (
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search saved locations"
          className="w-full px-3 py-2 rounded-md border"
          style={{
            borderColor: 'var(--border-color)',
            backgroundColor: 'var(--input-background)',
            color: 'var(--primary-text)',
          }}
        />
      )}

      <select
        value={internalSelectedId}
        onChange={(event) => void handleSelection(event.target.value)}
        className="w-full px-3 py-2 rounded-md border"
        style={{
          borderColor: 'var(--border-color)',
          backgroundColor: 'var(--input-background)',
          color: 'var(--primary-text)',
        }}
        disabled={!savedLocations.length}
      >
        <option value="">{placeholder}</option>
        {filteredLocations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
            {location.water ? ` • ${location.water}` : ''}
          </option>
        ))}
      </select>

      {savedLocationsLoading && (
        <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>
          Loading saved locations...
        </p>
      )}

      {selectorError && (
        <p className="text-sm" style={{ color: 'var(--error-text)' }}>
          {selectorError}
        </p>
      )}

      {(allowManage || internalSelectedId) && savedLocations.length > 0 && (
        <div className="space-y-3">
          <div className="grid gap-3">
            {(allowManage ? filteredLocations : filteredLocations.filter(loc => loc.id === internalSelectedId)).map((location) => (
              <div
                key={location.id}
                className="rounded-lg border px-3 py-2"
                style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--card-background)' }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--primary-text)' }}>
                      {location.name}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--secondary-text)' }}>
                      {[location.water, location.location].filter(Boolean).join(' • ') || 'No extra details'}
                    </p>
                    {(location.lat != null || location.lon != null) && (
                      <p className="text-xs" style={{ color: 'var(--secondary-text)' }}>
                        {location.lat != null ? `Lat: ${location.lat.toFixed(4)}` : 'Lat: —'} · {location.lon != null ? `Lon: ${location.lon.toFixed(4)}` : 'Lon: —'}
                      </p>
                    )}
                    {location.notes && (
                      <p className="text-xs mt-1" style={{ color: 'var(--secondary-text)' }}>
                        Notes: {location.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allowManage && (
                      <Button
                        type="button"
                        onClick={() => void handleSelection(location.id)}
                        disabled={isSelecting}
                        size="sm"
                      >
                        Use
                      </Button>
                    )}
                    <Button
                      type="button"
                      onClick={() => openForm('edit', location)}
                      variant="secondary"
                      size="sm"
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setDeleteTarget(location)}
                      variant="danger"
                      size="sm"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal isOpen={isFormOpen} onClose={closeForm} maxWidth="lg">
        <ModalHeader title={renderFormTitle()} onClose={closeForm} />
        <form onSubmit={handleFormSubmit}>
          <ModalBody className="space-y-4">
            {formError && (
              <div className="p-3 rounded" style={{ backgroundColor: 'var(--error-background)', border: '1px solid var(--error-border)' }}>
                <p className="text-sm" style={{ color: 'var(--error-text)' }}>{formError}</p>
              </div>
            )}
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--primary-text)' }}>
                Name
              </label>
              <input
                type="text"
                value={formState.name}
                onChange={(event) => handleFormStateChange('name', event.target.value)}
                required
                className="w-full px-3 py-2 rounded border"
                style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--input-background)', color: 'var(--primary-text)' }}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--primary-text)' }}>
                  Water Body
                </label>
                <input
                  type="text"
                  value={formState.water}
                  onChange={(event) => handleFormStateChange('water', event.target.value)}
                  className="w-full px-3 py-2 rounded border"
                  style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--input-background)', color: 'var(--primary-text)' }}
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--primary-text)' }}>
                  Specific Location
                </label>
                <input
                  type="text"
                  value={formState.location}
                  onChange={(event) => handleFormStateChange('location', event.target.value)}
                  className="w-full px-3 py-2 rounded border"
                  style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--input-background)', color: 'var(--primary-text)' }}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--primary-text)' }}>
                  Latitude
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={formState.lat}
                  onChange={(event) => handleFormStateChange('lat', event.target.value)}
                  className="w-full px-3 py-2 rounded border"
                  style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--input-background)', color: 'var(--primary-text)' }}
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--primary-text)' }}>
                  Longitude
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={formState.lon}
                  onChange={(event) => handleFormStateChange('lon', event.target.value)}
                  className="w-full px-3 py-2 rounded border"
                  style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--input-background)', color: 'var(--primary-text)' }}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--primary-text)' }}>
                Notes
              </label>
              <textarea
                value={formState.notes}
                onChange={(event) => handleFormStateChange('notes', event.target.value)}
                className="w-full px-3 py-2 rounded border"
                rows={3}
                style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--input-background)', color: 'var(--primary-text)' }}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <div className="flex justify-end gap-3">
              <Button type="button" onClick={closeForm} disabled={isSubmitting} variant="secondary">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </ModalFooter>
        </form>
      </Modal>

      <ConfirmationDialog
        isOpen={Boolean(deleteTarget)}
        title="Delete Saved Location"
        message={deleteTarget ? `Are you sure you want to delete “${deleteTarget.name}”? This action cannot be undone.` : ''}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        confirmText="Delete"
      />
    </div>
  );
};

export default SavedLocationSelector;
