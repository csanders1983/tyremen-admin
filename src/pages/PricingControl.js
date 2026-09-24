import "../admin-pages.css";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import * as XLSX from "xlsx";
import { auth, db } from "../firebase";

const FUNCTIONS_ROOT = "https://us-central1-tyremen-system.cloudfunctions.net";
const defaultAircon = { r134a: 64.99, r1234yf: 124.99, leakCheck: 75 };
const defaultRules = {
  vatPercent: 20, websiteDiscountPercent: 0, roundingMode: "ceilPound", overrides: [],
  markupBands: [{ upTo: 30, markup: 30 }, { upTo: 50, markup: 33 }, { upTo: 100, markup: 38 }, { upTo: 999999, markup: 43 }],
};
const defaultOffers = {
  buyTwoTyres: { active: true, minimumQuantity: 2, discountType: "fixedPerTyre", discountAmount: 5, discountPercent: 0, headline: "Buy 2 tyres, save £5 per tyre" },
  serviceMot: { active: true, addOnPrice: 20, headline: "Service + MOT offer" },
};
const engineBands = [[0, 1200, "0-1200cc"], [1201, 1500, "1201-1500cc"], [1501, 2000, "1501-2000cc"], [2001, 2400, "2001-2400cc"], [2401, 3500, "2401-3500cc"], [3501, 9999, "3501cc+"]];
const serviceTypes = [["oil", "Oil & Filter"], ["interim", "Interim"], ["full", "Full"], ["major", "Major"]];
const defaultServiceExVat = { oil: [100, 100, 114.17, 114.17, 137.5, 137.5], interim: [120, 120, 137, 137, 165, 165], full: [155, 155, 175, 175, 210, 210], major: [180, 180, 205, 205, 245, 245] };
const defaultMotPrices = { class4: 40, class7: 45 };
const serviceFallbackRows = () => serviceTypes.flatMap(([serviceType]) => engineBands.map(([minCC, maxCC, bandLabel], index) => ({ id: `${serviceType}-${minCC}-${maxCC}`, serviceType, bandLabel, minCC, maxCC, priceIncVat: Number((defaultServiceExVat[serviceType][index] * 1.2).toFixed(2)) })));
const historyTime = (value) => value?.toMillis?.() || Date.parse(value || "") || 0;

export default function PricingControl() {
  const [aircon, setAircon] = useState(defaultAircon);
  const [rules, setRules] = useState(defaultRules);
  const [offers, setOffers] = useState(defaultOffers);
  const [serviceRows, setServiceRows] = useState(serviceFallbackRows);
  const [motPrices, setMotPrices] = useState(defaultMotPrices);
  const [history, setHistory] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("Live");
  const [preview, setPreview] = useState({ cost: 50, qty: 1, code: "" });
  const [overrideDraft, setOverrideDraft] = useState({ key: "", label: "", price: "" });

  useEffect(() => {
    const stops = [
      onSnapshot(doc(db, "pricingControl", "aircon"), (snap) => snap.exists() && setAircon({ ...defaultAircon, ...snap.data() })),
      onSnapshot(doc(db, "pricingControl", "tyres"), (snap) => snap.exists() && setRules({ ...defaultRules, ...snap.data(), overrides: snap.data().overrides || [] })),
      onSnapshot(doc(db, "pricingControl", "offers"), (snap) => { if (snap.exists()) { const value = snap.data(); setOffers({ buyTwoTyres: { ...defaultOffers.buyTwoTyres, ...(value.buyTwoTyres || {}) }, serviceMot: { ...defaultOffers.serviceMot, ...(value.serviceMot || {}) } }); } }),
      onSnapshot(collection(db, "servicePricingMatrix"), (snapshot) => { const loaded = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })); setServiceRows(loaded.length ? loaded : serviceFallbackRows()); }),
      onSnapshot(collection(db, "motPricing"), (snapshot) => { const loaded = { ...defaultMotPrices }; snapshot.docs.forEach((entry) => { loaded[entry.id] = Number(entry.data().price || 0); }); setMotPrices(loaded); }),
      onSnapshot(collection(db, "pricingHistory"), (snapshot) => setHistory(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })).sort((a, b) => historyTime(b.createdAt) - historyTime(a.createdAt)).slice(0, 20))),
    ];
    return () => stops.forEach((stop) => stop());
  }, []);

  const changeAircon = (key, value) => { setAircon((current) => ({ ...current, [key]: Number(value) })); setDirty(true); };
  const changeRules = (next) => { setRules(next); setDirty(true); };
  const changeOffers = (next) => { setOffers(next); setDirty(true); };
  const changeMot = (key, value) => { setMotPrices((current) => ({ ...current, [key]: Number(value) })); setDirty(true); };
  const changeService = (id, value) => { setServiceRows((current) => current.map((row) => row.id === id ? { ...row, priceIncVat: Number(value) } : row)); setDirty(true); };

  const previewResult = useMemo(() => {
    const code = preview.code.trim().toUpperCase();
    const override = (rules.overrides || []).find((entry) => entry.active !== false && entry.key === code);
    let unitPrice;
    if (override) unitPrice = Number(override.price || 0);
    else {
      const band = [...rules.markupBands].sort((a, b) => Number(a.upTo) - Number(b.upTo)).find((entry) => Number(preview.cost) <= Number(entry.upTo));
      const raw = (Number(preview.cost || 0) + Number(band?.markup || 0)) * (1 + Number(rules.vatPercent || 0) / 100);
      const original = rules.roundingMode === "ceilPound" ? Math.ceil(raw) : raw;
      unitPrice = original * (1 - Number(rules.websiteDiscountPercent || 0) / 100);
    }
    const qty = Math.max(1, Number(preview.qty || 1));
    const multi = offers.buyTwoTyres.active && qty >= Number(offers.buyTwoTyres.minimumQuantity || 2);
    const discount = !multi ? 0 : offers.buyTwoTyres.discountType === "percent" ? unitPrice * qty * (Number(offers.buyTwoTyres.discountPercent || 0) / 100) : qty * Number(offers.buyTwoTyres.discountAmount || 0);
    return { unitPrice, subtotal: unitPrice * qty, discount, total: unitPrice * qty - discount, overridden: Boolean(override) };
  }, [preview, rules, offers]);

  const importFormula = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
      const points = rows.map((row) => ({ threshold: Number(row["Unit Greater Than"]), markup: Number(row["Fixed Uplift"]), saving: Number(row["Special per tyre 2 or more remove from the sale price not markup"]), rounding: String(row["Round Up"] || "") })).filter((row) => Number.isFinite(row.threshold) && Number.isFinite(row.markup)).sort((a, b) => a.threshold - b.threshold);
      if (!points.length) throw new Error("No formula rows found");
      const bands = [];
      points.forEach((point) => { const previous = bands[bands.length - 1]; if (!previous || previous.markup !== point.markup) bands.push({ upTo: point.threshold, markup: point.markup }); else previous.upTo = point.threshold; });
      bands[bands.length - 1].upTo = 999999;
      const saving = Math.abs(points[0].saving || 0);
      changeRules({ ...rules, markupBands: bands, roundingMode: points.some((point) => /round|nearest/i.test(point.rounding)) ? "ceilPound" : "nearestPenny", importFileName: file.name, importedAt: new Date().toISOString() });
      changeOffers({ ...offers, buyTwoTyres: { ...offers.buyTwoTyres, active: saving > 0, minimumQuantity: 2, discountType: "fixedPerTyre", discountAmount: saving, headline: `Buy 2 tyres, save £${saving.toFixed(2)} per tyre` } });
    } catch (error) { alert("Could not import this file. Please use the webcost.xlsx format."); }
    finally { event.target.value = ""; }
  };

  const addOverride = () => {
    const key = overrideDraft.key.trim().toUpperCase();
    const price = Number(overrideDraft.price || 0);
    if (!key || price <= 0) return alert("Enter a MIDAS stock code and selling price.");
    changeRules({ ...rules, overrides: [...(rules.overrides || []).filter((entry) => entry.key !== key), { key, label: overrideDraft.label.trim(), price, active: true }] });
    setOverrideDraft({ key: "", label: "", price: "" });
  };

  const publishAll = async () => {
    if (!dirty || !window.confirm("Publish all draft prices and offers to the live website?")) return;
    setStatus("Publishing…");
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`${FUNCTIONS_ROOT}/publishPricingControl`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ pricing: { aircon, tyres: rules, offers, serviceRows, motPrices } }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Prices could not be published");
      setDirty(false); setStatus("Published live");
    } catch (error) { setStatus(error.message || "Publish failed"); }
  };

  return <section className="adminPage pricingControlPage">
    <div className="adminHero"><span>CENTRAL PRICE CONTROL</span><h2>Pricing &amp; Offers</h2><p>Edit drafts, preview customer totals, then publish every connected website price in one controlled action.</p></div>
    <div className="adminStats"><div className="adminStat"><span>Draft status</span><strong className="smallStat">{dirty ? "Unpublished" : status}</strong></div><div className="adminStat"><span>Tyre bands</span><strong>{rules.markupBands.length}</strong></div><div className="adminStat"><span>Price history</span><strong>{history.length}</strong></div></div>
    <div className={`pricingPublishBar ${dirty ? "dirty" : ""}`}><div><strong>{dirty ? "Draft changes waiting" : "Everything is live"}</strong><span>{dirty ? "Customer prices have not changed yet." : "Edit any field to create a draft."}</span></div><button type="button" disabled={!dirty || status === "Publishing…"} onClick={publishAll}>{status === "Publishing…" ? "PUBLISHING…" : "PREVIEWED — PUBLISH ALL"}</button></div>

    <div className="pricingControlGrid pricingPreviewGrid">
      <div className="adminPanel pricingEditor"><h3>Customer price preview</h3><div className="pricingFields"><label>MIDAS cost £<input type="number" step=".01" value={preview.cost} onChange={(e) => setPreview({ ...preview, cost: e.target.value })} /></label><label>Quantity<input type="number" min="1" value={preview.qty} onChange={(e) => setPreview({ ...preview, qty: e.target.value })} /></label><label>Stock code (optional)<input value={preview.code} onChange={(e) => setPreview({ ...preview, code: e.target.value.toUpperCase() })} /></label></div><div className="pricePreviewTotals"><div><span>Unit price</span><strong>£{previewResult.unitPrice.toFixed(2)}</strong></div><div><span>Subtotal</span><strong>£{previewResult.subtotal.toFixed(2)}</strong></div><div><span>Offer saving</span><strong>-£{previewResult.discount.toFixed(2)}</strong></div><div className="grand"><span>Customer total</span><strong>£{previewResult.total.toFixed(2)}</strong></div></div>{previewResult.overridden && <p className="overrideNotice">Individual stock-code override applied.</p>}</div>
      <div className="adminPanel pricingEditor"><h3>MOT prices</h3><label>Class 4 MOT £<input type="number" step=".01" value={motPrices.class4} onChange={(e) => changeMot("class4", e.target.value)} /></label><label>Class 7 MOT £<input type="number" step=".01" value={motPrices.class7} onChange={(e) => changeMot("class7", e.target.value)} /></label></div>
    </div>

    <div className="adminPanel pricingEditor"><div className="adminEditHeader"><div><h3>Service prices including VAT</h3><p>Public prices by engine size. Nothing changes live until Publish All.</p></div></div><div className="centralServiceMatrix"><div className="centralServiceHead"><span>Engine</span>{serviceTypes.map(([, label]) => <span key={label}>{label}</span>)}</div>{engineBands.map(([minCC, , label]) => <div className="centralServiceRow" key={label}><strong>{label}</strong>{serviceTypes.map(([key]) => { const row = serviceRows.find((entry) => entry.serviceType === key && Number(entry.minCC) === minCC); return <label key={key}>£<input type="number" step=".01" value={row?.priceIncVat || 0} onChange={(e) => row && changeService(row.id, e.target.value)} /></label>; })}</div>)}</div></div>

    <div className="adminPanel pricingEditor"><div className="adminEditHeader"><div><h3>Tyre price formula</h3><p>Import webcost.xlsx or edit the draft bands.</p></div><label className="formulaImportButton">Import .xlsx<input type="file" accept=".xlsx,.xls" onChange={importFormula} /></label></div><div className="pricingFields"><label>VAT %<input type="number" value={rules.vatPercent} onChange={(e) => changeRules({ ...rules, vatPercent: Number(e.target.value) })} /></label><label>Website discount %<input type="number" value={rules.websiteDiscountPercent || 0} onChange={(e) => changeRules({ ...rules, websiteDiscountPercent: Number(e.target.value) })} /></label><label>Rounding<select value={rules.roundingMode} onChange={(e) => changeRules({ ...rules, roundingMode: e.target.value })}><option value="ceilPound">Round up to next £</option><option value="nearestPenny">Nearest penny</option></select></label></div><div className="markupBands">{rules.markupBands.map((band, index) => <div className="markupRow" key={index}><label>Cost up to £<input type="number" placeholder="No limit" value={band.upTo >= 999999 ? "" : band.upTo} onChange={(e) => changeRules({ ...rules, markupBands: rules.markupBands.map((entry, position) => position === index ? { ...entry, upTo: Number(e.target.value || 999999) } : entry) })} /></label><label>Add £<input type="number" value={band.markup} onChange={(e) => changeRules({ ...rules, markupBands: rules.markupBands.map((entry, position) => position === index ? { ...entry, markup: Number(e.target.value) } : entry) })} /></label></div>)}</div></div>

    <div className="pricingControlGrid"><div className="adminPanel pricingEditor"><h3>Individual tyre overrides</h3><div className="overrideEntry"><input placeholder="MIDAS stock code" value={overrideDraft.key} onChange={(e) => setOverrideDraft({ ...overrideDraft, key: e.target.value.toUpperCase() })} /><input placeholder="Description" value={overrideDraft.label} onChange={(e) => setOverrideDraft({ ...overrideDraft, label: e.target.value })} /><input type="number" step=".01" placeholder="Retail £" value={overrideDraft.price} onChange={(e) => setOverrideDraft({ ...overrideDraft, price: e.target.value })} /><button type="button" onClick={addOverride}>Add override</button></div><div className="overrideList">{(rules.overrides || []).map((entry) => <div key={entry.key}><span><b>{entry.key}</b><small>{entry.label || "Individual price"}</small></span><strong>£{Number(entry.price).toFixed(2)}</strong><button type="button" className="danger" onClick={() => changeRules({ ...rules, overrides: rules.overrides.filter((item) => item.key !== entry.key) })}>Remove</button></div>)}{!(rules.overrides || []).length && <p>No individual overrides.</p>}</div></div><div className="adminPanel pricingEditor"><h3>Air-conditioning</h3>{[["r134a", "R134a regas"], ["r1234yf", "R1234yf regas"], ["leakCheck", "Leak check"]].map(([key, label]) => <label key={key}>{label}<input type="number" step=".01" value={aircon[key]} onChange={(e) => changeAircon(key, e.target.value)} /></label>)}</div></div>

    <div className="adminPanel pricingEditor"><h3>Customer offers</h3><div className="pricingControlGrid"><div><label className="toggleField"><input type="checkbox" checked={offers.buyTwoTyres.active} onChange={(e) => changeOffers({ ...offers, buyTwoTyres: { ...offers.buyTwoTyres, active: e.target.checked } })} />Buy two tyre offer active</label><label>Minimum quantity<input type="number" min="2" value={offers.buyTwoTyres.minimumQuantity} onChange={(e) => changeOffers({ ...offers, buyTwoTyres: { ...offers.buyTwoTyres, minimumQuantity: Number(e.target.value) } })} /></label><label>Saving per tyre £<input type="number" step=".01" value={offers.buyTwoTyres.discountAmount} onChange={(e) => changeOffers({ ...offers, buyTwoTyres: { ...offers.buyTwoTyres, discountAmount: Number(e.target.value), discountType: "fixedPerTyre" } })} /></label><label>Public headline<input value={offers.buyTwoTyres.headline} onChange={(e) => changeOffers({ ...offers, buyTwoTyres: { ...offers.buyTwoTyres, headline: e.target.value } })} /></label></div><div><label className="toggleField"><input type="checkbox" checked={offers.serviceMot.active} onChange={(e) => changeOffers({ ...offers, serviceMot: { ...offers.serviceMot, active: e.target.checked } })} />Service + MOT offer active</label><label>MOT add-on price £<input type="number" step=".01" value={offers.serviceMot.addOnPrice} onChange={(e) => changeOffers({ ...offers, serviceMot: { ...offers.serviceMot, addOnPrice: Number(e.target.value) } })} /></label><label>Public headline<input value={offers.serviceMot.headline} onChange={(e) => changeOffers({ ...offers, serviceMot: { ...offers.serviceMot, headline: e.target.value } })} /></label></div></div></div>

    <div className="adminPanel pricingEditor"><h3>Publish history</h3><div className="pricingHistoryList">{history.map((entry) => <div key={entry.id}><span><b>{entry.actor?.name || entry.actor?.email || "Admin"}</b><small>{entry.createdAt?.toDate?.().toLocaleString("en-GB") || "Recent publish"}</small></span><span>{entry.summary?.tyreBands || 0} bands · {entry.summary?.tyreOverrides || 0} overrides · {entry.summary?.servicePrices || 0} service prices</span></div>)}{!history.length && <p>No publish history yet.</p>}</div></div>
  </section>;
}
