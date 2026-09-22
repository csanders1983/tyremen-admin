import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext(null);

export const ROLE_LABELS = {
  owner: "Owner / Admin",
  manager: "Manager",
  staff: "Staff",
  accounts: "Accounts",
};

export const ROLE_ACCESS = {
  owner: ["dashboard", "jobs", "calendar", "sales", "stock", "pricing", "services", "pages", "settings", "vct", "users"],
  manager: ["dashboard", "jobs", "calendar", "sales", "stock", "pricing", "services", "vct"],
  staff: ["dashboard", "jobs", "calendar", "sales", "stock"],
  accounts: ["dashboard", "sales"],
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stopProfile = () => {};
    const stopAuth = onAuthStateChanged(auth, (nextUser) => {
      stopProfile();
      setUser(nextUser);
      setProfile(null);
      if (!nextUser) {
        setLoading(false);
        return;
      }

      setLoading(true);
      stopProfile = onSnapshot(
        doc(db, "users", nextUser.uid),
        (snapshot) => {
          setProfile(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
          setLoading(false);
        },
        () => setLoading(false)
      );
    });

    return () => {
      stopProfile();
      stopAuth();
    };
  }, []);

  const value = useMemo(() => {
    const role = profile?.role || "staff";
    return {
      user,
      profile,
      role,
      loading,
      can: (permission) => (ROLE_ACCESS[role] || []).includes(permission),
      signOut: () => signOut(auth),
    };
  }, [user, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
