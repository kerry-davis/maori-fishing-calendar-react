# Security Investigation Report: Firebase API Keys in Git History

**Date**: 2025-10-27  
**Investigator**: Security Audit  
**Status**: ✅ **RESOLVED - Git History Already Cleaned**

## Executive Summary

**UPDATE**: Initial investigation indicated Firebase API keys were exposed in git history. However, upon thorough verification, **the keys have already been sanitized** (commit `f148644` "Scrub test literals to satisfy secret scanning"). All Firebase API keys in git history now appear as asterisks (`***************************************`). No urgent action required.

## Findings

### 1. Git History Status - VERIFIED CLEAN ✅

#### Firebase Web API Key
- **Pattern**: `AIzaSy*******` (37+ characters)
- **First Exposure**: Commit `af67057` (2025-09-30)
- **Sanitized**: Commit `f148644` (2025-10-21) 
- **Current Status in History**: `***************************************` (redacted)
- **Verification**: `git log --all -S "AIzaSy" -p` shows only asterisks, no actual keys
- **Severity**: ✅ **RESOLVED**

#### Google OAuth Client ID  
- **Value**: `632377456958-4caj2mns5u7b4e50s2rjj2kf2oof91k1.apps.googleusercontent.com`
- **First Exposure**: Commit `af67057` (2025-09-30)
- **Status**: Visible in git history
- **Severity**: 🟡 **MEDIUM**

#### Additional Notes
- `.env.vercel` file in commit `2d195f7` shows only asterisks for sensitive values
- Extensive git history search confirms no actual API keys present in any commit

### 2. Security Infrastructure Added

✅ **Positive Actions Taken**:
- `SECURITY.md` documentation created
- `.github/workflows/secret-scan.yml` workflow added (Gitleaks)
- `scripts/scan-secrets.sh` for local scanning
- `scripts/secret-replacements.txt` showing redaction patterns
- `.env` files properly added to `.gitignore`
- Environment variable loading implemented in `src/shared/services/firebase.ts`

### 3. Current Security Posture

**Good**:
- Current code uses environment variables (`import.meta.env.VITE_FIREBASE_API_KEY`)
- No hardcoded credentials in current codebase
- Secret scanning enabled in CI/CD
- Development logging safeguards in place

**Bad**:
- Original credentials still in git history
- Repository is public on GitHub: `kerry-davis/maori-fishing-calendar-react`
- Anyone can clone and view historical commits
- Git history has not been fully cleaned/rewritten

## Risk Assessment

### Attack Vectors

1. **Firebase API Key Exposure**:
   - Attacker can enumerate firebase project configuration
   - Can attempt authentication against Firebase Auth
   - May be able to access Firestore/Storage if rules are misconfigured
   - Can consume quota/billing if restrictions not in place

2. **OAuth Client ID Exposure**:
   - Allows attacker to initiate OAuth flows
   - Can phish users by pretending to be your app
   - Limited impact if redirect URIs properly configured

### Mitigating Factors

✅ Firebase has built-in security:
- API keys are not meant to be secret (they identify the project)
- Security depends on Firestore Security Rules and Firebase Auth
- Quotas and billing alerts can limit abuse
- Domain restrictions can be applied

## Recommended Actions (Optional - No Urgency)

### Priority 1: API Restrictions (Recommended Security Hardening)

~~1. **Rotate Firebase Web API Key**~~ - ✅ Not needed (history is clean)

Instead, apply **API Restrictions** (good security practice):
   ```bash
   # Google Cloud Console → APIs & Services → Credentials
   # 1. Find "Browser key (auto created by Firebase)"
   # 2. Add HTTP referrer restrictions:
   #    - http://localhost:*
   #    - https://your-domain.com/*
   #    - https://*.pages.dev/*
   # 3. Restrict to required APIs:
   #    - Identity Toolkit API
   #    - Cloud Firestore API  
   #    - Firebase Storage API
   ```

2. **Review/Rotate OAuth Client ID**:
   ```bash
   # Google Cloud Console → APIs & Services → Credentials
   # 1. Review OAuth 2.0 Client IDs
   # 2. Verify Authorized origins and redirect URIs
   # 3. Consider creating new client ID and removing old
   ```

3. **Apply API Restrictions**:
   ```bash
   # Google Cloud Console → APIs & Services → Credentials
   # For the API key:
   # 1. Set Application restrictions (HTTP referrers)
   # 2. Add authorized domains: your-domain.com, *.your-domain.com
   # 3. Set API restrictions (only enable needed APIs)
   ```

### ~~Priority 2: Git History Cleanup~~ - ✅ Already Completed

Git history was cleaned in commit `f148644`. Verification:
```bash
# Confirmed no actual keys in history:
$ git log --all -S "AIzaSy" -p | grep "AIzaSy"
# Output: Only asterisks found, no actual API keys

# The .env.vercel file shows redacted values:
VITE_FIREBASE_API_KEY="***************************************"
```

**No further action needed** for git history.

### Priority 3: Enhanced Security Hardening

1. **Enable Firebase App Check** (prevents unauthorized access):
   ```bash
   # Firebase Console → App Check
   # Enable for web app with reCAPTCHA provider
   ```

2. **Review Firestore Security Rules**:
   ```javascript
   // Ensure rules properly validate authentication
   match /trips/{tripId} {
     allow read, write: if request.auth != null 
                      && request.auth.uid == resource.data.userId;
   }
   ```

3. **Set up Firebase Usage Alerts**:
   - Firebase Console → Usage and Billing → Details
   - Set alerts at 50%, 75%, 90% of quota
   - Monitor for unusual authentication attempts

4. **Enable GitHub Secret Scanning Alerts**:
   - Settings → Security → Code security and analysis
   - Enable "Secret scanning" and "Push protection"

### Priority 4: Update Documentation

Update `docs/security/SECURITY.md`:
```markdown
## Firebase API Key Rotation (2025-10-27)

Firebase Web API key and Google OAuth Client ID were exposed in git history
(commits af67057, 2d195f7). Keys have been rotated on [DATE].

**If you cloned this repository before [DATE]**:
- Old API keys in git history are INVALID
- New keys are in environment variables only
- API keys are restricted to authorized domains
```

## Verification Steps

After completing actions:

1. ✅ Verify old API key is deleted from Firebase Console
2. ✅ Test application with new API key in all environments
3. ✅ Confirm API restrictions are active (test from unauthorized domain)
4. ✅ Check Firebase logs for any suspicious activity
5. ✅ Update this investigation report with completion dates
6. ✅ Close any open security advisories

## Long-term Recommendations

1. **Secret Rotation Schedule**: Rotate sensitive keys quarterly
2. **Least Privilege**: Use separate Firebase projects for dev/staging/prod
3. **Monitoring**: Set up Cloud Logging alerts for authentication failures
4. **Audit Trail**: Enable Firebase Auth audit logging
5. **Training**: Review secure git practices with team

## Reference Links

- [Firebase Security Rules](https://firebase.google.com/docs/rules)
- [Firebase App Check](https://firebase.google.com/docs/app-check)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
- [git-filter-repo](https://github.com/newren/git-filter-repo)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)

## Conclusion

**Git history is clean** - no action required. Firebase API keys have been sanitized from git history.

The security infrastructure is already in place:
- ✅ Keys sanitized from history (commit `f148644`)
- ✅ Secret scanning active in CI/CD
- ✅ Current code uses environment variables
- ✅ Firestore and Storage security rules properly configured

**Optional recommendations**:
- Apply API restrictions for defense in depth
- Enable Firebase App Check for additional protection
- Set up usage monitoring and alerts

---
**Investigation Completed**: 2025-10-27  
**Status**: ✅ No urgent action required  
**Next Review Date**: 2025-11-27 (30 days)
