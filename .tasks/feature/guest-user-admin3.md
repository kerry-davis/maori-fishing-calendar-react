1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Remove the nested `validateUserContext` call for guest flows so the bypass executes the guest operation directly.
4. Centralize guest photo preview handling to resolve raw `photoPath` rendering (generate safe URLs or fall back to placeholders).
5. Isolate global storage mocks in `dataIntegrity.test.ts` using per-suite setup/teardown so other specs retain real browser shims.
6. Audit for any additional guest write call sites still passing `validateUserContext(undefined, ...)` and update them.
7. Re-run the guest-mode and photo preview test suites to confirm fixes.
8. Create `.tasks/feature/guest-user-admin.files3.md` enumerating modified files in short form.
