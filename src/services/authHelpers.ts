// Helper to decide whether to use redirect instead of popup
// for Firebase Auth Google sign-in, based on environment.

export function shouldUseRedirect(params?: {
  userAgent?: string;
  isPWA?: boolean;
  isStandalone?: boolean;
}): boolean {
  const rawUA = params?.userAgent ?? (
    typeof navigator !== 'undefined' && typeof (navigator as any).userAgent === 'string'
      ? (navigator as any).userAgent
      : ''
  );
  const ua = String(rawUA).toLowerCase();
  const isPWA = !!params?.isPWA;
  const isStandalone = !!params?.isStandalone;

  const isIOS = /iphone|ipad|ipod/.test(ua) || (typeof navigator !== 'undefined' && (navigator as any).platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
  const isSafari = /safari/.test(ua) && !/chrome|crios|android/.test(ua);

  // Prefer popup in PWA/standalone to keep flow inside the app
  if (isPWA || isStandalone) {
    return false;
  }
  // iOS Safari (non-PWA) often blocks popups/3rd-party cookies
  if (isIOS || isSafari) {
    return true;
  }
  // Default to popup for Android Chrome/others; redirect if future checks require
  return false;
}
