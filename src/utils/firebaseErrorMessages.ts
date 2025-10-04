// Centralized mapping of Firebase Auth and Firestore error codes to user-friendly messages.
// Extend as needed. We intentionally avoid exposing raw Firebase messages to end users.

export type FirebaseErrorLike = { code?: string; message?: string } | Error | unknown;

// Auth error code -> friendly message (codes omit the "auth/" prefix for convenience)
const authErrorMap: Record<string, string> = {
  'invalid-email': 'That email address is not valid. Please check the format (e.g. name@example.com).',
  'user-disabled': 'This account has been disabled. Contact support if you think this is a mistake.',
  'user-not-found': 'No account found with that email. Try creating an account instead.',
  'wrong-password': 'Incorrect password. Please try again or reset your password.',
  'email-already-in-use': 'An account already exists with this email. Try logging in instead.',
  'weak-password': 'That password is too weak. Please use at least 6 characters (longer is better).',
  'missing-password': 'Please enter a password.',
  'popup-closed-by-user': 'The sign-in window was closed before finishing. Please try again.',
  'popup-blocked': 'The sign-in popup was blocked by the browser. Allow popups and try again.',
  'cancelled-popup-request': 'Another sign-in attempt is already in progress. Please finish it or try again.',
  'network-request-failed': 'Network issue while contacting the server. Check your internet connection and try again.',
  'too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'operation-not-allowed': 'That sign-in method is currently disabled. Please contact support.',
  'internal-error': 'Unexpected error occurred. Please try again.',
};

// Firestore / generic codes (prefix can vary)
const firestoreErrorMap: Record<string, string> = {
  'permission-denied': 'You do not have permission to perform this action.',
  'not-found': 'The requested item was not found.',
  'already-exists': 'This item already exists.',
  'resource-exhausted': 'Service temporarily unavailable due to usage limits. Please try again shortly.',
  'unavailable': 'Service is temporarily unavailable. Please try again soon.',
  'deadline-exceeded': 'The request took too long. Please try again.',
  'cancelled': 'The request was cancelled. Please try again.',
  'data-loss': 'A data error occurred. Please retry the action.',
  'invalid-argument': 'One of the provided values is invalid.',
  'failed-precondition': 'Cannot complete the action in the current state. Try refreshing or retrying.',
  'aborted': 'The operation was aborted. Please retry.',
  'out-of-range': 'A value was out of range. Please adjust and try again.',
  'unauthenticated': 'You need to be signed in to complete this action.',
};

// Derive a code from various error shapes
const extractCode = (error: FirebaseErrorLike): string | undefined => {
  if (!error) return undefined;
  if (typeof error === 'object' && error !== null) {
    const maybe = error as any;
    if (maybe.code && typeof maybe.code === 'string') return maybe.code as string;
    // Sometimes message includes code like "Firebase: Error (auth/email-already-in-use)."
    if (maybe.message && typeof maybe.message === 'string') {
      const match = maybe.message.match(/\(([^)]+)\)/); // capture inside parentheses
      if (match && match[1]) return match[1];
    }
  }
  if (error instanceof Error) {
    const match = error.message.match(/\(([^)]+)\)/);
    if (match && match[1]) return match[1];
  }
  return undefined;
};

export function mapFirebaseError(error: FirebaseErrorLike, context?: 'login' | 'register' | 'google' | 'generic'): string {
  const rawCode = extractCode(error) || '';
  // Split namespace e.g. auth/email-already-in-use -> [auth, email-already-in-use]
  const parts = rawCode.split('/');
  const namespace = parts.length > 1 ? parts[0] : undefined;
  const code = parts.length > 1 ? parts.slice(1).join('/') : parts[0];

  let baseMessage: string | undefined;

  if (namespace === 'auth') {
    baseMessage = authErrorMap[code];
  } else if (namespace === 'firestore' || namespace === 'storage' || namespace === 'functions' || firestoreErrorMap[code]) {
    baseMessage = firestoreErrorMap[code];
  }

  if (!baseMessage) {
    // Fallbacks by context
    switch (context) {
      case 'login':
        baseMessage = 'Could not sign you in. Please check your email and password and try again.';
        break;
      case 'register':
        baseMessage = 'Could not create the account. Please adjust the details and try again.';
        break;
      case 'google':
        baseMessage = 'Google sign-in failed. Please try again.';
        break;
      default:
        baseMessage = 'Something went wrong. Please try again.';
    }
  }

  // Provide subtle guidance for weak password on register context if code not recognized
  if (context === 'register' && code.includes('password')) {
    baseMessage += ' Use a stronger password (at least 6 characters).';
  }

  return baseMessage;
}

export function getFriendlyError(error: FirebaseErrorLike, context?: 'login' | 'register' | 'google' | 'generic'): string {
  return mapFirebaseError(error, context);
}

export default mapFirebaseError;
