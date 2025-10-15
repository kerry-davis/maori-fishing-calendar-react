Manual QA steps and targeted tests for guest-user-admin12:

1. Immediately available sync state:
   - Log in as a user with no pending sync queue.
   - Open sign-out modal; confirm last sync timestamp is shown and sign-out is enabled.

2. In-flight sync that eventually clears:
   - Trigger a sync operation (e.g., add data that requires syncing).
   - Open sign-out modal during sync; confirm progress indicator and blocking.
   - Wait for sync to complete; modal should unblock and allow sign-out.

3. Timeout fallback:
   - Simulate a long-running sync (e.g., network offline or large queue).
   - Open sign-out modal; after timeout, confirm retry and force sign-out options appear.

4. Force sign-out option:
   - After timeout, click "Sign Out Anyway"; confirm user is signed out and local state is cleared.

5. Header integration:
   - Open header menu, trigger sign-out; confirm new modal and live sync status.

6. Edge cases:
   - Try sign-out with missing Firebase instance; confirm no errors and UI remains responsive.

Automated tests recommended for:
- SyncStatusContext: state propagation, event handling, timer cleanup.
- SignOutConfirmation: UI state transitions, timer/interval logic, override actions.
