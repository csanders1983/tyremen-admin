import "../admin-pages.css";
import { useState } from "react";
import * as XLSX from "xlsx";
import { auth } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import { Link } from "react-router-dom";

const API = "https://us-central1-tyremen-system.cloudfunctions.net/importLegacyDirectory";
const clean = (value) => String(value ?? "").trim();
const normalise = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
function mapRows(rows, type) {
  const headers = (rows[0] || []).map(normalise);
  const column = (row, name) => clean(row[headers.indexOf(name)]);
  if (type === "vehicles" && !headers.includes("vrm")) throw new Error("Select the AutoCar vehicles CSV with a VRM column.");
  if (type === "accounts" && !headers.includes("accountnumber")) throw new Error("Select the AutoCar account details CSV with an Account Number column.");
  return rows.slice(1).map((row, index) => type === "vehicles" ? {
    sourceRow: index + 2, registration: column(row, "vrm").replace(/\s/g, "").toUpperCase(), make: column(row, "make"), model: column(row, "model"), legacyOwnerName: column(row, "currentowner"), motDue: column(row, "motdue"), serviceDue: column(row, "servicedue"), tyreCheckDue: column(row, "tyrecheckdue"), taxDue: column(row, "taxdue"), nextInspectionDue: column(row, "nextinspectiondue"),
  } : {
    sourceRow: index + 2, accountNumber: column(row, "accountnumber"), name: column(row, "name"), address1: column(row, "address"), postcode: column(row, "postcode"), contact: column(row, "contact"), mobile: column(row, "mobile"), phone: column(row, "telephone"), creditLimit: column(row, "creditlimit"), legacyBalance: column(row, "balance"),
  }).filter((item) => type === "vehicles" ? item.registration : item.accountNumber && item.name);
}

export default function LegacyImport() {
  const { role } = useAuth();
  const [type, setType] = useState("vehicles");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const choose = async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    setRows([]); setStatus(""); setFileName(file.name);
    try { const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" }); const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "" }); setRows(mapRows(data, type)); }
    catch (error) { setStatus(error.message || "Could not read CSV"); }
  };
  const importRows = async () => {
    if (!rows.length || role !== "owner" || !window.confirm(`Import ${rows.length} ${type} from ${fileName}? Existing records will be kept.`)) return;
    setBusy(true); let imported = 0; let skipped = 0;
    try {
      const token = await auth.currentUser.getIdToken();
      for (let index = 0; index < rows.length; index += 150) {
        const response = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ type, fileName, rows: rows.slice(index, index + 150) }) });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "Import failed");
        imported += result.imported; skipped += result.skipped;
        setStatus(`${imported} imported, ${skipped} already existed. ${Math.min(index + 150, rows.length)} / ${rows.length} checked.`);
      }
      setStatus(`Done: ${imported} imported and ${skipped} existing records kept. Account balances are historical reference only.`);
    } catch (error) { setStatus(`Stopped after ${imported} imports. ${error.message}. Re-upload the same CSV to resume safely.`); }
    finally { setBusy(false); }
  };
  return <section className="adminPage"><div className="adminHero"><span>LEGACY MIGRATION</span><h2>AutoCar import preview</h2><p>Import vehicle and credit account directory records. Historic ledger, payment and activity files need separate financial reconciliation before any posting.</p></div><div className="adminPanel"><Link to="/sales">← Back to sales</Link><div className="salesFormGrid"><label>Import type<select value={type} onChange={(event) => { setType(event.target.value); setRows([]); setFileName(""); }}><option value="vehicles">Vehicles</option><option value="accounts">Credit accounts</option></select></label><label>AutoCar CSV<input type="file" accept=".csv,text/csv" onChange={choose} /></label></div>{fileName && <p>{fileName} · {rows.length} valid rows</p>}{rows.length > 0 && <><h3>Preview: first five rows</h3><div className="legacyPreview">{rows.slice(0, 5).map((row) => <p key={row.sourceRow}>{type === "vehicles" ? `${row.registration} · ${row.make} ${row.model}` : `${row.accountNumber} · ${row.name}`}</p>)}</div><button type="button" className="adminPrimaryButton" onClick={importRows} disabled={busy || role !== "owner"}>{busy ? "Importing…" : `Import ${rows.length} ${type}`}</button></>}{status && <p role="status">{status}</p>}{role !== "owner" && <p>Only the owner can import old records.</p>}</div></section>;
}
