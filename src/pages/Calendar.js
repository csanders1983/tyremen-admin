import "../admin-pages.css";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  deleteDoc,
  doc,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase";

const defaultSettings = {
  motLanes: 1,
  weekdayMotCapacity: 8,
  saturdayMotCapacity: 5,
  weekdayStart: "09:00",
  weekdayEnd: "16:00",
  saturdayStart: "09:00",
  saturdayEnd: "13:00",
};

const makeTimeSlots = (start, end, capacity) => {
  const slots = [];
  const [startHour] = start.split(":").map(Number);
  const [endHour] = end.split(":").map(Number);
  const availableHours = Math.max(1, endHour - startHour + 1);
  const step = Math.max(1, Math.floor((availableHours * 60) / capacity));

  let mins = startHour * 60;

  for (let i = 0; i < capacity; i += 1) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    mins += step;
  }

  return slots;
};

const isMotJob = (job) => {
  const text = [
    job.service,
    job.serviceKey,
    job.type,
    ...(Array.isArray(job.items) ? job.items.map((item) => item.name || item.service || item.category) : []),
  ]
    .join(" ")
    .toLowerCase();

  return text.includes("mot");
};

const getJobTitle = (job) => {
  if (job.service) return job.service;
  if (Array.isArray(job.items) && job.items.length) {
    return job.items.map((item) => item.name || item.service || item.type).filter(Boolean).join(", ");
  }
  return "Booking";
};

export default function Calendar() {
  const [jobs, setJobs] = useState([]);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [closedDays, setClosedDays] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [blockTime, setBlockTime] = useState("");
  const [closeReason, setCloseReason] = useState("");

  useEffect(() => {
    const q = query(collection(db, "jobs"), orderBy("date", "asc"));

    const unsub = onSnapshot(q, (snapshot) => {
      setJobs(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "blockedSlots"), (snapshot) => {
      setBlockedSlots(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "closedDays"), (snapshot) => {
      setClosedDays(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "workshopSettings", "main"), (snap) => {
      if (snap.exists()) {
        setSettings({ ...defaultSettings, ...snap.data() });
      }
    });

    return () => unsub();
  }, []);

  const selectedDay = new Date(`${selectedDate}T12:00:00`);
  const dayNumber = selectedDay.getDay();
  const isSaturday = dayNumber === 6;
  const isSunday = dayNumber === 0;

  const dayJobs = useMemo(() => {
    return jobs
      .filter((job) => job.date === selectedDate)
      .sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));
  }, [jobs, selectedDate]);

  const motJobs = dayJobs.filter(isMotJob);
  const otherJobs = dayJobs.filter((job) => !isMotJob(job));
  const dayBlocks = blockedSlots.filter((slot) => slot.date === selectedDate);
  const closedDay = closedDays.find((day) => day.date === selectedDate);

  const motCapacity = isSunday
    ? 0
    : isSaturday
    ? Number(settings.saturdayMotCapacity || 5)
    : Number(settings.weekdayMotCapacity || 8);

  const motStart = isSaturday ? settings.saturdayStart : settings.weekdayStart;
  const motEnd = isSaturday ? settings.saturdayEnd : settings.weekdayEnd;
  const motSlots = makeTimeSlots(motStart, motEnd, motCapacity || 1);
  const motAvailable = Math.max(0, motCapacity - motJobs.length - dayBlocks.length);

  const saveSettings = async (nextSettings) => {
    const updated = { ...settings, ...nextSettings, updatedAt: new Date().toISOString() };
    setSettings(updated);
    await setDoc(doc(db, "workshopSettings", "main"), updated, { merge: true });
  };

  const blockSlot = async () => {
    if (!selectedDate || !blockTime) {
      alert("Choose a date and time.");
      return;
    }

    await addDoc(collection(db, "blockedSlots"), {
      date: selectedDate,
      time: blockTime,
      reason: "Blocked by admin",
      createdAt: new Date().toISOString(),
    });

    setBlockTime("");
  };

  const removeBlock = async (id) => {
    await deleteDoc(doc(db, "blockedSlots", id));
  };

  const closeDay = async () => {
    if (!selectedDate) return;

    await setDoc(doc(db, "closedDays", selectedDate), {
      date: selectedDate,
      reason: closeReason || "Closed by admin",
      createdAt: new Date().toISOString(),
    });

    setCloseReason("");
  };

  const reopenDay = async () => {
    if (!closedDay?.id) return;
    await deleteDoc(doc(db, "closedDays", closedDay.id));
  };

  return (
    <section className="page workshopDiaryPage">
      <div className="pageTitleRow">
        <div>
          <h2>Workshop Diary</h2>
          <p>MOT capacity, blocked slots, closed days and live website bookings.</p>
        </div>

        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
      </div>

      <div className="diaryStatsGrid">
        <div className="diaryStat yellow">
          <span>MOT Capacity</span>
          <strong>{closedDay || isSunday ? 0 : motCapacity}</strong>
          <small>{settings.motLanes} lane{Number(settings.motLanes) !== 1 ? "s" : ""} active</small>
        </div>

        <div className="diaryStat blue">
          <span>MOT Booked</span>
          <strong>{closedDay || isSunday ? 0 : motJobs.length}</strong>
          <small>{selectedDate}</small>
        </div>

        <div className="diaryStat green">
          <span>Available</span>
          <strong>{closedDay || isSunday ? 0 : motAvailable}</strong>
          <small>After blocks</small>
        </div>

        <div className="diaryStat purple">
          <span>Total Jobs</span>
          <strong>{dayJobs.length}</strong>
          <small>All departments</small>
        </div>
      </div>

      {closedDay && (
        <div className="closedDayBanner">
          <strong>Closed:</strong> {closedDay.reason || "Closed by admin"}
          <button type="button" onClick={reopenDay}>Re-open Day</button>
        </div>
      )}

      {isSunday && !closedDay && (
        <div className="closedDayBanner">
          <strong>Sunday:</strong> Workshop closed by default.
        </div>
      )}

      <div className="diarySettingsPanel">
        <div>
          <h3>MOT Lane Settings</h3>
          <p>Current setup: 8 MOTs Mon-Fri, 5 Saturday. Switch to lane 2 when fitted.</p>
        </div>

        <div className="diarySettingsActions">
          <button type="button" onClick={() => saveSettings({ motLanes: 1, weekdayMotCapacity: 8, saturdayMotCapacity: 5 })}>
            1 Lane: 8 / 5
          </button>
          <button type="button" onClick={() => saveSettings({ motLanes: 2, weekdayMotCapacity: 16, saturdayMotCapacity: 10 })}>
            2 Lanes: 16 / 10
          </button>
        </div>
      </div>

      <div className="diaryMainGrid">
        <div className="panel diaryPanelWide">
          <h3>MOT Slots</h3>

          <div className="motSlotsGrid">
            {motSlots.map((slot, index) => {
              const job = motJobs[index];
              const block = dayBlocks.find((item) => item.time === slot);
              const lane = Number(settings.motLanes || 1) === 2 && index >= motCapacity / 2 ? "MOT Lane 2" : "MOT Lane 1";

              return (
                <div className={`motSlotCard ${job ? "booked" : ""} ${block ? "blocked" : ""}`} key={`${slot}-${index}`}>
                  <div className="motSlotTop">
                    <strong>{slot}</strong>
                    <span>{lane}</span>
                  </div>

                  {closedDay || isSunday ? (
                    <p>Closed</p>
                  ) : block ? (
                    <p>Blocked</p>
                  ) : job ? (
                    <div>
                      <b>{job.registration || "NO REG"}</b>
                      <small>{job.name || "No name"}</small>
                      <em>{getJobTitle(job)}</em>
                    </div>
                  ) : (
                    <p>Available</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <h3>Controls</h3>

          <div className="blockForm">
            <input value={blockTime} onChange={(e) => setBlockTime(e.target.value)} placeholder="Block time e.g. 11:00" />
            <button type="button" onClick={blockSlot}>Block Slot</button>
          </div>

          <div className="blockForm closeForm">
            <input value={closeReason} onChange={(e) => setCloseReason(e.target.value)} placeholder="Reason e.g. Staff training" />
            <button type="button" onClick={closeDay}>Close Day</button>
          </div>

          <h3>Blocked Times</h3>

          {dayBlocks.length === 0 ? (
            <p className="empty">No blocked times on this date.</p>
          ) : (
            dayBlocks.map((slot) => (
              <div className="blockedSlot" key={slot.id}>
                <strong>{slot.time}</strong>
                <button className="danger" type="button" onClick={() => removeBlock(slot.id)}>Remove</button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="diaryMainGrid bottomGrid">
        <div className="panel">
          <h3>All Bookings For {selectedDate}</h3>

          {dayJobs.length === 0 ? (
            <p className="empty">No bookings for this date.</p>
          ) : (
            <div className="diaryBookingList">
              {dayJobs.map((job) => (
                <div className="diaryBookingCard" key={job.id}>
                  <div className="diaryTime">{job.time || "No time"}</div>

                  <div className="diaryInfo">
                    <strong>{job.registration || "No reg"}</strong>
                    <span>{job.name || "No name"}</span>
                    <small>{getJobTitle(job)}</small>
                  </div>

                  <div className="diaryPrice">£{Number(job.price || job.total || 0).toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <h3>Service / Tyres / Other</h3>

          {otherJobs.length === 0 ? (
            <p className="empty">No non-MOT work for this date.</p>
          ) : (
            <div className="diaryBookingList">
              {otherJobs.map((job) => (
                <div className="diaryBookingCard" key={job.id}>
                  <div className="diaryTime">{job.time || "No time"}</div>
                  <div className="diaryInfo">
                    <strong>{job.registration || "No reg"}</strong>
                    <span>{job.name || "No name"}</span>
                    <small>{getJobTitle(job)}</small>
                  </div>
                  <div className="diaryPrice">£{Number(job.price || job.total || 0).toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
