# Troubleshooting

| Symptom | Likely Cause | Fix |
| ------- | ------------ | --- |
| Ciphertext shows in UI | Pepper mismatch / rotation | Restore old build & re-encrypt, or plan rotation |
| Migration pill never appears | No plaintext docs OR key not ready | Confirm `encryptionService.isReady()` & existing plaintext |
| Offline queue stuck | Network offline or permission issue | Inspect `syncQueue_<userId>` and console logs |
| PWA not updating | SW cached | Hard refresh / adjust `vite-plugin-pwa` manifest changes |
| Photo decrypt fails (OperationError) | Different salt or pepper per device | Ensure `userSettings/<uid>.encSaltB64` exists and `VITE_KEY_PEPPER` matches |
| Trip log photos missing until edit | Legacy inline photos lacked preview fallback | Update to latest build or ensure photo fields populated |
| IndexedDB “VersionError” on load | Cached DB schema newer than requested | Latest build auto-recovers; refresh again if needed |
| Storage blocked by CORS | Missing origin in bucket CORS | Add origin to `cors.json`, re-apply with `gsutil cors set` |
| Gear rename doesn’t show in catches immediately | Background maintenance queue still processing | Check the progress banner in Tackle Box; new labels appear after the task completes |

## Photos disappear after editing a catch

- Symptoms: After editing species/notes, the catch photo vanishes.
- Cause: Update payload cleared photo fields implicitly (empty strings) or service cleared by omission.
- Fixes/Checks:
  - Ensure the client only modifies photo fields when user explicitly uploads or deletes a photo.
  - On delete, send `photo: ''` or `removePhoto: true`. On keep, omit photo fields entirely.
  - Verify Firebase rules and network logs; confirm update payload does not include blank `photoPath`/`photoUrl` unless intentional.

## Storage: CORS vs. 403 (staging photos)

- If `curl -I -H "Origin: <staging-origin>" <storage-url>` returns `Access-Control-Allow-Origin` but status `403`, CORS is fine — the 403 is from Storage rules.
- For private paths like `users/<uid>/enc_photos/**`, use tokenized URLs via the SDK:

```ts
import { getDownloadURL, ref } from 'firebase/storage';
const url = await getDownloadURL(ref(storage, 'users/<uid>/enc_photos/<file>.enc'));
```

- Or copy the Download URL from Firebase Console → Storage → file details (includes `?token=...`).
- To fix `OSError: No such file or directory` when applying CORS, run `gsutil cors set` with an absolute path to `cors.json`.
