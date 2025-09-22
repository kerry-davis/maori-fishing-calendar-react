import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "../services/firebase";
import type { AuthContextType, User } from "../types";

// Create the auth context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider component
interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Convert Firebase user to our User type
  const convertFirebaseUser = useCallback((firebaseUser: FirebaseUser | null): User | null => {
    if (!firebaseUser) return null;

    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      emailVerified: firebaseUser.emailVerified,
    };
  }, []);

  // Login with email and password
  const login = useCallback(async (email: string, password: string) => {
    try {
      setError(null);
      await signInWithEmailAndPassword(auth, email, password);
      setSuccessMessage("Successfully logged in!");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Login failed";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  // Login with Google
  const loginWithGoogle = useCallback(async () => {
    try {
      setError(null);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setSuccessMessage("Successfully logged in with Google!");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Google login failed";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    try {
      setError(null);
      await signOut(auth);
      setSuccessMessage("Successfully logged out!");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Logout failed";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  // Clear success message
  const clearSuccessMessage = useCallback(() => {
    setSuccessMessage(null);
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(convertFirebaseUser(firebaseUser));
      setLoading(false);
    });

    return unsubscribe;
  }, [convertFirebaseUser]);

  const contextValue: AuthContextType = {
    user,
    loading,
    error,
    successMessage,
    login,
    loginWithGoogle,
    logout,
    clearSuccessMessage,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

// Export the context for testing purposes
export { AuthContext };