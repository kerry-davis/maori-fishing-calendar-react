1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. Address the remaining opportunity in `src/hooks/useModalWithCleanup.ts` by revisiting `trackModalStateChange`, centralizing or memoizing its environment checks to reduce repeated `process.env` access while retaining conditional logging.
3. Tackle the remaining opportunity related to development-only console statements: audit all remaining emoji-bearing debug logs and adopt a consistent strategy (removal, plain-text replacement, or shared logging helper) so developer output stays purposeful.
4. Update any affected tests or mocks that assert on logging behavior or modal instrumentation to align with the refined logging strategy, ensuring coverage remains meaningful.
5. Execute the relevant Vitest suites for the modal hook and instrumentation to confirm the refactoring introduces no regressions and gather evidence for reviewers if failures arise.
6. After completing the above steps, generate `.tasks/data_integrity_test11.files.md` listing only the modified file paths, one per line, without additional commentary or explanations.
