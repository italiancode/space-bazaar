import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  getRedirectResult,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  signInWithRedirect,
} from "firebase/auth";
import { auth, db } from "../config/firebase";
import { doc, setDoc } from "firebase/firestore";
import { setCookie, deleteCookie } from "cookies-next";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";

interface CustomUser {
  uid: string;
  id: string;
  name: string;
  email: string;
  role: string;
  photoURL?: string;
}

interface AuthContextType {
  currentUser: CustomUser | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  isLoggingOut: boolean;
  isLoggingIn: boolean;
  user: CustomUser | null;
  loading: boolean;
  initiateAuth: (destination?: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CustomUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Listen to auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Transform Firebase user to your User type
        const transformedUser: CustomUser = {
          uid: user.uid,
          id: user.uid,
          name: user.displayName || 'Anonymous',
          email: user.email || '',
          role: 'user', // Set default role or fetch from your backend
        };
        setCurrentUser(transformedUser);
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const initiateAuth = useCallback((returnPath?: string) => {
    if (!loading && !currentUser) {
      const currentPath = returnPath || window.location.pathname;
      if (!currentPath.includes('/auth')) {
        router.push(`/auth?returnUrl=${encodeURIComponent(currentPath)}`);
      }
    }
  }, [currentUser, loading, router]);

  // Update user information in Firestore
  const updateUserInFirestore = async (user: CustomUser) => {
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          email: user.email,
          name: user.name,
          photoURL: user.photoURL,
          lastLogin: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Error updating user in Firestore:", error);
    }
  };

  const signInWithGoogle = async (): Promise<void> => {
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user: CustomUser = {
        uid: result.user.uid,
        id: result.user.uid,
        name: result.user.displayName || "",
        email: result.user.email || "",
        role: "user",
        photoURL: result.user.photoURL || undefined,
      };
      await updateUserInFirestore(user);
      setCookie('user', JSON.stringify(user));
      
      // Get return URL from query parameters
      const searchParams = new URLSearchParams(window.location.search);
      const returnUrl = searchParams.get('returnUrl') || '/';
      
      router.push(returnUrl);
    } catch (error) {
      console.error("Error signing in:", (error as FirebaseError).message);
      if ((error as FirebaseError).code === "auth/popup-blocked") {
        try {
          await signInWithRedirect(auth, provider);
        } catch (redirectError) {
          console.error("Redirect error:", redirectError);
        }
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle redirect result after OAuth login
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          const user: CustomUser = {
            uid: result.user.uid,
            id: result.user.uid,
            name: result.user.displayName || "",
            email: result.user.email || "",
            role: "user",
            photoURL: result.user.photoURL || undefined,
          };
          await updateUserInFirestore(user);
        } else {
          initiateAuth();
        }
      } catch (error) {
        console.error("Error handling redirect result:", error);
      }
    };

    handleRedirectResult();
  }, [initiateAuth]);

  // Logout function
  const logout = async () => {
    try {
      await signOut(auth);
      deleteCookie('user');
      router.push('/');
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const value = {
    currentUser,
    signInWithGoogle,
    initiateAuth,
    logout,
    isLoggingOut: false,
    isLoggingIn,
    user: currentUser,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
