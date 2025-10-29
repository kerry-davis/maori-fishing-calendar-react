# Security and Secret Management

This repository previously contained exposed Firebase credentials (API key and Google OAuth Client ID) in commit history. The current code loads configuration from environment variables and avoids logging sensitive data in production.

## Security Status Update (2025-10-27)

**✅ Git History Has Been Cleaned**

Firebase API keys were previously exposed but **have been sanitized from git history** (commit `f148644` "Scrub test literals to satisfy secret scanning"). Current status:

- ✅ Firebase API key in history: **REDACTED** (shown as asterisks)
- ✅ Current code uses environment variables (secure)
- ✅ Secret scanning active in CI/CD
- ℹ️ Google OAuth Client ID visible (acceptable - needs authorized origins configured)

## Recommended Security Hardening (Optional)

Since git history has been cleaned, these are **optional best practices** rather than urgent requirements:

### 1. Apply Firebase API Restrictions (Recommended)
Even though keys are no longer exposed, adding restrictions is good security hygiene:
   - Go to Google Cloud Console > APIs & Services > Credentials
   - Find "Browser key (auto created by Firebase)"
   - Add HTTP referrer restrictions to your production domains
   - Limit to required APIs only (Identity Toolkit, Firestore, Storage)

### 2. Review OAuth Client Configuration
   - Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client IDs  
   - Verify Authorized JavaScript origins only include your domains
   - Verify Authorized redirect URIs are correct
   - Remove any suspicious entries

### 3. Enable Firebase App Check (Highly Recommended)
   - Firebase Console > App Check
   - Prevents abuse even with valid API key
   - Uses reCAPTCHA to verify requests from legitimate clients

### 4. Secret Scanning (Already Active)
   - ✅ GitHub Actions workflow at .github/workflows/secret-scan.yml using Gitleaks
   - Run locally: `npm run scan:secrets` (if script exists)

## Local Development

- Copy .env.example to .env and fill in values
- .env is in .gitignore; do not commit your local .env

## Additional Hardening

- Keep Content Security Policy strict in production
- Avoid logging configuration in production (now enforced in src/services/firebase.ts)
- Monitor Firebase usage and set alerts for abnormal traffic

## Client-Side Field Encryption (Deterministic, Low-Friction)

The application implements lightweight client-side field-level encryption for selected sensitive fields before they are written to Firestore. This provides confidentiality against casual inspection of stored data (e.g. if someone with console access views documents) but is NOT a substitute for strong, user-controlled end‑to‑end encryption.

### Summary
* Algorithm: AES-GCM (256-bit) via Web Crypto API
* Ciphertext Format: `enc:v1:<base64(iv)>:<base64(cipher)>`
* Scope: Only configured string / scalar fields (see Field Map below) + selected array elements
* Key Derivation: Deterministic from `(userEmail | buildPepper) + per-user random salt`
* Pepper Env Var: `VITE_KEY_PEPPER` (build-time; keep private, rotate if leaked)
* Storage: Salt persisted in `localStorage` (`enc_salt_<userId>`). Derived key kept only in memory; never persisted
* Migration: Background batch process encrypts legacy plaintext documents, resumable & idempotent

### Field Map
Collections & fields currently encrypted (see `encryptionService.ts`):
```
trips: water, location, companions, notes
weatherLogs: sky, windCondition, windDirection
fishCaught: species, length, weight, time, details, gear[]
tackleItems: name, brand, colour
userSavedLocations: name, water, location, notes
```
Non-encrypted fields are either identifiers, references, timestamps, or needed for querying / indexing.

### Threat Model & Limitations
| Aspect | Provided | Not Provided |
| ------ | -------- | ------------ |
| At-rest confidentiality in Firestore | Partial (obfuscation) | Against a determined attacker with email + pepper access |
| Protection vs compromised browser / XSS | No | (Any script can access key once derived) |
| Protection vs malicious user (same account) | No | They already see plaintext in UI |
| Forward secrecy / revocation | No | Deterministic key remains stable unless pepper rotated |
| Strong entropy | Moderate | User email has low entropy; pepper improves but not equivalent to passphrase |

Because the key derivation is deterministic and based on low-entropy material (email), this should be considered data obfuscation rather than robust cryptographic protection. Its primary goal is to prevent immediate plaintext readability in the Firestore console by project collaborators without instrumenting the client.

### Migration Behavior
* Legacy plaintext documents are detected via `objectNeedsEncryption()`.
* Background migration processes documents in small batches, encrypting target fields and marking them with `_encrypted: true`.
* Mixed state is tolerated: reads decrypt any ciphertext; plaintext fields remain readable until next write or migration pass.
* Migration state & progress stored in `localStorage` keys (status, last cursor, abort flag) for resiliency.

### Pepper Management (`VITE_KEY_PEPPER`)
* Define in build environment (.env, CI secrets) – DO NOT commit
* Rotating the pepper changes derived keys; previously encrypted data becomes undecryptable (since the system does not retain old keys)
* If rotation is required, a planned re-encryption / data export-reimport workflow must be executed while old pepper is still available in a maintenance build

### When to Consider Stronger Encryption
Upgrade to a passphrase-based or server-managed (KMS) model if:
* Regulatory / compliance requirements demand confidentiality against project operators
* You need cryptographic deletion / revocable access
* You must defend against database exfiltration by an internal actor

### Operational Notes
* Reads attempt decryption opportunistically; plaintext passes through unchanged
* Failed decrypts (e.g. pepper mismatch after rotation) are logged and ciphertext returned (fails open for availability)
* All encryption is skipped if Web Crypto is unavailable (values stored plaintext); a console warning is emitted

### Testing
Deterministic encryption and migration helpers covered in `encryptionDeterministic.test.ts`. Legacy passphrase tests were removed as part of adopting this simplified model.

### Caveats / Future Hardening Options
1. Replace deterministic key with user-supplied secret (PBKDF2 w/ high iterations + UX recovery flow)
2. Add per-field deterministic salts + HMAC for authenticity (current design relies on GCM tag only)
3. Introduce searchable encrypted indexes (e.g. blind index) if querying on protected fields becomes necessary
4. Support pepper rotation via staged dual-key decrypt + re-encrypt window

If you need stronger guarantees, treat current scheme as an interim layer and plan a migration path early.

## Reporting

If you believe you have found a security issue, please open a private security advisory or contact the maintainers directly rather than opening a public issue.

## Encrypted Photos in Firebase Storage

User photos are compressed client-side (max 1080px, ~0.85 JPEG) and encrypted before upload to Firebase Storage under `users/<uid>/enc_photos/**`. For encrypted photos we intentionally do not persist a long‑lived `photoUrl` in Firestore (field is present but left empty); clients fetch a download URL on demand using the path and `encryptedMetadata` for decryption. Unencrypted legacy photos continue to store `photoUrl` when available. Access is governed by `storage.rules`. For cross-origin access in previews/staging, configure bucket CORS; see docs/deployment/FIREBASE_STORAGE_CORS.md.
