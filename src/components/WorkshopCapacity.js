import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";

const DEFAULTS = { motPerHour: 2, servicePerHour: 2, timing: 2, clutch: 4, airconR134a: 8, airconR1234yf: 8, brakes: 6 };
const FIELDS = [["motPerHour", "MOT spaces per hour"], ["servicePerHour", "Service spaces per hour"], ["timing", "Cambelt / timing per day"], ["clutch", "Clutches per day"], ["airconR134a", "R134a per day"], ["airconR1234yf", "R1234yf per day"], ["brakes", "Brake jobs per day"]];

export default function WorkshopCapacity() {
  const [capacity, setCapacity] = useState(DEFAULTS);
  const [status, setStatus] = useState("Live");
  useEffect(() => onSnapshot(doc(db, "workshopSettings", "capacity"), (snap) => snap.exists() && setCapacity({ ...DEFAULTS, ...snap.data() })), []);
  const save = async () => {
    setStatus("Saving…");
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch("https://us-central1-tyremen-system.cloudfunctions.net/updateWorkshopSettings", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ capacity }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Capacity could not be saved");
      setCapacity(result.capacity); setStatus("Live");
    } catch (error) { setStatus(error.message); }
  };
  return <div className="adminPanel workshopCapacityEditor"><div className="diaryPanelTitle"><div><h3>Workshop capacity settings</h3><p>These limits control website and manual booking availability.</p></div><strong>{status}</strong></div><div className="capacityInputGrid">{FIELDS.map(([key, label]) => <label key={key}>{label}<input type="number" min="0" value={capacity[key]} onChange={(event) => setCapacity({ ...capacity, [key]: Number(event.target.value || 0) })} /></label>)}</div><button className="adminPrimaryButton" type="button" onClick={save}>Publish capacity</button></div>;
}
