# Contributing (Internal)

1. Keep PRs focused and reasonably small.
2. Add/adjust tests for changed logic; avoid behavior drift.
3. Run `npm run test:run` before pushing.
4. Avoid runtime-only secret dependencies; app must work with provided Firebase config + pepper.
5. Document noteworthy architectural decisions in migration docs or ADRs.
