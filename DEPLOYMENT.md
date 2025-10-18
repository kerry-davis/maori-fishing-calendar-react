# Deployment Guide - Māori Fishing Calendar (React)

This guide covers the deployment process for the React version of the Māori Fishing Calendar PWA.

## 📋 Prerequisites

- Node.js 18+ and npm
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Web server for hosting (Apache, Nginx, or static hosting service)

## 🚀 Quick Start

### 1. Production Build

```bash
# Standard build (with TypeScript checking)
npm run build

# Production build with testing
npm run build:prod

# Skip TypeScript checking (if needed)
npm run build:skip-types
```

### 2. Preview Locally

```bash
# Start preview server
npm run preview

# Or use the deployment script
npm run deploy:preview
```

### 3. Test PWA Features

```bash
# Run PWA validation tests
npm run test:pwa
```

## 🔧 Build Configuration

### Vite Configuration

The build is configured in `vite.config.ts` with:

- **PWA Plugin**: Generates service worker and manifest
- **Asset Optimization**: Minification and compression
- **Code Splitting**: Automatic chunk splitting for optimal loading
- **Runtime Caching**: External CDNs and API responses

### Build Output

The build generates a `dist/` directory containing:

```
dist/
├── index.html              # Main HTML file
├── manifest.webmanifest    # PWA manifest
├── sw.js                   # Service worker
├── assets/                 # JS, CSS, and other assets
│   ├── index-[hash].js
│   ├── index-[hash].css
│   └── ...
└── icons/                  # PWA icons
    ├── icon-192x192.png
    └── icon-512x512.png
```

## 📱 PWA Features

### Service Worker

- **Caching Strategy**: App shell + runtime caching
- **Offline Support**: Core functionality works offline
- **Update Notifications**: Prompts users for updates
- **External Resources**: Caches CDN resources (Font Awesome, TailwindCSS)

### Manifest Configuration

```json
{
  "name": "Māori Fishing Calendar",
  "short_name": "Fishing Calendar",
  "display": "standalone",
  "start_url": "/",
  "theme_color": "#0d47a1",
  "background_color": "#ffffff"
}
```

### Installation

- **Desktop**: Install prompt appears in supported browsers
- **Mobile**: "Add to Home Screen" option available
- **Criteria**: HTTPS, valid manifest, service worker

## 🌐 Deployment Options

### Cloudflare Pages (Primary)

The project is configured to deploy to Cloudflare Pages via GitHub Actions.

#### Prerequisites
- GitHub repository
- Cloudflare account with Pages enabled
- Set up the following GitHub Actions secrets:
  - **Cloudflare Deployment**
    - `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token
    - `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare Account ID
    - `CLOUDFLARE_PAGES_PROJECT`: Your Cloudflare Pages project name
  - **Firebase Configuration (Client-side)**
    - `VITE_FIREBASE_API_KEY`: Firebase API key
    - `VITE_FIREBASE_AUTH_DOMAIN`: Firebase auth domain
    - `VITE_FIREBASE_PROJECT_ID`: Firebase project ID
    - `VITE_FIREBASE_STORAGE_BUCKET`: Firebase storage bucket
    - `VITE_FIREBASE_MESSAGING_SENDER_ID`: Firebase messaging sender ID
    - `VITE_FIREBASE_APP_ID`: Firebase app ID
  - **NIWA API Configuration (Server-side only)**
    - `NIWA_API_KEY`: NIWA API key for tide data (injected only into Cloudflare Pages Functions, not available to client code)

#### Automatic Deployment
Deployments are handled automatically by `.github/workflows/deploy-cloudflare-pages.yml`:
- **Preview Deployments**: Created automatically for all pull requests
- **Production Deployments**: Created when pushing to main branch

#### Manual Deployment (if needed)
```bash
# Install Wrangler CLI
npm install -g @cloudflare/wrangler

# Build the project
npm run build

# Deploy
wrangler pages deploy dist --project-name your-project-name
```

#### Configuration Files
- `functions/api/niwa-tides.ts`: Cloudflare Pages Function for NIWA tide API proxy
- `public/_redirects`: SPA routing configuration for Cloudflare Pages

### Alternative Static Hosting Services

#### Netlify
```bash
# Build command
npm run build

# Publish directory
dist

# Redirects for SPA (create _redirects file)
echo "/*    /index.html   200" > dist/_redirects
```

#### GitHub Pages
```bash
# Build and deploy
npm run build
# Copy dist/ contents to gh-pages branch
```

### Traditional Web Servers

#### Apache
```apache
# .htaccess for SPA routing
RewriteEngine On
RewriteBase /

# Handle Angular and other SPA routing
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]

# Enable compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/xml
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/x-javascript
</IfModule>

# Cache static assets
<IfModule mod_expires.c>
    ExpiresActive on
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
</IfModule>
```

#### Nginx
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/dist;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Compress responses
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

## 🔄 Data Migration

### From Original App

The React app is designed to be compatible with the original vanilla JS version:

1. **IndexedDB Schema**: Uses the same database structure
2. **localStorage Keys**: Maintains compatibility with existing settings
3. **Data Format**: Import/export uses identical JSON structure

### Migration Testing

```bash
# Test data migration compatibility
npm run test:migration
```

### Manual Migration Steps

1. **Backup Data**: Export data from original app
2. **Deploy React App**: On same domain/subdomain
3. **Verify Compatibility**: Check that existing data loads
4. **Test Functionality**: Ensure all features work with migrated data

## 🧪 Testing Deployment

### Local Testing

```bash
# Build and preview
npm run build
npm run preview

# Test PWA features
npm run test:pwa
```

### PWA Testing Checklist

- [ ] App installs correctly on desktop
- [ ] App installs correctly on mobile
- [ ] Offline functionality works
- [ ] Service worker updates properly
- [ ] Manifest loads without errors
- [ ] Icons display correctly
- [ ] Theme colors apply properly

### Cross-Browser Testing

Test in:
- [ ] Chrome (desktop & mobile)
- [ ] Firefox (desktop & mobile)
- [ ] Safari (desktop & mobile)
- [ ] Edge (desktop)

### Performance Testing

- [ ] Lighthouse PWA score > 90
- [ ] First Contentful Paint < 2s
- [ ] Largest Contentful Paint < 2.5s
- [ ] Time to Interactive < 3s

## 🔒 Security Considerations

### HTTPS Requirement

PWAs require HTTPS in production:
- Service workers only work over HTTPS
- Install prompts require secure context
- Use Let's Encrypt for free SSL certificates

### Content Security Policy

Consider adding CSP headers:
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com;
  style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com;
  img-src 'self' data: blob:;
  connect-src 'self' https://api.open-meteo.com;
">
```

## 📊 Monitoring

### Analytics

Consider adding:
- Google Analytics 4
- Web Vitals monitoring
- Error tracking (Sentry)

### Performance Monitoring

- Monitor Core Web Vitals
- Track PWA install rates
- Monitor offline usage patterns

## 🚨 Troubleshooting

### Common Issues

#### Build Fails
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### PWA Not Installing
- Check HTTPS requirement
- Verify manifest.webmanifest is accessible
- Check service worker registration
- Ensure all required icons are present

#### Service Worker Issues
- Clear browser cache
- Check DevTools > Application > Service Workers
- Verify sw.js is accessible and valid

#### Data Migration Issues
- Check browser console for errors
- Verify IndexedDB permissions
- Test with fresh browser profile
- Compare data schemas between versions

### Debug Commands

```bash
# Check build output
ls -la dist/

# Validate manifest
cat dist/manifest.webmanifest | jq .

# Check service worker
head -20 dist/sw.js

# Test local server
python3 -m http.server 8080 --directory dist
```

## 📞 Support

For deployment issues:
1. Check this documentation
2. Review browser console errors
3. Test with the provided scripts
4. Verify against PWA requirements

## 🔄 Updates

### Updating the App

1. **Build New Version**: `npm run build`
2. **Deploy**: Upload new dist/ contents
3. **Service Worker**: Automatically handles updates
4. **User Notification**: Users see update prompt

### Rollback Process

1. **Keep Previous Build**: Always backup previous dist/
2. **Quick Rollback**: Replace current files with backup
3. **Database**: Data structure should remain compatible

---

This deployment guide ensures a smooth transition from development to production while maintaining all PWA features and data compatibility.