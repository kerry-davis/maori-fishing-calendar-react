export type PhotoRemovalFields = {
  photo: "";
  photoPath: "";
  photoUrl: "";
  photoHash: undefined;
  photoMime: undefined;
  encryptedMetadata: undefined;
};

/**
 * Returns a canonical set of fields used to indicate that a photo should be removed
 * from a fish catch record (inline data, storage path, cached URL, and metadata).
 * Consumers should merge these into form state before submitting so that update
 * payloads remain consistent with Firebase sanitisation rules (see
 * docs/architecture/DATA_MODEL.md).
 */
export function buildPhotoRemovalFields(): PhotoRemovalFields {
  return {
    photo: "",
    photoPath: "",
    photoUrl: "",
    photoHash: undefined,
    photoMime: undefined,
    encryptedMetadata: undefined,
  } as const;
}
