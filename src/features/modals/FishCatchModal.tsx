import React, { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@shared/components/Button";
import ConfirmationDialog from '@shared/components/ConfirmationDialog';
import { Modal, ModalHeader, ModalBody, ModalFooter } from "./Modal";
import { useDatabaseService } from '../../app/providers/DatabaseContext';
import { useAuth } from '../../app/providers/AuthContext';
import { useFirebaseTackleBox } from "@shared/hooks/useFirebaseTackleBox";
import { storage } from "@shared/services/firebase";
import { ref, deleteObject } from "firebase/storage";
import type { FishCaught } from "@shared/types";
import { getFishPhotoPreview } from "@shared/utils/photoPreviewUtils";
import { getOrCreateGuestSessionId } from "@shared/services/guestSessionService";
import { buildPhotoRemovalFields } from "@shared/utils/photoUpdateHelpers";
import PhotoViewerModal from './PhotoViewerModal';

export interface FishCatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: number;
  fishId?: string;
  onFishCaught?: (fish: FishCaught) => void;
}

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
  const [formData, setFormData] = useState({
    species: "",
    length: "",
    weight: "",
    time: "",
    gear: [] as string[],
    details: "",
    photo: "",
    photoPath: "",
    photoUrl: "",
    photoHash: "",
    photoMime: "",
    encryptedMetadata: undefined as string | undefined,
  });
  const [validation, setValidation] = useState({
    isValid: true,
    errors: {} as Record<string, string>
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [fileInputKey, setFileInputKey] = useState(0);
  const [photoViewer, setPhotoViewer] = useState<{
    photoSrc?: string;
    requiresAuth: boolean;
    metadata: {
      species?: string;
      length?: string;
      weight?: string;
      time?: string;
      date?: string;
      location?: string;
      water?: string;
    };
  } | null>(null);
  const [tripDetails, setTripDetails] = useState<{ date?: string; location?: string; water?: string } | null>(null);
  const isEditing = fishId !== undefined;
  const photoStatusRef = useRef<'unchanged' | 'uploaded' | 'deleted'>('unchanged');
  const requiresAuthForExistingPhoto = !user && Boolean(formData.photoPath || formData.encryptedMetadata);
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
        setFormData({
          species: fish.species,
          length: fish.length,
          weight: fish.weight,
          time: fish.time,
          gear: fish.gear,
          details: fish.details,
          photo: fish.photo || "",
          photoPath: fish.photoPath || "",
          photoUrl: fish.photoUrl || "",
          photoHash: fish.photoHash || "",
          photoMime: fish.photoMime || "",
          encryptedMetadata: fish.encryptedMetadata ?? undefined,
        });
        photoStatusRef.current = 'unchanged';
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
          photo: "",
          photoPath: "",
          photoUrl: "",
          photoHash: "",
          photoMime: "",
          encryptedMetadata: undefined,
        });
      }
      photoStatusRef.current = 'unchanged';
      setError(null);
      setValidation({ isValid: true, errors: {} });
      setPhotoPreview(null);
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
      setPhotoViewer(null);
      setTripDetails(null);
    }
  }, [isOpen]);

  // Cleanup photo preview URL when preview changes or component unmounts
  useEffect(() => {
    return () => {
      if (photoPreview && photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (photoStatusRef.current === 'uploaded') {
      setIsPhotoLoading(false);
      return;
    }

    if (photoStatusRef.current === 'deleted') {
      setPhotoPreview(null);
      setIsPhotoLoading(false);
      return;
    }

    const hasPhotoSource = Boolean(formData.photoPath || formData.photoUrl || formData.photo);
    if (!hasPhotoSource) {
      setPhotoPreview(null);
      setIsPhotoLoading(false);
      return;
    }

    let isActive = true;
    const fallbackSrc = formData.photoUrl || formData.photo || null;

    const fetchPreview = async () => {
      setIsPhotoLoading(true);

      const fishForPreview: FishCaught = {
        id: fishId ?? `${tripId}-preview`,
        tripId,
        species: '',
        length: '',
        weight: '',
        time: '',
        gear: [],
        details: '',
        photo: formData.photo || undefined,
        photoUrl: formData.photoUrl || undefined,
        photoPath: formData.photoPath || undefined,
        photoHash: formData.photoHash || undefined,
        photoMime: formData.photoMime || undefined,
        encryptedMetadata: formData.encryptedMetadata || undefined,
      };

      try {
        const preview = await getFishPhotoPreview(fishForPreview);
        if (!isActive) return;
        setPhotoPreview(preview ?? fallbackSrc);
      } catch {
        if (!isActive) return;
        setPhotoPreview(fallbackSrc);
      } finally {
        if (isActive) {
          setIsPhotoLoading(false);
        }
      }
    };

    void fetchPreview();

    return () => {
      isActive = false;
    };
  }, [
    isOpen,
    isEditing,
    fishId,
    tripId,
    formData.photoPath,
    formData.photoUrl,
    formData.photo,
    formData.photoHash,
    formData.photoMime,
    formData.encryptedMetadata,
    user
  ]);

  const handleInputChange = useCallback((field: string, value: string | string[] | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value as any }));

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

  const openPhotoViewer = useCallback((src?: string | null, requiresAuthFlag?: boolean) => {
    if (!src && !requiresAuthFlag) {
      return;
    }
    const formattedDate = (() => {
      const raw = tripDetails?.date;
      if (!raw) return undefined;
      try {
        return new Date(raw).toLocaleDateString('en-NZ', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      } catch {
        return raw;
      }
    })();

    setPhotoViewer({
      photoSrc: src ?? undefined,
      requiresAuth: Boolean(requiresAuthFlag),
      metadata: {
        species: formData.species,
        length: formData.length,
        weight: formData.weight,
        time: formData.time,
        date: formattedDate,
        location: tripDetails?.location,
        water: tripDetails?.water,
      },
    });
  }, [formData.length, formData.species, formData.time, formData.weight, tripDetails]);

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

      // Only change photo if explicitly uploaded or deleted in this session
      if (photoStatusRef.current === 'uploaded' && typeof formData.photo === 'string' && formData.photo.startsWith('data:')) {
        fishDataBase.photo = formData.photo; // let service move to Storage
      } else if (photoStatusRef.current === 'deleted') {
        fishDataBase.photo = '';
        fishDataBase.photoPath = '';
        fishDataBase.photoUrl = '';
        fishDataBase.photoHash = undefined;
        fishDataBase.photoMime = undefined;
        fishDataBase.encryptedMetadata = undefined;
      } else {
        if (typeof formData.photo === 'string' && formData.photo.trim() !== '') {
          fishDataBase.photo = formData.photo;
        }
        if (typeof formData.photoPath === 'string' && formData.photoPath.trim() !== '') {
          fishDataBase.photoPath = formData.photoPath;
        }
        if (typeof formData.photoUrl === 'string' && formData.photoUrl.trim() !== '') {
          fishDataBase.photoUrl = formData.photoUrl;
        }
        if (typeof formData.photoHash === 'string' && formData.photoHash.trim() !== '') {
          fishDataBase.photoHash = formData.photoHash;
        }
        if (typeof formData.photoMime === 'string' && formData.photoMime.trim() !== '') {
          fishDataBase.photoMime = formData.photoMime;
        }
        if (typeof formData.encryptedMetadata === 'string' && formData.encryptedMetadata.trim() !== '') {
          fishDataBase.encryptedMetadata = formData.encryptedMetadata;
        }
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
  }, [db, formData, isEditing, onClose, onFishCaught, tripId, validateForm, fishId]);

  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Clean up previous preview URL to prevent memory leaks
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB.');
      return;
    }

    // Create preview URL for selected file immediately
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
    setUploadError(null);
    setError(null);

    // If not authenticated: persist as data URL (local-only) and keep preview
    if (!user) {
      try {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          handleInputChange("photo", dataUrl);
          handleInputChange("photoPath", "");
          handleInputChange("photoUrl", "");
          handleInputChange("photoHash", "");
          handleInputChange("photoMime", "");
          handleInputChange("encryptedMetadata", undefined);
          setPhotoPreview(dataUrl);
          if (previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(previewUrl);
          }
          photoStatusRef.current = 'uploaded';
        };
        reader.onerror = () => {
          // Clean up the preview URL on error
          if (previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(previewUrl);
          }
          setUploadError('Failed to process photo. Please try again.');
        };
        reader.readAsDataURL(file);
      } catch (e) {
        // Clean up the preview URL on error
        if (previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(previewUrl);
        }
        setUploadError('Failed to process photo. Please try again.');
      }
      return;
    }

    // For authenticated users: read the file as a data URL and let the data service
    // handle encryption and moving the inline data to storage. This centralizes
    // encryption behavior under firebaseDataService.ensurePhotoInStorage and keeps
    // handling consistent across create/update flows.
    setIsUploadingPhoto(true);
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;

        // Pass the data URL to the form state; firebaseDataService will handle
        // moving this inline photo to storage and setting photoPath/photoUrl and
        // encryptedMetadata accordingly when the record is saved.
        handleInputChange("photo", dataUrl);

        // Clear any existing storage-backed fields when replacing a photo
        handleInputChange("photoPath", "");
        handleInputChange("photoUrl", "");
        handleInputChange("photoHash", "");
        handleInputChange("photoMime", "");
        handleInputChange("encryptedMetadata", undefined);
        // Keep UI preview as the local data URL for instant feedback
        setPhotoPreview(dataUrl);
        photoStatusRef.current = 'uploaded';

        // Revoke the temporary blob preview URL if created
        if (previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(previewUrl);
        }
      };
      reader.onerror = () => {
        // Clean up the preview URL on error
        if (previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(previewUrl);
        }
        setUploadError('Failed to process photo. Please try again.');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Photo processing failed:', err);
      // Clean up the preview URL on error
      if (previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      setUploadError('Failed to process photo. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
    }
  }, [user, fishId, handleInputChange, photoPreview]);

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
                Photo (Optional)
              </label>
              {isEditing && formData.photo && !photoPreview && (
                <div className="mt-2">
                  <div className="text-sm font-medium mb-2" style={{ color: 'var(--secondary-text)' }}>Current Photo</div>
                  <div className="relative inline-block">
                    <button
                      type="button"
                      onClick={() => openPhotoViewer(formData.photo || formData.photoUrl, requiresAuthForExistingPhoto)}
                      className="relative block w-32 h-32 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{ border: '1px solid var(--border-color)', overflow: 'hidden' }}
                      title="View photo"
                    >
                      <img
                        src={formData.photo}
                        alt="Current catch"
                        className="w-full h-full object-cover"
                      />
                      {requiresAuthForExistingPhoto && (
                        <div className="absolute inset-0 flex items-center justify-center"
                             style={{ backgroundColor: 'rgba(17,24,39,0.6)', color: 'white', border: '1px solid var(--border-color)' }}>
                          <span className="text-[10px] font-medium">🔒 Sign in</span>
                        </div>
                      )}
                    </button>
                    {(user || !formData.photoPath) && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (user && formData.photoPath) {
                          try {
                            const storageRef = ref(storage, formData.photoPath);
                            await deleteObject(storageRef);
                          } catch (err) {
                            console.warn('Failed to delete photo from storage:', err);
                          }
                        }
                        const removal = buildPhotoRemovalFields();
                        handleInputChange("photo", removal.photo);
                        handleInputChange("photoPath", removal.photoPath);
                        handleInputChange("photoUrl", removal.photoUrl);
                        handleInputChange("photoHash", removal.photoHash);
                        handleInputChange("photoMime", removal.photoMime);
                        handleInputChange("encryptedMetadata", removal.encryptedMetadata);
                        setPhotoPreview(null);
                        setUploadError(null);
                        setFileInputKey((k) => k + 1);
                        photoStatusRef.current = 'deleted';
                      }}
                      className="absolute top-2 right-2 btn btn-danger px-2 py-1 text-xs"
                    >
                      Delete Photo
                    </button>)}
                  </div>
                </div>
              )}

              {/* Photo Preview for newly selected or decrypted photos */}
              <div className="mt-2">
                {(isPhotoLoading || isUploadingPhoto || uploadError || photoPreview) && (
                <div className="text-sm font-medium mb-2" style={{ color: 'var(--secondary-text)' }}>
                    {isPhotoLoading || isUploadingPhoto ? 'Loading Photo...' : uploadError ? 'Upload Failed' : photoPreview ? 'Selected Photo' : ''}
                  </div>
                )}
                <div className="relative inline-block">
                  {isPhotoLoading ? (
                    <div className="flex items-center justify-center w-32 h-32 bg-gray-100 dark:bg-gray-700 rounded">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                  ) : photoPreview ? (
                    <button
                      type="button"
                      onClick={() => openPhotoViewer(photoPreview, requiresAuthForExistingPhoto)}
                      className={`relative block w-32 h-32 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${uploadError ? 'opacity-50' : ''}`}
                      style={{ border: `1px solid ${uploadError ? 'var(--error-border)' : 'var(--border-color)'}`, overflow: 'hidden' }}
                      title="View photo"
                    >
                      <img
                        src={photoPreview}
                        alt="Selected catch"
                        className="w-full h-full object-cover"
                      />
                      {requiresAuthForExistingPhoto && (
                        <div className="absolute inset-0 flex items-center justify-center"
                             style={{ backgroundColor: 'rgba(17,24,39,0.6)', color: 'white', border: '1px solid var(--border-color)' }}>
                          <span className="text-[10px] font-medium">🔒 Sign in</span>
                        </div>
                      )}
                    </button>
                  ) : null}
                  {photoPreview && !isPhotoLoading && (
                    <button
                      type="button"
                      onClick={() => {
                        if (photoPreview && photoPreview.startsWith('blob:')) {
                          URL.revokeObjectURL(photoPreview);
                        }
                        setPhotoPreview(null);
                        setUploadError(null);
                        const removal = buildPhotoRemovalFields();
                        handleInputChange("photo", removal.photo);
                        handleInputChange("photoPath", removal.photoPath);
                        handleInputChange("photoUrl", removal.photoUrl);
                        handleInputChange("photoHash", removal.photoHash);
                        handleInputChange("photoMime", removal.photoMime);
                        handleInputChange("encryptedMetadata", removal.encryptedMetadata);
                        setFileInputKey((k) => k + 1);
                        photoStatusRef.current = 'deleted';
                      }}
                      className="absolute top-2 right-2 btn btn-danger px-2 py-1 text-xs"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {uploadError && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--error-text)' }}>{uploadError}</p>
                )}
              </div>
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
                    <div className="text-sm" style={{ color: 'var(--secondary-text)' }}>{isUploadingPhoto ? "Uploading..." : "Upload New Photo"}</div>
                  </div>
                </button>
                <input key={fileInputKey} type="file" id="photo-upload" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
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

      {photoViewer && (
        <PhotoViewerModal
          isOpen={true}
          photoSrc={photoViewer.photoSrc}
          requiresAuth={photoViewer.requiresAuth}
          metadata={photoViewer.metadata}
          onClose={() => setPhotoViewer(null)}
        />
      )}
    </>
  );
};

export default FishCatchModal;