import { Outlet, NavLink } from "react-router-dom";
import { ROLE_LABELS, useAuth } from "../auth/AuthContext";

export default function AdminLayout() {
  const { profile, role, can, signOut } = useAuth();
  return (
    <div className="adminShell">
      <aside className="adminSidebar">
        <div className="adminBrand">
          <div className="adminBrandIcon">T</div>

          <div>
            <h2>TYREMEN</h2>
            <p>PRO SYSTEM</p>
          </div>
        </div>

        <nav className="adminNav">
          <NavLink to="/">Dashboard</NavLink>
          {can("jobs") && <NavLink to="/orders">Jobs Board</NavLink>}
          {can("calendar") && <NavLink to="/calendar">Calendar</NavLink>}
          {can("sales") && <NavLink to="/sales">Sales &amp; Invoices</NavLink>}
          {can("stock") && <NavLink to="/tyres">Tyre Stock</NavLink>}
          {can("pricing") && <NavLink to="/pricing-control">Pricing &amp; Offers</NavLink>}
          {can("pages") && <NavLink to="/pages">Page Editor</NavLink>}
          {can("settings") && <NavLink to="/settings">Settings</NavLink>}
          {can("users") && <NavLink to="/users">Staff Users</NavLink>}
          {can("vct") && <NavLink className="vctNav" to="/very-cheap-tyres">Very Cheap Tyres</NavLink>}
        </nav>

        <div className="adminTodayBox">
          <span>TODAY</span>
          <strong>{new Date().toLocaleDateString()}</strong>

          <p>● Jobs booked</p>
          <p>● In progress</p>
          <p>● Completed</p>

          <h3>Tyremen Hull</h3>
          <small>More than just tyres</small>
        </div>
      </aside>

      <main className="adminMain">
        <header className="adminTopBar">
          <div>
            <h1>Workshop Dashboard</h1>
            <p>Live admin backend connected to Firebase</p>
          </div>

          <div className="adminSearch">
            <span>⌕</span>
            <input placeholder="Search jobs, customers, reg..." />
          </div>

          <div className="adminUser">
            <span className="adminLive">LIVE</span>
            <div className="adminAvatar">{String(profile?.name || "T").charAt(0).toUpperCase()}</div>
            <div>
              <strong>{profile?.name || "Tyremen staff"}</strong>
              <small>{ROLE_LABELS[role] || role}</small>
            </div>
            <button className="adminSignOut" type="button" onClick={signOut}>Sign out</button>
          </div>
        </header>

        <Outlet />
      </main>
    </div>
  );
}
