1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. Review `src/hooks/useModalWithCleanup.ts` and extend the Firebase listener `useEffect` dependency list so that `handleAuthStateChanged` (or any equivalent inline handler) is captured alongside `onAuthStateChange`, guarding against stale closures during rerenders.
3. Evaluate the console logging strategy within `useModalWithCleanup`, trimming or gating the emoji-rich debug statements (`🧹`, `✅`, etc.) to maintain production-appropriate signal while preserving necessary diagnostics.
4. Re-run and update the associated unit and integration tests in `src/test/authContextModalIntegration.test.ts` or related suites to confirm no regressions and to adjust any assertions impacted by logging or dependency changes.
5. After applying the updates, generate `.tasks/data_integrity_test10.files.md` containing only the modified file paths, one per line, with no additional commentary.
