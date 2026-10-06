import { useEffect, useState } from "react";
import { auth } from "../firebase";
const ROOT = "https://us-central1-tyremen-system.cloudfunctions.net";
async function request(path, body, signal) {
  const token = await auth.currentUser.getIdToken();
  const response = await fetch(`${ROOT}/${path}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body), signal });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.error || "Notification settings unavailable");
  return data;
}
export default function WorkshopNotifications({ date, area = "workshop" }) {
  const [settings, setSettings] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setSettings(null); setAlerts([]); setError(""); setMessage("");
    request("getWorkshopNotificationSettings", { date, area }, controller.signal).then((data) => {
      if (!controller.signal.aborted) { setSettings(data.settings); setAlerts(data.alerts); }
    }).catch((err) => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [date, refresh, area]);
  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const result = await request("saveWorkshopNotificationSettings", { ...settings, area });
      setSettings(result.settings); setMessage("Notification settings saved. Enabled channels are checked every five minutes.");
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };
  const testSms = async () => {
    setTesting(true); setError(""); setMessage("");
    try { const data = await request("testWorkshopSmsSettings", settings); setMessage(data.message); }
    catch (err) { setError(err.message); }
    finally { setTesting(false); }
  };
  return <section className="wbNotifications"><h2>{area === "tyres" ? "Tyre Foreman email & text alerts" : "Workshop email & text warnings"}</h2><p>{area === "tyres" ? "Vehicle-arrived and bay-finished alerts, plus planned completion warnings every five minutes. Messages go to the foreman contact below, not the customer." : "Three-hour progress checks for long jobs, plus a warning within 30 minutes of completion. Uses the planned start and duration above. Checks every five minutes, even with the board closed."}</p>{error && <div className="wbNotice" role="alert">{error}</div>}{message && <div className="wbNotice" role="status">{message}</div>}{settings ? <form onSubmit={save}><label>{area === "tyres" ? "Foreman email" : "Service manager email"}<input type="email" value={settings.email} required={settings.enabled} maxLength="254" placeholder="Enter the service manager’s email" onChange={(event) => setSettings({ ...settings, email: event.target.value })} /></label><label className="wbNotificationToggle"><input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })} /> Enable automatic email warnings</label><h3>Webex Interact · Tyremen-Admin-Text</h3><label>Approved Webex sender name or number<input value={settings.smsSender} maxLength="30" required={settings.smsEnabled} onChange={(event) => setSettings({ ...settings, smsSender: event.target.value })} placeholder="As configured in Webex" /></label><label>{area === "tyres" ? "Foreman mobile" : "Service manager mobile"}<input type="tel" value={settings.smsPhone} required={settings.smsEnabled} onChange={(event) => setSettings({ ...settings, smsPhone: event.target.value })} placeholder="+447..." /></label><label className="wbNotificationToggle"><input type="checkbox" checked={settings.smsEnabled} onChange={(event) => setSettings({ ...settings, smsEnabled: event.target.checked })} /> Enable automatic text warnings</label><p>The API token is stored in Firebase. SMS uses your Webex balance. Test validates this form without sending a text; save afterwards to apply.</p><button type="button" disabled={testing || saving || !settings.smsPhone || !settings.smsSender} onClick={testSms}>{testing ? "Validating…" : "Validate Webex · no text sent"}</button><button disabled={saving || testing} type="submit">{saving ? "Saving…" : "Save notification settings"}</button></form> : !error && <p>Loading settings…</p>}<div className="wbHistoryHeading"><h3>Delivery history · {date}</h3><button type="button" disabled={saving || testing} onClick={() => setRefresh((value) => value + 1)}>Refresh settings & history</button></div><p>Refresh reloads saved settings. Sent means accepted by the mail server; queued means accepted by Webex, awaiting delivery. Uncertain deliveries need checking with the recipient.</p>{!alerts.length ? <p>No warning attempts recorded for this date.</p> : <ul className="wbNotificationHistory">{alerts.map((alert) => <li key={alert.id}><b>{alert.registration} · {alert.kind === "arrived" ? "Vehicle arrived" : alert.kind === "finished" ? "Bay work finished" : alert.kind === "checkpoint" ? "3-hour check" : "30-minute warning"}</b><span>{area === "tyres" ? `Email ${alert.emailStatus || "off"} · Text ${alert.smsStatus || "off"}` : alert.channel === "sms" ? "Text" : "Email"} · {alert.status} · {alert.email} · attempt {alert.attempts}</span>{alert.at && <small>{new Date(alert.at).toLocaleString("en-GB", { timeZone: "Europe/London" })}</small>}{alert.error && <em>{alert.error}</em>}</li>)}</ul>}</section>;
}
