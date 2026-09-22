import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function RequireAuth({ permission, children }) {
  const { user, profile, loading, can } = useAuth();
  const location = useLocation();

  if (loading) return <div className="authLoading">Opening Tyremen Admin…</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!profile?.active) return <div className="authBlocked"><h1>Access not active</h1><p>Ask an owner or manager to activate this account.</p></div>;
  if (permission && !can(permission)) return <div className="authBlocked"><h1>Restricted area</h1><p>Your login does not have permission to open this section.</p></div>;
  return children;
}
