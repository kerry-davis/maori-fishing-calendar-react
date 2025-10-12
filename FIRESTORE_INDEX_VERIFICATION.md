# Firestore Index Verification Checklist

## Overview
This guide provides step-by-step instructions for manually verifying that the encryption migration works correctly after creating the required Firestore indexes.

## Prerequisites
- ✅ Firebase project set up and accessible
- ✅ Application deployed and running
- ✅ User logged into the application
- ✅ Browser developer tools open

## Step 1: Trigger Migration to Identify Missing Indexes

### 1.1 Log In to Application
```bash
# Navigate to your deployed application
# https://your-app-domain.com
```

### 1.2 Observe Migration Behavior
- The encryption migration should start automatically after login
- Watch for the green "Encrypting data…" pill in the bottom-right corner
- Ifindexes are missing, you'll see a red "Index Error" pill

### 1.3 Check Console for Index Errors
Open browser developer tools and look for errors like:
```
[enc-migration] Firebase index error detected - failing fast
Firestore: The query requires an index. You can create it here: https://console.firebase.google.com/v1/rprojects/your-project-id/databases/(default)/indexes?create_composite=C...
```

## Step 2: Create Indexes Using Console Links

### 2.1 Extract Console Links
From the browser console, copy each index creation URL. They typically look like:
- `https://console.firebase.google.com/v1/rprojects/PROJECT_ID/databases/(default)/indexes?create_composite=C...`

### 2.2 Create Each Required Index

#### Index 1: Trips Collection
1. Click the console link for the `trips` collection
2. Review the pre-configured index:
   - **Collection**: `trips`
   - **Fields**:
     - `userId` (Ascending)
     - `createdAt` (Ascending)
   - **Scope**: Collection
3. Click "Create Index"
4. Wait for index status to show "Enabled" (typically 1-2 minutes)

#### Index 2: WeatherLogs Collection
1. Click the console link for the `weatherLogs` collection
2. Verify configuration:
   - **Collection**: `weatherLogs`
   - **Fields**:
     - `userId` (Ascending)
     - `createdAt` (Ascending)
3. Click "Create Index"
4. Wait for index to enable

#### Additional Collections (if present)
Repeat for any other collections that show index errors:
- `fishCaught`
- `tackleItems`

### 2.3 Verify Index Status
In the Firebase console, check the "Indexes" tab:
- All relevant collections should show "Enabled" status
- No "Building" indexes should remain

## Step 3: Re-trigger Migration and Verify Completion

### 3.1 Method 1: Logout/Login (Recommended)
1. Click the user profile/menu and select "Logout"
2. Log back in with the same user credentials
3. Watch for automatic migration start

### 3.2 Method 2: Force Restart
If logged in and need to restart migration:

```javascript
// Open browser console and run:
const authHook = document.querySelector('[data-testid="test-component"]')?.__reactInternalInstance$?.child.child.memoizedProps.children.props.children?.children.memoizedProps.children;
// Or simpler: Use the force restart functionality if available through UI
window.location.reload(); // Fallback
```

### 3.3 Monitor Migration Progress

#### Expected Behavior:
1. **Green Progress Pill** should appear: "Encrypting data…"
2. **Progress Updates**: Watch the numbers update:
   - `docs updated: X`
   - `processed: Y`
   - `collections: Z/N`
3. **No Error Pill**: Red error pill should not appear
4. **Process Time**: Migration typically completes in 10-60 seconds depending on data size

## Step 4: Verify Migration Completion

### 4.1 Console Events
In browser developer tools console, watch for:
```
[enc-migration] Migration completion event received: {userId: "...", status: {...}}
```

### 4.2 Pill Disappearance
The green "Encrypting data…" pill should automatically disappear when complete.

### 4.3 Status Verification
Open browser console and run:

```javascript
// Check migration status
const authContext = document.querySelector('#root')?.__reactInternalInstance$?.child.memoizedProps.children.props.children?.children;
// Or use the hook in dev tools:
// Look for useEncryptionMigrationStatus hook in React DevTools
```

Expected outcome: `allDone: true` with `error: null`

### 4.4 Verification Checklist

#### ✅ Success Criteria:
- [ ] All required indexes show "Enabled" status in Firebase console
- [ ] No red "Index Error" pill appears
- [ ] Green migration pill appears and progresses
- [ ] "encryptionMigrationCompleted" event fires in console
- [ ] Migration pill disappears automatically
- [ ] `getEncryptionMigrationStatus().allDone` returns true
- [ ] No remaining migration-related warnings in console

#### ❌ Failure Indicators:
- [ ] Index continues showing "Building" status for more than 5 minutes
- [ ] Red error pill persists after creating index
- [ ] Migration gets stuck and doesn't complete
- [ ] "encryptionMigrationCompleted" event doesn't fire
- [ ] Console shows ongoing migration errors

## Step 5: Troubleshooting

### 5.1 If Migration Gets Stuck
1. Verify all indexes are fully "Enabled"
2. Refresh the page and try logout/login again
3. Check browser console for unexpected errors
4. Verify network connectivity

### 5.2 If Index Creation Fails
1. Ensure you have proper Firebase permissions
2. Try creating the index manually in Firestore console
3. Verify project configuration
4. Contact Firebase support if issues persist

### 5.3 If Multiple Collections Have Issues
Repeat steps 2-4 for each collection showing index errors. Each collection needs its own index.

## Step 6: Documentation

### 6.1 Record Successful Migration
For your records, capture:
- Date and time of successful migration
- Number of documents processed
- Time taken for completion
- Any issues encountered

### 6.2 Update Documentation
If this process revealed any improvements needed, update:
- `FIRESTORE_INDEX_GUIDE.md`
- Migration error handling
- User documentation

## Automated Verification (Optional)

For development verification, you can run the automated tests:

```bash
npm test -- src/test/migrationFlowVerification.test.tsx
```

These tests verify the same scenarios but with mocked Firebase services.

## Console API References

### Migration Status Check
```javascript
// In browser console, you can manually check status:
firebaseDataService.getEncryptionMigrationStatus()
```

### Force Migration Restart
```javascript
// Direct API call (if exposed globally):
window.firebaseDataService?.startBackgroundEncryptionMigration()
```

### Event Monitoring
```javascript
// Listen for completion event:
window.addEventListener('encryptionMigrationCompleted', (e) => {
  console.log('Migration completed:', e.detail);
});
```

---

## Support

If you encounter issues during verification:
1. Check this checklist for any missed steps
2. Review browser console for specific error messages
3. Refer to `FIRESTORE_INDEX_GUIDE.md` for troubleshooting
4. Contact development team with detailed error logs
