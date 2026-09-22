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
      setMessage("Login failed. Check your email and password.");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!email.trim()) return setMessage("Enter your email address first.");
    await sendPasswordResetEmail(auth, email.trim());
    setMessage("Password reset email sent.");
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
