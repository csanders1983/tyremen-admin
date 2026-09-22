import "../sales.css";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import { calculateInvoice, money } from "../lib/invoiceMath";
import { buildInvoiceHtml } from "../lib/invoiceTemplate";

const FUNCTIONS_ROOT = "https://us-central1-tyremen-system.cloudfunctions.net";
const blankItem = () => ({ type: "service", description: "", stockNumber: "", quantity: 1, unitPriceIncVat: 0, discountIncVat: 0, vatRate: 20, costExVat: 0 });
const blankSale = () => ({
  documentType: "invoice",
  customer: { name: "", email: "", phone: "", address1: "", address2: "", town: "Hull", postcode: "", accountNumber: "", customerType: "retail" },
  vehicle: { registration: "", make: "", model: "", year: "", fuel: "", engineCC: "", mileage: "", vin: "" },
  paymentTerms: "Due on completion",
  termsText: "Payment is due on completion unless account terms have been agreed in writing.",
  amountPaid: 0,
  paymentMethod: "unpaid",
  jobId: "",
  items: [blankItem()],
});

export default function Sales() {
  const { profile, can } = useAuth();
  const [tab, setTab] = useState("new");
  const [draft, setDraft] = useState(blankSale);
  const [invoices, setInvoices] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [vehicleRaw, setVehicleRaw] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "invoices"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => setInvoices(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))));
  }, []);

  const totals = useMemo(() => calculateInvoice(draft.items), [draft.items]);
  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return invoices.filter((invoice) => [invoice.invoiceNumber, invoice.customer?.name, invoice.customer?.email, invoice.vehicle?.registration, invoice.status].join(" ").toLowerCase().includes(term));
  }, [invoices, search]);

  const setCustomer = (field, value) => setDraft((current) => ({ ...current, customer: { ...current.customer, [field]: value } }));
  const setVehicle = (field, value) => setDraft((current) => ({ ...current, vehicle: { ...current.vehicle, [field]: value } }));
  const setItem = (index, field, value) => setDraft((current) => ({
    ...current,
    items: current.items.map((item, position) => position === index ? { ...item, [field]: ["quantity", "unitPriceIncVat", "discountIncVat", "vatRate", "costExVat"].includes(field) ? Number(value) : value } : item),
  }));

  const lookupVehicle = async () => {
    const vrm = draft.vehicle.registration.toUpperCase().replace(/\s/g, "");
    if (!vrm) return setMessage("Enter a registration first.");
    setBusy("vehicle"); setMessage("");
    try {
      const response = await fetch(`${FUNCTIONS_ROOT}/vehicleLookup?vrm=${encodeURIComponent(vrm)}`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Vehicle lookup failed");
      const vehicle = data.vehicle || {};
      setVehicleRaw(vehicle);
      setDraft((current) => ({ ...current, vehicle: {
        ...current.vehicle,
        registration: vehicle.vrm || vrm,
        make: vehicle.make || "",
        model: vehicle.model || "",
        year: vehicle.year || vehicle.registrationYear || "",
        fuel: vehicle.fuel || vehicle.fuelType || "",
        engineCC: vehicle.engineCC || "",
        vin: vehicle.vin || "",
        colour: vehicle.colour || "",
        body: vehicle.body || vehicle.bodyType || "",
        motDue: vehicle.motDue || "",
        frontTyreSize: vehicle.frontTyreSize || vehicle.tyreSize || "",
        rearTyreSize: vehicle.rearTyreSize || "",
      }}));
    } catch (error) {
      setMessage(error.message);
    } finally { setBusy(""); }
  };

  const authenticatedPost = async (path, body) => {
    const token = await auth.currentUser.getIdToken();
    const response = await fetch(`${FUNCTIONS_ROOT}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || `${path} failed`);
    return data;
  };

  const createInvoice = async () => {
    if (!draft.customer.name.trim() || !draft.items.some((item) => item.description.trim())) return setMessage("Add a customer name and at least one sales line.");
    setBusy("create"); setMessage("");
    try {
      const payload = { ...draft, adviserName: profile?.name || auth.currentUser.email, vehicleData: vehicleRaw };
      const data = await authenticatedPost("createAdminInvoice", payload);
      setSelected(data.invoice);
      setMessage(`${data.invoice.invoiceNumber} created successfully.`);
      setDraft(blankSale()); setVehicleRaw(null); setTab("invoices");
    } catch (error) { setMessage(error.message); }
    finally { setBusy(""); }
  };

  const printInvoice = (invoice) => {
    const popup = window.open("", "_blank", "width=1000,height=900");
    popup.document.open(); popup.document.write(buildInvoiceHtml(invoice)); popup.document.close();
    popup.onload = () => { popup.focus(); popup.print(); };
  };

  const emailInvoice = async (invoice) => {
    if (!invoice.customer?.email) return setMessage("Add a customer email address before sending.");
    setBusy(`email-${invoice.id}`); setMessage("");
    try {
      await authenticatedPost("emailAdminInvoice", { invoiceId: invoice.id });
      setMessage(`Invoice emailed to ${invoice.customer.email}.`);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(""); }
  };

  const markPaid = async (invoice) => {
    await updateDoc(doc(db, "invoices", invoice.id), { status: "paid", amountPaid: Number(invoice.total || 0), paidAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  };

  return <section className="adminPage salesPage">
    <div className="adminHero"><span>SALES, CUSTOMERS &amp; VAT INVOICES</span><h2>Workshop Sales</h2><p>Create a retail or account sale, attach the vehicle, calculate VAT and print or email the final invoice.</p></div>
    <div className="salesTabs"><button className={tab === "new" ? "active" : ""} onClick={() => setTab("new")}>New sale</button><button className={tab === "invoices" ? "active" : ""} onClick={() => setTab("invoices")}>Invoices</button></div>
    {message && <div className="adminInfoBox salesMessage">{message}</div>}

    {tab === "new" && <div className="salesWorkspace">
      <div className="salesMain">
        <div className="adminPanel">
          <div className="adminEditHeader"><div><h3>Customer</h3><p>Retail, trade or approved account customer.</p></div><select value={draft.customer.customerType} onChange={(e) => setCustomer("customerType", e.target.value)}><option value="retail">Retail</option><option value="trade">Trade</option><option value="account">Account</option></select></div>
          <div className="salesFormGrid">
            <label className="wide">Customer / company name *<input value={draft.customer.name} onChange={(e) => setCustomer("name", e.target.value)} /></label>
            <label>Email<input type="email" value={draft.customer.email} onChange={(e) => setCustomer("email", e.target.value)} /></label><label>Phone<input value={draft.customer.phone} onChange={(e) => setCustomer("phone", e.target.value)} /></label>
            <label>Account number<input value={draft.customer.accountNumber} onChange={(e) => setCustomer("accountNumber", e.target.value.toUpperCase())} /></label><label>Postcode<input value={draft.customer.postcode} onChange={(e) => setCustomer("postcode", e.target.value.toUpperCase())} /></label>
            <label className="wide">Address<input value={draft.customer.address1} onChange={(e) => setCustomer("address1", e.target.value)} /></label>
          </div>
        </div>

        <div className="adminPanel">
          <h3>Vehicle lookup</h3>
          <div className="vrmLookup"><input placeholder="ENTER REG" value={draft.vehicle.registration} onChange={(e) => setVehicle("registration", e.target.value.toUpperCase())} /><button onClick={lookupVehicle} disabled={busy === "vehicle"}>{busy === "vehicle" ? "CHECKING…" : "LOAD VEHICLE"}</button></div>
          {(draft.vehicle.make || draft.vehicle.model) && <div className="vehicleAdminCard">
            {[['Registration',draft.vehicle.registration],['Vehicle',`${draft.vehicle.year || ''} ${draft.vehicle.make || ''} ${draft.vehicle.model || ''}`],['Fuel / engine',`${draft.vehicle.fuel || '-'} ${draft.vehicle.engineCC ? `· ${draft.vehicle.engineCC}cc` : ''}`],['Body / colour',`${draft.vehicle.body || '-'} ${draft.vehicle.colour ? `· ${draft.vehicle.colour}` : ''}`],['Front tyres',draft.vehicle.frontTyreSize || '-'],['Rear tyres',draft.vehicle.rearTyreSize || '-'],['MOT due',draft.vehicle.motDue || '-'],['VIN',draft.vehicle.vin || '-']].map(([label,value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
            <label>Mileage<input type="number" value={draft.vehicle.mileage} onChange={(e) => setVehicle("mileage", e.target.value)} /></label>
            {vehicleRaw && <details><summary>All available vehicle data</summary><pre>{JSON.stringify(vehicleRaw, null, 2)}</pre></details>}
          </div>}
        </div>

        <div className="adminPanel">
          <div className="adminEditHeader"><div><h3>Sale lines</h3><p>Customer-facing prices are entered including VAT.</p></div><button onClick={() => setDraft((current) => ({ ...current, items: [...current.items, blankItem()] }))}>+ Add line</button></div>
          <div className="salesLineHead"><span>Description</span><span>Type</span><span>Stock no.</span><span>Qty</span><span>Unit inc VAT</span><span>Discount</span><span>VAT</span><span></span></div>
          {draft.items.map((item, index) => <div className="salesLine" key={index}>
            <input value={item.description} onChange={(e) => setItem(index, "description", e.target.value)} placeholder="Tyre, service, MOT, repair…" />
            <select value={item.type} onChange={(e) => setItem(index, "type", e.target.value)}><option value="tyre">Tyre</option><option value="service">Service / repair</option><option value="mot">MOT</option><option value="part">Part</option><option value="roadhero">Space saver</option><option value="alloy">Alloy wheel</option></select>
            <input value={item.stockNumber} onChange={(e) => setItem(index, "stockNumber", e.target.value)} />
            <input type="number" min="0" value={item.quantity} onChange={(e) => setItem(index, "quantity", e.target.value)} />
            <input type="number" min="0" step=".01" value={item.unitPriceIncVat} onChange={(e) => setItem(index, "unitPriceIncVat", e.target.value)} />
            <input type="number" min="0" step=".01" value={item.discountIncVat} onChange={(e) => setItem(index, "discountIncVat", e.target.value)} />
            <select value={item.vatRate} onChange={(e) => setItem(index, "vatRate", e.target.value)}><option value="20">20%</option><option value="0">0%</option></select>
            <button className="danger" onClick={() => setDraft((current) => ({ ...current, items: current.items.filter((_, position) => position !== index) }))}>×</button>
          </div>)}
        </div>
      </div>

      <aside className="adminPanel saleSummary">
        <h3>Sale summary</h3>
        <label>Document type<select value={draft.documentType} onChange={(e) => setDraft({ ...draft, documentType: e.target.value })}><option value="invoice">VAT Invoice</option><option value="quote">Quotation</option><option value="credit-note">Credit note</option></select></label>
        <label>Payment terms<select value={draft.paymentTerms} onChange={(e) => setDraft({ ...draft, paymentTerms: e.target.value })}><option>Due on completion</option><option>7 days</option><option>14 days</option><option>30 days</option><option>30 days end of month</option></select></label>
        <div><span>Net</span><strong>£{money(totals.net)}</strong></div><div><span>VAT</span><strong>£{money(totals.vat)}</strong></div><div className="grand"><span>Total</span><strong>£{money(totals.total)}</strong></div>
        <button className="adminPrimaryButton" disabled={busy === "create"} onClick={createInvoice}>{busy === "create" ? "CREATING…" : "COMPLETE & CREATE DOCUMENT"}</button>
        <small>Invoice numbers and VAT totals are confirmed by the secure server function.</small>
      </aside>
    </div>}

    {tab === "invoices" && <div className="adminPanel">
      <div className="pageTitleRow"><div><h3>Invoices &amp; documents</h3><p>Print, email, record payment and review history.</p></div><input className="searchInput" placeholder="Search invoice, customer or reg…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div className="invoiceList">{filtered.map((invoice) => <article className={selected?.id === invoice.id ? "selected" : ""} key={invoice.id} onClick={() => setSelected(invoice)}>
        <div><small>{invoice.invoiceNumber}</small><strong>{invoice.customer?.name}</strong><span>{invoice.vehicle?.registration || "No vehicle"}</span></div><div><b>£{money(invoice.total)}</b><span className={`invoiceStatus ${invoice.status}`}>{invoice.status || "issued"}</span></div>
        <div className="invoiceActions"><button onClick={(event) => { event.stopPropagation(); printInvoice(invoice); }}>Print / PDF</button><button onClick={(event) => { event.stopPropagation(); emailInvoice(invoice); }} disabled={busy === `email-${invoice.id}`}>{busy === `email-${invoice.id}` ? "Sending…" : "Email"}</button>{invoice.status !== "paid" && can("sales") && <button onClick={(event) => { event.stopPropagation(); markPaid(invoice); }}>Mark paid</button>}</div>
      </article>)}</div>
    </div>}
  </section>;
}
