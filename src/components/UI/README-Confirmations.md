# Standardized Confirmation Dialogs

## ContextualConfirmation Component

All confirmation dialogs in the app now use the standardized `ContextualConfirmation` component for consistent UX.

### Usage Patterns

#### 1. Logout Confirmation
```tsx
<ContextualConfirmation
  isOpen={showLogoutConfirm}
  title="Sign Out"
  message="Your data will be safely backed up before signing out."
  confirmText="Sign Out"
  cancelText="Stay Signed In"
  onConfirm={handleLogoutConfirm}
  onCancel={handleLogoutCancel}
  variant="warning"
  position="top-right"
/>
```

#### 2. Delete Confirmations
```tsx
<ContextualConfirmation
  isOpen={showDeleteConfirm}
  title="Delete Trip"
  message="This will permanently delete the entire trip and all associated data."
  confirmText="Delete Trip"
  cancelText="Keep It"
  onConfirm={handleConfirmDelete}
  onCancel={handleCancelDelete}
  variant="danger"
  position="center"
/>
```

### Variants

- **danger**: Red styling for destructive actions (delete, remove)
- **warning**: Yellow styling for caution actions (logout, sign out)
- **info**: Blue styling for informational confirmations

### Positions

- **top-right**: Contextual popup near trigger button (logout)
- **center**: Centered modal with backdrop (delete operations)

### Visual Standards

- Consistent icon usage (🗑️ for delete, ⚠️ for warning, ℹ️ for info)
- Standardized button sizing and colors
- Consistent spacing and typography
- Dark mode support
- Responsive design