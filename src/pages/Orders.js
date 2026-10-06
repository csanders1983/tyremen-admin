import ItemSearch, {stockLevelPrice,PRICE_LEVELS} from '../components/ItemSearch';
import TyreBrandLogo from '../components/TyreBrandLogo';
import {itemDescription,tyreData,upper,isTyre} from '../lib/tyrePresentation';
import "../admin-pages.css";
import "../tyre-foreman.css";
import TechnicianPicker from "../components/TechnicianPicker";
import WheelPositionPicker from "../components/WheelPositionPicker";
import { techniciansFor } from "../lib/tyreWork";
import "../workshop-board.css";
import WorkshopBookingEdit from "../components/WorkshopBookingEdit";
import WorkshopHistory from "../components/WorkshopHistory";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { useNavigate, useSearchParams } from "react-router-dom";
import { auth, db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

const isCompletedJob = job => Boolean(job?.invoiceId) || ["completed","complete","done"].includes(String(job?.status || "").trim().toLowerCase());

const FUNCTIONS_ROOT = "https://us-central1-tyremen-system.cloudfunctions.net";

const lineText = (item) =>
  [item?.name, item?.service, item?.category, item?.serviceKey, item?.type]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const isMotLine = (item) => /\bmot\b/.test(lineText(item));

export default function Orders() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const linkedJobId = searchParams.get("job");
  const openedJobId = useRef("");
  const { profile, can } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [jobView, setJobView] = useState("active");
  const [editingBooking, setEditingBooking] = useState(false);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [, setTechnicians] = useState([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [itemSearch,setItemSearch]=useState(null);
  const [serviceMaster,setServiceMaster]=useState([]);
  useEffect(()=>onSnapshot(collection(db,"serviceMaster"),snapshot=>setServiceMaster(snapshot.docs.map(d=>({id:d.id,...d.data()})))),[]);

  useEffect(() => {
    if (!linkedJobId || openedJobId.current === linkedJobId) return;
    const linked = jobs.find((job) => job.id === linkedJobId);
    if (linked) { openedJobId.current = linkedJobId; setSelected(linked); setJobView("active"); setSearch(""); }
  }, [linkedJobId, jobs]);

  useEffect(() => {
    const q = query(collection(db, "jobs"), orderBy("createdAt", "desc"));

  

    const unsub = onSnapshot(q, (snapshot) => {
      const rows = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      setJobs(rows);
    });

    return () => unsub();
  }, []);
useEffect(() => {
  const unsub = onSnapshot(collection(db, "technicians"), (snapshot) => {
    setTechnicians(
      snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }))
    );
  });

  return () => unsub();
}, []);
  const filteredJobs = useMemo(() => {
    const term = search.toLowerCase();

    return jobs.filter((job) => {
      if (isCompletedJob(job)) return false;
      return [
        job.name,
        job.phone,
        job.email,
        job.registration,
        job.service,
        job.status,
        job.date,
        ...(Array.isArray(job.tyres)
          ? job.tyres.map((t) => t.stockNumber)
          : []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [jobs, search]);

  const itemsSubtotal = useMemo(() => (selected?.items || []).reduce(
    (sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0),
    0
  ), [selected]);

  const effectiveDiscount = useMemo(() => {
    if (!selected || !itemsSubtotal) return 0;
    const storedTotal = Number(selected.total || selected.price || itemsSubtotal);
    const inferredDiscount = Math.max(0, itemsSubtotal - storedTotal);
    return Math.min(itemsSubtotal, Number(selected.discount ?? inferredDiscount));
  }, [selected, itemsSubtotal]);

  const calculatedTotal = useMemo(() => {
    if (!selected) return 0;
    if (!itemsSubtotal) return Number(selected.price || selected.total || 0);
    return Math.max(0, itemsSubtotal - effectiveDiscount);
  }, [selected, itemsSubtotal, effectiveDiscount]);

  const tyresQty = useMemo(() => {
    if (!selected?.items) return 0;

    return selected.items
      .filter((item) => item.type === "tyre")
      .reduce((sum, item) => sum + Number(item.qty || 0), 0);
  }, [selected]);

  const updateField = (field, value) => {
    setSelected((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const addBlankItem = (type = "service") => {
    const items = selected.items || [];

    setSelected({
      ...selected,
      items: [
        ...items,
        {
          name: "",
          qty: 1,
          price: 0,
          type,
          stockNumber: "",
          cost: 0,
        },
      ],
    });
  };

  const addItem = type => setItemSearch(type === 'labour' ? 'labour' : type === 'part' ? 'part' : type === 'tyre' ? 'tyre' : 'service');
  const tyreExtras = (line, level) => {
    const codes=level==='retail'?['CD','WB','TLV']:['special2Plus','xtra'].includes(level)?['CD']:[];
    const missing=codes.filter(code=>!serviceMaster.some(s=>upper(s.code)===code));
    if(missing.length)setMessage(`Set up ${missing.join(', ')} in Service Master. Missing charges were not invented.`);
    return codes.flatMap(code=>{const service=serviceMaster.find(s=>upper(s.code)===code);return service?[{type:'service',name:upper(service.name),stockNumber:code,serviceMasterId:service.id,parentLineId:line.lineId,qty:line.qty,price:Number(service.retailIncVat||0),cost:Number(service.costExVat||0),vatRate:Number(service.vatRate??20)}]:[];});
  };
  const addSearchItem = (product,kind,level) => {
    const tyre=kind==='stock'&&isTyre(product),line={type:tyre?'tyre':kind==='service'&&product.category==='mot'?'mot':kind==='stock'?'part':'service',name:itemDescription(product),stockNumber:product.sku||product.code||'',stockProductId:kind==='stock'&&product.source!=='oak'?product.id:'',serviceMasterId:kind==='service'?product.id:'',source:product.source||'tyremen',qty:1,price:kind==='service'?Number(product.retailIncVat||0):stockLevelPrice(product,level),cost:Number(product.costExVat||0),costExVat:Number(product.costExVat||0),vatRate:Number(product.vatRate??20),priceLevel:level,positions:[],lineId:window.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`,...(tyre?{...tyreData(product),runFlat:product.runFlat===true,extraLoad:product.extraLoad===true,homologation:product.homologation||'',vehicleType:product.vehicleType||'',priceLevels:Object.fromEntries(PRICE_LEVELS.map(([key])=>[key,stockLevelPrice(product,key)]))}:{})};
    const extras=tyre?tyreExtras(line,level):[];
    setSelected(current=>({...current,items:[...(current.items||[]),line,...extras]}));
    setMessage('Item added. Complete wheel positions for tyres, repairs and TPMS before invoicing.');
  };
  const changeItemPriceLevel = (index,level) => {const old=selected.items[index],line={...old,priceLevel:level,price:Number(old.priceLevels?.[level]??old.price)},extras=tyreExtras(line,level);setSelected(current=>({...current,items:[...current.items.filter(l=>l.parentLineId!==old.lineId).map((l)=>l===old?line:l),...extras]}));};
  const updateItem = (index, field, value) => {
    if(["name","description"].includes(field)) value=upper(value);
    const items = [...(selected.items || [])].map(line => field === "qty" && line.parentLineId && line.parentLineId === selected.items[index].lineId ? {...line, qty: value} : line);

    items[index] = {
      ...items[index],
      [field]: value,
    };

    setSelected({
      ...selected,
      items,
    });
  };

  const removeItem = (index) => {
    const items = [...(selected.items || [])];
    const parent = items[index].lineId;
    items.splice(index, 1);
    if(parent) for(let i=items.length-1;i>=0;i--) if(items[i].parentLineId===parent) items.splice(i,1);

    setSelected({
      ...selected,
      items,
    });
  };

  const orderUpdate = (statusOverride) => ({
    technician: selected.technicians?.[0] || selected.technician || "",
    technicians: techniciansFor(selected).filter(Boolean),
    name: selected.name || "",
    phone: selected.phone || "",
    email: selected.email || "",
    registration: selected.registration || "",
    service: selected.service || "",
    status: statusOverride || selected.status || "New",
    notes: selected.notes || "",
    discount: Number(effectiveDiscount || 0),
    amountPaid: Number(selected.amountPaid || 0),
    paymentMethod: selected.paymentMethod || "unpaid",
    paymentTerms: selected.paymentTerms || "Due on completion",
    price: Number(calculatedTotal || 0),
    total: Number(calculatedTotal || 0),
    items: (selected.items || []).map(item=>({...item,name:itemDescription(item),description:upper(item.description||item.name)})),
    tyres: (selected.items || []).filter((item) => item.type === "tyre"),
    updatedAt: new Date().toISOString(),
  });

  const saveOrder = async () => {
    if (!selected?.id || isCompletedJob(selected)) return;
    setBusy("save");
    setMessage("");
    try {
      const latest = await getDoc(doc(db, "jobs", selected.id));
      if (!latest.exists() || isCompletedJob(latest.data()) || latest.data().status === "Cancelled") throw new Error("This booking was cancelled. Refresh before editing it.");
      const update = orderUpdate();
      await updateDoc(doc(db, "jobs", selected.id), update);
      setSelected((current) => ({ ...current, ...update }));
      setMessage("Job saved.");
    } catch (error) {
      setMessage(error.message || "Job could not be saved.");
    } finally {
      setBusy("");
    }
  };

  const buildInvoiceItems = () => {
    const source = (selected.items || []).length
      ? selected.items
      : [{ name: selected.service || "Workshop work", type: "service", qty: 1, price: calculatedTotal }];
    const gross = source.reduce((sum, item) => sum + Number(item.qty || 1) * Number(item.price || 0), 0);
    const targetTotal = Number(calculatedTotal || 0);
    const totalDiscount = Math.max(0, gross - targetTotal);
    let allocated = 0;
    return source.map((item, index) => {
      const lineGross = Number(item.qty || 1) * Number(item.price || 0);
      const proportional = gross > 0 ? totalDiscount * (lineGross / gross) : 0;
      const discountIncVat = index === source.length - 1
        ? Math.max(0, Number((totalDiscount - allocated).toFixed(2)))
        : Math.max(0, Number(proportional.toFixed(2)));
      allocated += discountIncVat;
      return {
        ...tyreData(item), runFlat:item.runFlat===true,extraLoad:item.extraLoad===true,homologation:item.homologation||"",positions: item.positions || [], brand: item.brand || "", pattern: item.pattern || "", size: item.size || "", loadSpeed: item.loadSpeed || "", stockProductId: item.stockProductId || "",
        type: item.type || "service",
        description: itemDescription(item),
        stockNumber: item.stockNumber || item.code || item.sku || "",
        quantity: Math.max(1, Number(item.qty || item.quantity || 1)),
        unitPriceIncVat: gross > 0
          ? Number(item.price || item.unitPriceIncVat || 0)
          : (index === 0 ? targetTotal : 0),
        discountIncVat,
        vatRate: item.vatRate !== undefined ? Number(item.vatRate) : isMotLine(item) ? 0 : 20,
        costExVat: Number(item.cost || item.costExVat || 0),
      };
    });
  };

  const completeAndInvoice = async () => {
    if (!selected?.id || busy) return;
    if (selected.invoiceId) {
      setMessage(`This job already has invoice ${selected.invoiceNumber || selected.invoiceId}.`);
      return;
    }
    if (!String(selected.name || "").trim()) return setMessage("Add the customer name before completing the job.");
    const invoiceItems = buildInvoiceItems();
    if (!invoiceItems.some((item) => item.description.trim())) return setMessage("Add at least one completed work line.");
    if (!window.confirm(`Complete this job and create a VAT invoice for £${calculatedTotal.toFixed(2)}?`)) return;

    setBusy("complete");
    setMessage("");
    try {
      // Save the final workshop lines first. The secure invoice function then
      // creates one idempotent invoice and links it back to this job.
      const latest = await getDoc(doc(db, "jobs", selected.id));
      if (!latest.exists() || latest.data().status === "Cancelled") throw new Error("This booking was cancelled. It cannot be invoiced.");
      await updateDoc(doc(db, "jobs", selected.id), orderUpdate("Ready To Collect"));
      const token = await auth.currentUser.getIdToken();
      const vehicle = selected.vehicle || {};
      const response = await fetch(`${FUNCTIONS_ROOT}/createAdminInvoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          documentType: "invoice",
          jobId: selected.id,
          customer: {
            name: selected.name || "",
            email: selected.email || "",
            phone: selected.phone || "",
            address1: selected.address1 || "",
            address2: selected.address2 || "",
            town: selected.town || "Hull",
            postcode: selected.postcode || "",
            accountNumber: selected.accountNumber || "",
            customerType: selected.customerType || "retail",
          },
          vehicle: {
            ...vehicle,
            registration: selected.registration || vehicle.vrm || vehicle.registration || "",
            make: vehicle.make || "",
            model: vehicle.model || "",
            mileage: selected.mileage || vehicle.mileage || "",
          },
          vehicleData: vehicle,
          technician: selected.technicians?.[0] || selected.technician || "",
          technicians: techniciansFor(selected).filter(Boolean),
          items: invoiceItems,
          amountPaid: Number(selected.amountPaid || 0),
          paymentMethod: selected.paymentMethod || "unpaid",
          paymentTerms: selected.paymentTerms || "Due on completion",
          adviserName: profile?.name || auth.currentUser?.email || "Tyremen staff",
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Invoice could not be created");
      const completed = {
        status: "Completed",
        invoiceId: data.invoice.id,
        invoiceNumber: data.invoice.invoiceNumber,
        invoiceStatus: data.invoice.status,
        total: Number(data.invoice.total || calculatedTotal),
        price: Number(data.invoice.total || calculatedTotal),
      };
      setSelected((current) => ({ ...current, ...completed }));
      setMessage(`${data.invoice.invoiceNumber} created and linked to the completed job.`);
    } catch (error) {
      setMessage(error.message || "The job could not be completed.");
    } finally {
      setBusy("");
    }
  };

  const cancelOrder = async () => {
    if (!selected?.id || busy || selected.invoiceId || selected.status === "Cancelled") return;
    const reason = window.prompt("Reason for cancelling this booking (required):");
    if (reason === null) return;
    if (!reason.trim()) return setMessage("Enter a reason to cancel the booking.");
    if (!window.confirm(`Cancel ${selected.registration || selected.name || "this booking"}? The booking will stay in the job history.`)) return;
    setBusy("cancel"); setMessage("");
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`${FUNCTIONS_ROOT}/cancelWorkshopJob`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ jobId: selected.id, reason: reason.trim() }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not cancel booking");
      setSelected((current) => ({ ...current, status: "Cancelled", cancellationReason: reason.trim() }));
      setMessage("Booking cancelled, capacity released and the change recorded in the audit history.");
    } catch (error) { setMessage(error.message || "Could not cancel booking."); }
    finally { setBusy(""); }
  };

  const acceptOrder = async () => {
    if (!selected?.id) return;

    await updateDoc(doc(db, "jobs", selected.id), {
      status: "Accepted",
      acceptedAt: new Date().toISOString(),
    });

    const arrivalTime = selected.arrivalTime || selected.schedule?.arrivalTime || selected.time || "";
    const serviceTime = selected.schedule?.serviceTime || "";
    const message = `${selected.name || ""} - ${selected.registration || ""} - ${
      selected.service || ""
    } booked for ${selected.date || ""} - Time ${
      selected.time || ""
    }.${arrivalTime && arrivalTime !== selected.time ? ` Please have the vehicle here for ${arrivalTime}.` : ""}${
      serviceTime ? ` Service is scheduled for ${serviceTime}, subject to the MOT result.` : ""
    }`;

    alert(`Pre-filled email text:\n\n${message}`);
  };

  const printJobCard = () => {
    if (!selected) return;

    const lines = (selected.items || [])
      .map(
        (item) =>
          `${item.qty || 1} x ${item.name || "Item"} ${
            item.stockNumber ? `(Stock No: ${item.stockNumber})` : ""
          } - £${(
            Number(item.qty || 1) * Number(item.price || 0)
          ).toFixed(2)}`
      )
      .join("\n");

    const content = `
TYREMEN JOB CARD

Customer: ${selected.name || ""}
Phone: ${selected.phone || ""}
Email: ${selected.email || ""}
Reg: ${selected.registration || ""}
Date: ${selected.date || ""}
Time: ${selected.time || ""}
Status: ${selected.status || ""}

Job:
${selected.service || ""}

Items:
${lines}

Notes:
${selected.notes || ""}

Total: £${calculatedTotal.toFixed(2)}
`;

    const win = window.open("", "_blank");
    win.document.write(
      `<pre style="font-size:16px;font-family:Arial;">${content}</pre>`
    );
    win.document.close();
    win.print();
  };

  return (
    <section className="adminPage">
      <div className="adminHero">
        <span>WORKSHOP CONTROL</span>
        <h2>Orders / Jobs</h2>
        <p>Edit orders, tyres, services, labour, prices and workshop status.</p>
      </div>

      <div className="workshopBoard"><div className="wbWorkspaceTabs"><button type="button" aria-pressed={jobView === "active"} onClick={() => setJobView("active")}>Active jobs</button><button type="button" aria-pressed={jobView === "history"} onClick={() => {setJobView("history");setEditingBooking(false);}}>Completed history</button></div>{jobView === "history" && <WorkshopHistory />}</div>
      {jobView === "active" && <>
      <div className="adminStats">
        <div className="adminStat">
          <span>Total Orders</span>
          <strong>{filteredJobs.length}</strong>
        </div>

        <div className="adminStat">
          <span>Selected Total</span>
          <strong>£{calculatedTotal.toFixed(2)}</strong>
        </div>

        <div className="adminStat">
          <span>Tyres On Job</span>
          <strong>{tyresQty}</strong>
        </div>
      </div>

      {message && <div className="adminInfoBox jobMessage">{message}</div>}

      <div className="adminGrid">
        <div className="adminPanel">
          <h3>Orders</h3>

          <input
            className="adminSearch"
            placeholder="Search reg, name, phone, stock number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {filteredJobs.length === 0 ? (
            <p className="adminEmpty">No orders found.</p>
          ) : (
            <div className="adminList">
              {filteredJobs.map((job) => (
                <button
                  key={job.id}
                  className={
                    selected?.id === job.id ? "adminCard active" : "adminCard"
                  }
                  onClick={() => setSelected(job)}
                  type="button"
                >
                  <div className="adminReg">{job.registration || "NO REG"}</div>
                  <h4>{job.name || "No name"}</h4>
                  <p>{job.items?.length?job.items.map(line=>itemDescription(line,isTyre(line))).join(" · "):String(job.service||"Service").toUpperCase()}</p>{(job.items||job.tyres||[]).filter(isTyre).map((line,i)=><TyreBrandLogo key={i} line={line}/>)}
                  <p>
                    {job.date || "No date"} | {job.time || "No time"}
                  </p>
                  <div className="adminPrice">
                    £{Number(job.price || job.total || 0).toFixed(2)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="adminPanel">
          {!selected ? (
            <p className="adminEmpty">Select an order to edit.</p>
          ) : (
            <div className="adminEditor">
              <div className="adminEditHeader">
                <div>
                  <div className="adminReg">
                    {selected.registration || "NO REG"}
                  </div>
                  <h3>Edit Order</h3>
                  <p>
                    {selected.name || "No name"} |{" "}
                    {selected.status || "New"}
                  </p>
                  {selected.invoiceNumber && (
                    <button
                      type="button"
                      className="invoiceLinkButton"
                      onClick={() => navigate(`/sales?invoice=${encodeURIComponent(selected.invoiceId)}`)}
                    >
                      Invoice {selected.invoiceNumber}
                    </button>
                  )}
                </div>

                <div className="adminPrice">
                  £{calculatedTotal.toFixed(2)}
                </div>
              </div>

              {!isCompletedJob(selected) && <div className="workshopBoard"><button type="button" className="adminBtn" onClick={() => setEditingBooking(true)}>Edit booking date / time</button>{editingBooking && <WorkshopBookingEdit key={selected.id} job={selected} onClose={() => setEditingBooking(false)} onSaved={result => {setSelected(current => ({...current,...result}));setEditingBooking(false);setMessage("Booking moved. Shared diary updated.");}} />}</div>}
              <div className="adminFormGrid">
                <label>
                  Name
                  <input
                    value={selected.name || ""}
                    onChange={(e) => updateField("name", e.target.value)}
                  />
                </label>

                <label>
                  Phone
                  <input
                    value={selected.phone || ""}
                    onChange={(e) => updateField("phone", e.target.value)}
                  />
                </label>

                <label>
                  Email
                  <input
                    value={selected.email || ""}
                    onChange={(e) => updateField("email", e.target.value)}
                  />
                </label>

                <label>
                  Registration
                  <input
                    value={selected.registration || ""}
                    onChange={(e) =>
                      updateField("registration", e.target.value.toUpperCase())
                    }
                  />
                </label>

                <label>
                  Main Service
                  <input
                    value={selected.service || ""}
                    onChange={(e) => updateField("service", e.target.value)}
                  />
                </label>

                <label>
                  Date
                  <input
                    type="date"
                    value={selected.date || ""}
                    readOnly
                    title="Use Edit booking to change the appointment with a capacity check"
                  />
                </label>

                <label>
                  Time
                  <input
                    value={selected.time || ""}
                    readOnly
                    title="Use Edit booking to change the appointment with a capacity check"
                  />
                </label>

                <label>
                  Workshop Status
                  <select
                    value={selected.status || "New"}
                    onChange={(e) => updateField("status", e.target.value)}
                  >
                    <option>New</option>
                    <option>Accepted</option>
                    <option>Vehicle In</option>
                    <option>Working</option>
                    <option>Waiting Parts</option>
                    <option>Ready To Collect</option>
                    <option disabled={!selected.invoiceId}>Completed</option>
                    {selected.status === "Cancelled" && <option>Cancelled</option>}
                  </select>
                </label>
               <TechnicianPicker value={techniciansFor(selected)} onChange={technicians => setSelected(current => ({ ...current, technicians, technician: technicians[0] || "" }))} />
                <label>
                  Overall Discount (£)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={effectiveDiscount}
                    onChange={(e) => updateField("discount", Number(e.target.value || 0))}
                  />
                </label>
                <label>
                  Payment Method
                  <select
                    value={selected.paymentMethod || "unpaid"}
                    onChange={(e) => updateField("paymentMethod", e.target.value)}
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="card">Card</option>
                    <option value="cash">Cash</option>
                    <option value="bank-transfer">Bank transfer</option>
                    <option value="account">Account</option>
                  </select>
                </label>
                <label>
                  Amount Paid (£)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={selected.amountPaid || 0}
                    onChange={(e) => updateField("amountPaid", Number(e.target.value || 0))}
                  />
                </label>
              </div>

              <label>
                Notes
                <textarea
                  value={selected.notes || ""}
                  onChange={(e) => updateField("notes", e.target.value)}
                />
              </label>

              <div className="adminItemsHeader">
                <h3>Services / Tyres / Labour</h3>

                <div>
                  <button type="button" onClick={() => addItem("service")}>
                    Add Service
                  </button>
                  <button type="button" onClick={() => addItem("tyre")}>
                    Add Tyre
                  </button>
                  <button type="button" onClick={() => addItem("labour")}>
                    Add Labour
                  </button>
                </div>
              </div>

              {itemSearch && <ItemSearch initialCategory={itemSearch==='labour'?'all':itemSearch} serviceMaster={serviceMaster} onClose={()=>setItemSearch(null)} onSelect={addSearchItem}/>}
              {itemSearch && <button type="button" onClick={()=>addBlankItem(['tyre','labour','part'].includes(itemSearch)?itemSearch:'service')}>Add manual line instead</button>}
              {(selected.items || []).map((item, index) => {
                const lineTotal =
                  Number(item.qty || 0) * Number(item.price || 0);

                const profit =
                  Number(lineTotal || 0) -
                  Number(item.cost || 0) * Number(item.qty || 0);

                return (
                  <div className="adminItemEditor" key={index}>
                    {isTyre(item) && <div className="tyreLineSummary"><TyreBrandLogo line={item}/><strong>{itemDescription(item,true)}</strong></div>}

                    <div className="adminItemInputs">
                      <WheelPositionPicker line={item} onChange={positions => updateItem(index, "positions", positions)} />
                      <input
                        placeholder="Item name"
                        value={item.name || ""}
                        onChange={(e) =>
                          updateItem(index, "name", e.target.value)
                        }
                      />

                      <input
                        placeholder="Stock No"
                        value={item.stockNumber || ""}
                        onChange={(e) =>
                          updateItem(index, "stockNumber", e.target.value)
                        }
                      />

                      <select
                        value={item.type || "service"}
                        onChange={(e) =>
                          updateItem(index, "type", e.target.value)
                        }
                      >
                        <option value="service">Service</option><option value="mot">MOT</option>
                        <option value="tyre">Tyre</option>
                        <option value="labour">Labour</option>
                        <option value="part">Part</option>
                      </select>

                      <input
                        type="number"
                        placeholder="Qty"
                        value={item.qty || 1}
                        onChange={(e) =>
                          updateItem(index, "qty", e.target.value)
                        }
                      />

                      <input
                        type="number"
                        placeholder="Sell Price"
                        value={item.price || 0}
                        onChange={(e) =>
                          updateItem(index, "price", e.target.value)
                        }
                      />

                      <input
                        type="number"
                        placeholder="Cost"
                        value={item.cost || 0}
                        onChange={(e) =>
                          updateItem(index, "cost", e.target.value)
                        }
                      />
                    </div>

                    <div className="adminItemTotals">
                      {item.priceLevels && <label>Price level<select aria-label="Order tyre price level" value={item.priceLevel||'retail'} onChange={e=>changeItemPriceLevel(index,e.target.value)}>{PRICE_LEVELS.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>}
                      <strong>£{lineTotal.toFixed(2)}</strong>
                      <small>Profit £{profit.toFixed(2)}</small>
                      <button
                        type="button"
                        className="adminDanger"
                        onClick={() => removeItem(index)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}

              <div className="adminButtonRow">
                <button type="button" className="adminBtn" onClick={saveOrder} disabled={Boolean(busy) || isCompletedJob(selected) || selected.status === "Cancelled"}>
                  {busy === "save" ? "Saving…" : "Save Job"}
                </button>

                <button type="button" className="adminBtn" onClick={acceptOrder} disabled={isCompletedJob(selected) || selected.status === "Cancelled"}>
                  Accept + Email Text
                </button>

                <button type="button" className="adminBtn" onClick={printJobCard}>
                  Print Job Card
                </button>

                {can("sales") && !selected.invoiceId && selected.status !== "Cancelled" && (
                  <button
                    type="button"
                    className="adminBtn completeInvoiceButton"
                    onClick={completeAndInvoice}
                    disabled={Boolean(busy)}
                  >
                    {busy === "complete" ? "Creating invoice…" : "Complete Job & Create Invoice"}
                  </button>
                )}

                {selected.invoiceId && (
                  <button
                    type="button"
                    className="adminBtn completeInvoiceButton"
                    onClick={() => navigate(`/sales?invoice=${encodeURIComponent(selected.invoiceId)}`)}
                  >
                    Open {selected.invoiceNumber || "Invoice"}
                  </button>
                )}

                {!selected.invoiceId && selected.status !== "Cancelled" && <button
                  type="button" className="adminBtn danger" onClick={cancelOrder} disabled={Boolean(busy)}
                >{busy === "cancel" ? "Cancelling…" : "Cancel booking"}</button>}
              </div>
            </div>
          )}
        </div>
      </div>
    </>}
    </section>
  );
}
