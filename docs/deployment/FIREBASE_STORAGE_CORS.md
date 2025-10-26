# Firebase Storage CORS (for encrypted photos)

If you use Firebase Storage for photo binaries, configure CORS to allow your app origins. Example `cors.json` in this repo:

```
[
  {
    "origin": [
      "http://localhost:5173",
      "https://maori-fishing-calendar-react.web.app",
      "https://maori-fishing-calendar-react.firebaseapp.com",
      "https://maori-fishing-calendar-react.pages.dev",
      "https://staging-maori-fishing-calendar.pages.dev"
    ],
    "method": ["GET", "HEAD", "OPTIONS", "POST", "PUT", "DELETE"],
    "responseHeader": ["*"],
    "maxAgeSeconds": 3600
  }
]
```

Apply and verify (replace bucket if yours differs):

```
gsutil cors set cors.json gs://maori-fishing-calendar-react.firebasestorage.app
gsutil cors get gs://maori-fishing-calendar-react.firebasestorage.app
```

Notes:

- Origins must not include trailing slashes; match scheme/host/port exactly
- Add preview origins explicitly if needed (no wildcard subdomains)
- Browsers cache preflight per `maxAgeSeconds`

## Staging photos: CORS vs. auth (what we fixed)

1) Add the staging origin to `cors.json` and re-apply to the bucket (above). If you see `OSError: No such file or directory` when setting CORS, pass an absolute path to `cors.json`, e.g.:

```
gsutil cors set "/home/pulsta/vscode/repo/maori-fishing-calendar-react/cors.json" gs://maori-fishing-calendar-react.firebasestorage.app
```

2) Verify the CORS header for your staging origin:

```
curl -I -H "Origin: https://staging-maori-fishing-calendar.pages.dev" \
  "https://firebasestorage.googleapis.com/v0/b/maori-fishing-calendar-react.firebasestorage.app/o/<path>?alt=media"
```

3) If you still get `403`, that’s not CORS — it’s due to Storage security rules. Paths like `users/<uid>/enc_photos/**` are private by default in `storage.rules`. Use a tokenized download URL via the SDK:

```ts
import { getDownloadURL, ref } from "firebase/storage";
const url = await getDownloadURL(ref(storage, "users/<uid>/enc_photos/<file>.enc"));
// url includes ?token=... and will work cross-origin
```

Or copy the "Download URL" from Firebase Console → Storage → file details (it includes `?token=...`).

Tip: When using fetch/XHR for these URLs, do not send credentials; tokenized URLs are public and are not used with `withCredentials`.
