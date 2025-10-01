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
  const isAndroid = /android/.test(ua);
  const isSafari = /safari/.test(ua) && !/chrome|crios|android/.test(ua);

  // Use redirect on platforms where popup or third-party cookies are unreliable
  if (isPWA || isStandalone || isIOS || isAndroid || isSafari) {
    return true;
  }
  return false;
}
