1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Update `src/components/Modals/TripLogModal.tsx` to include `db` in the `loadTrips` dependency array and ensure memoization stays consistent.
4. Revoke previously created blob URLs in `TripLogModal` before generating new previews to prevent leaks during reloads.
5. Encode the SVG string returned by `createPlaceholderSVG` in `src/utils/photoPreviewUtils.ts` so data URIs remain valid with varied labels.
6. Create `.tasks/feature/encrypt-photos-phase8.files2.md` documenting, in short form, the files updated in this pass.
