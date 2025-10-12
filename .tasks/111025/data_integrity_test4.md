/home/pulsta/vscode/repo/maori-fishing-calendar-react
1. Audit `src/utils/persistenceInstrumentation.ts` for compile errors in `assessRisk`, add missing braces/return structure, and re-run TypeScript checks to confirm.
2. Update `src/utils/clearUserContext.ts` to remove duplicate imports, guard `performance.now()` and other browser APIs safely, and verify any BrowserAPISafe helper usage.
3. Refactor `src/utils/userStateCleared.ts` to rely on the existing Firebase `auth` import (no dynamic require), and enforce explicit write-operation detection instead of substring matching.
4. Adjust `src/hooks/useModalWithCleanup.ts` to listen for deterministic logout/auth events (or consume context) instead of `lastActiveUser` polling, ensuring cross-session cleanup triggers correctly.
5. Enhance regression coverage (unit/E2E) to validate the fixes: TypeScript build passes, logout clears state, UID mismatches throw, and modal cleanup fires on explicit logout event.
