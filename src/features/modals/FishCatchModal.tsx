import React, { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@shared/components/Button";
import ConfirmationDialog from '@shared/components/ConfirmationDialog';
import { Modal, ModalHeader, ModalBody, ModalFooter } from "./Modal";
import { useDatabaseService } from '../../app/providers/DatabaseContext';
import { useAuth } from '../../app/providers/AuthContext';
import { useFirebaseTackleBox } from "@shared/hooks/useFirebaseTackleBox";
import type { FishCaught, FishPhoto } from "@shared/types";
import { getFishPhotoPreview } from "@shared/utils/photoPreviewUtils";
import { getOrCreateGuestSessionId } from "@shared/services/guestSessionService";
import { buildPhotoRemovalFields } from "@shared/utils/photoUpdateHelpers";
import PhotoViewerModal from './PhotoViewerModal';
import { normalizeFishPhotos, getPrimaryPhoto } from "@shared/utils/fishPhotoUtils";
import { generateULID } from "@shared/utils/ulid";

export interface FishCatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: number;
  fishId?: string;
  onFishCaught?: (fish: FishCaught) => void;
}

type PhotoFormEntry = FishPhoto & {
  local?: boolean;
};

export const FishCatchModal: React.FC<FishCatchModalProps> = ({
  isOpen,
  onClose,
  tripId,
  fishId,
  onFishCaught,
}) => {
  const db = useDatabaseService();
  const { user } = useAuth();
  const [tackleBox] = useFirebaseTackleBox();
  const normalizeField = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (value === null || value === undefined) return "";
    return String(value);
  };

  const [formData, setFormData] = useState({
    species: "",
    length: "",
    weight: "",
    time: "",
    gear: [] as string[],
    details: "",
  });
  const [validation, setValidation] = useState({
    isValid: true,
    errors: {} as Record<string, string>
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PhotoFormEntry[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<Record<string, string>>({});
  const [photoAuthLocks, setPhotoAuthLocks] = useState<Record<string, boolean>>({});
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [fileInputKey, setFileInputKey] = useState(0);
  const [photoViewerIndex, setPhotoViewerIndex] = useState<number | null>(null);
  const [shouldClearLegacyPhoto, setShouldClearLegacyPhoto] = useState(false);
  const [tripDetails, setTripDetails] = useState<{ date?: string; location?: string; water?: string } | null>(null);
  const isEditing = fishId !== undefined;
  const primaryPhoto = React.useMemo(
    () => getPrimaryPhoto(photos, photos.find((p) => p.isPrimary)?.id),
    [photos]
  );
  const primaryPhotoId = primaryPhoto?.id;
  const initialPhotoCountRef = useRef(0);
  // Gear rename handling: ask for confirmation before removing stale gear
  const [showStaleGearConfirm, setShowStaleGearConfirm] = useState(false);
  const [staleGear, setStaleGear] = useState<string[]>([]);
  const lastPromptSignatureRef = useRef<string | null>(null);

  // Gear composite key helpers (type|brand|name|colour)
  const norm = (v?: string) => (v || '').trim();
  const normLower = (v?: string) => norm(v).toLowerCase();
  const gearKey = (item: { type: string; brand: string; name: string; colour: string }) =>
    `${norm(item.type)}|${norm(item.brand)}|${norm(item.name)}|${norm(item.colour)}`;
  const gearKeyLower = (item: { type: string; brand: string; name: string; colour: string }) => gearKey(item).toLowerCase();
  const entryLower = (value: string) => {
    const str = String(value || '');
    if (str.includes('|')) {
      return str
        .split('|')
        .map(part => part.trim().toLowerCase())
        .join('|');
    }
    return str.trim().toLowerCase();
  };
  const entryNameLower = (value: string) => {
    const parts = String(value || '').split('|');
    if (parts.length === 4) {
      return parts[2]?.trim().toLowerCase() ?? '';
    }
    return normLower(value);
  };
  const selectedGearLookup = React.useMemo(() => {
    const compositeSelections = new Set<string>();
    const legacyNameCounts = new Map<string, number>();

    for (const entry of formData.gear) {
      if (!entry) continue;
      const normalized = entryLower(entry);
      if (!normalized) continue;
      if (entry.includes('|')) {
        compositeSelections.add(normalized);
      } else {
        const nameLower = normLower(entry);
        legacyNameCounts.set(nameLower, (legacyNameCounts.get(nameLower) ?? 0) + 1);
      }
    }

    const assignedNameCounts = new Map<string, number>();
    const lookup = new Map<string, boolean>();

    for (const item of tackleBox) {
      const keyLower = gearKeyLower(item);
      if (compositeSelections.has(keyLower)) {
        lookup.set(keyLower, true);
        continue;
      }

      const nameLower = normLower(item.name);
      const totalForName = legacyNameCounts.get(nameLower) ?? 0;
      if (totalForName > 0) {
        const used = assignedNameCounts.get(nameLower) ?? 0;
        if (used < totalForName) {
          assignedNameCounts.set(nameLower, used + 1);
          lookup.set(keyLower, true);
          continue;
        }
      }

      if (!lookup.has(keyLower)) {
        lookup.set(keyLower, false);
      }
    }

    return lookup;
  }, [formData.gear, tackleBox]);

  const isSelectedGear = useCallback((item: { type: string; brand: string; name: string; colour: string }) => {
    const keyLower = gearKeyLower(item);
    return selectedGearLookup.get(keyLower) ?? false;
  }, [selectedGearLookup]);

  const gearDisplayLookup = React.useMemo(() => {
    const compositeMap = new Map<string, { name: string; brand: string; colour: string }>();
    const nameMap = new Map<string, string>();

    for (const item of tackleBox) {
      const compositeLower = gearKeyLower(item);
      compositeMap.set(compositeLower, {
        name: norm(item.name),
        brand: norm(item.brand),
        colour: norm(item.colour),
      });
      const nameLower = normLower(item.name);
      if (!nameMap.has(nameLower)) {
        nameMap.set(nameLower, norm(item.name));
      }
    }

    return { compositeMap, nameMap };
  }, [tackleBox]);

  const formatGearLabel = (raw: string): string => {
    const value = String(raw || '');
    if (!value) return '';

    const normalizeComposite = (val: string) =>
      val
        .split('|')
        .map(part => part.trim().toLowerCase())
        .join('|');

    const normalizeName = (val: string) => {
      const parts = val.split('|');
      if (parts.length === 4) {
        return (parts[2] || '').trim().toLowerCase();
      }
      return val.trim().toLowerCase();
    };

    if (value.includes('|')) {
      const compositeMatch = gearDisplayLookup.compositeMap.get(normalizeComposite(value));
      if (compositeMatch) {
        return [compositeMatch.name, compositeMatch.brand, compositeMatch.colour].filter(Boolean).join(' · ') || compositeMatch.name;
      }
    }

    const nameMatch = gearDisplayLookup.nameMap.get(normalizeName(value));
    if (nameMatch) {
      return nameMatch;
    }

    if (value.includes('|')) {
      const parts = value.split('|').map(part => part.trim());
      if (parts.length === 4) {
        const [, brand, name, colour] = parts;
        return [name, brand, colour].filter(Boolean).join(' · ') || value.trim();
      }
    }

    return value.trim();
  };

  useEffect(() => {
    if (!formData.gear?.length) return;
    const validNames = new Set(tackleBox.map(g => normLower(g.name)));
    const validKeys = new Set(tackleBox.map(g => gearKeyLower(g)));
    const invalid = formData.gear.filter((g) => {
      const lower = entryLower(g);
      if (validKeys.has(lower)) {
        return false;
      }
      const nameLower = entryNameLower(g);
      return !validNames.has(nameLower);
    });
    if (invalid.length > 0) {
      const sig = invalid.slice().sort().join('|');
      if (lastPromptSignatureRef.current !== sig) {
        lastPromptSignatureRef.current = sig;
        setStaleGear(invalid);
        setShowStaleGearConfirm(true);
      }
    } else {
      lastPromptSignatureRef.current = null;
    }
  }, [tackleBox, formData.gear]);

  const loadFishData = useCallback(async (id: string) => {
    setError(null);
    try {
      const fish = await db.getFishCaughtById(id);
      if (fish) {
        const normalizedPhotos = normalizeFishPhotos(fish.photos, {
          id: fish.id,
          photo: fish.photo,
          photoHash: fish.photoHash,
          photoPath: fish.photoPath,
          photoMime: fish.photoMime,
          photoUrl: fish.photoUrl,
          encryptedMetadata: fish.encryptedMetadata,
        });
        const previews: Record<string, string> = {};
        normalizedPhotos.forEach((photo) => {
          const inline = photo.photo || photo.photoUrl;
          if (inline) {
            previews[photo.id] = inline;
          }
        });
        setFormData({
          species: normalizeField(fish.species),
          length: normalizeField(fish.length),
          weight: normalizeField(fish.weight),
          time: normalizeField(fish.time),
          gear: Array.isArray(fish.gear) ? fish.gear.map((entry) => normalizeField(entry)) : [],
          details: normalizeField(fish.details),
        });
        setPhotos(normalizedPhotos);
        setPhotoPreviews(previews);
        setPhotoAuthLocks({});
        setShouldClearLegacyPhoto(false);
        initialPhotoCountRef.current = normalizedPhotos.length;
      } else {
        setError('Fish catch not found');
      }
    } catch (err) {
      console.error('Error loading fish catch:', err);
      setError('Failed to load fish catch data');
    }
  }, [db]);

  useEffect(() => {
    if (isOpen) {
      if (isEditing && fishId) {
        loadFishData(fishId);
      } else {
        setFormData({
          species: "",
          length: "",
          weight: "",
          time: "",
          gear: [],
          details: "",
        });
        setPhotos([]);
        setPhotoPreviews({});
        setPhotoAuthLocks({});
        setShouldClearLegacyPhoto(false);
        initialPhotoCountRef.current = 0;
      }
      setError(null);
      setValidation({ isValid: true, errors: {} });
      setUploadError(null);
    }
  }, [isOpen, isEditing, fishId, loadFishData]);

  useEffect(() => {
    let isMounted = true;
    const fetchTripDetails = async () => {
      try {
        const trip = await db.getTripById(tripId);
        if (isMounted) {
          setTripDetails(trip ? { date: trip.date, location: trip.location, water: trip.water } : null);
        }
      } catch {
        if (isMounted) {
          setTripDetails(null);
        }
      }
    };

    if (isOpen) {
      fetchTripDetails();
    }

    return () => {
      isMounted = false;
    };
  }, [db, isOpen, tripId]);

  useEffect(() => {
    if (!isOpen) {
      setPhotoViewerIndex(null);
      setTripDetails(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (photos.length > 0) {
      setShouldClearLegacyPhoto(false);
      return;
    }
    if (isEditing && initialPhotoCountRef.current > 0) {
      setShouldClearLegacyPhoto(true);
    }
  }, [photos.length, isEditing]);

  const fishPhotoContext = React.useMemo(() => {
    return {
      id: fishId ?? `${tripId}-draft`,
      tripId,
      species: formData.species,
      length: formData.length,
      weight: formData.weight,
      time: formData.time,
      gear: formData.gear,
      details: formData.details,
      photos,
      primaryPhotoId,
    } as FishCaught;
  }, [fishId, tripId, formData, photos, primaryPhotoId]);

  const pendingPhotoIds = React.useMemo(() => {
    return photos
      .filter((photo) => {
        const hasSource = Boolean(photo.photo || photo.photoUrl || photo.photoPath);
        return hasSource && !photoPreviews[photo.id];
      })
      .map((photo) => photo.id);
  }, [photos, photoPreviews]);

  useEffect(() => {
    if (!isOpen || pendingPhotoIds.length === 0) {
      return;
    }

    let cancelled = false;

    const hydratePreviews = async () => {
      for (const photoId of pendingPhotoIds) {
        const photo = photos.find((entry) => entry.id === photoId);
        if (!photo) continue;
        if (!user && (photo.photoPath || photo.encryptedMetadata)) {
          if (!cancelled) {
            setPhotoAuthLocks((prev) => ({ ...prev, [photo.id]: true }));
          }
          continue;
        }
        try {
          const preview = await getFishPhotoPreview(fishPhotoContext, photo);
          if (preview && !cancelled) {
            setPhotoPreviews((prev) => ({ ...prev, [photo.id]: preview }));
          }
        } catch {
          if (!cancelled && !user) {
            setPhotoAuthLocks((prev) => ({ ...prev, [photo.id]: true }));
          }
        }
      }
    };

    void hydratePreviews();

    return () => {
      cancelled = true;
    };
  }, [pendingPhotoIds, photos, isOpen, user, fishPhotoContext]);

  const handleInputChange = useCallback((field: string, value: string | string[] | undefined) => {
    setFormData(prev => {
      if (Array.isArray(value)) {
        return { ...prev, [field]: value.map((entry) => normalizeField(entry)) as any };
      }
      return { ...prev, [field]: normalizeField(value) as any };
    });

    // Clear validation error for this field
    if (validation.errors[field]) {
      setValidation(prev => ({
        ...prev,
        errors: {
          ...prev.errors,
          [field]: ''
        }
      }));
    }

    // Clear general error
    if (error) setError(null);
  }, [error, validation.errors]);

  const removePhoto = useCallback((photoId: string) => {
    setPhotos(prev => {
      const filtered = prev.filter(photo => photo.id !== photoId);
      if (filtered.length === 0) {
        return [];
      }
      const hasPrimary = filtered.some(photo => photo.isPrimary);
      if (!hasPrimary) {
        filtered[0].isPrimary = true;
      }
      return filtered.map((photo, index) => ({ ...photo, order: index }));
    });
    setPhotoPreviews(prev => {
      const next = { ...prev };
      delete next[photoId];
      return next;
    });
    setPhotoAuthLocks(prev => {
      const next = { ...prev };
      delete next[photoId];
      return next;
    });
  }, []);

  const setPhotoAsPrimary = useCallback((photoId: string) => {
    setPhotos(prev => prev.map(photo => ({
      ...photo,
      isPrimary: photo.id === photoId,
    })));
  }, []);

  const openPhotoViewer = useCallback((photoId: string) => {
    const index = photos.findIndex(photo => photo.id === photoId);
    if (index === -1) {
      return;
    }
    setPhotoViewerIndex(index);
  }, [photos]);

  const handleViewerClose = useCallback(() => {
    setPhotoViewerIndex(null);
  }, []);

  const handleViewerNext = useCallback(() => {
    setPhotoViewerIndex(prev => {
      if (prev === null || photos.length <= 1) return prev;
      return (prev + 1) % photos.length;
    });
  }, [photos.length]);

  const handleViewerPrevious = useCallback(() => {
    setPhotoViewerIndex(prev => {
      if (prev === null || photos.length <= 1) return prev;
      return (prev - 1 + photos.length) % photos.length;
    });
  }, [photos.length]);

  const viewerPhoto = photoViewerIndex !== null ? photos[photoViewerIndex] : null;
  const viewerSrc = viewerPhoto ? photoPreviews[viewerPhoto.id] : undefined;
  const viewerRequiresAuth = viewerPhoto
    ? Boolean(photoAuthLocks[viewerPhoto.id] || (!user && (viewerPhoto.photoPath || viewerPhoto.encryptedMetadata)))
    : false;
  const viewerMetadata = viewerPhoto
    ? {
        species: formData.species,
        length: formData.length,
        weight: formData.weight,
        time: formData.time,
        date: (() => {
          if (!tripDetails?.date) return undefined;
          try {
            return new Date(tripDetails.date).toLocaleDateString('en-NZ', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });
          } catch {
            return tripDetails.date;
          }
        })(),
        location: tripDetails?.location,
        water: tripDetails?.water,
      }
    : undefined;

  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};

    if (!formData.species.trim()) {
      errors.species = "Species is required";
    }

    const isValid = Object.keys(errors).length === 0;
    setValidation({ isValid, errors });
    return { isValid, errors };
  }, [formData]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    const validationResult = validateForm();
    setValidation(validationResult);

    if (!validationResult.isValid) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const hashFNV1a = (str: string) => {
        let hash = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
          hash ^= str.charCodeAt(i);
          hash = Math.imul(hash, 0x01000193);
        }
        return ('0000000' + (hash >>> 0).toString(16)).slice(-8);
      };
      const compositeToId = new Map<string, string>();
      const compositeToDisplay = new Map<string, string>();
      const nameToIds = new Map<string, string[]>();
      const nameToDisplay = new Map<string, string>();
      for (const it of tackleBox) {
        const composite = gearKey(it);
        const compositeLower = gearKeyLower(it);
        const gid = it.gearId || `local-${hashFNV1a(compositeLower)}`;
        if (!compositeToId.has(compositeLower)) compositeToId.set(compositeLower, gid);
        if (!compositeToDisplay.has(compositeLower)) compositeToDisplay.set(compositeLower, composite);
        const nmLower = normLower(it.name);
        const arr = nameToIds.get(nmLower) || [];
        if (!arr.includes(gid)) arr.push(gid);
        nameToIds.set(nmLower, arr);
        if (!nameToDisplay.has(nmLower)) {
          nameToDisplay.set(nmLower, norm(it.name));
        }
      }

      const canonicalGearEntries: string[] = [];
      const resolvedGearIds: string[] = [];
      const seenGearEntries = new Set<string>();
      const seenGearIds = new Set<string>();

      for (const rawEntry of formData.gear) {
        if (!rawEntry) continue;
        const normalizedValue = entryLower(rawEntry);
        const nameLower = entryNameLower(rawEntry);

        let canonicalEntry = rawEntry.includes('|')
          ? (compositeToDisplay.get(normalizedValue) || rawEntry.split('|').map(part => part.trim()).join('|'))
          : (nameToDisplay.get(nameLower) || norm(rawEntry));

        const canonicalLower = entryLower(canonicalEntry);
        if (!seenGearEntries.has(canonicalLower)) {
          canonicalGearEntries.push(canonicalEntry);
          seenGearEntries.add(canonicalLower);
        }

        let gid: string | undefined;
        if (rawEntry.includes('|')) {
          gid = compositeToId.get(normalizedValue);
        } else {
          const ids = nameToIds.get(nameLower) || [];
          gid = ids.length === 1 ? ids[0] : (ids[0] || undefined);
        }
        if (!gid) {
          gid = `local-${hashFNV1a(normalizedValue || nameLower)}`;
        }
        if (!seenGearIds.has(gid)) {
          resolvedGearIds.push(gid);
          seenGearIds.add(gid);
        }
      }
      const nextPhotos: PhotoFormEntry[] = photos.map((photo, index) => ({
        ...photo,
        order: index,
        isPrimary: photo.id === primaryPhotoId ? true : photo.isPrimary,
      }));

      const hasPrimary = nextPhotos.some((photo) => photo.isPrimary);
      if (!hasPrimary && nextPhotos.length > 0) {
        nextPhotos[0].isPrimary = true;
      }

      const persistablePhotos: FishPhoto[] = nextPhotos.map(({ local, ...rest }) => rest);

      const fishDataBase: any = {
        tripId,
        species: formData.species.trim(),
        length: formData.length.trim(),
        weight: formData.weight.trim(),
        time: formData.time.trim(),
        gear: canonicalGearEntries,
        gearIds: resolvedGearIds,
        details: formData.details.trim(),
      };

      if (persistablePhotos.length > 0) {
        fishDataBase.photos = persistablePhotos;
        fishDataBase.primaryPhotoId = persistablePhotos.find((photo) => photo.isPrimary)?.id ?? persistablePhotos[0].id;
      } else if (shouldClearLegacyPhoto) {
        Object.assign(fishDataBase, buildPhotoRemovalFields());
      }

      let savedData: FishCaught;
      if (isEditing && fishId) {
        const payload: any = { id: fishId, ...fishDataBase };
        if (!user) {
          payload.guestSessionId = getOrCreateGuestSessionId();
        }
        Object.keys(payload).forEach((key) => {
          if (payload[key] === undefined) {
            delete payload[key];
          }
        });
        await db.updateFishCaught(payload);
        savedData = { id: fishId, ...payload };
      } else {
        const payload: any = { ...fishDataBase };
        if (!user) {
          payload.guestSessionId = getOrCreateGuestSessionId();
        }
        Object.keys(payload).forEach((key) => {
          if (payload[key] === undefined) {
            delete payload[key];
          }
        });
        const newId = await db.createFishCaught(payload);
        savedData = { id: newId.toString(), ...payload };
      }

      if (onFishCaught) onFishCaught(savedData);
      onClose();
    } catch (err) {
      console.error(`Error ${isEditing ? 'updating' : 'creating'} fish catch:`, err);
      setError(`Failed to ${isEditing ? 'update' : 'save'} fish catch. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    db,
    formData,
    photos,
    primaryPhotoId,
    shouldClearLegacyPhoto,
    isEditing,
    onClose,
    onFishCaught,
    tripId,
    validateForm,
    fishId,
    tackleBox,
    entryLower,
    entryNameLower,
    gearKey,
    gearKeyLower,
    norm,
    normLower,
    user,
  ]);

  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    const validFiles = files.filter((file) => {
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file.');
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB.');
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) {
      setUploadError('No valid photos selected.');
      return;
    }

    setIsUploadingPhoto(true);
    setUploadError(null);
    setError(null);

    const readFile = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to process photo'));
        reader.readAsDataURL(file);
      });

    try {
      const dataUrls = await Promise.all(validFiles.map(readFile));
      setPhotos((prev) => {
        const baseOrder = prev.length;
        const newEntries: PhotoFormEntry[] = dataUrls.map((dataUrl, idx) => ({
          id: `${tripId}-${generateULID()}`,
          order: baseOrder + idx,
          photo: dataUrl,
          isPrimary: prev.length === 0 && idx === 0,
        }));
        const next = [...prev, ...newEntries];
        if (!next.some((photo) => photo.isPrimary) && next.length > 0) {
          next[0].isPrimary = true;
        }
        setPhotoPreviews((existing) => {
          const updated = { ...existing };
          newEntries.forEach((entry, index) => {
            updated[entry.id] = dataUrls[index];
          });
          return updated;
        });
        return next;
      });
      setFileInputKey((k) => k + 1);
    } catch (err) {
      console.error('Photo processing failed:', err);
      setUploadError('Failed to process photo. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
    }
  }, [tripId]);

  // Filter and group gear items
  const filteredAndGroupedGear = React.useMemo(() => {
    let filtered = tackleBox;

    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = tackleBox.filter(item =>
        item.name.toLowerCase().includes(search) ||
        item.brand.toLowerCase().includes(search) ||
        item.type.toLowerCase().includes(search)
      );
    }

    // Group by type
    const grouped = filtered.reduce((acc, item) => {
      const type = item.type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(item);
      return acc;
    }, {} as Record<string, typeof tackleBox>);

    return grouped;
  }, [tackleBox, searchTerm]);

  const toggleTypeExpansion = (type: string) => {
    const newExpanded = new Set(expandedTypes);
    if (newExpanded.has(type)) {
      newExpanded.delete(type);
    } else {
      newExpanded.add(type);
    }
    setExpandedTypes(newExpanded);
  };

  const selectAllInType = (type: string) => {
    const typeItems = filteredAndGroupedGear[type] || [];
    const existing = new Set(formData.gear.map(entryLower));
    const next = [...formData.gear];
    for (const item of typeItems) {
      const key = gearKey(item);
      const lower = gearKeyLower(item);
      if (!existing.has(lower)) {
        next.push(key);
        existing.add(lower);
      }
    }
    handleInputChange("gear", next);
  };

  const clearAllInType = (type: string) => {
    const typeItems = filteredAndGroupedGear[type] || [];
    const keysLower = new Set(typeItems.map(item => gearKeyLower(item)));
    const namesLower = new Set(typeItems.map(item => normLower(item.name)));
    const newSelection = formData.gear.filter((gear) => {
      const lower = entryLower(gear);
      if (keysLower.has(lower)) {
        return false;
      }
      const gearNameLower = entryNameLower(gear);
      return !namesLower.has(gearNameLower);
    });
    handleInputChange("gear", newSelection);
  };

  if (!isOpen) return null;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} maxWidth="2xl">
        <ModalHeader
          title={isEditing ? "Edit Fish Catch" : "Add Fish Catch"}
          subtitle={isEditing ? "Update details of your catch" : "Record details of your catch"}
          onClose={onClose}
        />

        <ModalBody>
          {/* Error display */}
          {error && (
            <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--error-background)', border: '1px solid var(--error-border)' }}>
              <div className="flex items-center">
                <i className="fas fa-exclamation-triangle mr-2" style={{ color: 'var(--error-text)' }}></i>
                <span style={{ color: 'var(--error-text)' }}>{error}</span>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Species */}
            <div>
              <label htmlFor="species" className="form-label">
                Species *
              </label>
              <input
                type="text"
                id="species"
                value={formData.species}
                onChange={(e) => handleInputChange("species", e.target.value)}
                placeholder="e.g., Rainbow Trout, Snapper"
                className={`w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validation.errors.species ? 'border-red-500' : ''
                }`}
                style={{
                  backgroundColor: 'var(--input-background)',
                  border: `1px solid ${validation.errors.species ? 'var(--error-border)' : 'var(--border-color)'}`,
                  color: 'var(--primary-text)'
                }}
                required
              />
              {validation.errors.species && (
                <p className="mt-1 text-sm" style={{ color: 'var(--error-text)' }}>{validation.errors.species}</p>
              )}
            </div>

            {/* Length and Weight Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="length" className="form-label">
                  Length
                </label>
                <input
                  type="text"
                  id="length"
                  value={formData.length}
                  onChange={(e) => handleInputChange("length", e.target.value)}
                  placeholder="e.g., 55cm"
                  className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    backgroundColor: 'var(--input-background)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--primary-text)'
                  }}
                />
              </div>
              <div>
                <label htmlFor="weight" className="form-label">
                  Weight
                </label>
                <input
                  type="text"
                  id="weight"
                  value={formData.weight}
                  onChange={(e) => handleInputChange("weight", e.target.value)}
                  placeholder="e.g., 2.5kg"
                  className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    backgroundColor: 'var(--input-background)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--primary-text)'
                  }}
                />
              </div>
            </div>

            {/* Time of Catch */}
            <div>
              <label htmlFor="time" className="form-label">
                Time of Catch
              </label>
              <input
                type="time"
                id="time"
                value={formData.time}
                onChange={(e) => handleInputChange("time", e.target.value)}
                className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{
                  backgroundColor: 'var(--input-background)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--primary-text)'
                }}
              />
            </div>

            {/* Gear Used */}
            <div>
              <label className="form-label">
                Gear Used
              </label>

              {/* Search Input */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search gear items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    backgroundColor: 'var(--input-background)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--primary-text)'
                  }}
                />
              </div>

              {tackleBox.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {Object.entries(filteredAndGroupedGear).map(([type, items]) => {
                    const isExpanded = expandedTypes.has(type);
                    const selectedCount = items.filter(item => isSelectedGear(item)).length;
                    const totalCount = items.length;

                    return (
                      <div key={type} className="border rounded-lg" style={{ borderColor: 'var(--border-color)' }}>
                        {/* Type Header */}
                        <div
                          className="flex items-center justify-between p-3 cursor-pointer hover:opacity-80 transition-all"
                          style={{ backgroundColor: 'var(--secondary-background)' }}
                          onClick={() => toggleTypeExpansion(type)}
                        >
                          <div className="flex items-center">
                            <i className={`fas fa-chevron-${isExpanded ? 'down' : 'right'} mr-2`} style={{ color: 'var(--secondary-text)' }}></i>
                            <div>
                              <div className="font-medium" style={{ color: 'var(--primary-text)' }}>
                                {type}s ({totalCount} item{totalCount !== 1 ? 's' : ''})
                              </div>
                              {selectedCount > 0 && (
                                <div className="text-xs" style={{ color: 'var(--secondary-text)' }}>
                                  {selectedCount} selected
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex space-x-1">
                            {selectedCount > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  clearAllInType(type);
                                }}
                                className="px-2 py-1 text-xs rounded"
                                style={{ backgroundColor: 'var(--error-background)', color: 'var(--error-text)' }}
                              >
                                Clear All
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                selectAllInType(type);
                              }}
                              className="px-2 py-1 text-xs rounded"
                              style={{ backgroundColor: 'var(--button-primary)', color: 'white' }}
                            >
                              Select All
                            </button>
                          </div>
                        </div>

                        {/* Type Items */}
                        {isExpanded && (
                          <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
                            {items.map(item => (
                              <label
                                key={item.id}
                                className="flex items-center p-2 rounded hover:opacity-80 cursor-pointer transition-all"
                                style={{
                                  backgroundColor: isSelectedGear(item) ? 'var(--button-primary)' : 'var(--input-background)',
                                  border: isSelectedGear(item) ? '1px solid var(--button-primary)' : '1px solid transparent'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelectedGear(item)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      const key = gearKey(item);
                                      const lower = gearKeyLower(item);
                                      const nameLower = normLower(item.name);
                                      let replaced = false;
                                      const next: string[] = [];

                                      for (const entry of formData.gear) {
                                        const candidateLower = entryLower(entry);
                                        const candidateNameLower = entryNameLower(entry);
                                        const compositeMatch = candidateLower === lower;
                                        const legacyMatch = !entry.includes('|') && candidateNameLower === nameLower;

                                        if (!replaced && (compositeMatch || legacyMatch)) {
                                          replaced = true;
                                          continue;
                                        }

                                        next.push(entry);
                                      }

                                      next.push(key);
                                      handleInputChange("gear", next);
                                    } else {
                                      const lower = gearKeyLower(item);
                                      const nameLower = normLower(item.name);
                                      let removed = false;
                                      const next: string[] = [];

                                      for (const entry of formData.gear) {
                                        const candidateLower = entryLower(entry);
                                        const candidateNameLower = entryNameLower(entry);
                                        const compositeMatch = candidateLower === lower;
                                        const legacyMatch = !entry.includes('|') && candidateNameLower === nameLower;

                                        if (!removed && (compositeMatch || legacyMatch)) {
                                          removed = true;
                                          continue;
                                        }

                                        next.push(entry);
                                      }

                                      handleInputChange("gear", next);
                                    }
                                  }}
                                  className="mr-3 w-4 h-4 text-white bg-transparent border-2 rounded focus:ring-0"
                                  style={{
                                    borderColor: isSelectedGear(item) ? 'white' : 'var(--border-color)',
                                    backgroundColor: isSelectedGear(item) ? 'var(--button-primary)' : 'transparent'
                                  }}
                                />
                                <div className="flex-1">
                                  <div className="text-sm font-medium" style={{ color: isSelectedGear(item) ? 'white' : 'var(--primary-text)' }}>
                                    {item.name} {item.brand ? `· ${item.brand}` : ''} {item.colour ? `· ${item.colour}` : ''}
                                  </div>
                                  <div className="text-xs" style={{ color: isSelectedGear(item) ? 'rgba(255,255,255,0.8)' : 'var(--secondary-text)' }}>
                                    {item.type}
                                  </div>
                                </div>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 border rounded-md" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--secondary-background)' }}>
                  <i className="fas fa-toolbox text-2xl mb-2" style={{ color: 'var(--secondary-text)' }}></i>
                  <p style={{ color: 'var(--secondary-text)' }}>No gear available</p>
                  <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>Add gear items to your tackle box first</p>
                </div>
              )}

              {/* Selected Gear Summary */}
              {formData.gear.length > 0 && (
                <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--secondary-background)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium" style={{ color: 'var(--secondary-text)' }}>
                      Selected Gear ({formData.gear.length} item{formData.gear.length !== 1 ? 's' : ''}):
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => handleInputChange("gear", [])}
                    >
                      Clear All
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {formData.gear.map((gearItem, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs"
                        style={{ backgroundColor: 'var(--chip-background)', color: 'var(--chip-text)' }}
                      >
                        {(() => {
                          const label = formatGearLabel(gearItem);
                          return label || gearItem;
                        })()}
                        <button
                          type="button"
                          onClick={() => handleInputChange("gear", formData.gear.filter((_, i) => i !== index))}
                          className="ml-1"
                          style={{ color: 'var(--chip-text)' }}
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Photo Section */}
            <div>
              <label className="form-label">
                Photos
              </label>
              {photos.length === 0 ? (
                <div className="mt-2 p-4 rounded border border-dashed text-sm text-center" style={{ borderColor: 'var(--border-color)', color: 'var(--secondary-text)' }}>
                  No photos added yet. Upload one or more images to document this catch.
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {photos.map((photo, index) => {
                    const preview = photoPreviews[photo.id];
                    const locked = photoAuthLocks[photo.id] || (!user && (photo.photoPath || photo.encryptedMetadata));
                    return (
                      <div key={photo.id} className="relative rounded-lg border p-2" style={{ borderColor: photo.isPrimary ? '#3b82f6' : 'var(--border-color)' }}>
                        <button
                          type="button"
                          onClick={() => openPhotoViewer(photo.id)}
                          className="relative block w-full h-32 rounded overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {preview ? (
                            <img src={preview} alt={`Catch photo ${index + 1}`} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-xs text-gray-500">
                              Loading preview…
                            </div>
                          )}
                          {locked && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-xs">
                              🔒 Sign in
                            </div>
                          )}
                          {photo.isPrimary && (
                            <div className="absolute bottom-2 left-2 bg-blue-600 text-white text-[10px] px-2 py-1 rounded-full">
                              Cover photo
                            </div>
                          )}
                        </button>
                        <div className="flex items-center justify-between mt-2 text-xs">
                          <button
                            type="button"
                            onClick={() => setPhotoAsPrimary(photo.id)}
                            className={`px-2 py-1 rounded ${photo.isPrimary ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}
                            disabled={photo.isPrimary}
                          >
                            {photo.isPrimary ? 'Primary' : 'Set as cover'}
                          </button>
                          <button
                            type="button"
                            onClick={() => removePhoto(photo.id)}
                            className="text-red-500 hover:text-red-600"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {uploadError && (
                <p className="mt-2 text-xs" style={{ color: 'var(--error-text)' }}>{uploadError}</p>
              )}
              <div className="mt-4">
                <button
                  type="button"
                  className="w-full border-2 border-dashed rounded-lg p-6 text-center hover:opacity-80 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border-color)' }}
                  onClick={() => document.getElementById('photo-upload')?.click()}
                >
                  <div className="space-y-2">
                    <div className="flex justify-center">
                      <i className="fas fa-camera text-2xl" style={{ color: 'var(--secondary-text)' }}></i>
                    </div>
                    <div className="text-sm" style={{ color: 'var(--secondary-text)' }}>
                      {isUploadingPhoto ? "Uploading..." : "Upload Photos"}
                    </div>
                    {photos.length > 0 && (
                      <div className="text-xs" style={{ color: 'var(--secondary-text)' }}>You can add multiple photos</div>
                    )}
                  </div>
                </button>
                <input key={fileInputKey} type="file" id="photo-upload" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
              </div>
            </div>

            {/* Details */}
            <div>
              <label htmlFor="details" className="form-label">
                Details (Optional)
              </label>
              <textarea
                id="details"
                rows={3}
                value={formData.details}
                onChange={(e) => handleInputChange("details", e.target.value)}
                placeholder="Additional notes about the catch..."
                className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
                style={{
                  backgroundColor: 'var(--input-background)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--primary-text)'
                }}
              />
            </div>
          </form>
        </ModalBody>

        <ModalFooter>
          <div className="flex justify-end space-x-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" onClick={handleSubmit} loading={isSubmitting} disabled={isSubmitting}>
              {isSubmitting ? (isEditing ? 'Updating…' : 'Saving…') : (isEditing ? 'Update' : 'Save')}
            </Button>
          </div>
        </ModalFooter>
      </Modal>

      <ConfirmationDialog
        isOpen={showStaleGearConfirm}
        title="Remove unavailable gear?"
        message={staleGear.length > 1
          ? `The following gear item names are no longer in your tackle box: ${staleGear.join(', ')}. Remove them from this catch?`
          : `"${staleGear[0] || ''}" is no longer in your tackle box. Remove it from this catch?`}
        confirmText="Remove"
        cancelText="Keep"
        onConfirm={() => {
          setFormData(prev => ({ ...prev, gear: prev.gear.filter(g => !staleGear.includes(g)) }));
          setShowStaleGearConfirm(false);
          setStaleGear([]);
        }}
        onCancel={() => {
          setShowStaleGearConfirm(false);
          setStaleGear([]);
        }}
        variant="warning"
        overlayStyle="blur"
      />

      {photoViewerIndex !== null && viewerPhoto && (
        <PhotoViewerModal
          isOpen={true}
          photoSrc={viewerSrc}
          requiresAuth={viewerRequiresAuth}
          metadata={viewerMetadata}
          onClose={handleViewerClose}
          onNext={photos.length > 1 ? handleViewerNext : undefined}
          onPrevious={photos.length > 1 ? handleViewerPrevious : undefined}
        />
      )}
    </>
  );
};

export default FishCatchModal;
