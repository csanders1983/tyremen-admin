import "../system-ui.css";
import { useEffect, useState } from "react";
import { Outlet, NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { ROLE_LABELS, useAuth } from "../auth/AuthContext";
import SystemIcon from "./SystemIcon";
const groups = [
  ["Workspace", [["/", "Overview", "dashboard", "home"], ["/calendar", "Booking diary", "calendar", "calendar"], ["/workshop", "Workshop live", "workshop", "workshop"], ["/orders", "Jobs & completion", "jobs", "jobs"]]],
  ["Sales & customers", [["/sales", "Sales & invoices", "sales", "sales"], ["/directory", "Customers & vehicles", "sales", "people"], ["/tyres", "Stock & services", "stock", "stock"]]],
  ["Management", [["/pricing-control", "Pricing & capacity", "pricing", "pricing"], ["/pages", "Website pages", "pages", "pages"], ["/very-cheap-tyres", "Very Cheap Tyres", "vct", "stock"], ["/users", "Staff access", "users", "people"], ["/settings", "Settings", "settings", "settings"]]],
];
export default function AdminLayout() {
  const { profile, role, can, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const current = groups.flatMap(([, items]) => items).find(([url]) => url === location.pathname);
  const title = current?.[1] || (location.pathname === "/legacy-import" ? "Import centre" : "Workspace");
  useEffect(() => { setMenuOpen(false); window.scrollTo(0, 0); }, [location.pathname]);
  useEffect(() => {
    const escape = (event) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  const submitSearch = (event) => { event.preventDefault(); if (search.trim().length >= 2) navigate(`/directory?q=${encodeURIComponent(search.trim())}`); };
  return <div className="adminShell systemShell">
    <div className="sysMobileBar"><Link to="/">TYREMEN <small>WORKSPACE</small></Link><button type="button" aria-expanded={menuOpen} aria-controls="system-sidebar" onClick={() => setMenuOpen(!menuOpen)}><SystemIcon name={menuOpen ? "close" : "menu"} />{menuOpen ? "Close" : "Menu"}</button></div>
    <aside id="system-sidebar" className={`adminSidebar ${menuOpen ? "sysNavOpen" : ""}`}>
      <Link className="sysBrand" to="/"><b>TYREMEN</b><span>WORKSPACE <i>HULL</i></span></Link>
      <nav className="adminNav" aria-label="Main navigation">{groups.map(([label, items]) => {
        const allowed = items.filter(([, , permission]) => can(permission));
        return allowed.length > 0 && <div className="sysNavGroup" key={label}><span>{label}</span>{allowed.map(([url, text, , icon]) => <NavLink end={url === "/"} to={url} key={url}><SystemIcon name={icon} /><span>{text}</span></NavLink>)}</div>;
      })}</nav>
      <div className="sysSidebarFooter"><b>Tyremen Ltd</b><span>Witty Street · Hull</span><small>{ROLE_LABELS[role] || role} access</small></div>
    </aside>
    <main className="adminMain" id="main-content">
      <header className="adminTopBar"><div className="sysPageIdentity"><span>TYREMEN / WORKSPACE</span><h1>{title}</h1></div>
        {can("sales") && <form className="sysSearch" role="search" onSubmit={submitSearch}><SystemIcon name="search" /><input aria-label="Search customers or vehicles" placeholder="Customer, registration or postcode" minLength="2" value={search} onChange={(event) => setSearch(event.target.value)} /><button type="submit" aria-label="Search directory"><SystemIcon name="arrow" size={17} /></button></form>}
        <div className="adminUser"><div className="adminAvatar">{String(profile?.name || "T").charAt(0).toUpperCase()}</div><div className="sysUserName"><strong>{profile?.name || "Tyremen staff"}</strong><small>{ROLE_LABELS[role] || role}</small></div><button className="adminSignOut" type="button" onClick={signOut}>Sign out</button></div>
      </header>
      <div className="sysQuickActions" aria-label="Quick actions"><span>TYREMEN LTD <i>·</i> HULL DEPOT</span><div>{can("calendar") && <Link to="/calendar#manual-booking"><SystemIcon name="calendar" size={16} /> Book a vehicle</Link>}{can("sales") && <Link to="/sales" state={{ openNewSale: true }}><SystemIcon name="plus" size={16} /> Create sale</Link>}{can("stock") && <Link to="/tyres"><SystemIcon name="search" size={16} /> Find stock</Link>}</div></div>
      <Outlet />
      <footer className="sysFooter">Tyremen workspace <span>Workshop · Sales · Customers · Stock</span></footer>
    </main>
  </div>;
}
