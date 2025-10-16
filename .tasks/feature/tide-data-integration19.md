1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Audit all `console.*` usage across services, hooks, and components; categorize messages as production-critical or development-only.
4. Define and document logging guidelines (which events deserve production logs vs. dev-only) in the developer docs.
5. Refactor NIWA services/proxy to route necessary logs through a central helper (dev flag) and remove redundant debug noise.
6. Clean up component/hook logging, ensuring tests don’t rely on console output.
7. Create or update `.tasks/feature/tide-data-integration.files19.md` with a concise summary of files touched by this cleanup.
