import "../admin-pages.css";
import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase";

const CREATE_BOOKING_URL =
  "https://us-central1-tyremen-system.cloudfunctions.net/createWorkshopBooking";
const HOURS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];
const JOB_TYPES = [
  ["mot", "MOT"],
  ["service", "Service"],
  ["tyres", "Tyres"],
  ["alignment", "Wheel Alignment"],
  ["diagnostics", "Diagnostics"],
  ["timing", "Cambelt / Timing Chain"],
  ["clutch", "Clutch"],
  ["airconR134a", "Air Con R134a"],
  ["airconR1234yf", "Air Con R1234yf"],
  ["brakes", "Brakes"],
];
const DAILY_CAPACITY = {
  timing: 2,
  clutch: 4,
  airconR134a: 8,
  airconR1234yf: 8,
  brakes: 6,
};

const textFor = (value) =>
  [value?.name, value?.service, value?.category, value?.serviceKey, value?.type, value?.gasType]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

function classify(job) {
  const records = [job, ...(job.items || [])];
  const text = records.map(textFor).join(" ");
  const aircon = /(air\s*con|air conditioning|regas|re-gas)/.test(text);
  const explicitService = records.some((record) =>
    ["service", "servicing"].includes(
      String(record?.category || record?.serviceKey || "").toLowerCase()
    )
  );
  return {
    mot: /\bmot\b/.test(text),
    service: explicitService || /(oil\s*(and|&)?\s*filter|interim|full service|major service|servicing)/.test(text),
    tyres: /\btyres?\b/.test(text),
    alignment: /(wheel alignment|tracking)/.test(text),
    diagnostics: /diagnostic/.test(text),
    timing: /(cambelt|cam belt|timing belt|timing chain)/.test(text),
    clutch: /clutch/.test(text),
    brakes: /brake/.test(text),
    airconR1234yf: aircon && /(1234|new gas|r1234yf)/.test(text),
    airconR134a: aircon && !/(1234|new gas|r1234yf)/.test(text),
  };
}

function shiftHour(time, amount) {
  const index = HOURS.indexOf(time);
  return index < 0 ? null : HOURS[index + amount] || null;
}

function allocationsFor(job) {
  if (Array.isArray(job.schedule?.allocations)) return job.schedule.allocations;
  const needs = classify(job);
  const rows = [];
  if (needs.mot) rows.push({ resource: "mot", time: job.time });
  if (needs.service) rows.push({ resource: "service", time: needs.mot ? shiftHour(job.time, 1) : job.time });
  Object.keys(DAILY_CAPACITY).forEach((key) => {
    if (needs[key]) rows.push({ resource: key, time: null });
  });
  return rows;
}

function activeJob(job) {
  return !["cancelled", "canceled", "deleted"].includes(String(job.status || "").toLowerCase());
}

function titleFor(job) {
  return job.service || (job.items || []).map((item) => item.name || item.service).filter(Boolean).join(", ") || "Workshop booking";
}

function JobCell({ job, label }) {
  if (!job) return <div className="diaryLaneCell available"><span>{label}</span><p>Available</p></div>;
  return (
    <div className="diaryLaneCell booked">
      <span>{label}</span>
      <b>{job.registration || "NO REG"}</b>
      <small>{job.name || "No name"}</small>
      <em>{titleFor(job)}</em>
    </div>
  );
}

export default function Calendar() {
  const [jobs, setJobs] = useState([]);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [closedDays, setClosedDays] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [blockResource, setBlockResource] = useState("mot");
  const [blockTime, setBlockTime] = useState("09:00");
  const [closeReason, setCloseReason] = useState("");
  const [manual, setManual] = useState({
    name: "", phone: "", email: "", registration: "", jobType: "mot", time: "09:00", price: "",
  });
  const [savingManual, setSavingManual] = useState(false);

  useEffect(() => {
    const jobsQuery = query(collection(db, "jobs"), orderBy("date", "asc"));
    return onSnapshot(jobsQuery, (snapshot) => {
      setJobs(snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() })));
    });
  }, []);

  useEffect(() => onSnapshot(collection(db, "blockedSlots"), (snapshot) => {
    setBlockedSlots(snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() })));
  }), []);

  useEffect(() => onSnapshot(collection(db, "closedDays"), (snapshot) => {
    setClosedDays(snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() })));
  }), []);

  const dayJobs = useMemo(
    () => jobs.filter((job) => job.date === selectedDate && activeJob(job))
      .sort((a, b) => String(a.time || "").localeCompare(String(b.time || ""))),
    [jobs, selectedDate]
  );
  const dayBlocks = blockedSlots.filter((slot) => slot.date === selectedDate);
  const closedDay = closedDays.find((day) => day.date === selectedDate);
  const dayNumber = new Date(`${selectedDate}T12:00:00`).getDay();
  const isSunday = dayNumber === 0;

  const jobsFor = (resource, time = null) =>
    dayJobs.filter((job) => allocationsFor(job).some(
      (item) => item.resource === resource && (time === null || item.time === time)
    ));

  const blocksFor = (resource, time = null) =>
    dayBlocks.reduce((sum, item) => {
      const matchesResource = !item.resource || item.resource === "all" || item.resource === resource;
      const matchesTime = time === null || !item.time || item.time === time;
      return sum + (matchesResource && matchesTime ? Number(item.units || 1) : 0);
    }, 0);

  const motBooked = jobsFor("mot").length;
  const serviceBooked = jobsFor("service").length;

  const blockSlot = async () => {
    if (!selectedDate || (!blockTime && ["mot", "service"].includes(blockResource))) {
      return alert("Choose a date and time.");
    }
    await addDoc(collection(db, "blockedSlots"), {
      date: selectedDate,
      time: ["mot", "service"].includes(blockResource) ? blockTime : null,
      resource: blockResource,
      units: 1,
      reason: "Blocked by admin",
      createdAt: new Date().toISOString(),
    });
  };

  const removeBlock = (id) => deleteDoc(doc(db, "blockedSlots", id));

  const closeDay = async () => {
    await setDoc(doc(db, "closedDays", selectedDate), {
      date: selectedDate,
      reason: closeReason || "Closed by admin",
      createdAt: new Date().toISOString(),
    });
    setCloseReason("");
  };

  const reopenDay = () => closedDay?.id && deleteDoc(doc(db, "closedDays", closedDay.id));

  const addManualBooking = async () => {
    if (!manual.name || !manual.phone || !manual.registration || !manual.time) {
      return alert("Name, phone, registration and time are required.");
    }
    const label = JOB_TYPES.find(([key]) => key === manual.jobType)?.[1] || "Workshop booking";
    const category =
      manual.jobType === "airconR1234yf" ? "Air Con R1234yf" :
      manual.jobType === "airconR134a" ? "Air Con R134a" : label;
    setSavingManual(true);
    try {
      const response = await fetch(CREATE_BOOKING_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: manual.name,
          phone: manual.phone,
          email: manual.email,
          registration: manual.registration,
          service: label,
          serviceKey: manual.jobType,
          type: "service",
          items: [{
            id: `admin-${manual.jobType}-${Date.now()}`,
            name: label,
            service: label,
            category,
            serviceKey: manual.jobType,
            type: "service",
            qty: 1,
            price: Number(manual.price || 0),
          }],
          date: selectedDate,
          time: manual.time,
          price: Number(manual.price || 0),
          total: Number(manual.price || 0),
          source: "Admin Manual",
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Could not add booking");
      setManual({ name: "", phone: "", email: "", registration: "", jobType: "mot", time: "09:00", price: "" });
    } catch (error) {
      alert(error.message);
    } finally {
      setSavingManual(false);
    }
  };

  return (
    <section className="page workshopDiaryPage">
      <div className="pageTitleRow">
        <div>
          <h2>Workshop Diary</h2>
          <p>Live website and manual bookings share the same capacity-controlled calendar.</p>
        </div>
        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
      </div>

      <div className="diaryStatsGrid">
        <div className="diaryStat yellow"><span>MOT booked</span><strong>{motBooked}</strong><small>of 16 weekday spaces</small></div>
        <div className="diaryStat blue"><span>Service booked</span><strong>{serviceBooked}</strong><small>2 per hour</small></div>
        <div className="diaryStat green"><span>Total jobs</span><strong>{dayJobs.length}</strong><small>{selectedDate}</small></div>
        <div className="diaryStat purple"><span>Admin blocks</span><strong>{dayBlocks.length}</strong><small>All resources</small></div>
      </div>

      {(closedDay || isSunday) && (
        <div className="closedDayBanner">
          <strong>{closedDay?.reason || "Sunday — workshop closed"}</strong>
          {closedDay && <button type="button" onClick={reopenDay}>Re-open day</button>}
        </div>
      )}

      <div className="panel diaryPanelWide">
        <div className="diaryPanelTitle">
          <div><h3>Hourly Workshop Capacity</h3><p>Two MOT bays and two servicing spaces every full hour.</p></div>
          <div className="diaryLegend"><span className="available">Available</span><span className="booked">Booked</span></div>
        </div>
        <div className="diarySchedule">
          <div className="diaryScheduleHead"><span>Time</span><span>MOT Bay 1</span><span>MOT Bay 2</span><span>Service 1</span><span>Service 2</span></div>
          {HOURS.map((hour) => {
            const mot = jobsFor("mot", hour);
            const service = jobsFor("service", hour);
            const motBlocks = blocksFor("mot", hour);
            const serviceBlocks = blocksFor("service", hour);
            const closed = Boolean(closedDay || isSunday);
            const motCells = [0, 1].map((index) => closed || index < motBlocks ? { blocked: true } : mot[index]);
            const serviceCells = [0, 1].map((index) => closed || index < serviceBlocks ? { blocked: true } : service[index]);
            return (
              <div className="diaryScheduleRow" key={hour}>
                <strong>{hour}</strong>
                {motCells.map((job, index) => job?.blocked
                  ? <div className="diaryLaneCell blocked" key={`mot-${index}`}><span>MOT Bay {index + 1}</span><p>Blocked</p></div>
                  : <JobCell key={`mot-${index}`} job={job} label={`MOT Bay ${index + 1}`} />)}
                {serviceCells.map((job, index) => job?.blocked
                  ? <div className="diaryLaneCell blocked" key={`service-${index}`}><span>Service {index + 1}</span><p>Blocked</p></div>
                  : <JobCell key={`service-${index}`} job={job} label={`Service ${index + 1}`} />)}
              </div>
            );
          })}
        </div>
      </div>

      <div className="dailyCapacityGrid">
        {[
          ["timing", "Cambelts / Timing", 2],
          ["clutch", "Clutches", 4],
          ["airconR134a", "Air Con R134a", 8],
          ["airconR1234yf", "Air Con R1234yf", 8],
          ["brakes", "Brakes", 6],
        ].map(([key, label, capacity]) => {
          const used = jobsFor(key).length + blocksFor(key);
          return (
            <div className={`dailyCapacityCard ${used >= capacity ? "full" : ""}`} key={key}>
              <span>{label}</span><strong>{Math.min(used, capacity)} / {capacity}</strong>
              <small>{used >= capacity ? "FULL" : `${capacity - used} available`}</small>
            </div>
          );
        })}
      </div>

      <div className="diaryMainGrid">
        <div className="panel">
          <h3>Add Manual Booking</h3>
          <p className="panelIntro">Uses the same live capacity check as the website.</p>
          <div className="manualBookingForm">
            <label>Customer<input value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} /></label>
            <label>Phone<input value={manual.phone} onChange={(e) => setManual({ ...manual, phone: e.target.value })} /></label>
            <label>Email<input value={manual.email} onChange={(e) => setManual({ ...manual, email: e.target.value })} /></label>
            <label>Registration<input className="adminRegInput" value={manual.registration} onChange={(e) => setManual({ ...manual, registration: e.target.value.toUpperCase() })} /></label>
            <label>Job type<select value={manual.jobType} onChange={(e) => setManual({ ...manual, jobType: e.target.value })}>{JOB_TYPES.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
            <label>Time<select value={manual.time} onChange={(e) => setManual({ ...manual, time: e.target.value })}>{HOURS.map((hour) => <option key={hour}>{hour}</option>)}</select></label>
            <label>Price (£)<input type="number" value={manual.price} onChange={(e) => setManual({ ...manual, price: e.target.value })} /></label>
          </div>
          <button className="adminPrimaryButton" type="button" disabled={savingManual || closedDay || isSunday} onClick={addManualBooking}>
            {savingManual ? "Checking capacity…" : "Add to workshop diary"}
          </button>
        </div>

        <div className="panel">
          <h3>Close / Block Capacity</h3>
          <div className="blockForm">
            <select value={blockResource} onChange={(e) => setBlockResource(e.target.value)}>
              <option value="mot">MOT bay</option><option value="service">Service bay</option>
              <option value="timing">Cambelt / Timing</option><option value="clutch">Clutch</option>
              <option value="airconR134a">Air Con R134a</option><option value="airconR1234yf">Air Con R1234yf</option>
              <option value="brakes">Brakes</option>
            </select>
            {["mot", "service"].includes(blockResource) && <select value={blockTime} onChange={(e) => setBlockTime(e.target.value)}>{HOURS.map((hour) => <option key={hour}>{hour}</option>)}</select>}
            <button type="button" onClick={blockSlot}>Block one space</button>
          </div>
          <div className="blockForm closeForm">
            <input value={closeReason} onChange={(e) => setCloseReason(e.target.value)} placeholder="Closure reason" />
            <button type="button" onClick={closeDay}>Close whole day</button>
          </div>
          <h3>Current blocks</h3>
          {!dayBlocks.length ? <p className="empty">No blocks for this date.</p> : dayBlocks.map((slot) => (
            <div className="blockedSlot" key={slot.id}>
              <strong>{slot.resource || "all"} {slot.time || "all day"}</strong>
              <button className="danger" type="button" onClick={() => removeBlock(slot.id)}>Remove</button>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3>All Bookings For {selectedDate}</h3>
        {!dayJobs.length ? <p className="empty">No bookings for this date.</p> : (
          <div className="diaryBookingList">
            {dayJobs.map((job) => (
              <div className="diaryBookingCard" key={job.id}>
                <div className="diaryTime">{job.arrivalTime && job.arrivalTime !== job.time ? `Arrive ${job.arrivalTime}` : job.time || "No time"}</div>
                <div className="diaryInfo"><strong>{job.registration || "No reg"}</strong><span>{job.name || "No name"}</span><small>{titleFor(job)}</small></div>
                <div className="diaryPrice">£{Number(job.price || job.total || 0).toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
