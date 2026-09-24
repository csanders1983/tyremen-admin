import "../admin-pages.css";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

const FUNCTIONS_ROOT = "https://us-central1-tyremen-system.cloudfunctions.net";

const lineText = (item) =>
  [item?.name, item?.service, item?.category, item?.serviceKey, item?.type]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const isMotLine = (item) => /\bmot\b/.test(lineText(item));

export default function Orders() {
  const navigate = useNavigate();
  const { profile, can } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [technicians, setTechnicians] = useState([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

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

  const addItem = (type = "service") => {
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

  const updateItem = (index, field, value) => {
    const items = [...(selected.items || [])];

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
    items.splice(index, 1);

    setSelected({
      ...selected,
      items,
    });
  };

  const orderUpdate = (statusOverride) => ({
    technician: selected.technician || "",
    name: selected.name || "",
    phone: selected.phone || "",
    email: selected.email || "",
    registration: selected.registration || "",
    service: selected.service || "",
    date: selected.date || "",
    time: selected.time || "",
    status: statusOverride || selected.status || "New",
    notes: selected.notes || "",
    discount: Number(effectiveDiscount || 0),
    amountPaid: Number(selected.amountPaid || 0),
    paymentMethod: selected.paymentMethod || "unpaid",
    paymentTerms: selected.paymentTerms || "Due on completion",
    price: Number(calculatedTotal || 0),
    total: Number(calculatedTotal || 0),
    items: selected.items || [],
    tyres: (selected.items || []).filter((item) => item.type === "tyre"),
    updatedAt: new Date().toISOString(),
  });

  const saveOrder = async () => {
    if (!selected?.id) return;
    setBusy("save");
    setMessage("");
    try {
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
        type: item.type || "service",
        description: item.name || item.description || item.service || "Workshop work",
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

  const deleteOrder = async () => {
    if (!selected?.id) return;

    const ok = window.confirm("Delete this order?");
    if (!ok) return;

    await deleteDoc(doc(db, "jobs", selected.id));
    setSelected(null);
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
                  <p>{job.service || "Service"}</p>
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
                    title="Cancel and rebook in Workshop Diary so capacity is checked"
                  />
                </label>

                <label>
                  Time
                  <input
                    value={selected.time || ""}
                    readOnly
                    title="Cancel and rebook in Workshop Diary so capacity is checked"
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
                    <option>Cancelled</option>
                  </select>
                </label>
               <label>
  Assigned Technician
  <select
    value={selected.technician || ""}
    onChange={(e) => updateField("technician", e.target.value)}
  >
    <option value="">Unassigned</option>

    {technicians
      .filter((tech) => tech.active)
      .map((tech) => (
        <option key={tech.id} value={tech.name}>
          {tech.name}
        </option>
      ))}
  </select>
</label>
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

              {(selected.items || []).map((item, index) => {
                const lineTotal =
                  Number(item.qty || 0) * Number(item.price || 0);

                const profit =
                  Number(lineTotal || 0) -
                  Number(item.cost || 0) * Number(item.qty || 0);

                return (
                  <div className="adminItemEditor" key={index}>
                    {item.image && (
                      <img src={item.image} alt={item.name || "Tyre"} />
                    )}

                    <div className="adminItemInputs">
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
                        <option value="service">Service</option>
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
                <button type="button" className="adminBtn" onClick={saveOrder} disabled={Boolean(busy)}>
                  {busy === "save" ? "Saving…" : "Save Job"}
                </button>

                <button type="button" className="adminBtn" onClick={acceptOrder}>
                  Accept + Email Text
                </button>

                <button type="button" className="adminBtn" onClick={printJobCard}>
                  Print Job Card
                </button>

                {can("sales") && !selected.invoiceId && (
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

                <button
                  type="button"
                  className="adminBtn danger"
                  onClick={deleteOrder}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
