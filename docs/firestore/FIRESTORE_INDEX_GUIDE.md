# Firestore Index Setup for Encryption Migration

## Required Composite Index

The encryption migration requires a composite index on the `trips` collection to properly query and encrypt user data.

### Index Details

The encryption migration requires composite indexes on multiple collections. Each collection needs the same field structure.

#### Required Indexes

**1. Trips Collection**
- **Collection**: `trips`
- **Fields**: 
  - `userId` (Ascending)
  - `createdAt` (Ascending)
- **Scope**: Collection

**2. WeatherLogs Collection**
- **Collection**: `weatherLogs`
- **Fields**: 
  - `userId` (Ascending)
  - `createdAt` (Ascending)
- **Scope**: Collection

**3. FishCaught Collection** (if applicable)
- **Collection**: `fishCaught`
- **Fields**: 
  - `userId` (Ascending)
  - `createdAt` (Ascending)
- **Scope**: Collection

**4. TackleItems Collection** (if applicable)
- **Collection**: `tackleItems`
- **Fields**: 
  - `userId` (Ascending)
  - `createdAt` (Ascending)
- **Scope**: Collection

### Setup Instructions

#### Method 1: Automatic Creation (Recommended)

1. The first time the encryption migration runs, Firebase will automatically detect missing indexes
2. Check the browser console for error messages containing links to create the required indexes
3. Click each provided link to open the Firebase console with each index pre-configured
4. Click "Create Index" for each required collection (trips, weatherLogs, etc.)
5. Wait for indexes to become active (typically 1-2 minutes) then retry the migration

#### Method 2: Manual Setup

1. Navigate to your Firebase project console: https://console.firebase.google.com/
2. Go to "Firestore Database" → "Indexes" tab
3. Click "Add Index" for each required collection

**For Trips Collection**:
- **Collection ID**: `trips`
- **Fields**:
  1. `userId` → Ascending
  2. `createdAt` → Ascending
- **Scope**: Collection

**For WeatherLogs Collection**:
- **Collection ID**: `weatherLogs`
- **Fields**:
  1. `userId` → Ascending
  2. `createdAt` → Ascending
- **Scope**: Collection

4. Click "Create" for each index
5. Wait for all indexes to become active before running migration

#### Method 3: Using Firebase CLI

If you have Firebase CLI configured, you can create all required indexes using this configuration:

```firestore
{
  "indexes": [
    {
      "collectionGroup": "trips",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "userId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "weatherLogs",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "userId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "fishCaught",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "userId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "tackleItems",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "userId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "ASCENDING"
        }
      ]
    }
  ]
}
```

Run: `firebase deploy --only firestore:indexes`

### Console URLs

Replace `[PROJECT_ID]` with your Firebase project ID:

- **Direct console URL**: https://console.firebase.google.com/project/[PROJECT_ID]/database/firestore/indexes
- **Index creation page**: https://console.firebase.google.com/project/[PROJECT_ID]/database/firestore/indexes/~2Ftrips~2FuserId~2FcreatedAt?createComposite=

### Verification

After creating the index, you can verify it works by:

1. Running the encryption migration test
2. Checking that no index errors appear in the console
3. Confirming the migration completes successfully

### Common Issues

1. **Index Status**: Indexes take a few minutes to become active. Check the "Status" column in the console.
2. **Multiple Projects**: Ensure you're creating the index in the correct Firebase project.
3. **Collection Name**: The index must be created on the `trips` collection exactly (case-sensitive).

### Migration Error Handling

The application now includes enhanced error handling:

- **Fast Failure**: When an index error is detected, the migration marks the affected collection as complete to prevent indefinite hanging
- **Error Events**: Dispatches `encryptionIndexError` event with details for UI display
- **User Notifications**: Shows appropriate error messages with console links
- **Auto-Recovery**: Once the index is created, the migration can be retried successfully

### Testing

To test the index setup:

1. Delete any existing index on `trips` collection temporarily
2. Run the encryption migration
3. Verify that an index error is properly caught and handled
4. Create the index using the provided console link
5. Retry the migration to confirm it completes successfully

For automated testing, see `src/test/encryptionIndexIntegration.test.tsx`.
