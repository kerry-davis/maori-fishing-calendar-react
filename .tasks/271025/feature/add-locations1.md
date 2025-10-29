Summary: Add Saved Locations feature with CRUD and limit of 10 per user.
Data & Storage: New SavedLocation model persisted in Firestore collection userSavedLocations with owner-only rules, guest mirror in localStorage, encryption on string fields, hard cap enforcement.
Services & State: Extend FirebaseDataService with get/create/update/delete helpers, introduce useSavedLocations hook feeding LocationContext with save/select helpers and limit errors.
UI: Build SavedLocationSelector component and integrate into trip modals, Settings location section, and tide/lunar views while preserving manual entry fallback.
Testing: Add unit, integration, and rules tests covering CRUD, limit enforcement, and auth/guest flows.
NonFunctional: Optimistic updates, event-driven refresh, consistent logging.
