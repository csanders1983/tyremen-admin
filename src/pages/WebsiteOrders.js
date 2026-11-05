import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { websitePost } from "../components/websiteOperationsApi";
import "./WebsiteOrders.css";
const stages = ["New", "Being arranged", "Arranged"];
const cash = (v) => `£${Number(v || 0).toFixed(2)}`;
const label = (item) => item.description || item.name || [item.size, item.loadIndex && `${item.loadIndex}${item.speedRating || ""}`, item.brand, item.pattern].filter(Boolean).join(" ") || item.service || "Order item";
const draftFor = (job) => ({ stage: job.websiteOrder?.stage || "New", assignedTo: job.websiteOrder?.assignedTo || "", notes: job.websiteOrder?.notes || "", date: job.date || "", time: job.time || "", notifyCustomer: false });
export default function WebsiteOrders() {
  const { can } = useAuth();
  const [rows, setRows] = useState([]), [cursor, setCursor] = useState(null), [more, setMore] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [search, setSearch] = useState(""), [filter, setFilter] = useState("Pending"), [team, setTeam] = useState([]), [job, setJob] = useState(null), [draft, setDraft] = useState(null), [saving, setSaving] = useState(false), [message, setMessage] = useState("");
  const generation = useRef(0), mounted = useRef(true), selection = useRef(0), loadingPage = useRef(false);
  const load = useCallback(async (append = false, next = null, quiet = false) => {
    if (loadingPage.current && (quiet || append)) return;
    loadingPage.current = true; const version = ++generation.current;
    if (!quiet) setBusy(true);
    try { const data = await websitePost("getWebsiteOrdersV2", { cursor: append ? next : null }); if (mounted.current && version === generation.current) { setRows((old) => append ? [...old, ...data.jobs.filter((row) => !old.some((r) => r.id === row.id))] : data.jobs); setCursor(data.cursor); setMore(data.hasMore); setError(""); } }
    catch (e) { if (mounted.current) setError(e.message); }
    finally { if (version === generation.current) { loadingPage.current = false; if (mounted.current) setBusy(false); } }
  }, []);
  useEffect(() => { mounted.current = true; load(); websitePost("getWebsiteOrderTeamV2").then((data) => { if (mounted.current) setTeam(data.team); }).catch((e) => { if (mounted.current) setError(e.message); }); return () => { mounted.current = false; generation.current += 1; selection.current += 1; }; }, [load]);
  // Refresh the first page only; never replace an unsaved detail form.
  useEffect(() => { const timer = window.setInterval(() => { if (document.visibilityState === "visible" && rows.length <= 50) load(false, null, true); }, 30000); return () => window.clearInterval(timer); }, [load, rows.length]);
  const dirty = job && draft && JSON.stringify(draft) !== JSON.stringify(draftFor(job));
  useEffect(() => { const guard = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } }; window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard); }, [dirty]);
  const open = async (id) => {
    if (dirty && !window.confirm("Discard unsaved changes to this order?")) return;
    const version = ++selection.current; setSaving(true); setMessage("");
    try { const data = await websitePost("getWebsiteOrderV2", { jobId: id }); if (mounted.current && selection.current === version) { setJob(data.job); setDraft(draftFor(data.job)); } }
    catch (e) { if (mounted.current) setMessage(e.message); }
    finally { if (mounted.current && selection.current === version) setSaving(false); }
  };
  const save = async () => {
    setSaving(true); setMessage("");
    try {
      const changed = draft.date !== job.date || draft.time !== job.time;
      const data = await websitePost("updateWebsiteOrderV2", { jobId: job.id, revision: job.websiteOrder?.revision || 0, stage: draft.stage, assignedTo: draft.assignedTo, notes: draft.notes, ...(changed ? { scheduleChange: { date: draft.date, time: draft.time }, notifyCustomer: draft.notifyCustomer } : {}) });
      if (mounted.current) { setJob(data.job); setDraft(draftFor(data.job)); setRows((old) => old.map((r) => r.id === data.job.id ? data.job : r)); setMessage("Saved. The existing workshop job remains linked."); }
    } catch (e) { if (mounted.current) setMessage(e.message); }
    finally { if (mounted.current) setSaving(false); }
  };
  const change = (key, value) => setDraft((old) => ({ ...old, [key]: value }));
  const shown = rows.filter((r) => { const stage = r.websiteOrder?.stage || "New"; return (filter === "All" || (filter === "Pending" ? stage !== "Arranged" : stage === filter)) && [r.id, r.registration, r.name, r.email, r.phone, r.service].join(" ").toLowerCase().includes(search.toLowerCase()); });
  const scheduleChanged = job && draft && (draft.date !== job.date || draft.time !== job.time);
  const technical = job?.vehicle?.tyreTechnical || job?.vehicle?.activeTyreFitment || {};
  const pressure = (axle) => technical[axle]?.pressure?.psi || technical[axle]?.pressure?.tyrePressure?.psi || technical[axle]?.tyre?.pressure?.tyrePressure?.psi;
  const torque = technical.torqueNm || technical.fixing?.torqueNm;
  return <section className="websiteOrders">
    <header className="woHero"><span>ECOMMERCE / INCOMING BOOKINGS</span><h2>Website orders</h2><p>Arrange incoming website orders here. Each record is the same job used by the diary, tyre bay and mechanics—not a duplicate or an approval gate.</p></header>
    <div className="woStats">{stages.map((s) => <div key={s}><span>{s}</span><strong>{rows.filter((r) => (r.websiteOrder?.stage || "New") === s).length}</strong></div>)}</div>
    <p className="woHint">Counts and search cover loaded records. Orders refresh every 30 seconds on the first page; use Load more for older orders.</p>
    <div className="woToolbar"><input aria-label="Search loaded website orders" placeholder="Registration, customer, phone or reference" value={search} onChange={(e) => setSearch(e.target.value)} /><select aria-label="Arrangement status" value={filter} onChange={(e) => setFilter(e.target.value)}>{["Pending", "All", ...stages].map((s) => <option key={s}>{s}</option>)}</select><button type="button" disabled={busy} onClick={() => load()}>Refresh latest</button></div>
    {error && <p className="woNotice" role="alert">{error}</p>}
    <div className="woLayout"><section className="woList" aria-label="Website orders">
      {shown.map((row) => <button type="button" key={row.id} disabled={saving} onClick={() => open(row.id)} className={job?.id === row.id ? "woOrder active" : "woOrder"}><div><strong>{row.registration || "No registration"}</strong><span className="woStage">{row.websiteOrder?.stage || "New"}</span></div><b>{row.name || "Customer"}</b><p>{row.service || "Workshop order"}</p><div><span>{row.date} · {row.time}</span><strong>{cash(row.total ?? row.price)}</strong></div><small>{row.websiteOrder?.assignedName || "Unassigned"} · Workshop: {row.status || "New"}</small></button>)}
      {!shown.length && !busy && <p className="woEmpty">No matching website orders in the loaded records.</p>}{busy && <p role="status">Loading orders…</p>}{more && <button type="button" disabled={busy} onClick={() => load(true, cursor)}>Load more orders</button>}
    </section>
    <section className="woDetail" aria-label="Selected order">
      {!job || !draft ? <div className="woEmpty"><h3>Select a website order</h3><p>Customer details, products and arrangement controls will appear here.</p></div> : <>
      <header className="woDetailHead"><div><span>BOOKING {job.id}</span><h3>{job.registration}</h3><p>{job.name}</p></div><strong>{cash(job.total ?? job.price)}</strong></header>
      <div className="woContact"><a href={`tel:${String(job.phone || "").replace(/[^+0-9]/g, "")}`}>{job.phone || "No phone"}</a><a href={`mailto:${job.email || ""}`}>{job.email || "No email"}</a></div>
      <p className="woHint">Workshop status: <strong>{job.status || "New"}</strong> · Arrival: {job.arrivalTime || job.time || "To arrange"}</p>
      {job.vehicle && <p>{[job.vehicle.make, job.vehicle.model, job.vehicle.year, job.vehicle.fuelType].filter(Boolean).join(" · ")}</p>}
      {(pressure("front") || pressure("rear") || torque) && <div className="woTechnical"><span>Front <b>{pressure("front") ? `${pressure("front")} psi` : "Not supplied"}</b></span><span>Rear <b>{pressure("rear") ? `${pressure("rear")} psi` : "Not supplied"}</b></span><span>Wheel torque <b>{torque ? `${torque} Nm` : "Not supplied"}</b></span></div>}
      <div className="woItems">{(job.items?.length ? job.items : job.tyres || []).map((item, i) => <article key={item.id || i}><strong>{Number(item.qty || item.quantity || 1)} × {label(item)}</strong><p>{[item.homologation, item.runflat ? "Run flat" : "", item.extraLoad ? "XL" : "", ...(Array.isArray(item.technologyMarkings) ? item.technologyMarkings : []).map((v) => typeof v === "string" ? v : v?.label || v?.code)].filter(Boolean).join(" · ")}</p><small>{[item.fuel && `Fuel ${item.fuel}`, item.wet && `Wet ${item.wet}`, item.noise && `Noise ${item.noise} dB`, item.stockSource, item.stockNumber && `Stock ${item.stockNumber}`].filter(Boolean).join(" · ")}</small><span>{cash(item.basePrice ?? item.price)} each</span></article>)}</div>
      {Number(job.discount) > 0 && <p className="woSaving">Savings {cash(job.discount)} · {job.appliedOffer?.label || "Offers applied"}{job.promoCode ? ` · Code ${job.promoCode}` : ""}</p>}
      {job.notes && <details><summary>Original booking / office notes</summary><p className="woPreWrap">{job.notes}</p></details>}
      <fieldset disabled={saving} className="woForm"><legend>Arrange this order</legend><div className="woFields"><label>Incoming order status<select value={draft.stage} onChange={(e) => change("stage", e.target.value)}>{stages.map((s) => <option key={s}>{s}</option>)}</select></label><label>Assigned to<select value={draft.assignedTo} onChange={(e) => change("assignedTo", e.target.value)}><option value="">Unassigned</option>{team.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label></div><label>Internal arrangement notes<textarea rows={4} maxLength={5000} value={draft.notes} onChange={(e) => change("notes", e.target.value)} placeholder="Stock ordered, customer contacted, collection or fitting arrangements…" /></label>
      <details className="woSchedule"><summary>Rearrange booking date / time</summary><p className="woHint">Only unaccepted bookings can be moved here. Capacity is checked on save. Started or accepted workshop jobs must be rearranged through the office.</p><div className="woFields"><label>Booking date<input type="date" value={draft.date} onChange={(e) => change("date", e.target.value)} /></label><label>Time<select value={draft.time} onChange={(e) => change("time", e.target.value)}>{["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"].map((t) => <option key={t}>{t}</option>)}</select></label></div>{scheduleChanged && <label className="woCheck"><input type="checkbox" checked={draft.notifyCustomer} onChange={(e) => change("notifyCustomer", e.target.checked)} />Queue a booking-update email to {job.email || "customer"}</label>}</details>
      <div className="woActions"><button type="button" disabled={!dirty || saving} onClick={save}>{saving ? "Saving…" : "Save arrangements"}</button><button type="button" disabled={saving} onClick={() => open(job.id)}>Reload order</button>{can("jobs") && <Link to={`/orders?job=${encodeURIComponent(job.id)}`}>Open linked workshop job →</Link>}</div></fieldset>
      </>}{message && <p className="woNotice" role="status">{message}</p>}
    </section></div>
  </section>;
}
