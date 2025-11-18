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
const USER_ID = new Uint8Array([1, 2, 3, 4]); // Dummy user ID
const USER_NAME = 'local-user';

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
   * This essentially asks the user to scan their fingerprint once to save a credential.
   */
  register: async (): Promise<boolean> => {
    try {
      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge: CHALLENGE,
        rp: {
          name: RP_NAME,
          id: window.location.hostname, // Must match current domain
        },
        user: {
          id: USER_ID,
          name: USER_NAME,
          displayName: USER_NAME,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' }, // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // Forces TouchID/FaceID/Fingerprint
          userVerification: 'required',
          requireResidentKey: false,
        },
        timeout: 60000,
        attestation: 'none',
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
      });

      return !!credential;
    } catch (error) {
      console.error('Biometric registration failed:', error);
      return false;
    }
  },

  /**
   * Prompts the user to authenticate using their biometric method.
   */
  authenticate: async (): Promise<boolean> => {
    try {
      const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge: CHALLENGE,
        timeout: 60000,
        userVerification: 'required',
        // We don't specify allowCredentials to allow any credential for this RP on this device
      };

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
