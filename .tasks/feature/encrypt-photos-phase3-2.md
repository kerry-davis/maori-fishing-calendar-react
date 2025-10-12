# Phase 3 Tasks for feature/encrypt-photos (Iteration 2)

1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Revisit Gallery photo list construction and keep fish IDs in their original string form (remove `parseInt` so IDs stay unique).
4. Verify all consumers of `PhotoItem.fishId` (selection, edit/delete flows, analytics) still receive the correct string IDs.
5. Add/adjust tests to cover gallery selection/edit flows and confirm IDs remain strings.
6. Run targeted tests for the gallery logic plus the full suite (`npm test` / `npm run test:run`) and resolve any issues.
7. Create `.tasks/feature/encrypt-photos-phase3.files2.md` summarizing the modified files in short form.
