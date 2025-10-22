import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.tsx'

// Timing: mark the start of (re)load as early as possible in the app entry
try {
  if (typeof performance !== 'undefined') {
    performance.mark('app-reload-start');
    // Console timer for a quick glance in DevTools
    // Note: Will be ended when DB is ready inside App.tsx
    // Using a stable label so it groups nicely across reloads
    console.time('[reload] total');
    // Track active timer and logging state to avoid duplicate logs under StrictMode
    try {
      (window as any).__reloadTimerActive = true;
      (window as any).__reloadFirstFrameLogged = false;
      (window as any).__reloadReadyLogged = false;
    } catch {}
  }
} catch {
  // no-op if performance API is unsupported
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
