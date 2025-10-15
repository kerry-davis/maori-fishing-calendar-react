1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Update GalleryModal to skip adding photo items when a catch has no usable image data.
4. Refine `fixPhotoData` (or its call sites) to return `undefined` for empty inputs so placeholders aren’t generated automatically.
5. Update relevant tests (or add new ones) to cover the no-photo gallery scenario.
6. Run affected suites to confirm blank placeholders no longer appear.
7. Create `.tasks/feature/guest-user-admin.files8.md` listing modified files.
