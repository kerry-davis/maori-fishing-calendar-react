import { describe, expect, it } from 'vitest';
import { shouldUseRedirect } from '../services/authHelpers';

describe('shouldUseRedirect', () => {
  it('uses popup for iOS PWA/standalone and redirect for Android PWA', () => {
    const iosUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const androidUA = 'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Mobile Safari/537.36';
    expect(shouldUseRedirect({ userAgent: iosUA, isPWA: true })).toBe(false);
    expect(shouldUseRedirect({ userAgent: androidUA, isPWA: true })).toBe(true);
  });

  it('uses redirect for iOS Safari', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1';
    expect(shouldUseRedirect({ userAgent: ua })).toBe(true);
  });

  it('uses popup for Android Chrome by default', () => {
    const chromeAndroid = 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Mobile Safari/537.36';
    expect(shouldUseRedirect({ userAgent: chromeAndroid })).toBe(false);
  });

  it('uses redirect for Safari on macOS (non-Chrome)', () => {
    const safariMac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Safari/605.1.15';
    expect(shouldUseRedirect({ userAgent: safariMac })).toBe(true);
  });

  it('uses popup for desktop Chrome by default', () => {
    const chromeDesktop = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36';
    expect(shouldUseRedirect({ userAgent: chromeDesktop })).toBe(false);
  });
});
