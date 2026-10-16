import ItemSearch from '../components/ItemSearch';
import TyreBrandLogo from '../components/TyreBrandLogo';
import { itemDescription, tyreData, upper, isTyre } from '../lib/tyrePresentation';
import "../sales.css";
import "../sales-simple.css";
import { saleStepError } from "../lib/saleFlow";
import "../tyre-foreman.css";
import TechnicianPicker from "../components/TechnicianPicker";
import WheelPositionPicker from "../components/WheelPositionPicker";
import { techniciansFor, wheelWork } from "../lib/tyreWork";
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
const blankItem = () => ({
  type: "service",
  description: "",
  stockNumber: "",
  stockProductId: "",
  priceLevel: "retail",
  quantity: 1,
  unitPriceIncVat: 0,
  discountIncVat: 0,
  vatRate: 20,
  costExVat: 0
});
const blankSale = () => ({
  documentType: "invoice",
  depot: "Tyremen Ltd",
  salesChannel: "Workshop",
  adviserName: "",
  purchaseOrderNumber: "",
  notes: "",
  advisoryNotes: "",
  technician: "",
  workDescription: "",
  workLineIndices: [],
  customerId: "",
  customer: {
    salutation: "",
    name: "",
    email: "",
    phone: "",
    mobile: "",
    address1: "",
    address2: "",
    town: "Hull",
    postcode: "",
    accountNumber: "",
    customerType: "retail"
  },
  vehicle: {
    registration: "",
    make: "",
    model: "",
    year: "",
    fuel: "",
    engineCC: "",
    mileage: "",
    vin: ""
  },
  paymentTerms: "Due on completion",
  termsText: "Payment is due on completion unless account terms have been agreed in writing.",
  amountPaid: 0,
  paymentMethod: "unpaid",
  jobId: "",
  items: [blankItem()]
});
export default function Sales() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const appliedDirectoryLink = useRef("");
  const {
    profile,
    can
  } = useAuth();
  const [tab, setTab] = useState("new");
  const [visibleDocuments, setVisibleDocuments] = useState(100);
  const [saleStep, setSaleStep] = useState(0),
    [documentFilter, setDocumentFilter] = useState("all"),
    [statusFilter, setStatusFilter] = useState("all");
  useEffect(() => {
    if (location.state?.openNewSale) {
      setTab("new");
      setSaleStep(0);
    }
  }, [location.key, location.state]);
  const [draft, setDraft] = useState(blankSale);
  const [invoices, setInvoices] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [vehicleRaw, setVehicleRaw] = useState(null);
  const [stockProducts, setStockProducts] = useState([]);
  const [itemSearchOpen, setItemSearchOpen] = useState(false);
  const [serviceMaster, setServiceMaster] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [paymentDraft, setPaymentDraft] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState({
    entries: [],
    unlistedAmount: 0,
    loading: false,
    error: ""
  });
  useEffect(() => {
    const q = query(collection(db, "invoices"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snapshot => setInvoices(snapshot.docs.map(entry => ({
      id: entry.id,
      ...entry.data()
    }))));
  }, []);
  useEffect(() => onSnapshot(collection(db, "stockProducts"), snapshot => setStockProducts(snapshot.docs.map(entry => ({
    id: entry.id,
    ...entry.data()
  })))), []);
  useEffect(() => onSnapshot(collection(db, "serviceMaster"), snapshot => setServiceMaster(snapshot.docs.map(entry => ({
    id: entry.id,
    ...entry.data()
  })))), []);
  useEffect(() => onSnapshot(collection(db, "customers"), snapshot => setCustomers(snapshot.docs.map(entry => ({
    id: entry.id,
    ...entry.data()
  })))), []);
  useEffect(() => onSnapshot(collection(db, "vehicles"), snapshot => setVehicles(snapshot.docs.map(entry => ({
    id: entry.id,
    ...entry.data()
  })))), []);
  useEffect(() => {
    const invoiceId = searchParams.get("invoice");
    if (!invoiceId || !invoices.length) return;
    const invoice = invoices.find(entry => entry.id === invoiceId);
    if (invoice) {
      setSelected(invoice);
      setTab("invoices");
    }
  }, [invoices, searchParams]);
  useEffect(() => {
    if (!selected?.id) return;
    const live = invoices.find(entry => entry.id === selected.id);
    if (live) setSelected(live);
  }, [invoices, selected?.id]);
  useEffect(() => {
    if (!selected?.id || tab !== "invoices") return;
    let active = true;
    setPaymentHistory({
      entries: [],
      unlistedAmount: 0,
      loading: true,
      error: ""
    });
    (async () => {
      try {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch(`${FUNCTIONS_ROOT}/getAdminPaymentHistory`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            invoiceId: selected.id
          })
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "Payment history unavailable");
        if (active) setPaymentHistory({
          entries: result.entries || [],
          unlistedAmount: result.unlistedAmount || 0,
          loading: false,
          error: ""
        });
      } catch (error) {
        if (active) setPaymentHistory({
          entries: [],
          unlistedAmount: 0,
          loading: false,
          error: error.message
        });
      }
    })();
    return () => {
      active = false;
    };
  }, [selected?.id, tab]);
  useEffect(() => {
    const customerId = searchParams.get("customer");
    const vrm = searchParams.get("vrm");
    const key = customerId ? `customer:${customerId}` : vrm ? `vrm:${vrm}` : "";
    if (!key || appliedDirectoryLink.current === key) return;
    if (customerId) {
      const found = customers.find(item => item.id === customerId);
      if (!found) return;
      setDraft(current => ({
        ...current,
        customerId: found.id,
        customer: {
          ...current.customer,
          ...found
        }
      }));
    } else {
      const reg = vrm.toUpperCase().replace(/\s/g, "");
      const found = vehicles.find(item => item.registration === reg);
      if (!found) return;
      const owner = customers.find(item => item.id === found.customerId);
      setDraft(current => ({
        ...current,
        vehicle: {
          ...current.vehicle,
          ...found
        },
        ...(owner ? {
          customerId: owner.id,
          customer: {
            ...current.customer,
            ...owner
          }
        } : {})
      }));
    }
    appliedDirectoryLink.current = key;
    setTab("new");
    setSaleStep(0);
  }, [customers, vehicles, searchParams]);
  const totals = useMemo(() => calculateInvoice(draft.items), [draft.items]);
  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return invoices.filter(invoice => [invoice.invoiceNumber, invoice.customer?.name, invoice.customer?.email, invoice.customer?.postcode, invoice.customer?.accountNumber, invoice.customer?.phone, invoice.customer?.mobile, invoice.vehicle?.registration, invoice.status, invoice.invoiceDate].join(" ").toLowerCase().includes(term) && (documentFilter === "all" || (invoice.documentType || "invoice") === documentFilter) && (statusFilter === "all" || (invoice.status || "issued") === statusFilter));
  }, [invoices, search, documentFilter, statusFilter]);
  useEffect(() => setVisibleDocuments(100), [search, documentFilter, statusFilter]);
  useEffect(() => {
    if (selected?.id && tab === "invoices") requestAnimationFrame(() => document.getElementById("selected-sales-document")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    }));
  }, [selected?.id, tab]);
  const matchingCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    return term ? customers.filter(customer => [customer.name, customer.accountNumber, customer.postcode, customer.phone, customer.mobile].join(" ").toLowerCase().includes(term)).slice(0, 10) : [];
  }, [customers, customerSearch]);
  const storedVehicle = vehicles.find(vehicle => vehicle.registration === draft.vehicle.registration.replace(/\s/g, "").toUpperCase());
  const vehicleHistory = invoices.filter(entry => draft.vehicle.registration && entry.vehicle?.registration?.replace(/\s/g, "") === draft.vehicle.registration.replace(/\s/g, "").toUpperCase());
  const setCustomer = (field, value) => setDraft(current => ({
    ...current,
    customer: {
      ...current.customer,
      [field]: value
    }
  }));
  const setVehicle = (field, value) => {
    if (field === "registration") setVehicleRaw(null);
    setDraft(current => ({
      ...current,
      vehicle: field === "registration" && current.vehicle.registration !== value ? {
        ...blankSale().vehicle,
        registration: value
      } : {
        ...current.vehicle,
        [field]: value
      }
    }));
  };
  const setItem = (index, field, value) => setDraft(current => {
    const parent = current.items[index];
    if (field === "description") value = upper(value);
    const updated = ["quantity", "unitPriceIncVat", "discountIncVat", "vatRate", "costExVat"].includes(field) ? Number(value) : value;
    return {
      ...current,
      items: current.items.map((item, position) => position === index ? {
        ...item,
        [field]: updated
      } : field === "quantity" && parent.type === "tyre" && item.parentLineId === parent.lineId ? {
        ...item,
        quantity: updated
      } : item)
    };
  });
  const addStockLine = (product, priceLevel = "retail") => {
    const field = priceLevel === "special2Plus" ? "special2PlusIncVat" : priceLevel === "xtra" ? "xtraIncVat" : priceLevel === "supply" ? "supplyIncVat" : "retailIncVat";
    const retail = Number(product.retailIncVat || 0);
    const fallback = priceLevel === "special2Plus" ? Math.max(0, retail - 4.9992) : priceLevel === "xtra" ? retail * (retail <= 198 ? 0.92 : 0.96) : priceLevel === "supply" ? (Number(product.costExVat || 0) + 12) * 1.2 : retail;
    const lineId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const line = {
      lineId,
      type: product.category === "tyre" ? "tyre" : product.category === "space-saver" ? "roadhero" : product.category === "alloy" ? "alloy" : "part",
      description: itemDescription(product),
      ...(isTyre(product) ? {
        ...tyreData(product),
        runFlat: product.runFlat === true,
        extraLoad: product.extraLoad === true,
        homologation: product.homologation || "",
        vehicleType: product.vehicleType || ""
      } : {}),
      stockNumber: product.sku || product.code,
      stockProductId: product.source === 'oak' ? '' : product.id,
      source: product.source || 'tyremen',
      priceLevel,
      priceLevels: {
        retail: stockPrice(product, "retail"),
        special2Plus: stockPrice(product, "special2Plus"),
        xtra: stockPrice(product, "xtra"),
        supply: stockPrice(product, "supply")
      },
      quantity: 1,
      unitPriceIncVat: Number(product.priceLevels?.[priceLevel] ?? product[field] ?? fallback),
      discountIncVat: 0,
      vatRate: 20,
      costExVat: Number(product.costExVat || 0)
    };
    const codes = line.type === "tyre" ? priceLevel === "retail" ? ["CD", "WB", "TLV"] : ["special2Plus", "xtra"].includes(priceLevel) ? ["CD"] : [] : [];
    const missing = codes.filter(code => !serviceMaster.some(service => service.code?.toUpperCase() === code));
    if (missing.length) setMessage(`Set up ${missing.join(", ")} in Service Master before charging these tyre services. No zero-price extras were added.`);
    const extras = codes.flatMap(code => {
      const service = serviceMaster.find(item => item.code?.toUpperCase() === code);
      return service ? [{
        parentLineId: lineId,
        type: "service",
        description: upper(service.name),
        stockNumber: service.code,
        serviceMasterId: service.id,
        quantity: 1,
        unitPriceIncVat: Number(service.retailIncVat || 0),
        vatRate: Number(service.vatRate ?? 20),
        discountIncVat: 0,
        costExVat: Number(service.costExVat || 0)
      }] : [];
    });
    setDraft(current => ({
      ...current,
      items: current.items.length === 1 && !current.items[0].description ? [line, ...extras] : [...current.items, line, ...extras]
    }));
  };
  const stockPrice = (product, level) => {
    if (product.priceLevels?.[level] !== undefined) return Number(product.priceLevels[level]);
    const retail = Number(product.retailIncVat || 0);
    if (level === "special2Plus") return Number(product.special2PlusIncVat || Math.max(0, retail - 4.9992));
    if (level === "xtra") return Number(product.xtraIncVat || retail * (retail <= 198 ? 0.92 : 0.96));
    if (level === "supply") return Number(product.supplyIncVat || (Number(product.costExVat || 0) + 12) * 1.2);
    return retail;
  };
  const addServiceLine = service => {
    const line = {
      type: service.category === "mot" ? "mot" : "service",
      description: upper(service.name),
      stockNumber: service.code,
      serviceMasterId: service.id,
      quantity: 1,
      unitPriceIncVat: Number(service.retailIncVat || 0),
      discountIncVat: 0,
      vatRate: Number(service.vatRate ?? 20),
      costExVat: Number(service.costExVat || 0)
    };
    setDraft(current => ({
      ...current,
      items: current.items.length === 1 && !current.items[0].description ? [line] : [...current.items, line]
    }));
  };
  const chooseCustomer = customer => {
    const toAccount = customer.customerType !== "account" || window.confirm("Charge this sale to the credit account? Choose Cancel for a paid retail sale.");
    setDraft(current => ({
      ...current,
      customerId: customer.id,
      customer: {
        ...current.customer,
        ...customer,
        customerType: toAccount ? customer.customerType : "retail"
      }
    }));
    if (customer.customerType === "account") setMessage(toAccount ? "Credit account selected. Check terms before invoicing." : "Paid sale selected. Record the payment before completing the invoice.");
    setCustomerSearch("");
  };
  const chooseStoredVehicle = vehicle => {
    const customer = customers.find(entry => entry.id === vehicle.customerId);
    setDraft(current => ({
      ...current,
      vehicle: {
        ...current.vehicle,
        ...vehicle
      },
      ...(customer ? {
        customerId: customer.id,
        customer: {
          ...current.customer,
          ...customer
        }
      } : {})
    }));
  };
  const changePriceLevel = (index, level) => setDraft(current => {
    const original = current.items[index];
    const updated = {
      ...original,
      priceLevel: level,
      unitPriceIncVat: Number(original.priceLevels?.[level] ?? original.unitPriceIncVat)
    };
    const codes = original.type === "tyre" ? level === "retail" ? ["CD", "WB", "TLV"] : ["special2Plus", "xtra"].includes(level) ? ["CD"] : [] : [];
    const extras = codes.flatMap(code => {
      const service = serviceMaster.find(item => item.code?.toUpperCase() === code);
      return service ? [{
        parentLineId: updated.lineId,
        type: "service",
        description: upper(service.name),
        stockNumber: code,
        serviceMasterId: service.id,
        quantity: updated.quantity,
        unitPriceIncVat: Number(service.retailIncVat || 0),
        vatRate: Number(service.vatRate ?? 20),
        discountIncVat: 0,
        costExVat: Number(service.costExVat || 0)
      }] : [];
    });
    return {
      ...current,
      items: [...current.items.filter(line => line.parentLineId !== original.lineId).map(line => line === original ? updated : line), ...extras]
    };
  });
  const lookupVehicle = async () => {
    const vrm = draft.vehicle.registration.toUpperCase().replace(/\s/g, "");
    if (!vrm) return setMessage("Enter a registration first.");
    setBusy("vehicle");
    setMessage("");
    try {
      const response = await fetch(`${FUNCTIONS_ROOT}/vehicleLookupV2?vrm=${encodeURIComponent(vrm)}`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Vehicle lookup failed");
      const vehicle = data.vehicle || data;
      setVehicleRaw(vehicle);
      setDraft(current => ({
        ...current,
        vehicle: {
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
          rearTyreSize: vehicle.rearTyreSize || ""
        }
      }));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy("");
    }
  };
  const authenticatedPost = async (path, body) => {
    const token = await auth.currentUser.getIdToken();
    const response = await fetch(`${FUNCTIONS_ROOT}/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || `${path} failed`);
    return data;
  };
  const createInvoice = async () => {
    if (busy) return;
    const stepError = saleStepError(draft, 1, wheelWork);
    if (stepError) {
      setMessage(stepError);
      setSaleStep(saleStepError(draft, 0) ? 0 : 1);
      return;
    }
    if (!draft.vehicle.registration.trim() || !draft.vehicle.make.trim() || !draft.vehicle.model.trim()) return setMessage("Registration, make and model are required. Load the vehicle or enter these details before completing the sale.");
    if (!draft.customer.name.trim() || !draft.items.some(item => item.description.trim())) return setMessage("Add a customer name and at least one sales line.");
    if (!draft.technician) return setMessage("Select the technician responsible for the work.");
    if (Number(draft.amountPaid || 0) > 0 && draft.paymentMethod === "unpaid") return setMessage("Choose a payment method for the amount received.");
    setBusy("create");
    setMessage("");
    try {
      const payload = {
        ...draft,
        adviserName: draft.adviserName || profile?.name || auth.currentUser.email,
        vehicleData: vehicleRaw
      };
      const data = await authenticatedPost("createAdminInvoice", payload);
      setSelected(data.invoice);
      setSearchParams({
        invoice: data.invoice.id
      });
      setPaymentDraft(null);
      setMessage(`${data.invoice.invoiceNumber} created successfully.`);
      setDraft(blankSale());
      setVehicleRaw(null);
      setSaleStep(0);
      setDocumentFilter("all");
      setStatusFilter("all");
      setSearch("");
      setTab("invoices");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy("");
    }
  };
  const printInvoice = invoice => {
    const popup = window.open("", "_blank", "width=1000,height=900");
    if (!popup) return setMessage("Allow pop-ups to print this document.");
    popup.document.open();
    popup.document.write(buildInvoiceHtml(invoice));
    popup.document.close();
    popup.onload = () => {
      popup.focus();
      popup.print();
    };
  };
  const emailInvoice = async invoice => {
    if (!invoice.customer?.email) return setMessage("Add a customer email address before sending.");
    setBusy(`email-${invoice.id}`);
    setMessage("");
    try {
      await authenticatedPost("emailAdminInvoice", {
        invoiceId: invoice.id
      });
      setMessage(`Invoice emailed to ${invoice.customer.email}.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy("");
    }
  };
  const openPayment = invoice => {
    const balance = Number(invoice.balanceDue ?? Number(invoice.total || 0) - Number(invoice.amountPaid || 0));
    setSelected(invoice);
    setSearchParams({
      invoice: invoice.id
    });
    setPaymentDraft({
      invoiceId: invoice.id,
      amount: money(balance),
      method: "card",
      requestId: paymentReference()
    });
    setMessage("");
  };
  const recordPayment = async () => {
    if (!paymentDraft || busy) return;
    const invoice = invoices.find(item => item.id === paymentDraft.invoiceId) || selected;
    const amount = Number(paymentDraft.amount);
    const balance = Number(invoice.balanceDue ?? Number(invoice.total || 0) - Number(invoice.amountPaid || 0));
    if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001 || amount > balance + 0.001) return setMessage(`Enter an amount between £0.01 and £${money(balance)}.`);
    setBusy("payment");
    setMessage("");
    try {
      const result = await authenticatedPost("recordAdminPayment", {
        invoiceId: invoice.id,
        amount,
        method: paymentDraft.method,
        requestId: paymentDraft.requestId
      });
      setSelected(current => ({
        ...current,
        amountPaid: result.amountPaid,
        balanceDue: result.balanceDue,
        status: result.balanceDue ? current.status : "paid"
      }));
      setPaymentDraft(null);
      setMessage(`£${money(amount)} recorded against ${invoice.invoiceNumber}. Balance £${money(result.balanceDue)}.`);
      try {
        const history = await authenticatedPost("getAdminPaymentHistory", {
          invoiceId: invoice.id
        });
        setPaymentHistory({
          entries: history.entries || [],
          unlistedAmount: history.unlistedAmount || 0,
          loading: false,
          error: ""
        });
      } catch (historyError) {
        setPaymentHistory(current => ({
          ...current,
          loading: false,
          error: historyError.message
        }));
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy("");
    }
  };
  const convertDocument = async document => {
    if (!can("sales") || !["quote", "order"].includes(document.documentType) || document.convertedTo) return;
    const deposit = Number(document.amountPaid || 0);
    const prompt = `Create a VAT invoice from ${document.invoiceNumber} for £${money(document.total)}?${deposit ? ` The £${money(deposit)} order deposit will carry across.` : ""} The original document will stay in the history.`;
    if (!window.confirm(prompt)) return;
    setBusy(`convert-${document.id}`);
    setMessage("");
    try {
      const result = await authenticatedPost("convertAdminDocument", {
        documentId: document.id
      });
      setSelected(result.invoice);
      setSearch("");
      setSearchParams({
        invoice: result.invoice.id
      });
      setMessage(`${document.invoiceNumber} converted to ${result.invoice.invoiceNumber}. The original remains available.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy("");
    }
  };
  const goToStep = next => {
    const error = next > 0 ? saleStepError(draft, next > 1 ? 1 : 0, wheelWork) : '';
    if (error) return setMessage(error);
    setMessage('');
    setSaleStep(next);
    if (next === 1) setItemSearchOpen(true);
    requestAnimationFrame(() => document.getElementById('sales-flow')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    }));
  };
  const documentLabel = invoice => invoice.documentType === 'quote' ? 'Quote' : invoice.documentType === 'order' ? 'Order' : invoice.documentType === 'credit-note' ? 'Credit note' : 'Invoice';
  const removeLine = index => setDraft(current => ({
    ...current,
    workLineIndices: [],
    items: current.items.filter((entry, position) => position !== index && (!current.items[index].lineId || entry.parentLineId !== current.items[index].lineId))
  }));
  const renderLine = (item, index, extra = false) => <article className={`ssLine ${extra ? 'ssExtraLine' : ''}`} key={item.lineId || `line-${index}`}>
    <div className="ssLineMain">
      <label className="ssDescription"><span>{extra ? 'Tyre service' : 'Description'} {isTyre(item) && <TyreBrandLogo line={item} />}</span><input aria-label={`Description line ${index + 1}`} value={item.description} onChange={e => setItem(index, 'description', e.target.value)} placeholder="Description of tyre, work or part" />{item.stockNumber && <small>{item.stockNumber}</small>}{isTyre(item) && <small className="ssFitmentFlags">{tyreData(item).flags.join(' · ')}</small>}</label>
      <label><span>Qty</span><input aria-label={`Quantity line ${index + 1}`} type="number" min={wheelWork(item) ? 1 : 0.01} step={wheelWork(item) ? 1 : 'any'} value={item.quantity} onChange={e => setItem(index, 'quantity', e.target.value)} /></label>
      <label><span>Unit £ inc VAT</span><input aria-label={`Unit price line ${index + 1}`} type="number" min="0" step="0.01" value={item.unitPriceIncVat} onChange={e => setItem(index, 'unitPriceIncVat', e.target.value)} /></label>
      <div className="ssLineTotal"><small>Line total</small><strong>£{money(totals.lines[index]?.gross)}</strong></div>
      <button className="ssRemove" aria-label={`Remove line ${index + 1}`} onClick={() => removeLine(index)}>×</button>
    </div>
    {item.priceLevels && <label className="ssPriceLevel">Price level<select aria-label={`Price level line ${index + 1}`} value={item.priceLevel} onChange={e => changePriceLevel(index, e.target.value)}>{PRICE_LEVELS.map(([key, name]) => <option key={key} value={key}>{name} · £{money(item.priceLevels[key])}</option>)}</select></label>}
    <WheelPositionPicker line={item} onChange={positions => setItem(index, 'positions', positions)} />
    <details className="ssLineOptions"><summary>Line options{Number(item.discountIncVat) ? ` · £${money(item.discountIncVat)} discount` : ''}{Number(item.vatRate) === 0 ? ' · VAT 0%' : ''}</summary><div className="ssFields">
      <label>Type<select aria-label={`Type line ${index + 1}`} value={item.type} onChange={e => setItem(index, 'type', e.target.value)}>{[['tyre', 'Tyre'], ['service', 'Service / repair'], ['mot', 'MOT'], ['part', 'Part'], ['roadhero', 'Space saver'], ['alloy', 'Alloy wheel']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
      <label>Stock number<input aria-label={`Stock number line ${index + 1}`} value={item.stockNumber} onChange={e => setItem(index, 'stockNumber', e.target.value)} /></label>
      <label>Line discount £<input aria-label={`Discount line ${index + 1}`} type="number" min="0" step="0.01" value={item.discountIncVat} onChange={e => setItem(index, 'discountIncVat', e.target.value)} /></label>
      <label>VAT<select aria-label={`VAT line ${index + 1}`} value={item.vatRate} onChange={e => setItem(index, 'vatRate', e.target.value)}><option value="20">20%</option><option value="0">0%</option></select></label>
    </div></details>
    {!extra && item.lineId && draft.items.some(v => v.parentLineId === item.lineId) && <details className="ssTyreExtras"><summary>Tyre services · {draft.items.filter(v => v.parentLineId === item.lineId).map(v => v.description).join(', ')} <b>£{money(totals.lines.filter((_, i) => draft.items[i].parentLineId === item.lineId).reduce((n, l) => n + l.gross, 0))}</b></summary>{draft.items.map((v, i) => v.parentLineId === item.lineId ? renderLine(v, i, true) : null)}</details>}
  </article>;
  return <section className="adminPage salesPage simpleSales">
    <header className="ssPageHeading"><div><h2>Sales & invoices</h2><p>{tab === 'new' ? 'Create a quote, order or invoice.' : 'Find a document, then choose what to do.'}</p></div><div className="ssTabs"><button aria-pressed={tab === 'new'} onClick={() => {
          setTab('new');
          setSearchParams({});
          setPaymentDraft(null);
          setMessage('');
        }}>Create sale</button><button aria-pressed={tab === 'invoices'} onClick={() => setTab('invoices')}>Find invoice / order</button><Link to="/legacy-import">Import history</Link></div></header>
    {message && <div role="status" className="ssNotice">{message}</div>}
    {tab === 'new' && <>
      <nav id="sales-flow" className="ssSteps" aria-label="Create sale steps">{['Vehicle & customer', 'Items & technician', 'Review & payment'].map((name, i) => <button key={name} aria-current={saleStep === i ? 'step' : undefined} onClick={() => goToStep(i)}><b>{i + 1}</b><span>{name}</span></button>)}</nav>
      <div className="ssWorkspace"><div className="ssMain">
        {saleStep === 0 && <>
          <details className="ssPanel ssSaleOptions"><summary><strong>{documentLabel(draft)}</strong><span>{draft.depot} · {draft.salesChannel} · {draft.adviserName || profile?.name || 'Logged-in adviser'}</span><em>Sale options</em></summary><div className="ssFields"><label>Document type<select aria-label="Document type" value={draft.documentType} onChange={e => setDraft({
                    ...draft,
                    documentType: e.target.value,
                    amountPaid: 0,
                    paymentMethod: 'unpaid'
                  })}><option value="invoice">VAT invoice</option><option value="quote">Quote</option><option value="order">Sales order</option></select></label><label>Sales adviser<select aria-label="Sales adviser" value={draft.adviserName} onChange={e => setDraft({
                    ...draft,
                    adviserName: e.target.value
                  })}><option value="">{profile?.name || 'Logged-in staff member'}</option>{ADVISERS.map(name => <option key={name}>{name}</option>)}</select></label><label>Sales channel<select aria-label="Sales channel" value={draft.salesChannel} onChange={e => setDraft({
                    ...draft,
                    salesChannel: e.target.value
                  })}>{['Workshop', 'Book my garage', 'Website', 'Text', 'Email'].map(name => <option key={name}>{name}</option>)}</select></label><label>Purchase order number<input value={draft.purchaseOrderNumber} onChange={e => setDraft({
                    ...draft,
                    purchaseOrderNumber: e.target.value
                  })} /></label><label className="ssWide">Private sale notes<textarea rows="2" value={draft.notes} onChange={e => setDraft({
                    ...draft,
                    notes: e.target.value
                  })} /></label></div></details>
          <section className="ssPanel"><header><h3>Vehicle</h3><small>Registration, make and model required</small></header><div className="ssVrm"><label className="ssVrmLabel">Registration<input aria-label="Vehicle registration" placeholder="ENTER REG" value={draft.vehicle.registration} onChange={e => setVehicle('registration', e.target.value.toUpperCase())} /></label><button className="ssPrimary" disabled={Boolean(busy)} onClick={lookupVehicle}>{busy === 'vehicle' ? 'Checking…' : 'Find vehicle'}</button><button className="ssQuiet" onClick={() => navigator.clipboard?.writeText(draft.vehicle.registration)}>Copy reg</button></div>
            {storedVehicle && <button className="ssSavedVehicle" onClick={() => chooseStoredVehicle(storedVehicle)}>Use saved vehicle{storedVehicle.customerId ? ' & customer' : ''}</button>}
            <div className="ssFields"><label>Make *<input value={draft.vehicle.make || ''} onChange={e => setVehicle('make', e.target.value)} /></label><label>Model *<input value={draft.vehicle.model || ''} onChange={e => setVehicle('model', e.target.value)} /></label><label>Mileage<input type="number" value={draft.vehicle.mileage || ''} onChange={e => setVehicle('mileage', e.target.value)} /></label></div>
            {(draft.vehicle.frontTyreSize || draft.vehicle.year || draft.vehicle.motDue) && <div className="ssVehicleFacts">{[draft.vehicle.year, draft.vehicle.fuel, draft.vehicle.frontTyreSize && 'Front ' + draft.vehicle.frontTyreSize, draft.vehicle.rearTyreSize && 'Rear ' + draft.vehicle.rearTyreSize, draft.vehicle.motDue && 'MOT ' + draft.vehicle.motDue].filter(Boolean).map(v => <span key={v}>{v}</span>)}</div>}
            <details className="ssDetails"><summary>More vehicle details{vehicleHistory.length ? ` & history (${vehicleHistory.length})` : ''}</summary><div className="ssFields">{[['engineCC', 'Engine cc'], ['vin', 'VIN'], ['motDue', 'MOT due'], ['frontTyreSize', 'Front tyres'], ['rearTyreSize', 'Rear tyres']].map(([key, label]) => <label key={key}>{label}<input value={draft.vehicle[key] || ''} onChange={e => setVehicle(key, e.target.value)} /></label>)}</div>{vehicleHistory.map(entry => <p key={entry.id}>{entry.invoiceNumber} · {entry.customer?.name} · £{money(entry.total)}{entry.items?.filter(isTyre).map((item, i) => <TyreBrandLogo key={i} line={item} />)}<small>{entry.items?.map(item => itemDescription(item, isTyre(item))).join(' · ')}</small></p>)}{vehicleRaw && <details><summary>All provider data</summary><pre>{JSON.stringify(vehicleRaw, null, 2)}</pre></details>}</details>
          </section>
          <section className="ssPanel"><header><h3>Customer</h3><Link to="/directory">Customer directory ↗</Link></header><label>Find a saved customer<input placeholder="Name, postcode, phone or account number" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} /></label>{!!matchingCustomers.length && <div className="ssCustomerMatches">{matchingCustomers.map(entry => <button key={entry.id} onClick={() => chooseCustomer(entry)}><b>{entry.name}</b><span>{entry.accountNumber || 'Retail'} · {entry.postcode}</span></button>)}</div>}
            {draft.customerId && <p className="ssSavedHint">Saved customer selected</p>}
            <div className="ssFields"><label>Customer / company name *<input value={draft.customer.name} onChange={e => setCustomer('name', e.target.value)} /></label><label>Mobile<input value={draft.customer.mobile || ''} onChange={e => setCustomer('mobile', e.target.value)} /></label><label>Email<input type="email" value={draft.customer.email} onChange={e => setCustomer('email', e.target.value)} /></label></div>
            <details className="ssDetails"><summary>Address, phone & account{draft.customer.customerType === 'account' ? ' · Credit account selected' : ''}</summary><div className="ssFields">{[['salutation', 'Salutation'], ['phone', 'Telephone'], ['postcode', 'Postcode'], ['address1', 'Address'], ['address2', 'Address line 2'], ['town', 'Town'], ['accountNumber', 'Account number']].map(([key, label]) => <label key={key}>{label}<input value={draft.customer[key] || ''} onChange={e => setCustomer(key, ['postcode', 'accountNumber'].includes(key) ? e.target.value.toUpperCase() : e.target.value)} /></label>)}<label>Customer type<select value={draft.customer.customerType} onChange={e => setCustomer('customerType', e.target.value)}><option value="retail">Retail</option><option value="trade">Trade</option><option value="account">Account</option></select></label></div></details>
          </section>
        </>}
        {saleStep === 1 && <>
          <section className="ssPanel"><header><div><h3>Items & work</h3><small>Search Tyremen stock, partner tyres or service items.</small></div><div className="ssActions"><button className="ssPrimary" onClick={() => setItemSearchOpen(v => !v)}>{itemSearchOpen ? 'Hide search' : 'Search items'}</button><button onClick={() => setDraft(current => ({
                    ...current,
                    items: [...current.items, blankItem()]
                  }))}>Add manual line</button></div></header>
            {itemSearchOpen && <ItemSearch stockProducts={stockProducts} serviceMaster={serviceMaster} onClose={() => setItemSearchOpen(false)} onSelect={(p, kind, level) => kind === 'service' ? addServiceLine(p) : addStockLine(p, level)} />}
            <div className="ssLines">{draft.items.map((item, index) => !item.parentLineId || !draft.items.some(p => p.lineId === item.parentLineId) ? renderLine(item, index) : null)}</div>
          </section>
          <section className="ssPanel"><header><h3>Technician & notes</h3><small>Up to four technicians</small></header><TechnicianPicker value={techniciansFor(draft)} onChange={technicians => setDraft({
                ...draft,
                technicians,
                technician: technicians[0] || ''
              })} required /><label>Advisory notes<textarea rows="2" placeholder="Optional advice for the customer" value={draft.advisoryNotes} onChange={e => setDraft({
                  ...draft,
                  advisoryNotes: e.target.value
                })} /></label>
            <details className="ssDetails"><summary>Work description & invoice grouping{draft.workDescription ? ' · Description added' : ''}</summary><label>Work shown to customer<textarea rows="3" value={draft.workDescription} placeholder="e.g. MOT and full service as requested" onChange={e => setDraft({
                    ...draft,
                    workDescription: e.target.value
                  })} /></label><p className="ssMuted">Select the lines to show under one work description. Item details remain in the record.</p><div className="ssGroupChoices">{draft.items.map((item, index) => <label key={index}><input type="checkbox" checked={draft.workLineIndices.includes(index)} onChange={e => setDraft(current => ({
                      ...current,
                      workLineIndices: e.target.checked ? [...current.workLineIndices, index] : current.workLineIndices.filter(v => v !== index)
                    }))} />{item.description || `Line ${index + 1}`}</label>)}</div></details>
          </section>
        </>}
        {saleStep === 2 && <>
          <section className="ssPanel"><header><h3>Check this sale</h3><button onClick={() => goToStep(0)}>Edit details</button></header><div className="ssReviewIdentity"><div><small>Vehicle</small><b>{draft.vehicle.registration}</b><span>{draft.vehicle.make} {draft.vehicle.model}</span></div><div><small>Customer</small><b>{draft.customer.name}</b><span>{draft.customer.mobile || draft.customer.phone}{draft.customer.email && ' · ' + draft.customer.email}</span></div><div><small>Technicians</small><b>{techniciansFor(draft).join(', ')}</b><span>{draft.salesChannel} · {draft.adviserName || profile?.name}</span></div></div><div className="ssReviewLines">{draft.items.map((item, i) => <div key={i}>{isTyre(item) && <TyreBrandLogo line={item} />}<span><b>{itemDescription(item)}</b><small>Qty {item.quantity}{item.positions?.length ? ' · ' + item.positions.join(' / ') : ''}{isTyre(item) && tyreData(item).flags.length ? ' · ' + tyreData(item).flags.join(' · ') : ''}{Number(item.discountIncVat) ? ' · Discount £' + money(item.discountIncVat) : ''}</small></span><strong>£{money(totals.lines[i]?.gross)}</strong></div>)}</div><button className="ssQuiet" onClick={() => goToStep(1)}>Edit items</button></section>
          {draft.documentType !== 'quote' && <section className="ssPanel"><header><h3>{draft.documentType === 'order' ? 'Deposit or payment (optional)' : 'Payment'}</h3><button onClick={() => setDraft({
                  ...draft,
                  amountPaid: Number(money(totals.total)),
                  paymentMethod: draft.paymentMethod === 'unpaid' ? 'card' : draft.paymentMethod
                })}>Pay in full</button></header><div className="ssPaymentMethods">{[['unpaid', '', 'No payment'], ...PAYMENT_METHODS].map(([key, icon, label]) => <button key={key} aria-pressed={draft.paymentMethod === key} onClick={() => setDraft({
                  ...draft,
                  paymentMethod: key,
                  ...(key === 'unpaid' ? {
                    amountPaid: 0
                  } : {})
                })}>{label}</button>)}</div><div className="ssFields"><label>Amount received £<input aria-label="Amount received" type="number" min="0" max={totals.total} step="0.01" value={draft.amountPaid} onChange={e => setDraft({
                    ...draft,
                    amountPaid: e.target.value
                  })} /></label><div className="ssBalance"><small>Remaining balance</small><strong>£{money(Math.max(0, totals.total - Number(draft.amountPaid || 0)))}</strong></div></div></section>}
          <details className="ssPanel ssDetails"><summary>Payment terms · {draft.paymentTerms}</summary><label>Payment terms<select value={draft.paymentTerms} onChange={e => setDraft({
                  ...draft,
                  paymentTerms: e.target.value
                })}>{['Due on completion', '7 days', '14 days', '30 days', '30 days end of month'].map(v => <option key={v}>{v}</option>)}</select></label></details>
        </>}
        <div className="ssStepActions"><button disabled={saleStep === 0 || Boolean(busy)} onClick={() => goToStep(saleStep - 1)}>Back</button>{saleStep < 2 ? <button className="ssPrimary" disabled={Boolean(busy)} onClick={() => goToStep(saleStep + 1)}>{saleStep === 0 ? 'Continue to items' : 'Review sale'} →</button> : <button className="ssPrimary" disabled={Boolean(busy)} onClick={createInvoice}>{busy === 'create' ? 'Creating…' : `Create ${documentLabel(draft).toLowerCase()}`}</button>}</div>
      </div>
      <aside className="ssPanel ssSummary"><header><h3>Current sale</h3><span className="ssBadge">{documentLabel(draft)}</span></header><div className="ssSummaryIdentity"><b>{draft.vehicle.registration || 'Vehicle not selected'}</b><span>{draft.customer.name || 'Customer not selected'}</span>{draft.customer.customerType === 'account' && <small>Credit account · {draft.customer.accountNumber}</small>}</div><div className="ssSummaryRows"><span>{draft.items.filter(i => i.description).length} item lines</span><button className="ssQuiet" onClick={() => goToStep(1)}>View items</button></div><dl><div><dt>Net</dt><dd>£{money(totals.net)}</dd></div><div><dt>VAT</dt><dd>£{money(totals.vat)}</dd></div><div className="ssGrand"><dt>Total inc VAT</dt><dd>£{money(totals.total)}</dd></div></dl><p>{saleStep === 0 ? 'Start with the vehicle and customer.' : saleStep === 1 ? 'Add the work and assign technicians.' : draft.documentType === 'quote' ? 'A quote takes no payment.' : 'Check payment before creating the document.'}</p><small>Print / PDF and email are available after creation.</small></aside>
      </div>
    </>}
    {tab === 'invoices' && <div className="ssDocuments"><section className="ssPanel"><header><h3>Find a document</h3><span className="ssMuted">{filtered.length} matching</span></header><div className="ssDocumentFilters"><input aria-label="Search sales documents" placeholder="Number, name, registration, postcode or phone" value={search} onChange={e => setSearch(e.target.value)} /><select aria-label="Document type filter" value={documentFilter} onChange={e => setDocumentFilter(e.target.value)}><option value="all">All document types</option><option value="invoice">Invoices</option><option value="order">Sales orders</option><option value="quote">Quotes</option><option value="credit-note">Credit notes</option></select><select aria-label="Payment status filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">All statuses</option>{['issued', 'paid', 'order', 'quote', 'converted'].map(v => <option key={v}>{v}</option>)}</select><button onClick={() => {
            setSearch('');
            setDocumentFilter('all');
            setStatusFilter('all');
          }}>Clear</button></div>
      <div className="ssDocumentTable"><table><thead><tr><th>Document / date</th><th>Customer / vehicle</th><th>Total</th><th>Balance</th><th>Status</th></tr></thead><tbody>{filtered.slice(0, visibleDocuments).map(invoice => <tr key={invoice.id} className={selected?.id === invoice.id ? 'ssSelected' : ''}><td><button className="ssDocumentOpen" onClick={() => {
                    setSelected(invoice);
                    setPaymentDraft(null);
                    setSearchParams({
                      invoice: invoice.id
                    });
                  }}>{invoice.invoiceNumber}</button><small>{documentLabel(invoice)} · {invoice.invoiceDate}</small></td><td><b>{invoice.customer?.name}</b><small>{invoice.vehicle?.registration || 'No vehicle'}</small></td><td>£{money(invoice.total)}</td><td>{invoice.documentType === 'quote' ? '—' : `£${money(invoice.balanceDue ?? Number(invoice.total || 0) - Number(invoice.amountPaid || 0))}`}</td><td><span className="ssBadge">{invoice.status || 'issued'}</span></td></tr>)}</tbody></table>{!filtered.length && <p className="ssEmpty">No documents match this search.</p>}</div>{filtered.length > visibleDocuments && <button className="ssMoreDocuments" onClick={() => setVisibleDocuments(v => v + 100)}>Show 100 more · {filtered.length - visibleDocuments} remaining</button>}
      </section>
      {selected && <section id="selected-sales-document" className="ssPanel ssSelectedDocument"><header><div><span className="ssMuted">{documentLabel(selected)}</span><h3>{selected.invoiceNumber}</h3></div><button onClick={() => {
            setSelected(null);
            setPaymentDraft(null);
            setSearchParams({});
          }}>Close document</button></header><div className="ssReviewIdentity"><div><small>Customer</small><b>{selected.customer?.name}</b><span>{selected.customer?.email}</span></div><div><small>Vehicle</small><b>{selected.vehicle?.registration}</b><span>{selected.vehicle?.make} {selected.vehicle?.model}</span></div><div><small>Total / balance</small><b>£{money(selected.total)}</b><span>Balance £{money(selected.balanceDue ?? Number(selected.total || 0) - Number(selected.amountPaid || 0))}</span></div></div>
        <div className="ssActions"><button className="ssPrimary" onClick={() => printInvoice(selected)}>Print / PDF</button><button disabled={Boolean(busy) || !selected.customer?.email} onClick={() => emailInvoice(selected)}>{busy === `email-${selected.id}` ? 'Sending…' : 'Email document'}</button>{['quote', 'order'].includes(selected.documentType) && !selected.convertedTo && can('sales') && <button disabled={Boolean(busy)} onClick={() => convertDocument(selected)}>Create VAT invoice</button>}{selected.status !== 'paid' && !selected.convertedTo && ['invoice', 'order'].includes(selected.documentType) && can('sales') && <button disabled={Boolean(busy)} onClick={() => openPayment(selected)}>Record payment</button>}{selected.convertedTo && <button onClick={() => {
            setSearch('');
            setSearchParams({
              invoice: selected.convertedTo
            });
          }}>Open linked invoice</button>}{selected.sourceDocumentId && <button onClick={() => {
            setSearch('');
            setSearchParams({
              invoice: selected.sourceDocumentId
            });
          }}>Open original {selected.sourceDocumentType}</button>}</div>
        <div className="ssReviewLines">{(selected.items || []).map((item, i) => <div key={i}>{isTyre(item) && <TyreBrandLogo line={item} />}<span><b>{itemDescription(item)}</b><small>Qty {item.quantity}{item.positions?.length ? ' · ' + item.positions.join(' / ') : ''}{isTyre(item) && tyreData(item).flags.length ? ' · ' + tyreData(item).flags.join(' · ') : ''}</small></span><strong>£{money(item.gross ?? Math.max(0, Number(item.quantity || 0) * Number(item.unitPriceIncVat || 0) - Number(item.discountIncVat || 0)))}</strong></div>)}</div>
        {paymentDraft?.invoiceId === selected.id && <div className="ssPaymentEditor"><h4>Record a payment</h4><div className="ssFields"><label>Amount received £<input type="number" min="0.01" max={selected.balanceDue} step="0.01" value={paymentDraft.amount} onChange={e => setPaymentDraft({
                ...paymentDraft,
                amount: e.target.value,
                requestId: paymentReference()
              })} /></label><label>Method<select value={paymentDraft.method} onChange={e => setPaymentDraft({
                ...paymentDraft,
                method: e.target.value,
                requestId: paymentReference()
              })}>{PAYMENT_METHODS.map(([key,, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div><div className="ssActions"><button className="ssPrimary" disabled={Boolean(busy)} onClick={recordPayment}>{busy === 'payment' ? 'Recording…' : `Record £${money(paymentDraft.amount)}`}</button><button onClick={() => setPaymentDraft(null)}>Cancel</button></div></div>}
        <details className="ssDetails"><summary>Payment history{paymentHistory.entries.length ? ` (${paymentHistory.entries.length})` : ''}</summary>{paymentHistory.loading ? <p>Loading…</p> : paymentHistory.error ? <p>{paymentHistory.error}</p> : <>{paymentHistory.entries.map(entry => <div className="ssHistoryRow" key={entry.id}><span>{entry.kind === 'opening' ? 'Opening payment' : 'Payment'} · {entry.method}<small>{entry.date ? new Date(entry.date).toLocaleString('en-GB') : ''} · {entry.by}</small></span><b>£{money(entry.amount)}</b></div>)}{paymentHistory.unlistedAmount > 0 && <p>Previously recorded paid amount: £{money(paymentHistory.unlistedAmount)}</p>}{!paymentHistory.entries.length && !paymentHistory.unlistedAmount && <p>No payments recorded.</p>}</>}</details>
        <small className="ssMuted">Issued documents are retained. Payments and conversions are recorded in their history.</small>
      </section>}
    </div>}
  </section>;
}
