import "../admin-pages.css";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { Link, useSearchParams } from "react-router-dom";
import { auth, db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

const API = "https://us-central1-tyremen-system.cloudfunctions.net/saveDirectoryRecord";
const customerFields = [["salutation", "Salutation"], ["name", "Name / company *"], ["email", "Email"], ["phone", "Telephone"], ["mobile", "Mobile"], ["address1", "Address"], ["address2", "Address line 2"], ["town", "Town"], ["postcode", "Postcode"], ["contact", "Account contact"]];
const vehicleFields = [["registration", "Registration *"], ["make", "Make"], ["model", "Model"], ["year", "Year"], ["fuel", "Fuel"], ["engineCC", "Engine cc"], ["mileage", "Mileage"], ["vin", "VIN"], ["motDue", "MOT due"], ["serviceDue", "Service due"], ["frontTyreSize", "Front tyres"], ["rearTyreSize", "Rear tyres"], ["transmission", "Transmission"], ["engineNumber", "Engine number"], ["dateFirstRegistered", "First registered"], ["tyrePressure", "Tyre pressure"], ["wheelTorque", "Wheel nut torque"], ["pcd", "PCD"], ["centreBore", "Centre bore"], ["advisories", "Advisory notes"]];
const text = (value) => String(value ?? "").trim();
const normaliseReg = (value) => text(value).toUpperCase().replace(/\s/g, "");
const csv = (name, headings, rows) => {
  const cell = (value) => { const raw = text(value); const safe = /^[=+@\-\t\r]/.test(raw) ? `'${raw}` : raw; return `"${safe.replaceAll('"', '""')}"`; };
  const lines = [headings.map(cell).join(","), ...rows.map((row) => row.map(cell).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", lines], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default function Directory() {
  const { role } = useAuth();
  const [searchParams] = useSearchParams();
  const directoryQuery = searchParams.get("q") || "";
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState(directoryQuery);
  useEffect(() => { setSearch(directoryQuery); }, [directoryQuery]);
  const [scope, setScope] = useState("all");
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const fail = () => setMessage("Could not load directory records. Check your admin access and Firestore rules.");
    const stops = [
      onSnapshot(collection(db, "customers"), (snap) => setCustomers(snap.docs.map((item) => ({ id: item.id, ...item.data() }))), fail),
      onSnapshot(collection(db, "vehicles"), (snap) => setVehicles(snap.docs.map((item) => ({ id: item.id, ...item.data() }))), fail),
      onSnapshot(collection(db, "invoices"), (snap) => setInvoices(snap.docs.map((item) => ({ id: item.id, ...item.data() }))), fail),
    ];
    return () => stops.forEach((stop) => stop());
  }, []);
  const matches = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (term.length < 2) return [];
    const people = scope === "vehicles" ? [] : customers.filter((item) => (scope !== "accounts" || item.customerType === "account") && [item.name, item.accountNumber, item.postcode, item.email, item.phone, item.mobile, item.contact].join(" ").toLowerCase().includes(term)).map((item) => ({ type: "customer", record: item }));
    const cars = ["all", "vehicles"].includes(scope) ? vehicles.filter((item) => [item.registration, item.make, item.model, item.vin, item.legacyOwnerName].join(" ").toLowerCase().includes(term)).map((item) => ({ type: "vehicle", record: item })) : [];
    return [...people, ...cars].slice(0, 100);
  }, [search, scope, customers, vehicles]);
  const pick = (type, record) => { setSelected({ type, id: record.id }); setDraft({ ...record }); setOwnerSearch(""); setMessage(""); };
  const current = selected?.type === "customer" ? customers.find((item) => item.id === selected.id) : vehicles.find((item) => item.id === selected?.id);
  const linkedCustomer = selected?.type === "vehicle" ? customers.find((item) => item.id === current?.customerId) : null;
  const linkedVehicles = selected?.type === "customer" ? vehicles.filter((item) => item.customerId === selected.id) : [];
  const history = useMemo(() => {
    if (!selected) return [];
    if (selected.type === "vehicle") return invoices.filter((item) => normaliseReg(item.vehicle?.registration) === normaliseReg(current?.registration));
    return invoices.filter((item) => item.customerId === selected.id || (current?.accountNumber && item.customer?.accountNumber === current.accountNumber));
  }, [selected, current, invoices]);
  const matchesOwners = ownerSearch.trim().length < 2 ? [] : customers.filter((item) => [item.name, item.accountNumber, item.postcode].join(" ").toLowerCase().includes(ownerSearch.trim().toLowerCase())).slice(0, 8);
  const save = async () => {
    if (!selected || !draft || saving) return;
    setSaving(true); setMessage("");
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ type: selected.type, id: selected.id === "new" ? "" : selected.id, record: draft }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not save record");
      setSelected({ type: selected.type, id: result.id });
      setMessage(result.changedFields.length ? `Saved ${result.changedFields.join(", ")} with an audit record.` : "No changes to save.");
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  };
  const exportRecords = (which) => {
    if (which === "customers" || which === "accounts") {
      const fields = ["name", "customerType", "accountNumber", "salutation", "address1", "address2", "town", "postcode", "email", "phone", "mobile", "contact", "legacyCreditLimit", "legacyBalance"];
      const rows = which === "accounts" ? customers.filter((item) => item.customerType === "account") : customers;
      return csv(`tyremen-${which}.csv`, ["ID", ...fields], rows.map((row) => [row.id, ...fields.map((key) => row[key])]));
    }
    if (which === "vehicles") return csv("tyremen-vehicles.csv", ["Registration", "Make", "Model", "Customer ID", "MOT due", "Service due", "VIN", "Front tyres", "Rear tyres"], vehicles.map((row) => [row.registration, row.make, row.model, row.customerId, row.motDue, row.serviceDue, row.vin, row.frontTyreSize, row.rearTyreSize]));
    const saleSign = (row) => row.documentType === "invoice" ? 1 : row.documentType === "credit-note" ? -1 : 0;
    return csv("tyremen-sales-history.csv", ["Document", "Type", "Date", "Customer ID", "Customer", "Account", "Registration", "Document Net", "Document VAT", "Document Total", "Paid snapshot", "Status", "Linked Document", "Sales Net (invoice basis)", "Sales VAT (invoice basis)", "Sales Total (invoice basis)"], invoices.map((row) => [row.invoiceNumber, row.documentType, row.invoiceDate, row.customerId, row.customer?.name, row.customer?.accountNumber, row.vehicle?.registration, row.net, row.vat, row.total, row.amountPaid, row.status, row.sourceDocumentNumber || row.convertedInvoiceNumber || "", Number(row.net || 0) * saleSign(row), Number(row.vat || 0) * saleSign(row), Number(row.total || 0) * saleSign(row)]));
  };

  return <section className="adminPage directoryPage">
    <div className="adminHero"><span>CUSTOMERS · VEHICLES · ACCOUNTS</span><h2>Customer directory</h2><p>Find a customer or registration, review connected records, and correct contact and vehicle details.</p></div>
    <div className="directoryTools"><input autoFocus aria-label="Search directory" placeholder="Name, account, postcode, phone, VRM or VIN…" value={search} onChange={(event) => setSearch(event.target.value)} /><select value={scope} onChange={(event) => setScope(event.target.value)}><option value="all">Everything</option><option value="customers">Customers</option><option value="accounts">Credit accounts</option><option value="vehicles">Vehicles</option></select><button type="button" onClick={() => { setSearch(""); setSelected(null); setDraft(null); }}>Clear</button><button type="button" onClick={() => { setSelected({ type: "customer", id: "new" }); setDraft({ name: "", customerType: "retail", town: "Hull" }); }}>+ New customer</button><button type="button" onClick={() => { setSelected({ type: "vehicle", id: "new" }); setDraft({ registration: "" }); }}>+ New vehicle</button><Link to="/legacy-import">AutoCar import</Link></div>
    <div className="directoryExports">{["customers", "accounts", "vehicles", "history"].map((item) => <button type="button" onClick={() => exportRecords(item)} key={item}>Export {item} CSV</button>)}</div>
    {message && <div className="adminInfoBox" role="status">{message}</div>}
    <div className="directoryWorkspace"><div className="adminPanel directoryResults"><h3>Results</h3>{search.trim().length < 2 ? <p>Type at least two characters to search.</p> : !matches.length ? <p>No matching records.</p> : matches.map(({ type, record }) => <button type="button" key={`${type}-${record.id}`} className={selected?.type === type && selected.id === record.id ? "active" : ""} onClick={() => pick(type, record)}><b>{type === "vehicle" ? record.registration : record.name}</b><span>{type === "vehicle" ? `${record.make || ""} ${record.model || ""} · ${record.legacyOwnerName || ""}` : `${record.accountNumber || "Retail"} · ${record.postcode || ""}`}</span></button>)}</div>
      <div className="adminPanel directoryDetail">{!draft ? <p>Select a result to see its full record.</p> : <><div className="adminEditHeader"><div><h3>{selected.type === "vehicle" ? draft.registration : draft.name || "New customer"}</h3><p>{selected.type === "vehicle" ? "Vehicle record" : draft.customerType === "account" ? "Credit account" : "Customer"}</p></div>{selected.type === "vehicle" && <Link to={`/sales?vrm=${encodeURIComponent(draft.registration || "")}`}>Create sale</Link>}{selected.type === "customer" && selected.id !== "new" && <Link to={`/sales?customer=${encodeURIComponent(selected.id)}`}>Create sale</Link>}</div>
        <div className="directoryForm">{(selected.type === "vehicle" ? vehicleFields : customerFields).map(([field, label]) => <label key={field}>{label}<input value={text(draft[field])} readOnly={field === "registration" && selected.id !== "new"} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} /></label>)}
          {selected.type === "customer" && <><label>Type<select value={draft.customerType || "retail"} disabled={role !== "owner"} onChange={(event) => setDraft({ ...draft, customerType: event.target.value })}><option value="retail">Retail</option><option value="trade">Trade</option><option value="account">Credit account</option></select></label><label>Account number<input value={text(draft.accountNumber)} readOnly={role !== "owner"} onChange={(event) => setDraft({ ...draft, accountNumber: event.target.value.toUpperCase() })} /></label></>}
        </div>
        {selected.type === "vehicle" && <div className="directoryLinks"><h4>Linked customer</h4><p>{linkedCustomer ? `${linkedCustomer.name} · ${linkedCustomer.accountNumber || "Retail"}` : draft.legacyOwnerName ? `AutoCar owner: ${draft.legacyOwnerName} (not yet linked)` : "No customer linked"}</p><input placeholder="Find customer to link…" value={ownerSearch} onChange={(event) => setOwnerSearch(event.target.value)} />{matchesOwners.map((item) => <button type="button" key={item.id} onClick={() => { setDraft({ ...draft, customerId: item.id }); setOwnerSearch(""); }}>{item.name} · {item.accountNumber || item.postcode}</button>)}{draft.customerId && <p>Selected customer ID: {draft.customerId}</p>}</div>}
        {selected.type === "customer" && !!linkedVehicles.length && <div className="directoryLinks"><h4>Linked vehicles</h4>{linkedVehicles.map((item) => <button type="button" key={item.id} onClick={() => pick("vehicle", item)}>{item.registration} · {item.make} {item.model}</button>)}</div>}
        <button className="adminPrimaryButton" type="button" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save directory record"}</button>
        <div className="directoryHistory"><h4>Sales history · {history.length}</h4>{!history.length ? <p>No linked sales yet.</p> : history.map((invoice) => <Link key={invoice.id} to={`/sales?invoice=${encodeURIComponent(invoice.id)}`}><b>{invoice.invoiceNumber}</b><span>{invoice.invoiceDate || ""} · {invoice.vehicle?.registration || ""} · {invoice.items?.map((item) => item.description).join(", ")}</span><strong>£{Number(invoice.total || 0).toFixed(2)}</strong></Link>)}</div></>}</div></div>
  </section>;
}
