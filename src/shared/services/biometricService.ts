/**
 * Service for handling Biometric authentication (Fingerprint/FaceID) via WebAuthn.
 * 
 * This service allows "locking" the app locally while keeping the Firebase session active.
 * It relies on the device's platform authenticator (TouchID, FaceID, Windows Hello, Android Fingerprint).
 * 
 * Note: This is a LOCAL verification only to gate UI access. It does not replace Firebase Auth.
 */

const CHALLENGE = new Uint8Array([
  0x8c, 0x59, 0x9c, 0x21, 0x8d, 0x18, 0x96, 0x3c,
  0x52, 0x2e, 0x54, 0x4b, 0x59, 0x24, 0x99, 0x18,
  0x89, 0x95, 0xc2, 0x94, 0x78, 0xb3, 0x9f, 0x99,
  0x02, 0x83, 0xe8, 0x12, 0xa4, 0x20, 0xbb, 0xb9
]); // Fixed dummy challenge for local verification

const RP_NAME = 'Maori Fishing Calendar';

// Helper to convert ArrayBuffer to Base64URL string
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Helper to convert Base64URL string to ArrayBuffer
function base64ToBuffer(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const base64Standard = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64Standard);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export const biometricService = {
  /**
   * Checks if a platform authenticator (Biometrics) is available on this device.
   */
  isAvailable: async (): Promise<boolean> => {
    if (
      typeof window === 'undefined' ||
      !window.PublicKeyCredential ||
      !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
    ) {
      return false;
    }

    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch (error) {
      console.warn('Biometric availability check failed:', error);
      return false;
    }
  },

  /**
   * Registers a credential on the device to "enable" biometrics for this domain.
   * Returns the Credential ID (base64url) if successful, or null if failed.
   * @param userId - Unique identifier for the user (e.g., Firebase UID)
   * @param username - Display name or email for the user
   */
  register: async (userId: string, username: string): Promise<string | null> => {
    try {
      const encoder = new TextEncoder();
      const userBuffer = encoder.encode(userId);

      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge: CHALLENGE,
        rp: {
          name: RP_NAME,
          id: window.location.hostname,
        },
        user: {
          id: userBuffer,
          name: username,
          displayName: username,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' }, // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          requireResidentKey: false,
        },
        timeout: 60000,
        attestation: 'none',
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
      }) as PublicKeyCredential;

      if (credential && credential.rawId) {
        return bufferToBase64(credential.rawId);
      }
      return null;
    } catch (error) {
      console.error('Biometric registration failed:', error);
      return null;
    }
  },

  /**
   * Prompts the user to authenticate using their biometric method.
   * @param credentialId - The stored credential ID to verify against.
   */
  authenticate: async (credentialId?: string | null): Promise<boolean> => {
    try {
      const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge: CHALLENGE,
        timeout: 60000,
        userVerification: 'required',
        rpId: window.location.hostname, // Explicitly bind to current domain
      };

      // If we have a stored credential ID, use it to filter allowed credentials
      if (credentialId) {
        publicKeyCredentialRequestOptions.allowCredentials = [{
          id: base64ToBuffer(credentialId),
          type: 'public-key',
          transports: ['internal'], // Hint for platform authenticators
        }];
      }

      const assertion = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions,
      });

      return !!assertion;
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return false;
    }
  }
};
