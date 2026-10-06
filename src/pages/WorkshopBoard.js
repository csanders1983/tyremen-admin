import '../workspace-consistency.css';
import "../workshop-board.css";
import "../tyre-foreman.css";
import TechnicianPicker from "../components/TechnicianPicker";
import JobVehicleDetails from "../components/JobVehicleDetails";
import WorkshopHistory from "../components/WorkshopHistory";
import WorkshopBookingEdit from "../components/WorkshopBookingEdit";
import WorkshopDurationDefaults from "../components/WorkshopDurationDefaults";
import WorkshopNotifications from "../components/WorkshopNotifications";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { auth } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import { jobTiming, londonDate, londonTime, shiftDate } from "../lib/workshopTime";

const ROOT = "https://us-central1-tyremen-system.cloudfunctions.net";
async function post(path, body, signal) {
  const token = await auth.currentUser.getIdToken();
  const response = await fetch(`${ROOT}/${path}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body), signal });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.error || "Workshop request failed");
  return result;
}
export default function WorkshopBoard({ screen = false }) {
  const { role, signOut } = useAuth();
  const [now, setNow] = useState(Date.now());
  const today = londonDate(new Date(now));
  const [date, setDate] = useState(londonDate);
  const [followToday, setFollowToday] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [lastUpdate, setLastUpdate] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [bookingEditor, setBookingEditor] = useState(null);
  const [editor, setEditor] = useState(null);
  const [stageEditor,setStageEditor]=useState(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [view, setView] = useState("board");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (followToday) setDate(today); }, [today, followToday]);
  useEffect(() => { setEditor(null); setBookingEditor(null); setMessage(""); setPage(0); }, [date]);
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    setLoading(true); setJobs([]); setLastUpdate("");
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const result = await post("getWorkshopBoard", { date }, controller.signal);
        if (!controller.signal.aborted) { setJobs((result.jobs||[]).filter(job=>job.workshopArea!=="tyres"&&(job.currentArea===undefined||job.currentArea==="service"||job.stageComplete))); setLastUpdate(result.fetchedAt); setError(""); }
      } catch (err) { if (!controller.signal.aborted) setError(err.message); }
      finally { pending = false; if (!controller.signal.aborted) setLoading(false); }
    };
    load();
    const timer = window.setInterval(load, 30000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [date, refresh]);
  const rows = useMemo(() => jobs.map((job) => ({ ...job, timing: jobTiming(job, now) })).sort((a, b) => (a.plan.startTime || a.time).localeCompare(b.plan.startTime || b.time)), [jobs, now]);
  const warnings = rows.filter((job) => ["checkpoint", "due", "overdue"].includes(job.timing.state));
  const editableJobs = rows.filter((job) => job.timing.state !== "complete");
  const visible = (showCompleted ? rows : editableJobs).filter((job) => screen || [job.registration, job.service, job.technician, job.plan.bay].join(" ").toLowerCase().includes(filter.toLowerCase()));
  const [screenPageSize,setScreenPageSize]=useState(()=>window.innerWidth<=600?1:window.innerWidth<=1000?2:3);
  useEffect(()=>{const resize=()=>setScreenPageSize(window.innerWidth<=600?1:window.innerWidth<=1000?2:3);window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
  const pageCount = Math.max(1, Math.ceil(visible.length / screenPageSize));
  useEffect(() => {
    if (!screen || pageCount < 2) return;
    const timer = window.setInterval(() => setPage((value) => (value + 1) % pageCount), 15000);
    return () => window.clearInterval(timer);
  }, [screen, pageCount]);
  const displayed = screen ? visible.slice((page % pageCount) * screenPageSize, (page % pageCount) * screenPageSize + screenPageSize) : visible;
  const chooseJob = (id) => {
    const job = rows.find((item) => item.id === id);
    setEditor(job ? { jobId: id, startTime: job.plan.startTime || job.time || "09:00", durationMinutes: job.plan.durationMinutes || 60, bay: job.plan.bay || "", technician: job.technician || "", technicians: job.technicians || (job.technician ? [job.technician] : []) } : null);
  };
  const save = async (event) => {
    event.preventDefault(); setSaving(true); setMessage("");
    try { await post("saveWorkshopPlan", { jobId: editor.jobId, plan: editor }); setMessage("Workshop plan saved and audited."); setRefresh((value) => value + 1); }
    catch (err) { setMessage(err.message); }
    finally { setSaving(false); }
  };
  const saveStage=async event=>{
    event.preventDefault();setSaving(true);setMessage("");
    try{const result=await post("updateWorkshopStage",{jobId:stageEditor.job.id,revision:stageEditor.job.stageRevision||0,action:stageEditor.job.stageStatus==="In bay"?"finish":"start",technicians:stageEditor.technicians,finishedTime:stageEditor.finishedTime});setStageEditor(null);setRefresh(v=>v+1);setMessage(result.nextStop==="tyres"?"Mechanical work started · next stop Tyre bay live":result.currentArea==="tyres"?"Mechanical work complete. Vehicle sent to Tyre bay live.":result.allWorkFinished?"All bay work finished. Ready for office invoice.":"Mechanical work started.");}
    catch(e){setMessage(e.message);}finally{setSaving(false);}
  };
  return <section className={`workshopBoard ${screen ? "workshopScreen" : ""}`}>
    <header className="wbHeader"><div><span>TYREMEN · WORKSHOP LIVE</span><h1>Workshop live</h1></div><div className="wbClock">{londonTime(now)}<small>{date}</small></div></header>
    {(screen || view !== "history") && <><div className="wbControls"><button type="button" onClick={() => { setFollowToday(true); setDate(today); }}>Today</button><button type="button" onClick={() => { setFollowToday(false); setDate(shiftDate(date, -1)); }}>Previous day</button><input aria-label="Board date" type="date" value={date} onChange={(event) => { setFollowToday(false); setDate(event.target.value || today); }} /><button type="button" onClick={() => { setFollowToday(false); setDate(shiftDate(date, 1)); }}>Next day</button>{screen && <button type="button" aria-pressed={showCompleted} onClick={() => { setShowCompleted((value) => !value); setPage(0); }}>{showCompleted ? "Hide completed" : "Show completed"}</button>}{screen && pageCount > 1 && <button type="button" onClick={() => setPage((value) => (value + 1) % pageCount)}>Page {(page % pageCount) + 1} / {pageCount} · auto</button>}{!screen && <Link to="/workshop-screen" target="_blank" rel="noreferrer">Open TV view</Link>}{screen && <button type="button" onClick={() => document.documentElement.requestFullscreen?.().catch(() => setMessage("Use the browser full-screen key if full screen is unavailable."))}>Full screen</button>}{screen && role !== "service-manager" && <Link to="/workshop">Admin view</Link>}{screen && <button type="button" onClick={signOut}>Sign out</button>}</div>
    <div className={`wbConnection ${error ? "stale" : ""}`}>{error ? `Connection issue · ${error}` : loading ? "Loading workshop…" : "Connected · updates every 30 seconds"}{lastUpdate && <span>Last update {londonTime(Date.parse(lastUpdate))}</span>}</div>
    {message && <div className="wbNotice" role="status">{message}</div>}
    <div className="wbStats"><div><span>Jobs</span><b>{rows.length}</b></div><div><span>Work complete</span><b>{rows.filter((job) => job.timing.state === "complete").length}</b></div><div><span>Check progress</span><b>{warnings.length}</b></div><div><span>Duration needed</span><b>{rows.filter((job) => job.timing.state === "unplanned").length}</b></div></div>
    {!!warnings.length && <div className="wbAlerts" role="status">{warnings.map((job) => <span key={job.id}><b>{job.registration}</b> · {job.timing.label} · {job.technician || "Unassigned"}</span>)}</div>}
    </>}
    {!screen && <div className="wbWorkspaceTabs" aria-label="Workshop views"><button type="button" aria-pressed={view === "board"} onClick={() => setView("board")}>Live jobs <span>{editableJobs.length}</span></button><button type="button" aria-pressed={view === "history"} onClick={() => {setView("history");setBookingEditor(null);}}>Completed history</button>{role === "owner" && <><button type="button" aria-pressed={view === "planning"} onClick={() => setView("planning")}>Job planning</button><button type="button" aria-pressed={view === "defaults"} onClick={() => setView("defaults")}>Duration defaults</button><button type="button" aria-pressed={view === "alerts"} onClick={() => setView("alerts")}>Email & text settings</button></>}</div>}
    {stageEditor&&<form className="wbEditor" onSubmit={saveStage}><h2>{stageEditor.job.registration} · {stageEditor.job.stageStatus==='In bay'?'Complete mechanical work':'Start mechanical work'}</h2><TechnicianPicker value={stageEditor.technicians} onChange={technicians=>setStageEditor({...stageEditor,technicians})}/>{stageEditor.job.stageStatus==='In bay'&&<label>Actual finished time<input aria-label="Actual mechanical finish time" type="time" required value={stageEditor.finishedTime} onChange={e=>setStageEditor({...stageEditor,finishedTime:e.target.value})}/></label>}<div className="tfActions"><button disabled={saving}>{saving?'Saving…':stageEditor.job.stageStatus==='In bay'?'Complete & hand over':'Start work'}</button><button type="button" onClick={()=>setStageEditor(null)}>Cancel</button></div><p>{stageEditor.job.nextStop==='tyres'?'Next stop: Tyre bay live':'Office completes the full job invoice after bay work is finished.'}</p></form>}
    {!screen && view === "history" && <WorkshopHistory area="service" />}
    {!screen && view === "defaults" && role === "owner" && <WorkshopDurationDefaults date={date} onApplied={() => setRefresh(v => v + 1)} />}
    {!screen && bookingEditor && view === "board" && <WorkshopBookingEdit key={bookingEditor.id} job={bookingEditor} onClose={() => setBookingEditor(null)} onSaved={result => {setBookingEditor(null);setFollowToday(false);setDate(result.date);setRefresh(v => v + 1);setMessage(`Booking moved to ${result.date} at ${result.time}. Shared diary updated.`);}} />}
    {!screen && view === "board" && <div className="wbListPanel"><div className="wbListToolbar"><div><h2>Workshop jobs</h2><span>Planned times · {date}</span></div><input aria-label="Filter workshop jobs" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Find registration, technician or bay…" /></div><div className="sysTableScroll"><table className="wbOperationsTable"><thead><tr><th>Vehicle / work</th><th>Technician / bay</th><th>Start</th><th>Finish</th><th>Progress</th><th>Action</th></tr></thead><tbody>{visible.map((job) => <tr key={job.id}><td><b className="sysPlate">{job.registration || "NO REG"}</b><small>{job.status}</small><JobVehicleDetails job={job.workLines ? job : {...job,workLines:[{name:job.service||"Workshop work"}]}}/>{job.nextStop&&<div className="bayHandover">Next stop · Tyre bay live</div>}</td><td><strong>{job.technicians?.join(" · ") || job.technician || "Unassigned"}</strong><small>{job.plan.bay || "Bay unassigned"}</small></td><td>{job.plan.startTime || job.time || "—"}</td><td>{londonTime(job.timing.end)}</td><td><span className={`wbListState ${job.timing.state}`}>{job.timing.label}</span><div className="wbProgress"><i style={{width:`${job.timing.progress}%`}} /></div></td><td><div className="wbInlineActions">{!job.stageComplete&&["owner","manager","staff","service-manager"].includes(role)&&<button type="button" onClick={()=>setStageEditor({job,technicians:job.technicians||[],finishedTime:londonTime(Date.now())})}>{job.stageStatus==='In bay'?'Complete mechanical work':'Start mechanical work'}</button>}{job.timing.state !== "complete" && ["owner","manager","staff"].includes(role) && <button type="button" onClick={() => setBookingEditor(job)}>Edit booking</button>}{role === "owner" && job.timing.state !== "complete" ? <button type="button" onClick={() => { chooseJob(job.id); setView("planning"); }}>Plan job</button> : <span>View only</span>}</div></td></tr>)}</tbody></table></div>{!visible.length && <div className="sysEmpty">{loading ? "Loading jobs…" : error ? "Job data unavailable." : "No jobs match this view."}</div>}</div>}
    {screen && <div className="wbJobs">{!visible.length && <p className="wbEmpty">{loading ? "Opening jobs…" : error ? "No board data loaded." : rows.length ? "All work complete. Choose Show completed to review." : "No bookings for this date."}</p>}{displayed.map((job) => <article className={`wbJob ${job.timing.state}`} key={job.id}><div className="wbJobTop"><b>{job.plan.bay || "Bay to be assigned"}</b><span>{job.status}</span></div><b className="tfPlate wbRegistration">{job.registration || "NO REG"}</b><JobVehicleDetails job={job.workLines ? job : {...job,workLines:[{name:job.service||"Workshop work"}]}}/>{job.nextStop&&<div className="bayHandover">Next stop · Tyre bay live</div>}<div className="wbTimes"><div><small>Planned start</small><strong>{job.plan.startTime || job.time || "—"}</strong></div><div><small>Expected finish</small><strong>{londonTime(job.timing.end)}</strong></div></div><div className="wbCountdown">{job.timing.label}</div><div className="wbProgress"><i style={{ width: `${job.timing.progress}%` }} /></div><footer>{!job.stageComplete&&<button type="button" onClick={()=>setStageEditor({job,technicians:job.technicians||[],finishedTime:londonTime(Date.now())})}>{job.stageStatus==='In bay'?'Complete mechanical work':'Start mechanical work'}</button>}<span>{job.status}</span>{job.arrivalTime && <span>Arrival {job.arrivalTime}</span>}{job.serviceTime && <span>Service {job.serviceTime}</span>}</footer></article>)}</div>}
    {!screen && view === "planning" && role === "owner" && <form className="wbEditor" onSubmit={save}><h2>Plan a job</h2><p>Set the expected work duration. The booking date and capacity slot stay linked to the diary.</p><label>Booking<select value={editor?.jobId || ""} onChange={(event) => chooseJob(event.target.value)}><option value="">Choose a booking</option>{editableJobs.map((job) => <option value={job.id} key={job.id}>{job.registration} · {job.time} · {job.service}</option>)}</select></label>{editor && <><div><label>Planned start<input type="time" value={editor.startTime} onChange={(event) => setEditor({ ...editor, startTime: event.target.value })} required /></label><label>Duration (minutes)<input type="number" min="5" max="720" step="5" value={editor.durationMinutes} onChange={(event) => setEditor({ ...editor, durationMinutes: Number(event.target.value) })} required /></label><label>Bay<input value={editor.bay} onChange={(event) => setEditor({ ...editor, bay: event.target.value })} placeholder="e.g. Service bay 1" /></label><TechnicianPicker value={editor.technicians || []} onChange={technicians => setEditor({ ...editor, technicians, technician: technicians[0] || "" })} /></div><button type="submit" disabled={saving}>{saving ? "Saving…" : "Save workshop plan"}</button></>}</form>}
    {!screen && view === "alerts" && role === "owner" && <WorkshopNotifications date={date} />}
  </section>;
}
