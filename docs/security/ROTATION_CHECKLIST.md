# Firebase API Key Rotation Checklist

Use this checklist to rotate Firebase credentials after exposure.

## Pre-Rotation Preparation

- [ ] Read [SECURITY_INVESTIGATION_REPORT.md](./SECURITY_INVESTIGATION_REPORT.md)
- [ ] Ensure you have access to:
  - [ ] Firebase Console
  - [ ] Google Cloud Console
  - [ ] Deployment platform (Cloudflare Pages)
  - [ ] CI/CD secrets (GitHub Actions)
- [ ] Notify team of upcoming rotation
- [ ] Schedule maintenance window if needed

## Firebase Web API Key Rotation

### Step 1: Create New API Key
- [ ] Login to [Firebase Console](https://console.firebase.google.com/)
- [ ] Navigate to: Project Settings → General
- [ ] Under "Your apps", find the Web App
- [ ] Click "Regenerate Config"
- [ ] Copy new `apiKey` value
- [ ] Save to secure password manager

### Step 2: Apply API Restrictions
- [ ] Go to [Google Cloud Console](https://console.cloud.google.com/)
- [ ] Navigate to: APIs & Services → Credentials
- [ ] Find "Browser key (auto created by Firebase)"
- [ ] Click Edit
- [ ] **Application restrictions**:
  - [ ] Select "HTTP referrers (web sites)"
  - [ ] Add authorized domains:
    ```
    http://localhost:*
    https://your-production-domain.com/*
    https://*.pages.dev/*  # Cloudflare Pages
    ```
- [ ] **API restrictions**:
  - [ ] Select "Restrict key"
  - [ ] Enable only required APIs:
    - [ ] Identity Toolkit API
    - [ ] Cloud Firestore API
    - [ ] Firebase Storage API
    - [ ] (Add others as needed)
- [ ] Click "Save"

### Step 3: Update Environment Variables

#### Local Development
```bash
# Update your .env file
VITE_FIREBASE_API_KEY=<new_api_key>
```
- [ ] Update `.env` file with new key
- [ ] Test locally: `npm run dev`
- [ ] Verify login/logout works

#### Cloudflare Pages
- [ ] Go to Cloudflare Dashboard
- [ ] Navigate to: Workers & Pages → Your Project → Settings → Environment variables
- [ ] Update `VITE_FIREBASE_API_KEY` for:
  - [ ] Production
  - [ ] Preview
- [ ] Click "Save"

#### GitHub Actions (if used)
- [ ] Go to GitHub Repository Settings
- [ ] Navigate to: Secrets and variables → Actions
- [ ] Update `VITE_FIREBASE_API_KEY`

### Step 4: Delete Old API Key
⚠️ **WAIT**: Ensure new key works in all environments first!

- [ ] Test production deployment with new key
- [ ] Verify no errors in Firebase Console logs
- [ ] Wait 24-48 hours to ensure all caches cleared
- [ ] Go back to Google Cloud Console → Credentials
- [ ] Find old "Browser key" (check creation date)
- [ ] Click Delete
- [ ] Confirm deletion

## Google OAuth Client ID Rotation

### Step 1: Review Current Configuration
- [ ] Go to Google Cloud Console → Credentials
- [ ] Find OAuth 2.0 Client ID
- [ ] Check **Authorized JavaScript origins**:
  - [ ] Should include your production domain
  - [ ] Should NOT include wildcard domains
- [ ] Check **Authorized redirect URIs**:
  - [ ] Should only include legitimate redirect paths
  - [ ] Remove any suspicious entries

### Step 2: Create New OAuth Client (if needed)
- [ ] Click "Create Credentials" → "OAuth client ID"
- [ ] Application type: "Web application"
- [ ] Name: "Māori Fishing Calendar - Web (New)"
- [ ] **Authorized JavaScript origins**:
  ```
  http://localhost:5173
  http://localhost:8788
  https://your-production-domain.com
  ```
- [ ] **Authorized redirect URIs**:
  ```
  http://localhost:5173/__/auth/handler
  https://your-production-domain.com/__/auth/handler
  ```
- [ ] Click "Create"
- [ ] Copy Client ID

### Step 3: Update OAuth Client ID
- [ ] Update `.env`: `VITE_GOOGLE_CLIENT_ID=<new_client_id>`
- [ ] Update Cloudflare Pages environment variables
- [ ] Test Google Sign-In locally
- [ ] Deploy to production
- [ ] Test Google Sign-In in production

### Step 4: Remove Old OAuth Client (after verification)
- [ ] Wait 7 days to ensure no active sessions use old client
- [ ] Delete old OAuth 2.0 Client ID

## Firebase App Check (Highly Recommended)

- [ ] Go to Firebase Console → App Check
- [ ] Click "Get started"
- [ ] Select "reCAPTCHA v3" provider
- [ ] Register your domain
- [ ] Copy site key
- [ ] Add to your app code (see Firebase docs)
- [ ] Enable enforcement for:
  - [ ] Firestore
  - [ ] Storage
  - [ ] Auth (optional, may break some flows)

## Post-Rotation Verification

### Functional Testing
- [ ] User registration works
- [ ] User login (email/password) works
- [ ] Google Sign-In works
- [ ] Data reads from Firestore work
- [ ] Data writes to Firestore work
- [ ] Photo uploads to Storage work
- [ ] Offline sync works

### Security Testing
- [ ] Try accessing Firebase from unauthorized domain (should fail)
- [ ] Check Firebase console for "Unauthorized domain" errors
- [ ] Monitor authentication logs for suspicious activity
- [ ] Verify old API key no longer works (returns 403)

### Monitoring Setup
- [ ] Firebase Console → Usage and Billing
  - [ ] Set quota alerts at 50%, 75%, 90%
- [ ] Firebase Console → Authentication
  - [ ] Enable audit logging if available
- [ ] Set up email alerts for unusual activity

## Git History Cleanup (Optional)

⚠️ **WARNING**: This rewrites git history. All team members must re-clone.

```bash
# Option 1: git-filter-repo (recommended)
pip install git-filter-repo
git-filter-repo --replace-text scripts/secret-replacements.txt
git push --force --all
git push --force --tags

# Option 2: BFG Repo-Cleaner
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar
java -jar bfg-1.14.0.jar --replace-text scripts/secret-replacements.txt
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force --all
git push --force --tags
```

### After History Rewrite
- [ ] Notify all team members to re-clone repository
- [ ] Update any CI/CD that clones the repo
- [ ] Check for orphaned forks on GitHub
- [ ] Document that old commits are invalid

## Documentation Updates

- [ ] Update `SECURITY.md` with rotation date
- [ ] Update `SECURITY_INVESTIGATION_REPORT.md` status
- [ ] Add entry to `CHANGELOG.md`
- [ ] Update `.env.example` if format changed
- [ ] Close any related security advisories

## Final Steps

- [ ] Mark this checklist as complete
- [ ] Archive old credentials securely
- [ ] Schedule next review (90 days)
- [ ] Share lessons learned with team

---

**Rotation Started**: ___________  
**Rotation Completed**: ___________  
**Performed By**: ___________  
**Verified By**: ___________

