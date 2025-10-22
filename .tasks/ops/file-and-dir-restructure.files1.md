# Files Changed in Directory Restructure

## Moved to src/app/
- App.tsx → src/app/App.tsx
- main.tsx → src/app/main.tsx
- index.css → src/app/styles/global.css

## Moved to src/app/providers/
- contexts/AuthContext.tsx → src/app/providers/AuthContext.tsx
- contexts/DatabaseContext.tsx → src/app/providers/DatabaseContext.tsx
- contexts/LocationContext.tsx → src/app/providers/LocationContext.tsx
- contexts/PWAContext.tsx → src/app/providers/PWAContext.tsx
- contexts/README.md → src/app/providers/README.md
- contexts/SyncStatusContext.tsx → src/app/providers/SyncStatusContext.tsx
- contexts/ThemeContext.tsx → src/app/providers/ThemeContext.tsx
- contexts/index.tsx → src/app/providers/index.tsx

## Moved to src/shared/
- hooks/useModal.ts → src/shared/hooks/useModal.ts
- hooks/useSyncStatus.ts → src/shared/hooks/useSyncStatus.ts
- utils/cleanupDuplicates.ts → src/shared/utils/cleanupDuplicates.ts
- utils/clearUserContext.ts → src/shared/utils/clearUserContext.ts
- utils/debugDataStatus.ts → src/shared/utils/debugDataStatus.ts
- utils/firebaseErrorMessages.ts → src/shared/utils/firebaseErrorMessages.ts
- utils/guestDataUtils.ts → src/shared/utils/guestDataUtils.ts
- utils/guestEncryptionUtils.ts → src/shared/utils/guestEncryptionUtils.ts
- utils/loggingHelpers.ts → src/shared/utils/loggingHelpers.ts
- utils/persistenceInstrumentation.ts → src/shared/utils/persistenceInstrumentation.ts
- utils/photoPreviewUtils.ts → src/shared/utils/photoPreviewUtils.ts
- utils/storageQuotaUtils.ts → src/shared/utils/storageQuotaUtils.ts
- utils/userStateCleared.ts → src/shared/utils/userStateCleared.ts
- services/databaseService.ts → src/shared/services/databaseService.ts
- services/lunarService.ts → src/shared/services/lunarService.ts
- services/mareaTideService.ts → src/shared/services/mareaTideService.ts
- services/niwaTideService.ts → src/shared/services/niwaTideService.ts
- services/photoCacheService.ts → src/shared/services/photoCacheService.ts
- services/photoMigrationService.ts → src/shared/services/photoMigrationService.ts
- services/tideProviderFactory-minimal.ts → src/shared/services/tideProviderFactory-minimal.ts
- services/tideService.ts → src/shared/services/tideService.ts
- services/weatherService.ts → src/shared/services/weatherService.ts
- types/index.ts → src/shared/types/index.ts
- assets/react.svg → src/shared/assets/react.svg

## Moved to src/features/auth/
- components/Auth/AuthButton.tsx → src/features/auth/AuthButton.tsx
- components/Auth/LoginModal.tsx → src/features/auth/LoginModal.tsx
- components/Auth/ProtectedRoute.tsx → src/features/auth/ProtectedRoute.tsx
- components/Auth/SuccessToast.tsx → src/features/auth/SuccessToast.tsx
- components/Auth/index.ts → src/features/auth/index.ts

## Moved to src/features/calendar/
- components/Calendar/Calendar.tsx → src/features/calendar/Calendar.tsx
- components/Calendar/CalendarDay.tsx → src/features/calendar/CalendarDay.tsx
- components/Calendar/CalendarGrid.tsx → src/features/calendar/CalendarGrid.tsx
- components/Calendar/index.ts → src/features/calendar/index.ts

## Moved to src/features/charts/
- components/Charts/GearChart.tsx → src/features/charts/GearChart.tsx
- components/Charts/LocationChart.tsx → src/features/charts/LocationChart.tsx
- components/Charts/MoonPhaseChart.tsx → src/features/charts/MoonPhaseChart.tsx
- components/Charts/PersonalBestsDisplay.tsx → src/features/charts/PersonalBestsDisplay.tsx
- components/Charts/SpeciesChart.tsx → src/features/charts/SpeciesChart.tsx
- components/Charts/WeatherChart.tsx → src/features/charts/WeatherChart.tsx
- components/Charts/index.ts → src/features/charts/index.ts

## Moved to src/features/debug/
- components/Debug/MigrationVerification.tsx → src/features/debug/MigrationVerification.tsx
- components/Debug/index.ts → src/features/debug/index.ts

## Moved to src/features/encryption/
- components/Encryption/EncryptionMigrationStatus.tsx → src/features/encryption/EncryptionMigrationStatus.tsx
- components/Encryption/index.ts → src/features/encryption/index.ts

## Moved to src/features/forms/
- components/Forms/FishCaughtDisplay.tsx → src/features/forms/FishCaughtDisplay.tsx
- components/Forms/FishCaughtForm.tsx → src/features/forms/FishCaughtForm.tsx
- components/Forms/WeatherLogDisplay.tsx → src/features/forms/WeatherLogDisplay.tsx
- components/Forms/WeatherLogForm.tsx → src/features/forms/WeatherLogForm.tsx
- components/Forms/index.ts → src/features/forms/index.ts

## Moved to src/features/layout/
- components/Layout/Footer.tsx → src/features/layout/Footer.tsx
- components/Layout/Header.tsx → src/features/layout/Header.tsx
- components/Layout/index.ts → src/features/layout/index.ts

## Moved to src/features/legend/
- components/Legend/Legend.tsx → src/features/legend/Legend.tsx
- components/Legend/index.ts → src/features/legend/index.ts

## Moved to src/features/modals/
- components/Modals/AnalyticsModal.tsx → src/features/modals/AnalyticsModal.tsx
- components/Modals/DataMigrationModal.tsx → src/features/modals/DataMigrationModal.tsx
- components/Modals/FishCatchModal.tsx → src/features/modals/FishCatchModal.tsx
- components/Modals/GalleryModal.tsx → src/features/modals/GalleryModal.tsx
- components/Modals/GearForm.tsx → src/features/modals/GearForm.tsx
- components/Modals/GearSelectionModal.tsx → src/features/modals/GearSelectionModal.tsx
- components/Modals/GearTypeForm.tsx → src/features/modals/GearTypeForm.tsx
- components/Modals/LunarModal.tsx → src/features/modals/LunarModal.tsx
- components/Modals/Modal.tsx → src/features/modals/Modal.tsx
- components/Modals/ModalWithCleanup.tsx → src/features/modals/ModalWithCleanup.tsx
- components/Modals/PhotosModal.tsx → src/features/modals/PhotosModal.tsx
- components/Modals/SearchModal.tsx → src/features/modals/SearchModal.tsx
- components/Modals/SettingsModal.tsx → src/features/modals/SettingsModal.tsx
- components/Modals/TackleBoxModal.tsx → src/features/modals/TackleBoxModal.tsx
- components/Modals/TripDetailsModal.tsx → src/features/modals/TripDetailsModal.tsx
- components/Modals/TripFormModal.tsx → src/features/modals/TripFormModal.tsx
- components/Modals/TripLogModal.tsx → src/features/modals/TripLogModal.tsx
- components/Modals/WeatherLogModal.tsx → src/features/modals/WeatherLogModal.tsx
- components/Modals/index.ts → src/features/modals/index.ts

## Moved to src/features/moon/
- components/MoonInfo/CurrentMoonInfo.tsx → src/features/moon/CurrentMoonInfo.tsx
- components/MoonInfo/index.ts → src/features/moon/index.ts

## Moved to src/features/pwa/
- components/PWA/OfflineIndicator.tsx → src/features/pwa/OfflineIndicator.tsx
- components/PWA/PWAInstallPrompt.tsx → src/features/pwa/PWAInstallPrompt.tsx
- components/PWA/PWAUpdateNotification.tsx → src/features/pwa/PWAUpdateNotification.tsx
- components/PWA/index.ts → src/features/pwa/index.ts

## Moved to src/features/tide/
- components/Tide/TideChart.tsx → src/features/tide/TideChart.tsx
- components/Tide/TideSummary.tsx → src/features/tide/TideSummary.tsx
- components/Tide/index.ts → src/features/tide/index.ts

## Moved to src/features/weather/
- components/Weather/WeatherDisplay.tsx → src/features/weather/WeatherDisplay.tsx
- components/Weather/WeatherForecast.tsx → src/features/weather/WeatherForecast.tsx
- components/Weather/WeatherSection.tsx → src/features/weather/WeatherSection.tsx
- components/Weather/index.ts → src/features/weather/index.ts

## Moved to src/shared/components/
- components/UI/Button.tsx → src/shared/components/Button.tsx
- components/UI/Card.tsx → src/shared/components/Card.tsx
- components/UI/ConfirmationDialog.tsx → src/shared/components/ConfirmationDialog.tsx
- components/UI/Container.tsx → src/shared/components/Container.tsx
- components/UI/ContextualConfirmation.tsx → src/shared/components/ContextualConfirmation.tsx
- components/UI/DataSafetyInfo.tsx → src/shared/components/DataSafetyInfo.tsx
- components/UI/DataSyncStatus.tsx → src/shared/components/DataSyncStatus.tsx
- components/UI/ErrorBoundary.tsx → src/shared/components/ErrorBoundary.tsx
- components/UI/GuestModeNotice.tsx → src/shared/components/GuestModeNotice.tsx
- components/UI/IconButton.tsx → src/shared/components/IconButton.tsx
- components/UI/ProgressBar.tsx → src/shared/components/ProgressBar.tsx
- components/UI/index.ts → src/shared/components/index.ts

## Moved to src/shared/__tests__/
- Various test files moved to src/shared/__tests__/

## Moved to feature-specific __tests__ directories
- Various test files moved to their respective feature directories under __tests__/

## Updated Configuration Files
- tsconfig.app.json - Added path aliases
- vite.config.ts - Added resolve.alias configuration
- vite.config.production.ts - Added resolve.alias configuration