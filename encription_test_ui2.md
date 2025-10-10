1. Refactor the migration guard in `AuthContext` to use a synchronous `useRef` (e.g., `migrationStartedRef`) so StrictMode double renders can’t trigger a second `setTimeout` before the state update lands.
2. Update the `useEffect` dependency array to include the ref/state accessors (or switch the guard to `useRef` + `useState` combo) to silence React’s missing-dependency warning while keeping the closure fresh.
3. Add a unit or integration test that simulates two rapid auth-state changes to ensure the migration kick-off happens only once per login.
