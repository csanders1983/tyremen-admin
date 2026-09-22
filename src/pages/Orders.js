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
import { db } from "../firebase";
import "../admin-pages.css";

export default function Orders() {
  const [jobs, setJobs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [technicians, setTechnicians] = useState([]);

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

  const calculatedTotal = useMemo(() => {
    if (!selected) return 0;

    const itemsTotal = (selected.items || []).reduce((sum, item) => {
      return sum + Number(item.qty || 0) * Number(item.price || 0);
    }, 0);

    return itemsTotal || Number(selected.price || selected.total || 0);
  }, [selected]);

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

  const saveOrder = async () => {
    if (!selected?.id) return;

    await updateDoc(doc(db, "jobs", selected.id), {
      technician: selected.technician || "",
      name: selected.name || "",
      phone: selected.phone || "",
      email: selected.email || "",
      registration: selected.registration || "",
      service: selected.service || "",
      date: selected.date || "",
      time: selected.time || "",
      status: selected.status || "New",
      notes: selected.notes || "",
      price: Number(calculatedTotal || 0),
      total: Number(calculatedTotal || 0),
      items: selected.items || [],
      tyres: (selected.items || []).filter((item) => item.type === "tyre"),
      updatedAt: new Date().toISOString(),
    });

    alert("Order saved.");
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
                    <option>Complete</option>
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
                <button type="button" className="adminBtn" onClick={saveOrder}>
                  Save Order
                </button>

                <button type="button" className="adminBtn" onClick={acceptOrder}>
                  Accept + Email Text
                </button>

                <button type="button" className="adminBtn" onClick={printJobCard}>
                  Print Job Card
                </button>

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
