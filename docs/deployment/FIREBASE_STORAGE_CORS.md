# Firebase Storage CORS (for encrypted photos)

If you use Firebase Storage for photo binaries, configure CORS to allow your app origins. Example `cors.json` in this repo:

```
[
  {
    "origin": [
      "http://localhost:5173",
      "https://maori-fishing-calendar-react.web.app",
      "https://maori-fishing-calendar-react.firebaseapp.com",
      "https://maori-fishing-calendar-react.pages.dev"
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
