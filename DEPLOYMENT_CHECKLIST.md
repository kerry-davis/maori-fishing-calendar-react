# Deployment Checklist - Māori Fishing Calendar (React)

Use this checklist to ensure a successful deployment of the React version of the Māori Fishing Calendar.

## 🚀 Pre-Deployment

### Code Quality
- [ ] All TypeScript errors resolved
- [ ] ESLint passes without errors
- [ ] All tests pass (`npm run test:run`)
- [ ] Code review completed

### Build Verification
- [ ] Production build succeeds (`npm run build` or `npm run build:skip-types`)
- [ ] Build output is optimized (check bundle sizes)
- [ ] No console errors in build output

### PWA Validation
- [ ] PWA test passes (`npm run test:pwa`)
- [ ] Manifest file is valid JSON
- [ ] Service worker generates correctly
- [ ] All required icons are present
- [ ] Offline functionality works

### Data Compatibility
- [ ] Data compatibility verified (`npm run verify:compatibility`)
- [ ] Database structure matches original app
- [ ] localStorage keys are compatible
- [ ] Export/import functionality tested

## 🧪 Testing

### Local Testing
- [ ] Preview server works (`npm run preview`)
- [ ] App loads without errors
- [ ] All major features functional
- [ ] PWA install prompt appears
- [ ] Offline mode works

### Cross-Browser Testing
- [ ] Chrome (desktop & mobile)
- [ ] Firefox (desktop & mobile)
- [ ] Safari (desktop & mobile)
- [ ] Edge (desktop)

### PWA Testing
- [ ] App installs on desktop
- [ ] App installs on mobile
- [ ] Service worker registers
- [ ] Offline functionality works
- [ ] Update notifications work
- [ ] Icons display correctly

### Data Migration Testing
- [ ] Original app data loads correctly
- [ ] New data is compatible with original
- [ ] Export/import works between versions
- [ ] No data loss during migration

## 🌐 Deployment

### Server Configuration
- [ ] HTTPS enabled (required for PWA)
- [ ] Proper MIME types configured
- [ ] Compression enabled (gzip/brotli)
- [ ] Cache headers set for static assets
- [ ] SPA routing configured (fallback to index.html)

### File Upload
- [ ] All files from `dist/` directory uploaded
- [ ] File permissions set correctly
- [ ] Directory structure preserved
- [ ] Icons accessible at correct paths

### DNS & SSL
- [ ] Domain points to correct server
- [ ] SSL certificate valid and trusted
- [ ] HTTPS redirects configured
- [ ] Security headers configured

## ✅ Post-Deployment

### Functionality Verification
- [ ] App loads at production URL
- [ ] No console errors
- [ ] All features work as expected
- [ ] PWA install prompt appears
- [ ] Service worker registers

### Performance Testing
- [ ] Lighthouse PWA score > 90
- [ ] Page load time < 3 seconds
- [ ] First Contentful Paint < 2 seconds
- [ ] Largest Contentful Paint < 2.5 seconds

### PWA Verification
- [ ] Manifest loads without errors
- [ ] Service worker active
- [ ] App installable on mobile
- [ ] App installable on desktop
- [ ] Offline functionality works
- [ ] Update mechanism works

### Data Migration Verification
- [ ] Existing user data preserved
- [ ] New users can create data
- [ ] Export functionality works
- [ ] Import functionality works

## 🔧 Troubleshooting

### Common Issues

#### Build Fails
```bash
# Clear cache and rebuild
rm -rf node_modules package-lock.json dist
npm install
npm run build:skip-types
```

#### PWA Not Installing
- Check HTTPS requirement
- Verify manifest accessibility
- Check service worker registration
- Ensure all icons are present

#### Service Worker Issues
- Clear browser cache
- Check DevTools > Application > Service Workers
- Verify sw.js is accessible
- Check for JavaScript errors

#### Data Migration Issues
- Verify database names match
- Check IndexedDB permissions
- Test with fresh browser profile
- Compare data schemas

### Debug Commands

```bash
# Check build output
ls -la dist/

# Validate manifest
python3 -c "import json; print(json.load(open('dist/manifest.webmanifest')))"

# Test local server
python3 -m http.server 8080 --directory dist

# Check service worker
curl -I https://yourdomain.com/sw.js
```

## 📊 Monitoring

### Post-Deployment Monitoring
- [ ] Error tracking configured
- [ ] Performance monitoring active
- [ ] PWA install rates tracked
- [ ] User feedback collected

### Analytics Setup
- [ ] Google Analytics configured
- [ ] Core Web Vitals monitored
- [ ] PWA metrics tracked
- [ ] Error reporting active

## 🔄 Rollback Plan

### If Issues Occur
1. **Immediate**: Revert to previous version
2. **Backup**: Restore previous dist/ files
3. **Database**: Ensure data compatibility maintained
4. **Communication**: Notify users of temporary issues

### Rollback Commands
```bash
# Backup current deployment
cp -r dist dist-backup-$(date +%Y%m%d-%H%M%S)

# Restore previous version
cp -r dist-previous/* dist/

# Clear service worker cache (if needed)
# Users may need to clear browser cache
```

## 📞 Support

### Emergency Contacts
- [ ] Development team contact info ready
- [ ] Server admin contact info ready
- [ ] DNS provider contact info ready

### Documentation
- [ ] Deployment documentation accessible
- [ ] Troubleshooting guide available
- [ ] User migration guide prepared

---

## ✅ Final Sign-off

- [ ] **Technical Lead**: All technical requirements met
- [ ] **QA**: All testing completed successfully  
- [ ] **Product Owner**: Features and functionality approved
- [ ] **DevOps**: Infrastructure and deployment ready

**Deployment Date**: _______________  
**Deployed By**: _______________  
**Version**: _______________  

---

*This checklist ensures a smooth deployment while maintaining data integrity and user experience.*