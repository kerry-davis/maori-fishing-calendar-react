import React, { useState } from 'react';
import { useAuth } from '@app/providers/AuthContext';
import { DEV_LOG, PROD_ERROR } from '@shared/utils/loggingHelpers';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMobileMenuClose?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onMobileMenuClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, register, signInWithGoogle, user, isFirebaseConfigured } = useAuth();

  // Close modal when user becomes authenticated
  React.useEffect(() => {
    if (user && isOpen) {
      onClose();
      // Close mobile menu if function provided
      if (onMobileMenuClose) {
        onMobileMenuClose();
      }
      // Reset form state
      setEmail('');
      setPassword('');
      setError('');
      setLoading(false);
    }
  }, [user, isOpen, onClose, onMobileMenuClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await register(email, password);
      } else {
        await login(email, password);
      }
      onClose();
      // Close mobile menu after successful login
      if (onMobileMenuClose) {
        onMobileMenuClose();
      }
    } catch (err) {
      const friendly = err instanceof Error ? err.message : 'An unexpected error occurred.';
      // Provide offline-specific guidance
      if (!navigator.onLine) {
        setError('You appear to be offline. Connect to the internet and try again.');
      } else {
        setError(friendly);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    DEV_LOG('Google sign-in button clicked');
    DEV_LOG('isFirebaseConfigured:', isFirebaseConfigured);

    setError('');
    setLoading(true);

    try {
      DEV_LOG('Attempting Google sign-in...');
      await signInWithGoogle();
      DEV_LOG('Google sign-in successful');
      onClose(); // Close modal on successful Google sign-in
      // Close mobile menu after successful Google sign-in
      if (onMobileMenuClose) {
        onMobileMenuClose();
      }
    } catch (err) {
      PROD_ERROR('Google sign-in error:', err);
      const friendly = err instanceof Error ? err.message : 'Google sign-in failed';
      if (!navigator.onLine) {
        setError('You appear to be offline. Connect to the internet and try again.');
      } else {
        setError(friendly);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-2 sm:p-4"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        minHeight: '100dvh' // Use dynamic viewport height for mobile
      }}
    >
      <div
        className="rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] overflow-y-auto shadow-xl"
        style={{
          backgroundColor: 'var(--card-background)',
          border: '1px solid var(--card-border)',
          color: 'var(--primary-text)',
          maxHeight: 'calc(100dvh - 2rem)' // Also use dynamic viewport height for the modal
        }}
      >
        <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--primary-text)' }}>
          {isRegister ? 'Create Account' : 'Sign In'}
        </h2>

        {error && (
          <div
            className="px-4 py-3 rounded mb-4"
            style={{
              backgroundColor: 'var(--error-background)',
              border: '1px solid var(--error-border)',
              color: 'var(--error-text)'
            }}
          >
            {error}
          </div>
        )}

        {/* Google Sign-In Button */}
        <div className="mb-6">
          {!isFirebaseConfigured ? (
            <div
              className="w-full py-2 px-4 rounded-md flex items-center justify-center gap-2"
              style={{
                backgroundColor: 'var(--secondary-background)',
                border: '1px solid var(--border-color)',
                color: 'var(--secondary-text)'
              }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="text-sm">Configure Firebase to enable Google Sign-In</span>
            </div>
          ) : (
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="google-signin-button w-full py-2 px-4 rounded-md flex items-center justify-center gap-3 transition-all"
            >
              <svg className="w-5 h-5" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
                <path fill="#4285F4" d="M17.64 9.2045c0-.638-.0573-1.25-.1636-1.836H9v3.472h4.844c-.2085 1.124-.8424 2.077-1.7932 2.716v2.258h2.902c1.6995-1.565 2.6872-3.874 2.6872-6.61z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.806 5.96-2.185l-2.902-2.258c-.806.54-1.837.857-3.058.857-2.352 0-4.342-1.588-5.055-3.72H.96v2.332C2.445 15.982 5.481 18 9 18z" />
                <path fill="#FBBC05" d="M3.945 10.694c-.18-.54-.282-1.115-.282-1.694s.102-1.154.282-1.694V4.974H.96C.348 6.195 0 7.563 0 9s.348 2.805.96 4.026l2.985-2.332z" />
                <path fill="#EA4335" d="M9 3.542c1.32 0 2.51.454 3.442 1.346l2.582-2.582C13.465.912 11.43 0 9 0 5.481 0 2.445 2.018.96 4.974l2.985 2.332C4.658 5.174 6.648 3.542 9 3.542z" />
              </svg>
              Continue with Google
            </button>
          )}
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div
              className="w-full"
              style={{
                borderTop: '1px solid var(--border-color)'
              }}
            ></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span
              className="px-2"
              style={{
                backgroundColor: 'var(--primary-background)',
                color: 'var(--secondary-text)'
              }}
            >
              Or continue with email
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              className="block text-sm font-bold mb-2"
              style={{ color: 'var(--primary-text)' }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                backgroundColor: 'var(--input-background)',
                border: '1px solid var(--input-border)',
                color: 'var(--primary-text)'
              }}
              required
            />
          </div>

          <div className="mb-6">
            <label
              className="block text-sm font-bold mb-2"
              style={{ color: 'var(--primary-text)' }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                backgroundColor: 'var(--input-background)',
                border: '1px solid var(--input-border)',
                color: 'var(--primary-text)'
              }}
              required
            />
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 px-4 rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              style={{
                backgroundColor: 'var(--button-primary)',
                color: 'white'
              }}
            >
              {loading ? 'Loading...' : (isRegister ? 'Create Account' : 'Sign In')}
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                // Close mobile menu when user cancels login
                if (onMobileMenuClose) {
                  onMobileMenuClose();
                }
              }}
              className="flex-1 py-2 px-4 rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-gray-500"
              style={{
                backgroundColor: 'var(--button-secondary)',
                color: 'white'
              }}
            >
              Cancel
            </button>
          </div>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setIsRegister(!isRegister)}
            className="text-sm hover:opacity-80"
            style={{ color: 'var(--accent-color)' }}
          >
            {isRegister ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
          </button>
        </div>
      </div>
    </div>
  );
};