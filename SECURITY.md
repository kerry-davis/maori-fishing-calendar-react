# Security and Secret Management

This repository previously contained exposed Firebase credentials (API key and Google OAuth Client ID) in commit history. The current code loads configuration from environment variables and avoids logging sensitive data in production.

## Immediate Actions to Take

1. Rotate Firebase Web API Key
   - Go to Firebase Console > Project Settings > General > Your apps > Web API Key
   - Create a new API key and update it in deployment environments (.env on local, provider secrets for CI/CD)
   - Restrict usage: In Google Cloud Console, lock the API key to correct referrers (your domain) and APIs
   - Invalidate the old key after rollout

2. Review OAuth Client
   - Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client IDs
   - If the Web client ID was exposed, consider creating a new one and removing the old
   - Verify Authorized JavaScript origins and redirect URIs are correct

3. Purge or Mitigate History
   - Because the key appeared in git history, consider:
     - Rewriting git history to remove the secret (e.g., git filter-repo), and
     - For forks/clones you cannot control, rely on rotation and referer/API restrictions

4. Enable Secret Scanning
   - GitHub Actions workflow added at .github/workflows/secret-scan.yml using Gitleaks
   - Run locally: npm run scan:secrets

## Local Development

- Copy .env.example to .env and fill in values
- .env is in .gitignore; do not commit your local .env

## Additional Hardening

- Keep Content Security Policy strict in production
- Avoid logging configuration in production (now enforced in src/services/firebase.ts)
- Monitor Firebase usage and set alerts for abnormal traffic

## Reporting

If you believe you have found a security issue, please open a private security advisory or contact the maintainers directly rather than opening a public issue.
