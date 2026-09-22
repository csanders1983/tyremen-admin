import "../admin-pages.css";
import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import { db } from "../firebase";

const defaultAircon = { r134a: 64.99, r1234yf: 124.99, leakCheck: 75 };
const defaultRules = {
  vatPercent: 20,
  roundingMode: "ceilPound",
  markupBands: [
    { upTo: 30, markup: 30 },
    { upTo: 50, markup: 33 },
    { upTo: 100, markup: 38 },
    { upTo: 999999, markup: 43 },
  ],
};
const defaultOffers = {
  buyTwoTyres: {
    active: true,
    minimumQuantity: 2,
    discountType: "fixedPerTyre",
    discountAmount: 5,
    headline: "Buy 2 tyres, save £5 per tyre",
  },
  serviceMot: { active: true, addOnPrice: 20 },
};

export default function PricingControl() {
  const [aircon, setAircon] = useState(defaultAircon);
  const [rules, setRules] = useState(defaultRules);
  const [offers, setOffers] = useState(defaultOffers);
  const [status, setStatus] = useState("Live");

  useEffect(() => {
    const stops = [
      onSnapshot(doc(db, "pricingControl", "aircon"), (snap) => {
        if (snap.exists()) setAircon({ ...defaultAircon, ...snap.data() });
      }),
      onSnapshot(doc(db, "pricingControl", "tyres"), (snap) => {
        if (snap.exists()) setRules({ ...defaultRules, ...snap.data() });
      }),
      onSnapshot(doc(db, "pricingControl", "offers"), (snap) => {
        if (!snap.exists()) return;
        const value = snap.data();
        setOffers({
          buyTwoTyres: { ...defaultOffers.buyTwoTyres, ...(value.buyTwoTyres || {}) },
          serviceMot: { ...defaultOffers.serviceMot, ...(value.serviceMot || {}) },
        });
      }),
    ];
    return () => stops.forEach((stop) => stop());
  }, []);

  const save = async (key, value) => {
    setStatus("Saving...");
    await setDoc(
      doc(db, "pricingControl", key),
      { ...value, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    setStatus("Live");
  };

  const importFormula = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {
        defval: "",
      });
      const points = rows
        .map((row) => ({
          threshold: Number(row["Unit Greater Than"]),
          markup: Number(row["Fixed Uplift"]),
          saving: Number(
            row["Special per tyre 2 or more remove from the sale price not markup"]
          ),
          rounding: String(row["Round Up"] || ""),
        }))
        .filter((row) => Number.isFinite(row.threshold) && Number.isFinite(row.markup))
        .sort((a, b) => a.threshold - b.threshold);
      if (!points.length) throw new Error("No formula rows found");

      const bands = [];
      points.forEach((point) => {
        const previous = bands[bands.length - 1];
        if (!previous || previous.markup !== point.markup) {
          bands.push({ upTo: point.threshold, markup: point.markup });
        } else {
          previous.upTo = point.threshold;
        }
      });
      bands[bands.length - 1].upTo = 999999;

      const importedRules = {
        ...rules,
        websiteDiscountPercent: 0,
        roundingMode: points.some((point) => /round|nearest/i.test(point.rounding))
          ? "ceilPound"
          : "nearestPenny",
        markupBands: bands,
        importFileName: file.name,
        importedAt: new Date().toISOString(),
      };
      const saving = Math.abs(points[0].saving || 0);
      const importedOffers = {
        ...offers,
        buyTwoTyres: {
          ...offers.buyTwoTyres,
          active: saving > 0,
          minimumQuantity: 2,
          discountType: "fixedPerTyre",
          discountAmount: saving,
          headline: `Buy 2 tyres, save £${saving.toFixed(2)} per tyre`,
        },
      };

      setRules(importedRules);
      setOffers(importedOffers);
      await Promise.all([save("tyres", importedRules), save("offers", importedOffers)]);
    } catch (error) {
      console.error(error);
      alert("Could not import this file. Please use the webcost.xlsx format.");
    } finally {
      event.target.value = "";
    }
  };

  const setBand = (index, field, value) => {
    const markupBands = rules.markupBands.map((band, position) =>
      position === index ? { ...band, [field]: Number(value) } : band
    );
    setRules({ ...rules, markupBands });
  };

  return (
    <section className="adminPage pricingControlPage">
      <div className="adminHero">
        <span>CENTRAL PRICE CONTROL</span>
        <h2>Tyres, Air-Con &amp; Offers</h2>
        <p>Customer prices update through Firebase. MOT and service prices remain under Service Prices.</p>
      </div>

      <div className="adminStats">
        <div className="adminStat"><span>Status</span><strong>{status}</strong></div>
        <div className="adminStat"><span>Tyre bands</span><strong>{rules.markupBands.length}</strong></div>
        <div className="adminStat"><span>Imported file</span><strong className="smallStat">{rules.importFileName || "Manual"}</strong></div>
      </div>

      <div className="adminPanel pricingEditor">
        <div className="adminEditHeader">
          <div><h3>Tyre price formula</h3><p>Import webcost.xlsx or edit the resulting bands below.</p></div>
          <label className="formulaImportButton">Import .xlsx<input type="file" accept=".xlsx,.xls" onChange={importFormula} /></label>
        </div>
        <div className="pricingFields">
          <label>VAT %<input type="number" value={rules.vatPercent} onChange={(e) => setRules({ ...rules, vatPercent: Number(e.target.value) })} onBlur={() => save("tyres", rules)} /></label>
          <label>Rounding<select value={rules.roundingMode} onChange={(e) => { const next = { ...rules, roundingMode: e.target.value }; setRules(next); save("tyres", next); }}><option value="ceilPound">Round up to next £</option><option value="nearestPenny">Nearest penny</option></select></label>
        </div>
        <div className="markupBands">
          {rules.markupBands.map((band, index) => (
            <div className="markupRow" key={index}>
              <label>Cost up to £<input type="number" placeholder="No limit" value={band.upTo >= 999999 ? "" : band.upTo} onChange={(e) => setBand(index, "upTo", e.target.value || 999999)} onBlur={() => save("tyres", rules)} /></label>
              <label>Add £<input type="number" value={band.markup} onChange={(e) => setBand(index, "markup", e.target.value)} onBlur={() => save("tyres", rules)} /></label>
            </div>
          ))}
        </div>
      </div>

      <div className="pricingControlGrid">
        <div className="adminPanel pricingEditor">
          <h3>Air-conditioning</h3>
          {[["r134a", "R134a regas"], ["r1234yf", "R1234yf regas"], ["leakCheck", "Leak check"]].map(([key, label]) => (
            <label key={key}>{label}<input type="number" step="0.01" value={aircon[key]} onChange={(e) => setAircon({ ...aircon, [key]: Number(e.target.value) })} onBlur={() => save("aircon", aircon)} /></label>
          ))}
        </div>
        <div className="adminPanel pricingEditor">
          <h3>Offers</h3>
          <label className="toggleField"><input type="checkbox" checked={offers.buyTwoTyres.active} onChange={(e) => { const next = { ...offers, buyTwoTyres: { ...offers.buyTwoTyres, active: e.target.checked } }; setOffers(next); save("offers", next); }} />Buy two tyre offer active</label>
          <label>Saving per tyre £<input type="number" value={offers.buyTwoTyres.discountAmount} onChange={(e) => setOffers({ ...offers, buyTwoTyres: { ...offers.buyTwoTyres, discountAmount: Number(e.target.value) } })} onBlur={() => save("offers", offers)} /></label>
          <label>Service + MOT add-on £<input type="number" value={offers.serviceMot.addOnPrice} onChange={(e) => setOffers({ ...offers, serviceMot: { ...offers.serviceMot, addOnPrice: Number(e.target.value) } })} onBlur={() => save("offers", offers)} /></label>
        </div>
      </div>
    </section>
  );
}
