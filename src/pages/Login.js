import { useState } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { Navigate, useLocation } from "react-router-dom";
import { auth } from "../firebase";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const { user } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={location.state?.from?.pathname || "/"} replace />;

  const login = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      setMessage(`Login failed (${error?.code || "unknown"}). ${error?.code === "auth/invalid-credential" || error?.code === "auth/wrong-password" || error?.code === "auth/user-not-found" ? "Check your email and password or use Forgot password." : error?.code === "auth/unauthorized-domain" ? "This preview domain is not authorized in Firebase Authentication." : error?.code === "auth/operation-not-allowed" ? "Email/password sign-in is not enabled for this Firebase project." : "Please report this error code so we can fix the configuration."}`);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!email.trim()) return setMessage("Enter your email address first.");
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMessage("If this email has a Firebase account, a password reset message will be sent.");
    } catch (error) {
      setMessage(`Password reset failed (${error?.code || "unknown"}).`);
    }
  };

  return (
    <main className="loginPage">
      <form className="loginCard" onSubmit={login}>
        <div className="loginLogo">TYREMEN</div>
        <span>SECURE ADMIN SYSTEM</span>
        <h1>Staff login</h1>
        <label>Email address<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {message && <p className="loginMessage">{message}</p>}
        <button disabled={busy}>{busy ? "SIGNING IN…" : "SIGN IN"}</button>
        <button className="loginReset" type="button" onClick={reset}>Forgot password?</button>
      </form>
    </main>
  );
}
