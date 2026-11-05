import { useCallback, useEffect, useState } from "react";
import { auth } from "../firebase";
import "./OfferBuilder.css";

const ROOT = "https://us-central1-tyremen-system.cloudfunctions.net";
const categories = [["tyre", "Tyres"], ["mot", "MOT"], ["service", "Servicing"], ["alignment", "Wheel alignment"], ["puncture", "Puncture repair"], ["wheel-weld", "Wheel weld"], ["diagnostics", "Diagnostics"], ["locking-wheel-removal", "Locking wheel removal"], ["tpms", "TPMS"], ["balance", "Wheel balance"], ["suspension", "Suspension"], ["steering", "Steering"], ["exhaust", "Exhaust"], ["battery", "Battery"], ["general-repair", "General repair"], ["brakes", "Brakes"], ["clutch", "Clutch"], ["timing", "Timing belt / chain"], ["aircon", "Air conditioning"], ["spare-wheel", "Space savers"]];
const newOffer = () => ({ id: window.crypto.randomUUID(), title: "New offer", active: false, mode: "automatic", code: "", benefit: "fixed", value: 10, target: { kinds: ["tyre"], brands: [], models: [], serviceKeys: [] }, requiredKinds: [], minimumQty: 1, minimumSpend: 0, buyQty: 2, freeQty: 1, maxDiscount: 0, usageLimit: 0, priority: 0, fulfilment: "any", stacking: "stack", group: "", stackWithPresets: false, start: "", end: "" });
const lists = (value) => value.split(",");
const localDate = (value) => { if (!value) return ""; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const displayMoney = (v) => `£${Number(v || 0).toFixed(2)}`;
async function call(name, body = {}) {
  if (!auth.currentUser) throw new Error("Please sign in again.");
  const token = await auth.currentUser.getIdToken();
  const response = await fetch(`${ROOT}/${name}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.error || "Offer request failed");
  return data;
}
function KindChoices({ value, onChange, label }) {
  return <fieldset className="obChoices"><legend>{label}</legend>{categories.map(([key, title]) => <label key={key}><input type="checkbox" checked={value.includes(key)} onChange={(e) => onChange(e.target.checked ? [...value, key] : value.filter((k) => k !== key))} />{title}</label>)}</fieldset>;
}
function Field({ label, value, onChange, ...props }) { return <label className="obField">{label}<input {...props} value={value} onChange={(e) => onChange(e.target.value)} /></label>; }
export default function OfferBuilder() {
  const [offers, setOffers] = useState([]), [version, setVersion] = useState(0), [usage, setUsage] = useState({});
  const [status, setStatus] = useState("Loading custom offers…"), [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false);
  const [previewRows, setPreviewRows] = useState([{ kind: "tyre", price: 100, qty: 2, brand: "Davanti", model: "DX640" }]);
  const [previewCode, setPreviewCode] = useState(""), [previewCollection, setPreviewCollection] = useState(false), [preview, setPreview] = useState(null);
  const load = useCallback(async () => {
    setBusy(true);
    try { const data = await call("getOfferBuilderV2"); setOffers(data.offers); setVersion(data.version); setUsage(data.usage); setReady(true); setDirty(false); setStatus("Custom offers loaded."); }
    catch (error) { setStatus(error.message); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const guard = (event) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  const change = (id, values) => { setOffers((all) => all.map((o) => o.id === id ? { ...o, ...values } : o)); setDirty(true); setPreview(null); };
  const add = (template) => {
    if (offers.length >= 50) return setStatus("Maximum 50 offers. Remove an old offer first.");
    const o = { ...newOffer(), ...template }; setOffers((all) => [...all, o]); setDirty(true); setPreview(null);
  };
  const publish = async () => {
    if (!window.confirm("Publish these custom offers now? Existing preset offers and prices will not be changed.")) return;
    setBusy(true);
    try { const data = await call("saveOfferBuilderV2", { offers, version }); setVersion(data.version); setDirty(false); setStatus("Custom offers published live."); }
    catch (error) { setStatus(error.message); }
    finally { setBusy(false); }
  };
  const test = async () => {
    setBusy(true); setPreview(null);
    try {
      const items = previewRows.map((row) => ({ type: row.kind === "tyre" ? "tyre" : row.kind === "spare-wheel" ? "spare-wheel" : "service", name: categories.find(([k]) => k === row.kind)?.[1] || row.kind, serviceKey: row.kind, category: row.kind, price: Number(row.price), qty: Number(row.qty), brand: row.brand, pattern: row.model, fittingOption: previewCollection ? "collection" : "fitted" }));
      const data = await call("previewOfferBuilderV2", { offers, items, promoCode: previewCode }); setPreview(data.quote); setStatus("Draft preview calculated. Nothing was booked or redeemed.");
    } catch (error) { setStatus(error.message); }
    finally { setBusy(false); }
  };
  return <section className="offerBuilder adminPanel" aria-label="Custom offer builder">
    <header className="obHeader"><div><small>BUILD YOUR OWN</small><h3>Offers &amp; checkout codes</h3><p>Create automatic offers or code-only promotions. Existing preset offers stay unchanged. Publish custom offers separately here.</p></div><span className="obBadge">{dirty ? "Unpublished draft" : "Custom offers"}</span></header>
    <div className="obToolbar"><button type="button" disabled={!ready || busy} onClick={() => add()}>+ Create offer</button><button type="button" disabled={busy} onClick={() => { if (!dirty || window.confirm("Discard unpublished custom-offer changes and reload?")) load(); }}>Reload live</button><button type="button" disabled={!dirty || busy || !ready} onClick={publish}>Publish custom offers</button></div>
    <p className="obStatus" role="status">{status}</p>
    {ready && <details className="obTemplates"><summary>Start from an example</summary><div className="obToolbar">
      <button type="button" disabled={busy} onClick={() => add({ title: "Tyre promo code", mode: "code", code: "TYRES10", benefit: "percent", value: 10, minimumQty: 2 })}>10% tyre code</button>
      <button type="button" disabled={busy} onClick={() => add({ title: "MOT with servicing", benefit: "addon", value: 30, target: { kinds: ["mot"], brands: [], models: [], serviceKeys: [] }, requiredKinds: ["service"] })}>£30 MOT add-on</button>
      <button type="button" disabled={busy} onClick={() => add({ title: "Free alignment with tyres", benefit: "free-addon", target: { kinds: ["alignment"], brands: [], models: [], serviceKeys: [] }, requiredKinds: ["tyre"], minimumQty: 1, minimumTyres: 2 })}>Free alignment</button>
      <button type="button" disabled={busy} onClick={() => add({ title: "Buy 3 tyres, get 1 free", benefit: "multibuy", buyQty: 3, freeQty: 1 })}>Buy 3 + 1 free</button>
    </div><p>Examples start paused. Review the conditions, switch on, then publish.</p></details>}
    {!offers.length && ready && <p className="obEmpty">No custom offers yet. Your existing preset offers still work.</p>}
    <fieldset className="obEditor" disabled={busy || !ready}><legend className="obSrOnly">Offer definitions</legend>
    {offers.map((o) => <details className="obCard" key={o.id}>
      <summary><span>{o.title}</span><span className="obSummaryMeta">{o.mode === "code" ? o.code || "Code needed" : "Automatic"} · {o.active ? "On" : "Paused"} · {usage[o.id] || 0}{o.usageLimit ? ` / ${o.usageLimit}` : ""} uses</span></summary>
      <div className="obCardBody"><div className="obGrid">
        <Field label="Customer-facing title" value={o.title} maxLength={120} onChange={(title) => change(o.id, { title })} />
        <label className="obField">How it applies<select value={o.mode} onChange={(e) => change(o.id, { mode: e.target.value })}><option value="automatic">Automatic</option><option value="code">Checkout code only</option></select></label>
        {o.mode === "code" && <Field label="Offer code" value={o.code} maxLength={32} onChange={(code) => change(o.id, { code: code.toUpperCase() })} />}
        <label className="obCheck"><input type="checkbox" checked={o.active} onChange={(e) => change(o.id, { active: e.target.checked })} />Offer switched on</label>
        <label className="obField">Benefit<select value={o.benefit} onChange={(e) => change(o.id, { benefit: e.target.value })}><option value="fixed">£ off eligible lines (once)</option><option value="per-unit">£ off each eligible unit</option><option value="percent">% off eligible lines</option><option value="bundle">Eligible bundle total price</option><option value="multibuy">Buy X, get Y free</option><option value="addon">One add-on at a set price</option><option value="free-addon">One free add-on</option></select></label>
        {!["multibuy", "free-addon"].includes(o.benefit) && <Field label={o.benefit === "percent" ? "Discount %" : ["bundle", "addon"].includes(o.benefit) ? "Total / add-on price £ inc VAT" : "Saving £ inc VAT"} type="number" min="0" step="0.01" max={o.benefit === "percent" ? 100 : 100000} value={o.value} onChange={(value) => change(o.id, { value })} />}
        {o.benefit === "multibuy" && <><Field label="Buy quantity (paid)" type="number" min="1" value={o.buyQty} onChange={(buyQty) => change(o.id, { buyQty })} /><Field label="Free quantity" type="number" min="1" value={o.freeQty} onChange={(freeQty) => change(o.id, { freeQty })} /></>}
      </div>
      <p className="obHint">A free/discounted add-on must already be in the basket; it is not inserted automatically. Buy X + Y means X paid and Y free per complete group, cheapest eligible units free. A bundle price covers all matching lines once.</p>
      <KindChoices label="Apply saving to these categories" value={o.target.kinds} onChange={(kinds) => change(o.id, { target: { ...o.target, kinds } })} />
      <div className="obGrid">
        <Field label="Brands (comma-separated; blank = any)" value={o.target.brands.join(",")} onChange={(s) => change(o.id, { target: { ...o.target, brands: lists(s) } })} />
        <Field label="Models (exact names; blank = any)" value={o.target.models.join(",")} onChange={(s) => change(o.id, { target: { ...o.target, models: lists(s) } })} />
        <Field label="Service keys (optional exact keys)" value={o.target.serviceKeys.join(",")} onChange={(s) => change(o.id, { target: { ...o.target, serviceKeys: lists(s) } })} />
        <Field label="Minimum matching units" type="number" min="1" value={o.minimumQty} onChange={(minimumQty) => change(o.id, { minimumQty })} />
        <Field label="Minimum tyres in basket (0 = none)" type="number" min="0" value={o.minimumTyres || 0} onChange={(minimumTyres) => change(o.id, { minimumTyres })} />
        <Field label="Minimum basket spend £ (before offers)" type="number" min="0" step="0.01" value={o.minimumSpend} onChange={(minimumSpend) => change(o.id, { minimumSpend })} />
        <Field label="Maximum saving £ (0 = uncapped)" type="number" min="0" step="0.01" value={o.maxDiscount} onChange={(maxDiscount) => change(o.id, { maxDiscount })} />
        <label className="obField">Tyre fulfilment<select value={o.fulfilment} onChange={(e) => change(o.id, { fulfilment: e.target.value })}><option value="any">Any / no tyres required</option><option value="fitted">Fitted tyres only</option><option value="collection">Collection tyres only</option></select></label>
      </div>
      <KindChoices label="Also require ALL selected categories in basket (blank = none)" value={o.requiredKinds} onChange={(requiredKinds) => change(o.id, { requiredKinds })} />
      <div className="obGrid">
        <Field label="Starts (UK local time; optional)" type="datetime-local" value={localDate(o.start)} onChange={(start) => change(o.id, { start: start ? new Date(start).toISOString() : "" })} />
        <Field label="Ends (exclusive; optional)" type="datetime-local" value={localDate(o.end)} onChange={(end) => change(o.id, { end: end ? new Date(end).toISOString() : "" })} />
        <Field label="Total booking uses (0 = unlimited)" type="number" min="0" step="1" value={o.usageLimit} onChange={(usageLimit) => change(o.id, { usageLimit })} />
        <Field label="Priority (higher runs first)" type="number" min="-999" max="999" step="1" value={o.priority} onChange={(priority) => change(o.id, { priority })} />
        <label className="obField">Combine with custom offers<select value={o.stacking} onChange={(e) => change(o.id, { stacking: e.target.value })}><option value="stack">Allow stacking</option><option value="group">One per named group</option><option value="exclusive">Exclusive custom offer</option></select></label>
        {o.stacking === "group" && <Field label="Group name" value={o.group} onChange={(group) => change(o.id, { group })} />}
        <label className="obCheck"><input type="checkbox" checked={o.stackWithPresets} onChange={(e) => change(o.id, { stackWithPresets: e.target.checked })} />Also combine with preset savings</label>
      </div>
      <p className="obHint">With preset stacking off, this replaces preset savings only when it is at least as good. Stacked percentages apply to the remaining eligible price. Usage counts successful bookings, not previews; cancellation does not automatically restore a use.</p>
      <div className="obToolbar"><button type="button" onClick={() => add({ ...o, id: window.crypto.randomUUID(), title: `${o.title} copy`.slice(0, 120), code: o.code ? `${o.code.slice(0, 27)}-COPY` : "", active: false })}>Duplicate</button><button type="button" onClick={() => change(o.id, { active: !o.active })}>{o.active ? "Pause" : "Switch on"}</button><button type="button" onClick={() => { if (window.confirm(`Remove ${o.title}? It will stop applying after you publish. Booking records are retained.`)) { setOffers((all) => all.filter((v) => v.id !== o.id)); setDirty(true); setPreview(null); } }}>Remove</button></div>
      </div>
    </details>)}
    </fieldset>
    <details className="obPreview"><summary>Test a basket before publishing</summary><p>Uses these draft custom offers and the current live presets. No stock, usage or bookings are changed.</p>
      {previewRows.map((row, index) => <div className="obTestRow" key={index}>
        <label className="obField">Category<select value={row.kind} onChange={(e) => setPreviewRows((rows) => rows.map((v, n) => n === index ? { ...v, kind: e.target.value } : v))}>{categories.map(([k, title]) => <option key={k} value={k}>{title}</option>)}</select></label>
        {[['price', 'Unit price £'], ['qty', 'Quantity'], ['brand', 'Brand'], ['model', 'Model']].map(([key, label]) => <Field key={key} label={label} type={['price', 'qty'].includes(key) ? 'number' : 'text'} value={row[key]} onChange={(value) => { setPreview(null); setPreviewRows((rows) => rows.map((v, n) => n === index ? { ...v, [key]: value } : v)); }} />)}
        <button type="button" aria-label={`Remove test row ${index + 1}`} onClick={() => { setPreviewRows((rows) => rows.filter((_, n) => n !== index)); setPreview(null); }}>Remove</button>
      </div>)}
      <div className="obToolbar"><button type="button" onClick={() => setPreviewRows((rows) => [...rows, { kind: "mot", price: 45, qty: 1, brand: "", model: "" }])}>+ Test line</button><Field label="Test code" value={previewCode} onChange={(value) => { setPreviewCode(value.toUpperCase()); setPreview(null); }} /><label className="obCheck"><input type="checkbox" checked={previewCollection} onChange={(e) => { setPreviewCollection(e.target.checked); setPreview(null); }} />Collection</label><button type="button" disabled={busy || !ready || !previewRows.length} onClick={test}>Calculate draft preview</button></div>
      {preview && <div className="obPreviewResult"><p>Subtotal <strong>{displayMoney(preview.subtotal)}</strong> · Savings <strong>{displayMoney(preview.discount)}</strong> · Total <strong>{displayMoney(preview.total)}</strong></p><p>{preview.offer?.label || "No offers apply."}</p>{preview.promo?.code && <p>{preview.promo.message}</p>}{(preview.customOffers || []).map((o) => <p key={o.id}>{o.title}: −{displayMoney(o.discount)}</p>)}</div>}
    </details>
  </section>;
}
