# Security Documentation

This directory contains security-related documentation for the Māori Fishing Calendar application.

## Documents

### 1. [SECURITY.md](./SECURITY.md)
Main security documentation covering:
- Firebase API key exposure details
- Immediate action items
- Client-side encryption implementation
- Secret management practices
- Reporting procedures

### 2. [SECURITY_INVESTIGATION_REPORT.md](./SECURITY_INVESTIGATION_REPORT.md) 🔴 **ACTION REQUIRED**
Comprehensive investigation report including:
- Detailed findings of credential exposure
- Risk assessment and attack vectors
- Prioritized action items with timelines
- Verification steps
- Long-term security recommendations

**Status**: Credentials found in git history - rotation recommended

### 3. [ROTATION_CHECKLIST.md](./ROTATION_CHECKLIST.md)
Step-by-step checklist for rotating Firebase credentials:
- Pre-rotation preparation
- Firebase API key rotation procedure
- Google OAuth Client ID rotation
- Environment variable updates
- Post-rotation verification
- Git history cleanup (optional)

## Quick Action Guide

If you're responding to a security incident:

1. **Read First**: [SECURITY_INVESTIGATION_REPORT.md](./SECURITY_INVESTIGATION_REPORT.md)
2. **Follow Steps**: [ROTATION_CHECKLIST.md](./ROTATION_CHECKLIST.md)
3. **Update Docs**: Mark completion dates in documents
4. **Monitor**: Set up Firebase usage alerts

## Security Status Dashboard

| Item | Status | Last Updated | Next Review |
|------|--------|--------------|-------------|
| Firebase API Key | 🔴 Exposed in history | 2025-10-27 | Immediate |
| OAuth Client ID | 🟡 Exposed in history | 2025-10-27 | Immediate |
| API Restrictions | ⚪ Unknown | - | Check now |
| Firestore Rules | ✅ Implemented | - | Monthly |
| Storage Rules | ✅ Implemented | - | Monthly |
| Secret Scanning | ✅ Active | 2025-09-30 | Automated |
| App Check | ⚪ Not enabled | - | Recommended |

### Status Legend
- ✅ Secure / Implemented
- 🟡 Needs attention / Review required
- 🔴 Action required / Exposed
- ⚪ Unknown / Not configured

## Getting Help

- **Security Questions**: Review [SECURITY.md](./SECURITY.md)
- **Incident Response**: Follow [SECURITY_INVESTIGATION_REPORT.md](./SECURITY_INVESTIGATION_REPORT.md)
- **Report Issues**: Use GitHub Security Advisories (private)
- **Emergency**: Contact repository maintainer directly

## Related Documentation

- [Firebase Security Rules](https://firebase.google.com/docs/rules)
- [Firebase App Check](https://firebase.google.com/docs/app-check)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

---

**Last Updated**: 2025-10-27  
**Document Owner**: Security Team  
**Review Frequency**: Quarterly or after incidents
