import ItemSearch from '../components/ItemSearch';
import TyreBrandLogo from '../components/TyreBrandLogo';
import {itemDescription,tyreData,upper,isTyre} from '../lib/tyrePresentation';
import "../sales.css";
import "../tyre-foreman.css";
import TechnicianPicker from "../components/TechnicianPicker";
import WheelPositionPicker from "../components/WheelPositionPicker";
import { techniciansFor } from "../lib/tyreWork";
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import { calculateInvoice, money } from "../lib/invoiceMath";
import { buildInvoiceHtml } from "../lib/invoiceTemplate";
import { Link, useSearchParams, useLocation } from "react-router-dom";

const FUNCTIONS_ROOT = "https://us-central1-tyremen-system.cloudfunctions.net";
const ADVISERS = ["Chris Sanders", "Sarah Sanders", "Nigel Love", "Billy McManus", "Dave Bailey", "Damain", "Page Bosworth", "Ellie Sanders", "Mia Sanders", "Ethan", "George Dearlove", "Mally Clixby", "Martin Taylor", "Will Massey", "Darren Blagg", "Kieron BMW", "Jack Wright-Sims"];
const PRICE_LEVELS = [["retail", "Retail"], ["special2Plus", "2+ Special"], ["xtra", "Xtra"], ["supply", "Supply"]];
const PAYMENT_METHODS = [["card", "▣", "Card"], ["cash", "£", "Cash"], ["BACS", "↗", "BACS"], ["web sales", "⌘", "Web sales"], ["eBay", "◉", "eBay"]];
const paymentReference = () => window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const blankItem = () => ({ type: "service", description: "", stockNumber: "", stockProductId: "", priceLevel: "retail", quantity: 1, unitPriceIncVat: 0, discountIncVat: 0, vatRate: 20, costExVat: 0 });
const blankSale = () => ({
  documentType: "invoice",
  depot: "Tyremen Ltd", salesChannel: "Workshop", adviserName: "", purchaseOrderNumber: "", notes: "", advisoryNotes: "", technician: "", workDescription: "", workLineIndices: [],
  customerId: "", customer: { salutation: "", name: "", email: "", phone: "", mobile: "", address1: "", address2: "", town: "Hull", postcode: "", accountNumber: "", customerType: "retail" },
  vehicle: { registration: "", make: "", model: "", year: "", fuel: "", engineCC: "", mileage: "", vin: "" },
  paymentTerms: "Due on completion",
  termsText: "Payment is due on completion unless account terms have been agreed in writing.",
  amountPaid: 0,
  paymentMethod: "unpaid",
  jobId: "",
  items: [blankItem()],
});

export default function Sales() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const appliedDirectoryLink = useRef("");
  const { profile, can } = useAuth();
  const [tab, setTab] = useState("new");
  useEffect(() => { if (location.state?.openNewSale) setTab("new"); }, [location.key, location.state]);
  const [draft, setDraft] = useState(blankSale);
  const [invoices, setInvoices] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [vehicleRaw, setVehicleRaw] = useState(null);
  const [stockProducts, setStockProducts] = useState([]);
  const [itemSearchOpen,setItemSearchOpen]=useState(false);
  const [serviceMaster, setServiceMaster] = useState([]);

  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [paymentDraft, setPaymentDraft] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState({ entries: [], unlistedAmount: 0, loading: false, error: "" });

  useEffect(() => {
    const q = query(collection(db, "invoices"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => setInvoices(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))));
  }, []);

  useEffect(() => onSnapshot(collection(db, "stockProducts"), (snapshot) => setStockProducts(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })))), []);
  useEffect(() => onSnapshot(collection(db, "serviceMaster"), (snapshot) => setServiceMaster(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })))), []);
  useEffect(() => onSnapshot(collection(db, "customers"), (snapshot) => setCustomers(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })))), []);
  useEffect(() => onSnapshot(collection(db, "vehicles"), (snapshot) => setVehicles(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })))), []);

  useEffect(() => {
    const invoiceId = searchParams.get("invoice");
    if (!invoiceId || !invoices.length) return;
    const invoice = invoices.find((entry) => entry.id === invoiceId);
    if (invoice) {
      setSelected(invoice);
      setTab("invoices");
    }
  }, [invoices, searchParams]);
  useEffect(() => {
    if (!selected?.id) return;
    const live = invoices.find((entry) => entry.id === selected.id);
    if (live) setSelected(live);
  }, [invoices, selected?.id]);
  useEffect(() => {
    if (!selected?.id || tab !== "invoices") return;
    let active = true;
    setPaymentHistory({ entries: [], unlistedAmount: 0, loading: true, error: "" });
    (async () => {
      try {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch(`${FUNCTIONS_ROOT}/getAdminPaymentHistory`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ invoiceId: selected.id }) });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "Payment history unavailable");
        if (active) setPaymentHistory({ entries: result.entries || [], unlistedAmount: result.unlistedAmount || 0, loading: false, error: "" });
      } catch (error) { if (active) setPaymentHistory({ entries: [], unlistedAmount: 0, loading: false, error: error.message }); }
    })();
    return () => { active = false; };
  }, [selected?.id, tab]);
  useEffect(() => {
    const customerId = searchParams.get("customer");
    const vrm = searchParams.get("vrm");
    const key = customerId ? `customer:${customerId}` : vrm ? `vrm:${vrm}` : "";
    if (!key || appliedDirectoryLink.current === key) return;
    if (customerId) {
      const found = customers.find((item) => item.id === customerId);
      if (!found) return;
      setDraft((current) => ({ ...current, customerId: found.id, customer: { ...current.customer, ...found } }));
    } else {
      const reg = vrm.toUpperCase().replace(/\s/g, "");
      const found = vehicles.find((item) => item.registration === reg);
      if (!found) return;
      const owner = customers.find((item) => item.id === found.customerId);
      setDraft((current) => ({ ...current, vehicle: { ...current.vehicle, ...found }, ...(owner ? { customerId: owner.id, customer: { ...current.customer, ...owner } } : {}) }));
    }
    appliedDirectoryLink.current = key;
    setTab("new");
  }, [customers, vehicles, searchParams]);

  const totals = useMemo(() => calculateInvoice(draft.items), [draft.items]);
  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return invoices.filter((invoice) => [invoice.invoiceNumber, invoice.customer?.name, invoice.customer?.email, invoice.customer?.postcode, invoice.customer?.accountNumber, invoice.vehicle?.registration, invoice.status].join(" ").toLowerCase().includes(term));
  }, [invoices, search]);
  const matchingCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    return term ? customers.filter((customer) => [customer.name, customer.accountNumber, customer.postcode, customer.phone, customer.mobile].join(" ").toLowerCase().includes(term)).slice(0, 10) : [];
  }, [customers, customerSearch]);
  const storedVehicle = vehicles.find((vehicle) => vehicle.registration === draft.vehicle.registration.replace(/\s/g, "").toUpperCase());
  const vehicleHistory = invoices.filter((entry) => draft.vehicle.registration && entry.vehicle?.registration?.replace(/\s/g, "") === draft.vehicle.registration.replace(/\s/g, "").toUpperCase());
  const setCustomer = (field, value) => setDraft((current) => ({ ...current, customer: { ...current.customer, [field]: value } }));
  const setVehicle = (field, value) => setDraft((current) => ({ ...current, vehicle: { ...current.vehicle, [field]: value } }));
  const setItem = (index, field, value) => setDraft((current) => {
    const parent = current.items[index];
    if(field === "description") value=upper(value);
    const updated = ["quantity", "unitPriceIncVat", "discountIncVat", "vatRate", "costExVat"].includes(field) ? Number(value) : value;
    return { ...current, items: current.items.map((item, position) => position === index ? { ...item, [field]: updated } : field === "quantity" && parent.type === "tyre" && item.parentLineId === parent.lineId ? { ...item, quantity: updated } : item) };
  });

  const addStockLine = (product, priceLevel = "retail") => {
    const field = priceLevel === "special2Plus" ? "special2PlusIncVat" : priceLevel === "xtra" ? "xtraIncVat" : priceLevel === "supply" ? "supplyIncVat" : "retailIncVat";
    const retail = Number(product.retailIncVat || 0);
    const fallback = priceLevel === "special2Plus" ? Math.max(0, retail - 4.9992) : priceLevel === "xtra" ? retail * (retail <= 198 ? 0.92 : 0.96) : priceLevel === "supply" ? (Number(product.costExVat || 0) + 12) * 1.2 : retail;
    const lineId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const line = { lineId, type: product.category === "tyre" ? "tyre" : product.category === "space-saver" ? "roadhero" : product.category === "alloy" ? "alloy" : "part", description: itemDescription(product), ...(isTyre(product)?{...tyreData(product),runFlat:product.runFlat===true,extraLoad:product.extraLoad===true,homologation:product.homologation||"",vehicleType:product.vehicleType||""}:{}), stockNumber: product.sku||product.code, stockProductId: product.source==='oak'?'':product.id,source:product.source||'tyremen', priceLevel, priceLevels: { retail: stockPrice(product, "retail"), special2Plus: stockPrice(product, "special2Plus"), xtra: stockPrice(product, "xtra"), supply: stockPrice(product, "supply") }, quantity: 1, unitPriceIncVat: Number(product.priceLevels?.[priceLevel] ?? product[field] ?? fallback), discountIncVat: 0, vatRate: 20, costExVat: Number(product.costExVat || 0) };
    const codes = line.type === "tyre" ? priceLevel === "retail" ? ["CD", "WB", "TLV"] : ["special2Plus", "xtra"].includes(priceLevel) ? ["CD"] : [] : [];
    const missing = codes.filter((code) => !serviceMaster.some((service) => service.code?.toUpperCase() === code));
    if (missing.length) setMessage(`Set up ${missing.join(", ")} in Service Master before charging these tyre services. No zero-price extras were added.`);
    const extras = codes.flatMap((code) => { const service = serviceMaster.find((item) => item.code?.toUpperCase() === code); return service ? [{ parentLineId: lineId, type: "service", description: upper(service.name), stockNumber: service.code, serviceMasterId: service.id, quantity: 1, unitPriceIncVat: Number(service.retailIncVat || 0), vatRate: Number(service.vatRate ?? 20), discountIncVat: 0, costExVat: Number(service.costExVat || 0) }] : []; });
    setDraft((current) => ({ ...current, items: current.items.length === 1 && !current.items[0].description ? [line, ...extras] : [...current.items, line, ...extras] }));

  };
  const stockPrice = (product, level) => {
    if(product.priceLevels?.[level] !== undefined) return Number(product.priceLevels[level]);
    const retail = Number(product.retailIncVat || 0);
    if (level === "special2Plus") return Number(product.special2PlusIncVat || Math.max(0, retail - 4.9992));
    if (level === "xtra") return Number(product.xtraIncVat || retail * (retail <= 198 ? 0.92 : 0.96));
    if (level === "supply") return Number(product.supplyIncVat || (Number(product.costExVat || 0) + 12) * 1.2);
    return retail;
  };
  const addServiceLine = (service) => {
    const line = { type: service.category === "mot" ? "mot" : "service", description: upper(service.name), stockNumber: service.code, serviceMasterId: service.id, quantity: 1, unitPriceIncVat: Number(service.retailIncVat || 0), discountIncVat: 0, vatRate: Number(service.vatRate ?? 20), costExVat: Number(service.costExVat || 0) };
    setDraft((current) => ({ ...current, items: current.items.length === 1 && !current.items[0].description ? [line] : [...current.items, line] }));

  };
  const chooseCustomer = (customer) => {
    const toAccount = customer.customerType !== "account" || window.confirm("Charge this sale to the credit account? Choose Cancel for a paid retail sale.");
    setDraft((current) => ({ ...current, customerId: customer.id, customer: { ...current.customer, ...customer, customerType: toAccount ? customer.customerType : "retail" } }));
    if (customer.customerType === "account") setMessage(toAccount ? "Credit account selected. Check terms before invoicing." : "Paid sale selected. Record the payment before completing the invoice.");
    setCustomerSearch("");
  };
  const chooseStoredVehicle = (vehicle) => {
    const customer = customers.find((entry) => entry.id === vehicle.customerId);
    setDraft((current) => ({ ...current, vehicle: { ...current.vehicle, ...vehicle }, ...(customer ? { customerId: customer.id, customer: { ...current.customer, ...customer } } : {}) }));
  };
  const changePriceLevel = (index, level) => setDraft((current) => {
    const original = current.items[index];
    const updated = { ...original, priceLevel: level, unitPriceIncVat: Number(original.priceLevels?.[level] ?? original.unitPriceIncVat) };
    const codes = original.type === "tyre" ? level === "retail" ? ["CD", "WB", "TLV"] : ["special2Plus", "xtra"].includes(level) ? ["CD"] : [] : [];
    const extras = codes.flatMap((code) => { const service = serviceMaster.find((item) => item.code?.toUpperCase() === code); return service ? [{ parentLineId: updated.lineId, type: "service", description: upper(service.name), stockNumber: code, serviceMasterId: service.id, quantity: updated.quantity, unitPriceIncVat: Number(service.retailIncVat || 0), vatRate: Number(service.vatRate ?? 20), discountIncVat: 0, costExVat: Number(service.costExVat || 0) }] : []; });
    return { ...current, items: [...current.items.filter((line) => line.parentLineId !== original.lineId).map((line) => line === original ? updated : line), ...extras] };
  });

  const lookupVehicle = async () => {
    const vrm = draft.vehicle.registration.toUpperCase().replace(/\s/g, "");
    if (!vrm) return setMessage("Enter a registration first.");
    setBusy("vehicle"); setMessage("");
    try {
      const response = await fetch(`${FUNCTIONS_ROOT}/vehicleLookupV2?vrm=${encodeURIComponent(vrm)}`);
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
    if (!draft.vehicle.registration.trim() || !draft.vehicle.make.trim() || !draft.vehicle.model.trim()) return setMessage("Registration, make and model are required. Load the vehicle or enter these details before completing the sale.");
    if (!draft.customer.name.trim() || !draft.items.some((item) => item.description.trim())) return setMessage("Add a customer name and at least one sales line.");
    if (!draft.technician) return setMessage("Select the technician responsible for the work.");
    if (Number(draft.amountPaid || 0) > 0 && draft.paymentMethod === "unpaid") return setMessage("Choose a payment method for the amount received.");
    setBusy("create"); setMessage("");
    try {
      const payload = { ...draft, adviserName: draft.adviserName || profile?.name || auth.currentUser.email, vehicleData: vehicleRaw };
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

  const openPayment = (invoice) => {
    const balance = Number(invoice.balanceDue ?? (Number(invoice.total || 0) - Number(invoice.amountPaid || 0)));
    setSelected(invoice);
    setPaymentDraft({ invoiceId: invoice.id, amount: money(balance), method: "card", requestId: paymentReference() });
    setMessage("");
  };
  const recordPayment = async () => {
    if (!paymentDraft || busy) return;
    const invoice = invoices.find((item) => item.id === paymentDraft.invoiceId) || selected;
    const amount = Number(paymentDraft.amount);
    const balance = Number(invoice.balanceDue ?? (Number(invoice.total || 0) - Number(invoice.amountPaid || 0)));
    if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001 || amount > balance + 0.001) return setMessage(`Enter an amount between £0.01 and £${money(balance)}.`);
    setBusy("payment"); setMessage("");
    try {
      const result = await authenticatedPost("recordAdminPayment", { invoiceId: invoice.id, amount, method: paymentDraft.method, requestId: paymentDraft.requestId });
      setSelected((current) => ({ ...current, amountPaid: result.amountPaid, balanceDue: result.balanceDue, status: result.balanceDue ? current.status : "paid" }));
      setPaymentDraft(null);
      setMessage(`£${money(amount)} recorded against ${invoice.invoiceNumber}. Balance £${money(result.balanceDue)}.`);
      try {
        const history = await authenticatedPost("getAdminPaymentHistory", { invoiceId: invoice.id });
        setPaymentHistory({ entries: history.entries || [], unlistedAmount: history.unlistedAmount || 0, loading: false, error: "" });
      } catch (historyError) {
        setPaymentHistory((current) => ({ ...current, loading: false, error: historyError.message }));
      }
    } catch (error) { setMessage(error.message); }
    finally { setBusy(""); }
  };

  const convertDocument = async (document) => {
    if (!can("sales") || !["quote", "order"].includes(document.documentType) || document.convertedTo) return;
    const deposit = Number(document.amountPaid || 0);
    const prompt = `Create a VAT invoice from ${document.invoiceNumber} for £${money(document.total)}?${deposit ? ` The £${money(deposit)} order deposit will carry across.` : ""} The original document will stay in the history.`;
    if (!window.confirm(prompt)) return;
    setBusy(`convert-${document.id}`); setMessage("");
    try {
      const result = await authenticatedPost("convertAdminDocument", { documentId: document.id });
      setSelected(result.invoice);
      setSearch("");
      setSearchParams({ invoice: result.invoice.id });
      setMessage(`${document.invoiceNumber} converted to ${result.invoice.invoiceNumber}. The original remains available.`);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(""); }
  };

  return <section className="adminPage salesPage">
    <div className="adminHero"><span>SALES, CUSTOMERS &amp; VAT INVOICES</span><h2>Workshop Sales</h2><p>Create a retail or account sale, attach the vehicle, calculate VAT and print or email the final invoice.</p></div>
    <div className="salesTabs"><button className={tab === "new" ? "active" : ""} onClick={() => setTab("new")}>New sale</button><button className={tab === "invoices" ? "active" : ""} onClick={() => setTab("invoices")}>Invoices</button><Link to="/legacy-import">AutoCar import preview</Link></div>
    {message && <div className="adminInfoBox salesMessage">{message}</div>}

    {tab === "new" && <nav className="sysSectionNav" aria-label="Sale sections">{[["details","Sale details"],["vehicle","Vehicle"],["customer","Customer"],["items","Items & work"]].map(([id,label]) => <a key={id} href={`#sale-section-${id}`}>{label}</a>)}</nav>}
    {tab === "new" && <div className="salesWorkspace">
      <div className="salesMain">
        <div className="adminPanel" id="sale-section-details"><h3>Sale details</h3><div className="salesFormGrid"><label>Depot<input value={draft.depot} readOnly /></label><label>Sales type<select value={draft.documentType} onChange={(e) => setDraft({ ...draft, documentType: e.target.value, amountPaid: 0 })}><option value="quote">Quote</option><option value="order">Order</option><option value="invoice">VAT invoice</option></select></label><label>Sales adviser<select value={draft.adviserName} onChange={(e) => setDraft({ ...draft, adviserName: e.target.value })}><option value="">Use logged-in staff member</option>{ADVISERS.map((name) => <option key={name}>{name}</option>)}</select></label><label>Channel<select value={draft.salesChannel} onChange={(e) => setDraft({ ...draft, salesChannel: e.target.value })}>{["Workshop", "Book my garage", "Website", "Text", "Email"].map((name) => <option key={name}>{name}</option>)}</select></label><label>Purchase order number<input value={draft.purchaseOrderNumber} onChange={(e) => setDraft({ ...draft, purchaseOrderNumber: e.target.value })} /></label><label className="wide">Private sale notes<textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></label></div></div>
        <div className="adminPanel" id="sale-section-vehicle"><h3>Vehicle · required</h3><p>Enter a registration, then load verified details or use an existing vehicle record.</p>
          <div className="vrmLookup"><input placeholder="ENTER REG" value={draft.vehicle.registration} onChange={(e) => setVehicle("registration", e.target.value.toUpperCase())} /><button onClick={lookupVehicle} disabled={busy === "vehicle"}>{busy === "vehicle" ? "CHECKING…" : "LOAD VEHICLE"}</button><button type="button" onClick={() => navigator.clipboard?.writeText(draft.vehicle.registration)}>Copy registration</button></div>
          {storedVehicle && <button type="button" onClick={() => chooseStoredVehicle(storedVehicle)}>Use saved vehicle and linked customer</button>}
          <div className="salesFormGrid"><label>Make *<input value={draft.vehicle.make || ""} onChange={(e) => setVehicle("make", e.target.value)} /></label><label>Model *<input value={draft.vehicle.model || ""} onChange={(e) => setVehicle("model", e.target.value)} /></label><label>Engine cc<input value={draft.vehicle.engineCC || ""} onChange={(e) => setVehicle("engineCC", e.target.value)} /></label><label>Mileage<input type="number" value={draft.vehicle.mileage || ""} onChange={(e) => setVehicle("mileage", e.target.value)} /></label><label>VIN<input value={draft.vehicle.vin || ""} onChange={(e) => setVehicle("vin", e.target.value)} /></label><label>MOT due<input value={draft.vehicle.motDue || ""} onChange={(e) => setVehicle("motDue", e.target.value)} /></label></div>
          {!!vehicleHistory.length && <details><summary>Sales history for this registration ({vehicleHistory.length})</summary>{vehicleHistory.map((entry) => <p key={entry.id}>{entry.invoiceNumber} · {entry.customer?.name} · £{money(entry.total)} · {entry.items?.filter(isTyre).map((item,i)=><TyreBrandLogo key={i} line={item}/>)} {entry.items?.map((item) => itemDescription(item,isTyre(item))).join(" · ")}</p>)}</details>}
        </div>
        <div className="adminPanel" id="sale-section-customer">
          <div className="adminEditHeader"><div><h3>Customer</h3><p>Retail, trade or approved account customer.</p></div><select value={draft.customer.customerType} onChange={(e) => setCustomer("customerType", e.target.value)}><option value="retail">Retail</option><option value="trade">Trade</option><option value="account">Account</option></select></div>
          <label>Find saved customer by name, account, postcode or phone<input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Search existing records" /></label>{!!matchingCustomers.length && <div className="customerMatches">{matchingCustomers.map((entry) => <button key={entry.id} onClick={() => chooseCustomer(entry)}>{entry.name} · {entry.accountNumber || "Retail"} · {entry.postcode || ""}</button>)}</div>}
          {draft.customerId && <p>Saved customer selected · {draft.customerId}</p>}
          <div className="salesFormGrid">
            <label>Salutation<input value={draft.customer.salutation || ""} onChange={(e) => setCustomer("salutation", e.target.value)} /></label>
            <label className="wide">Customer / company name *<input value={draft.customer.name} onChange={(e) => setCustomer("name", e.target.value)} /></label>
            <label>Email<input type="email" value={draft.customer.email} onChange={(e) => setCustomer("email", e.target.value)} /></label><label>Phone<input value={draft.customer.phone} onChange={(e) => setCustomer("phone", e.target.value)} /></label><label>Mobile<input value={draft.customer.mobile || ""} onChange={(e) => setCustomer("mobile", e.target.value)} /></label>
            <label>Account number<input value={draft.customer.accountNumber} onChange={(e) => setCustomer("accountNumber", e.target.value.toUpperCase())} /></label><label>Postcode<input value={draft.customer.postcode} onChange={(e) => setCustomer("postcode", e.target.value.toUpperCase())} /></label>
            <label className="wide">Address<input value={draft.customer.address1} onChange={(e) => setCustomer("address1", e.target.value)} /></label>
          </div>
        </div>

        <div className="adminPanel">
          <h3>Vehicle specification</h3>
          {(draft.vehicle.make || draft.vehicle.model) && <div className="vehicleAdminCard">
            {[['Registration',draft.vehicle.registration],['Vehicle',`${draft.vehicle.year || ''} ${draft.vehicle.make || ''} ${draft.vehicle.model || ''}`],['Fuel / engine',`${draft.vehicle.fuel || '-'} ${draft.vehicle.engineCC ? `· ${draft.vehicle.engineCC}cc` : ''}`],['Body / colour',`${draft.vehicle.body || '-'} ${draft.vehicle.colour ? `· ${draft.vehicle.colour}` : ''}`],['Front tyres',draft.vehicle.frontTyreSize || '-'],['Rear tyres',draft.vehicle.rearTyreSize || '-'],['MOT due',draft.vehicle.motDue || '-'],['VIN',draft.vehicle.vin || '-']].map(([label,value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
            <label>Mileage<input type="number" value={draft.vehicle.mileage} onChange={(e) => setVehicle("mileage", e.target.value)} /></label>
            {vehicleRaw && <details><summary>All available vehicle data</summary><pre>{JSON.stringify(vehicleRaw, null, 2)}</pre></details>}
          </div>}
        </div>

        <div className="adminPanel" id="sale-section-items">
          <div className="adminEditHeader"><div><h3>Sale lines</h3><p>Customer-facing prices are entered including VAT.</p></div><button onClick={() => setDraft((current) => ({ ...current, items: [...current.items, blankItem()] }))}>+ Add line</button></div>
          <button type="button" className="itemSearchToggle" onClick={()=>setItemSearchOpen(v=>!v)}>+ Add tyre / service / part — search stock</button>
          {itemSearchOpen && <ItemSearch stockProducts={stockProducts} serviceMaster={serviceMaster} onClose={()=>setItemSearchOpen(false)} onSelect={(p,kind,level)=>kind==='service'?addServiceLine(p):addStockLine(p,level)}/>}
          <div className="salesLineWorkspace"><div className="salesLineHead"><span>Description</span><span>Type</span><span>Stock no.</span><span>Qty</span><span>Unit inc VAT</span><span>Discount</span><span>VAT</span><span></span></div>
          {draft.items.map((item, index) => <div className="salesLine" key={index}>
            {isTyre(item)&&<div className="tyreLineSummary"><TyreBrandLogo line={item}/><strong>{itemDescription(item,true)}</strong></div>}
            <WheelPositionPicker line={item} onChange={positions => setItem(index, "positions", positions)} />
            <input value={item.description} onChange={(e) => setItem(index, "description", e.target.value)} placeholder="Tyre, service, MOT, repair…" />
            <select value={item.type} onChange={(e) => setItem(index, "type", e.target.value)}><option value="tyre">Tyre</option><option value="service">Service / repair</option><option value="mot">MOT</option><option value="part">Part</option><option value="roadhero">Space saver</option><option value="alloy">Alloy wheel</option></select>
            <input value={item.stockNumber} onChange={(e) => setItem(index, "stockNumber", e.target.value)} />
            <input type="number" min="0" value={item.quantity} onChange={(e) => setItem(index, "quantity", e.target.value)} />
            <div>{item.priceLevels && <select aria-label="Price level" value={item.priceLevel} onChange={(e) => changePriceLevel(index, e.target.value)}>{PRICE_LEVELS.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select>}<input type="number" min="0" step=".01" value={item.unitPriceIncVat} onChange={(e) => setItem(index, "unitPriceIncVat", e.target.value)} /></div>
            <input type="number" min="0" step=".01" value={item.discountIncVat} onChange={(e) => setItem(index, "discountIncVat", e.target.value)} />
            <select value={item.vatRate} onChange={(e) => setItem(index, "vatRate", e.target.value)}><option value="20">20%</option><option value="0">0%</option></select>
            <button className="danger" onClick={() => setDraft((current) => ({ ...current, workLineIndices: [], items: current.items.filter((entry, position) => position !== index && (!item.lineId || entry.parentLineId !== item.lineId)) }))}>×</button>
          </div>)}</div>
          <div className="salesFormGrid"><TechnicianPicker value={techniciansFor(draft)} onChange={technicians => setDraft({ ...draft, technicians, technician: technicians[0] || "" })} required /><label className="wide">Work shown to customer<textarea value={draft.workDescription} placeholder="e.g. MOT and full service as requested" onChange={(e) => setDraft({ ...draft, workDescription: e.target.value })} /></label><div className="wide"><p>Choose lines to group on the customer document; all original lines remain in the internal invoice record.</p>{draft.items.map((item, index) => <label key={index}><input type="checkbox" checked={draft.workLineIndices.includes(index)} onChange={(e) => setDraft((current) => ({ ...current, workLineIndices: e.target.checked ? [...current.workLineIndices, index] : current.workLineIndices.filter((value) => value !== index) }))} /> {item.description || `Line ${index + 1}`}</label>)}</div><label className="wide">Advisory notes<textarea value={draft.advisoryNotes} onChange={(e) => setDraft({ ...draft, advisoryNotes: e.target.value })} /></label></div>
        </div>
      </div>

      <aside className="adminPanel saleSummary">
        <h3>Sale summary</h3>
        {draft.documentType !== "quote" && <div className="paymentFields"><h4>{draft.documentType === "order" ? "Optional deposit or full payment" : "Payment"}</h4><label>Amount paid £<input type="number" min="0" max={totals.total} step=".01" value={draft.amountPaid} onChange={(e) => setDraft({ ...draft, amountPaid: e.target.value })} /></label><div className="openingPaymentMethod"><span>How was it paid?</span><div className="salesMethodChoices"><button type="button" aria-pressed={draft.paymentMethod === "unpaid"} className={draft.paymentMethod === "unpaid" ? "active" : ""} onClick={() => setDraft({ ...draft, paymentMethod: "unpaid" })}>No payment</button>{PAYMENT_METHODS.map(([key, icon, label]) => <button type="button" key={key} aria-pressed={draft.paymentMethod === key} className={draft.paymentMethod === key ? "active" : ""} onClick={() => setDraft({ ...draft, paymentMethod: key })}><b aria-hidden="true">{icon}</b>{label}</button>)}</div></div></div>}
        <label>Payment terms<select value={draft.paymentTerms} onChange={(e) => setDraft({ ...draft, paymentTerms: e.target.value })}><option>Due on completion</option><option>7 days</option><option>14 days</option><option>30 days</option><option>30 days end of month</option></select></label>
        <div><span>Net</span><strong>£{money(totals.net)}</strong></div><div><span>VAT</span><strong>£{money(totals.vat)}</strong></div><div className="grand"><span>Total</span><strong>£{money(totals.total)}</strong></div>
        <button className="adminPrimaryButton" disabled={busy === "create"} onClick={createInvoice}>{busy === "create" ? "CREATING…" : "COMPLETE & CREATE DOCUMENT"}</button>
        <small>Invoice numbers and VAT totals are confirmed by the secure server function.</small>
      </aside>
    </div>}

    {tab === "invoices" && <div className="adminPanel">
      <div className="pageTitleRow"><div><h3>Invoices &amp; documents</h3><p>Print, email, record payment and review history.</p></div><input className="searchInput" placeholder="Search invoice, customer or reg…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      {selected && <div className="salesDocumentLink"><b>{selected.invoiceNumber}</b><span>{selected.sourceDocumentNumber ? `Invoiced from ${selected.sourceDocumentNumber}` : selected.convertedTo ? `Converted to ${selected.convertedInvoiceNumber}` : selected.documentType === "order" ? `Deposit £${money(selected.amountPaid)} · Balance £${money(selected.balanceDue)}` : selected.documentType === "quote" ? "Quotation" : `Balance £${money(selected.balanceDue)}`}</span>{selected.convertedTo && <button type="button" onClick={() => { setSearch(""); setSearchParams({ invoice: selected.convertedTo }); }}>Open linked invoice</button>}{selected.sourceDocumentId && <button type="button" onClick={() => { setSearch(""); setSearchParams({ invoice: selected.sourceDocumentId }); }}>Open original {selected.sourceDocumentType}</button>}</div>}
      {selected && <div className="salesPaymentPanel"><div className="salesPaymentHeader"><div><h4>Payments · {selected.invoiceNumber}</h4><p>Paid £{money(selected.amountPaid)} · Remaining £{money(selected.balanceDue ?? (Number(selected.total || 0) - Number(selected.amountPaid || 0)))}</p></div>{paymentDraft?.invoiceId === selected.id && <button type="button" onClick={() => setPaymentDraft(null)}>Close payment</button>}</div>
        {paymentDraft?.invoiceId === selected.id && <div className="salesPaymentEntry"><label>Amount received (£)<input type="number" min="0.01" max={selected.balanceDue} step="0.01" value={paymentDraft.amount} onChange={(event) => setPaymentDraft({ ...paymentDraft, amount: event.target.value, requestId: paymentReference() })} /></label><div><span>Payment method</span><div className="salesMethodChoices">{PAYMENT_METHODS.map(([key, icon, label]) => <button type="button" key={key} aria-pressed={paymentDraft.method === key} className={paymentDraft.method === key ? "active" : ""} onClick={() => setPaymentDraft({ ...paymentDraft, method: key, requestId: paymentReference() })}><b aria-hidden="true">{icon}</b>{label}</button>)}</div></div><button type="button" className="adminPrimaryButton" disabled={busy === "payment"} onClick={recordPayment}>{busy === "payment" ? "Recording…" : `Record £${money(paymentDraft.amount)} payment`}</button></div>}
        <div className="salesPaymentHistory"><strong>Payment history</strong>{paymentHistory.loading ? <span>Loading…</span> : paymentHistory.error ? <span>{paymentHistory.error}</span> : <>{paymentHistory.entries.map((entry) => <div key={entry.id}><span>{entry.kind === "opening" ? "Opening payment" : "Payment"} · {entry.method}{entry.documentId !== selected.id ? ` · ${entry.invoiceNumber}` : ""}<small>{entry.date ? new Date(entry.date).toLocaleString("en-GB") : ""} · {entry.by}</small></span><b>£{money(entry.amount)}</b></div>)}{paymentHistory.unlistedAmount > 0 && <div><span>Previously recorded paid amount<small>Entered before payment history was available</small></span><b>£{money(paymentHistory.unlistedAmount)}</b></div>}{!paymentHistory.entries.length && !paymentHistory.unlistedAmount && <span>No payments recorded.</span>}</>}</div>
      </div>}
      <div className="invoiceList">{filtered.map((invoice) => <article className={selected?.id === invoice.id ? "selected" : ""} key={invoice.id} onClick={() => setSelected(invoice)}>
        <div><small>{invoice.invoiceNumber}</small><strong>{invoice.customer?.name}</strong><span>{invoice.vehicle?.registration || "No vehicle"}{invoice.sourceDocumentNumber ? ` · From ${invoice.sourceDocumentNumber}` : invoice.convertedInvoiceNumber ? ` · To ${invoice.convertedInvoiceNumber}` : ""}</span></div><div><b>£{money(invoice.total)}</b><span className={`invoiceStatus ${invoice.status}`}>{invoice.status || "issued"}</span></div>
        <div className="invoiceActions"><button type="button" onClick={(event) => { event.stopPropagation(); printInvoice(invoice); }}>Print / PDF</button><button type="button" onClick={(event) => { event.stopPropagation(); emailInvoice(invoice); }} disabled={busy === `email-${invoice.id}`}>{busy === `email-${invoice.id}` ? "Sending…" : "Email"}</button>{["quote", "order"].includes(invoice.documentType) && !invoice.convertedTo && can("sales") && <button type="button" className="convertButton" disabled={Boolean(busy)} onClick={(event) => { event.stopPropagation(); convertDocument(invoice); }}>{busy === `convert-${invoice.id}` ? "Converting…" : "Create VAT invoice"}</button>}{invoice.status !== "paid" && !invoice.convertedTo && ["invoice", "order"].includes(invoice.documentType) && can("sales") && <button type="button" onClick={(event) => { event.stopPropagation(); openPayment(invoice); }}>Record payment</button>}</div>
      </article>)}</div>
    </div>}
  </section>;
}
