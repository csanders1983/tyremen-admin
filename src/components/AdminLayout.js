import { Outlet, NavLink } from "react-router-dom";

export default function AdminLayout() {
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
          <NavLink to="/orders">Jobs Board</NavLink>
          <NavLink to="/calendar">Calendar</NavLink>
          <NavLink to="/tyres">Tyre Stock</NavLink>
          <NavLink to="/services">Service Prices</NavLink>
          <NavLink to="/pages">Page Editor</NavLink>
          <NavLink to="/settings">Settings</NavLink>
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
            <div className="adminAvatar">N</div>
            <div>
              <strong>Nigel</strong>
              <small>Admin</small>
            </div>
          </div>
        </header>

        <Outlet />
      </main>
    </div>
  );
}