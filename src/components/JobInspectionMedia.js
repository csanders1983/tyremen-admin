import { useCallback, useEffect, useState } from "react";
import { ref, uploadBytesResumable } from "firebase/storage";
import { storage } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import { workshopPost } from "../lib/workshopApi";
import "../job-inspection-media.css";

const OFFICE_ROLES = ["owner", "manager", "staff"];

function Item({ item, jobId, busy, onChanged }) {
  const [note, setNote] = useState(item.note || "");
  const [visible, setVisible] = useState(item.customerVisible === true);
  async function save(archived = item.archived === true) {
    await onChanged(() => workshopPost("updateJobInspectionItem", { jobId, mediaId: item.id, note, customerVisible: visible, archived }));
  }
  return <article className={`jimItem${item.archived ? " archived" : ""}`}>
    <div className="jimPreview">
      {item.kind === "image" && <img src={item.url} alt={item.note || "Workshop inspection"} />}
      {item.kind === "video" && <video src={item.url} controls preload="metadata" />}
      {item.kind === "note" && <b>TECHNICIAN NOTE</b>}
    </div>
    <div className="jimItemBody">
      <small>{item.kind === "note" ? "NOTE" : `${item.kind.toUpperCase()} · ${item.fileName || "Workshop media"}`}</small>
      <textarea aria-label="Inspection note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Describe what the customer is looking at…" />
      {item.archived && <strong className="jimArchivedLabel">ARCHIVED — retained in the job record</strong>}
      <label className="jimCheck"><input type="checkbox" disabled={item.archived} checked={visible} onChange={(event) => setVisible(event.target.checked)} /> Share this item with customer</label>
      <div className="jimActions"><button type="button" disabled={busy || item.archived} onClick={() => save(false)}>Save item</button><button className="secondary" type="button" disabled={busy} onClick={() => save(!item.archived)}>{item.archived ? "Restore" : "Archive"}</button></div>
    </div>
  </article>;
}

export default function JobInspectionMedia({ job, onClose }) {
  const { role } = useAuth();
  const [items, setItems] = useState([]);
  const [inspection, setInspection] = useState(job.inspection || {});
  const [customer, setCustomer] = useState({});
  const [files, setFiles] = useState([]);
  const [customerVisible, setCustomerVisible] = useState(false);
  const [note, setNote] = useState("");
  const [noteVisible, setNoteVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const result = await workshopPost("getJobInspection", { jobId: job.id });
    setItems(result.items || []); setInspection(result.inspection || {}); setCustomer(result.customer || {});
  }, [job.id]);
  useEffect(() => { load().catch((caught) => setError(caught.message)); }, [load]);

  async function action(callback, reload = true) {
    setBusy(true); setError(""); setMessage("");
    try { const result = await callback(); if (reload) await load(); if (result?.message) setMessage(result.message); }
    catch (caught) { setError(caught.message); }
    finally { setBusy(false); setProgress(0); }
  }

  async function upload(event) {
    event.preventDefault();
    if (!files.length) return setError("Choose at least one photo or video.");
    await action(async () => {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const prepared = await workshopPost("prepareJobMediaUpload", { jobId: job.id, fileName: file.name, contentType: file.type, size: file.size, customerVisible });
        await new Promise((resolve, reject) => {
          const task = uploadBytesResumable(ref(storage, prepared.path), file, { contentType: file.type, customMetadata: { jobId: job.id, mediaId: prepared.mediaId } });
          task.on("state_changed", (snapshot) => setProgress(Math.round(((index + snapshot.bytesTransferred / snapshot.totalBytes) / files.length) * 100)), reject, resolve);
        });
        await workshopPost("finaliseJobMediaUpload", { jobId: job.id, mediaId: prepared.mediaId });
      }
      setFiles([]);
      event.target.reset();
      return { message: `${files.length} inspection file${files.length === 1 ? "" : "s"} uploaded.` };
    });
  }

  async function addNote(event) {
    event.preventDefault();
    await action(async () => { const result = await workshopPost("addJobInspectionNote", { jobId: job.id, note, customerVisible: noteVisible }); setNote(""); return { ...result, message: "Inspection note saved." }; });
  }

  const office = OFFICE_ROLES.includes(role);
  const activeItems = items.filter((item) => !item.archived);
  const archivedItems = items.filter((item) => item.archived);
  return <div className="jimOverlay" role="dialog" aria-modal="true" aria-label={`Vehicle inspection ${job.registration}`}>
    <section className="jimPanel">
      <header><div><span>VEHICLE INSPECTION</span><h2>{job.registration || "NO REG"}</h2><p>{job.customerName || job.name || "Customer"} · {job.vehicle?.make || ""} {job.vehicle?.model || ""}</p></div><button type="button" className="jimClose" onClick={onClose}>×</button></header>
      <div className="jimStatus"><b>{String(inspection.status || "draft").replaceAll("-", " ")}</b><span>{Number(inspection.mediaCount || 0)} media · {Number(inspection.noteCount || 0)} notes</span></div>
      {error && <div className="jimError" role="alert">{error}</div>}{message && <div className="jimMessage" role="status">{message}</div>}

      <div className="jimCreate">
        <form onSubmit={upload}>
          <h3>Add photos or video</h3><p>Take them now or choose existing files. Photos up to 20 MB; videos up to 250 MB.</p>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm" multiple capture="environment" onChange={(event) => setFiles([...event.target.files])} />
          <label className="jimCheck"><input type="checkbox" checked={customerVisible} onChange={(event) => setCustomerVisible(event.target.checked)} /> Selected files can be shared with customer</label>
          <button disabled={busy || !files.length}>{busy && progress ? `Uploading ${progress}%` : "Upload selected files"}</button>
          {busy && progress > 0 && <div className="jimProgress"><i style={{ width: `${progress}%` }} /></div>}
        </form>
        <form onSubmit={addNote}>
          <h3>Add technician note</h3><textarea required value={note} onChange={(event) => setNote(event.target.value)} placeholder="What was checked, what was found and what is recommended?" />
          <label className="jimCheck"><input type="checkbox" checked={noteVisible} onChange={(event) => setNoteVisible(event.target.checked)} /> Note can be shared with customer</label>
          <button disabled={busy || !note.trim()}>Save note</button>
        </form>
      </div>

      <div className="jimItems"><div className="jimSectionTitle"><h3>Inspection record</h3><span>{activeItems.length} active item{activeItems.length === 1 ? "" : "s"}</span></div>{activeItems.map((item) => <Item key={item.id} item={item} jobId={job.id} busy={busy} onChanged={(callback) => action(callback)} />)}{!activeItems.length && <p className="jimEmpty">No active inspection media or notes have been added yet.</p>}{archivedItems.length > 0 && <div className="jimArchive"><div className="jimSectionTitle"><h3>Archived items</h3><span>{archivedItems.length} retained</span></div>{archivedItems.map((item) => <Item key={item.id} item={item} jobId={job.id} busy={busy} onChanged={(callback) => action(callback)} />)}</div>}</div>

      <footer className="jimShare">
        <div><h3>Share inspection</h3><p>Mechanics send it to the office first. The office checks the customer-visible items before sending.</p><small>{customer.email || "No customer email"} · {customer.mobile || "No customer mobile"}</small></div>
        <div className="jimActions"><button disabled={busy || !activeItems.length} onClick={() => action(() => workshopPost("markJobInspectionReady", { jobId: job.id }))}>Ready for office</button>{office && <><button disabled={busy || !activeItems.some((item) => item.customerVisible)} onClick={() => action(() => workshopPost("sendJobInspection", { jobId: job.id, channel: "email" }))}>Email customer</button><button disabled={busy || !activeItems.some((item) => item.customerVisible)} onClick={() => action(() => workshopPost("sendJobInspection", { jobId: job.id, channel: "sms" }))}>Text customer</button><button disabled={busy || !activeItems.some((item) => item.customerVisible)} onClick={() => action(() => workshopPost("sendJobInspection", { jobId: job.id, channel: "both" }))}>Email + text</button><button className="secondary" disabled={busy} onClick={() => action(() => workshopPost("revokeJobInspectionShares", { jobId: job.id }))}>Revoke links</button></>}</div>
      </footer>
    </section>
  </div>;
}
