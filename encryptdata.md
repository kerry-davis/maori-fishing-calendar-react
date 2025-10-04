

## Data Encryption Plan (Cloud Storage + Retrieval)

### 1. Objectives
- Confidentiality: Prevent cloud provider / unauthorized parties reading user data.
- Integrity: Detect tampering of stored payloads.
- Least access: Backend/services never see plaintext when possible.
- Key hygiene: Enable rotation, revocation, and compartmentalization.

### 2. Data Classification
| Class | Examples | Encryption Level |
|-------|----------|------------------|
| P0 (Sensitive) | User auth tokens, personal fishing logs with location | Client-side E2EE + server at-rest |
| P1 (Internal) | Aggregated analytics, non-personal stats | Server-side at-rest |
| P2 (Public) | Non-user-specific calendar metadata | Optional (transport only) |

### 3. Threat Model (Primary)
- Passive network observer (MitM) → solve via TLS.
- Compromised cloud DB snapshot → solve via strong at-rest encryption + app-layer encryption for P0.
- Malicious insider with DB read access → solve via client-side encryption (keys not stored with data).
- Stolen user device local storage → solve via per-user master key derived from credential + optional platform storage (WebCrypto + OS keystore when available).

### 4. Encryption Layers
1. Transport: Enforce HTTPS (HSTS + TLS 1.3; disable weak ciphers).
2. Server At-Rest: Provider-managed encryption (e.g., AWS KMS / GCP CMEK / Azure Key Vault), plus application-managed envelope keys for P0.
3. Client-Side (Application Layer): WebCrypto AES-GCM for content before upload; store ciphertext only.
4. Integrity: AES-GCM provides AEAD; additionally sign critical blobs (Ed25519) if long-term tamper evidence required.

### 5. Key Hierarchy (Envelope Model)
- Root KMS Customer Master Key (CMK): Stored in cloud KMS; policy restricted.
- Data Encryption Key (DEK) per user (P0 scope):
  - Generated client-side (crypto.getRandomValues) on first secure login.
  - Wrapped (encrypted) by a KEK (Key Encryption Key).
- KEK Derivation:
  - Use PBKDF2 or Argon2id on user secret (NOT the raw password—use post-auth high-entropy secret from backend, e.g., a short-lived key seed).
  - Argon2id params (example): memory=64MB, parallelism=2, iterations tuned for ~150ms.
- Optionally re-wrap DEKs with a KMS-provided KEK to allow server-side rotation without re-encrypting data payloads.

### 6. Storage of Keys
| Item | Location | Notes |
|------|----------|-------|
| Root CMK | Cloud KMS | Never leaves KMS. |
| Wrapped DEK | DB/User profile doc | ciphertext + metadata (alg, version). |
| KEK (derived) | Ephemeral in memory | Re-derive per session; never persist. |
| Session Token | Secure HTTP-only cookie | Standard auth; separate from crypto keys. |

### 7. Algorithms / Formats
- Symmetric: AES-256-GCM (12-byte IV, random; 16-byte auth tag). Zero IV reuse.
- Asymmetric (optional signing): Ed25519 or ECDSA P-256.
- KDF: Argon2id (preferred) or PBKDF2-HMAC-SHA256 (fallback).
- Hashing (non-crypto passwords already handled by auth provider): SHA-256 for content hashing (dedupe) if needed.
- Serialization: 
  {
    v:1,
    alg:"AES-256-GCM",
    iv: base64url(12B),
    ct: base64url(ciphertext),
    tag: base64url(16B),
    ad: base64url(optional associated data),
    kekVer: 2,
    dekId: "u_abc123"
  }

### 8. Rotation Strategy
- Version fields (kekVer, v) in every blob.
- On KEK rotation: re-wrap DEK only.
- On DEK compromise or scheduled (e.g., yearly): generate new DEK, re-encrypt user blobs lazily (on access) and mark old as pending retirement.
- Maintain a key metadata table: {dekId, status, createdAt, retiredAt}.

### 9. Client Workflow (P0 Data)
1. User authenticates (backend returns ephemeral key seed).
2. Derive KEK (Argon2id(seed + userId + staticSalt)).
3. Fetch wrapped DEK; unwrap (AES-GCM or XChaCha20-Poly1305 if chosen).
4. To store:
   - Generate random IV.
   - Encrypt plaintext (AES-GCM) with DEK.
   - Upload ciphertext object.
5. To read:
   - Download ciphertext object.
   - Decrypt with DEK.
6. On logout: Zero memory—overwrite key buffers.

### 10. Backend Responsibilities
- Enforce TLS + HSTS.
- Store only wrapped DEKs + ciphertext.
- Provide seed for KEK derivation (rotate seed periodically; map old seeds by version).
- Mediate authorization (ensuring only owner retrieves blobs).
- Coordinate key rotation tasks (background job to flag outdated wraps).

### 11. Integrity & Replay Mitigation
- Use AES-GCM AAD field for: userId || dekId || version || timestampBucket.
- Track latest nonce timestamp per record (optional) to detect stale replays (server can store a monotonic counter if strict requirements).

### 12. Performance Considerations
- Batch encrypt multiple small entries into a single logical payload if user writes frequently → reduces IV management overhead.
- Use Web Workers for Argon2 to avoid blocking UI.
- Cache unwrapped DEK in memory only (no localStorage).

### 13. Secrets & Environment
- Use .env (never commit) for:
  - KMS key alias
  - StaticSalt (non-secret but stable)
  - Rotation intervals
- CI: Inject via secret manager (GitHub Actions OIDC → cloud secret manager).

### 14. Logging / Monitoring
- Never log raw keys or plaintext.
- Log key operations: wrap, unwrap, rotate (metadata only).
- Alert on unusual unwrap frequency or failed integrity checks.

### 15. Compliance / Privacy
- Provide user export: decrypt locally and bundle.
- Provide user delete: wipe ciphertext + mark DEK retired; optionally schedule secure deletion window.
- Document cryptographic design (this plan forms base).

### 16. Minimal Implementation Steps
1. Add cryptoutils.ts (WebCrypto wrappers: generateDEK, encrypt, decrypt, deriveKEK, wrapDEK, unwrapDEK).
2. Extend user profile schema: wrappedDek, dekAlg, dekCreatedAt, kekVersion.
3. Modify saveLog() / fetchLog() to call encrypt/decrypt.
4. Add rotation script (server): re-wrap DEKs with new KEK version.
5. Add automated test vectors (known key/plaintext → ciphertext stable except IV).
6. Add lint rule ensuring no usage of deprecated crypto (e.g., SHA1).

### 17. Example Pseudocode (Client)
```
async function initKeys(seed, userId, wrappedDekObj) {
  const kek = await deriveKEK(seed, userId);            // Argon2id
  const dekRaw = await unwrapDEK(kek, wrappedDekObj);   // AES-GCM unwrap
  return dekRaw;
}

async function storeSecure(dek, data, meta) {
  const {ciphertext, iv, tag} = await encryptAESGCM(dek, JSON.stringify(data), meta);
  return upload({v:1, alg:"AES-256-GCM", iv, ct:ciphertext, tag, meta});
}

async function readSecure(dek, blob) {
  return JSON.parse(await decryptAESGCM(dek, blob));
}
```

### 18. Testing
- Unit: encryption round-trip, tamper detection (modify a byte → expect failure).
- Property: randomized plaintext lengths.
- Load: measure Argon2id derivation latency (target < 200ms).
- Security review: confirm no IV reuse (collect set; assert uniqueness).

### 19. Rollout Plan
1. Phase 1: Implement infrastructure (key wrapping, encrypt new data only).
2. Phase 2: Migrate legacy plaintext → background job encrypts + flags migrated.
3. Phase 3: Enforce encryption required (reject unencrypted writes).
4. Phase 4: Enable rotation & monitoring dashboards.

### 20. Future Enhancements
- WebAssembly Argon2 for performance.
- Hardware-backed keys (WebAuthn / Passkey–derived secret).
- Differential privacy layer for aggregate analytics (if required).

Let me know if you want code scaffolding for cryptoutils.ts or backend key wrapping logic.