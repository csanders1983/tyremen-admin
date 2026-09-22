import "../admin-pages.css";
import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const FUNCTIONS_ROOT = "https://us-central1-tyremen-system.cloudfunctions.net";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "staff" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => onSnapshot(collection(db, "users"), (snapshot) => setUsers(snapshot.docs.map((row) => ({ id: row.id, ...row.data() })))), []);

  const createUser = async (event) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`${FUNCTIONS_ROOT}/createAdminUser`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
      const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.error || "User could not be created");
      setMessage(`${form.name} can now log in.`); setForm({ name: "", email: "", password: "", role: "staff" });
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };

  return <section className="adminPage"><div className="adminHero"><span>SECURE ACCESS CONTROL</span><h2>Staff Users</h2><p>Create individual logins and control access by role. Never share one admin password.</p></div>{message && <div className="adminInfoBox">{message}</div>}
    <div className="pricingControlGrid"><form className="adminPanel pricingEditor" onSubmit={createUser}><h3>Add staff login</h3><label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label><label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label><label>Temporary password<input type="password" minLength="10" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label><label>Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="owner">Owner / Admin</option><option value="manager">Manager</option><option value="staff">Staff</option><option value="accounts">Accounts</option></select></label><button disabled={busy}>{busy ? "CREATING…" : "CREATE LOGIN"}</button></form>
      <div className="adminPanel"><h3>Current users</h3>{users.map((user) => <div className="blockedSlot" key={user.id}><div><strong>{user.name || user.email}</strong><small>{user.email} · {user.role}</small></div><label className="toggleField"><input type="checkbox" checked={user.active === true} onChange={(e) => updateDoc(doc(db, "users", user.id), { active: e.target.checked, updatedAt: new Date().toISOString() })} />Active</label></div>)}</div>
    </div>
  </section>;
}
