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

  // PWA/standalone behavior differs per platform
  if (isPWA || isStandalone) {
    // iOS PWA: popup, avoid redirect (redirect can lose state)
    if (isIOS) return false;
    // Android PWA: redirect tends to be more reliable than popup
    return true;
  }
  // Browser behavior
  // iOS Safari (non-PWA): redirect for reliability
  if (isIOS || isSafari) return true;
  // Others (desktop chrome, android chrome): popup
  return false;
}
