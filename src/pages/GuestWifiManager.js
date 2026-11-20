import React, { useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

const ref = doc(db, "publicContent", "guestWifi");
const initial = [
  { id: "mot", title: "MOT TESTING", price: "FROM £45", description: "Class 4 & Class 7 MOT testing", image: "", enabled: true },
  { id: "service", title: "VEHICLE SERVICING", price: "FROM £149", description: "Interim, Full & Major servicing", image: "", enabled: true },
  { id: "alignment", title: "WHEEL ALIGNMENT", price: "FROM £29.95", description: "Protect your tyres from uneven wear", image: "", enabled: true },
  { id: "tyres", title: "TYRE OFFERS", price: "GREAT PRICES", description: "Economy, mid-range and premium tyres", image: "", enabled: true }
];
const base = { countdown: 20, slideSeconds: 5, offers: initial };
const uid = () => "offer-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);

export default function GuestWifiManager() {
  const [data, setData] = useState(base);
  const [status, setStatus] = useState("Loading...");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    getDoc(ref).then(s => { if (s.exists()) setData({ ...base, ...s.data(), offers: s.data().offers || initial }); setStatus(""); })
      .catch(() => setStatus("Could not load offers. Check Firestore permissions."));
  }, []);
  const update = (id, field, value) => setData(d => ({ ...d, offers: d.offers.map(o => o.id === id ? { ...o, [field]: value } : o) }));
  const move = (index, direction) => setData(d => {
    const offers = [...d.offers], other = index + direction;
    if (other < 0 || other >= offers.length) return d;
    [offers[index], offers[other]] = [offers[other], offers[index]];
    return { ...d, offers };
  });
  const publish = async () => {
    setSaving(true); setStatus("");
    try {
      const offers = data.offers.map(o => ({
        id: String(o.id), title: String(o.title).slice(0, 100), price: String(o.price).slice(0, 70),
        description: String(o.description).slice(0, 220), image: String(o.image || "").slice(0, 1000), enabled: !!o.enabled
      }));
      await setDoc(ref, { countdown: Math.min(120, Math.max(5, Number(data.countdown) || 20)),
        slideSeconds: Math.min(30, Math.max(2, Number(data.slideSeconds) || 5)), offers, updatedAt: serverTimestamp() });
      setStatus("Published to Firestore.");
    } catch (e) { setStatus("Publish failed: " + e.message); }
    finally { setSaving(false); }
  };
  const field = { width: "100%", padding: 10, border: "1px solid #bbb", borderRadius: 7, boxSizing: "border-box" };
  return <section style={{ padding: 24, maxWidth: 1050, margin: "auto", color: "#171717" }}>
    <h2>Guest Wi-Fi · Offers Manager</h2>
    <p>Edit the promotions shown before customers connect. Changes only appear after Publish.</p>
    <p><a href="https://tyremen-system--pr2-feature-guest-wifi-p-akn9ex4z.web.app/guest-wifi" target="_blank" rel="noreferrer">Open customer portal preview (staging) ↗</a></p>
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
      <label>Countdown (seconds)<input style={field} type="number" min="5" max="120" value={data.countdown} onChange={e => setData({ ...data, countdown: e.target.value })} /></label>
      <label>Slide interval (seconds)<input style={field} type="number" min="2" max="30" value={data.slideSeconds} onChange={e => setData({ ...data, slideSeconds: e.target.value })} /></label>
    </div>
    {data.offers.map((o, i) => <article key={o.id} style={{ background: "#fff", border: "1px solid #ddd", borderLeft: "5px solid #ffd000", padding: 16, borderRadius: 9, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <strong>Slide {i + 1}</strong><div>
          <button type="button" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>{" "}
          <button type="button" onClick={() => move(i, 1)} disabled={i === data.offers.length - 1}>↓</button>{" "}
          <button type="button" onClick={() => setData(d => ({ ...d, offers: d.offers.filter(x => x.id !== o.id) }))}>Remove</button>
        </div>
      </div>
      <label><input type="checkbox" checked={o.enabled} onChange={e => update(o.id, "enabled", e.target.checked)} /> Show this offer</label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12, marginTop: 10 }}>
        {["title", "price", "description", "image"].map(k => <label key={k} style={{ display: "block" }}>{k === "image" ? "Image URL (HTTPS)" : k[0].toUpperCase() + k.slice(1)}
          <input style={field} value={o[k] || ""} onChange={e => update(o.id, k, e.target.value)} placeholder={k === "image" ? "https://..." : ""} />
        </label>)}
      </div>
    </article>)}
    <button type="button" onClick={() => setData(d => ({ ...d, offers: [...d.offers, { id: uid(), title: "NEW OFFER", price: "", description: "", image: "", enabled: true }] }))}>+ Add offer</button>{" "}
    <button type="button" onClick={publish} disabled={saving} style={{ background: "#ffd000", color: "#111", fontWeight: 800, padding: "12px 22px", border: 0, borderRadius: 8 }}>{saving ? "Publishing..." : "Publish offers"}</button>
    <p role="status">{status}</p>
    <small>Image URLs must be hosted online. This editor does not configure DrayTek or RADIUS access.</small>
  </section>;
}
