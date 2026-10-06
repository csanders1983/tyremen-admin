import "./Dashboard.css";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import { londonDate } from "../lib/workshopTime";
import SystemIcon from "../components/SystemIcon";
const stateOf = (job) => String(job.status || "New").toLowerCase().replace(/\s/g, "");
const done = (job) => ["done", "complete", "completed", "readytocollect"].includes(stateOf(job));
const working = (job) => ["working", "inprogress"].includes(stateOf(job));
export default function Dashboard() {
  const { can } = useAuth();
  const [date, setDate] = useState(londonDate);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    setLoading(true); setError(""); setJobs([]);
    return onSnapshot(query(collection(db, "jobs"), where("date", "==", date)), (snapshot) => {
      setJobs(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })).filter((job) => !["cancelled", "canceled", "deleted"].includes(stateOf(job)))); setLoading(false);
    }, () => { setError("Could not load bookings. Check your connection or access."); setLoading(false); });
  }, [date]);
  const rows = useMemo(() => jobs.filter((job) => [job.registration, job.name, job.service, job.technician].join(" ").toLowerCase().includes(search.trim().toLowerCase())).sort((a,b) => String(a.time || "99:99").localeCompare(String(b.time || "99:99"))), [jobs, search]);
  const services = Object.entries(jobs.reduce((result,job) => { const name = job.service || job.type || "Other work"; result[name] = (result[name] || 0) + 1; return result; }, {})).sort((a,b) => b[1]-a[1]);
  const total = jobs.reduce((sum,job) => sum + (Number(job.total ?? job.price) || 0),0);
  const waiting = jobs.filter((job) => !done(job) && !working(job));
  const metrics = [["Bookings",jobs.length,"For the selected day"],["Awaiting work",waiting.length,"Booked / accepted"],["In progress",jobs.filter(working).length,"Work under way"],["Work complete",jobs.filter(done).length,"Finished / ready to collect"]];
  return <section className="sysOverview">
    <div className="sysOverviewHeading"><div><span className="sysEyebrow">DAILY OPERATIONS</span><h2>Your day, at a glance.</h2><p>Bookings, workshop progress and the next action.</p></div><div className="sysDateControl"><button type="button" onClick={() => setDate(londonDate())}>Today</button><input type="date" aria-label="Overview date" value={date} onChange={(event) => setDate(event.target.value || londonDate())} /></div></div>
    {error && <div className="adminInfoBox" role="alert">{error}</div>}
    <div className="sysMetricGrid">{metrics.map(([label,value,caption],index) => <div className="sysMetric" key={label}><span>{label}<SystemIcon name={index === 0 ? "calendar" : "jobs"} size={17} /></span><b>{loading || error ? "—" : value}</b><small>{caption}</small></div>)}</div>
    <div className="sysOverviewGrid"><div className="sysPanel"><div className="sysPanelHeading"><div><h3>Booking activity</h3><span>{date} · {jobs.length} bookings</span></div>{can("calendar") && <Link to="/calendar">Open diary <SystemIcon name="arrow" size={16} /></Link>}</div><div className="sysTableTools"><div><SystemIcon name="search" size={17} /><input aria-label="Filter selected-day bookings" placeholder="Filter registration, customer or technician…" value={search} onChange={(event) => setSearch(event.target.value)} /></div><span>{rows.length} results</span></div><div className="sysTableScroll"><table className="sysActivityTable"><thead><tr><th>Time</th><th>Vehicle / customer</th><th>Work</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.map((job) => <tr key={job.id}><td className="sysTime">{job.time || "—"}</td><td><b className="sysPlate">{job.registration || "NO REG"}</b><small>{job.name || "Customer not recorded"}</small></td><td><strong>{job.service || job.type || "Workshop work"}</strong><small>{job.technician || "Technician unassigned"}</small></td><td><span className={`sysStatus ${done(job) ? "complete" : working(job) ? "working" : "waiting"}`}>{job.status || "New"}</span></td><td>{can("jobs") ? <Link className="sysRowLink" to={`/orders?job=${encodeURIComponent(job.id)}`}>Open <SystemIcon name="arrow" size={15} /></Link> : <span>View only</span>}</td></tr>)}</tbody></table></div>{!rows.length && <div className="sysEmpty">{loading ? "Loading bookings…" : error ? "Booking data unavailable." : search ? "No bookings match your search." : "No bookings for this date."}</div>}</div>
      <aside className="sysOverviewAside"><div className="sysPanel sysDayValue"><span className="sysEyebrow">BOOKED VALUE</span><b>{loading || error ? "—" : `£${total.toLocaleString("en-GB",{minimumFractionDigits:2,maximumFractionDigits:2})}`}</b><p>Value of these bookings. Final invoices and payments are in Sales.</p>{can("sales") && <Link to="/sales">Open sales <SystemIcon name="arrow" size={16} /></Link>}</div><div className="sysPanel"><div className="sysPanelHeading"><h3>Work mix</h3><span>{services.length} types</span></div>{services.slice(0,6).map(([service,count]) => <div className="sysServiceMix" key={service}><span>{service}<b>{count}</b></span><i><em style={{width:`${count / Math.max(jobs.length,1) * 100}%`}} /></i></div>)}{!services.length && <p className="sysMuted">{loading ? "Loading work mix…" : "No work booked."}</p>}</div><div className="sysPanel sysNextAction"><h3>Keep the day moving</h3>{can("workshop") && <Link to="/workshop"><SystemIcon name="workshop" /><span>Workshop live<small>Plans, progress & alerts</small></span><SystemIcon name="arrow" size={16} /></Link>}{can("sales") && <Link to="/sales"><SystemIcon name="sales" /><span>Create a sale<small>Quote, order or VAT invoice</small></span><SystemIcon name="arrow" size={16} /></Link>}{can("stock") && <Link to="/tyres"><SystemIcon name="stock" /><span>Find stock<small>Tyremen & partner stock</small></span><SystemIcon name="arrow" size={16} /></Link>}</div></aside>
    </div>
  </section>;
}
