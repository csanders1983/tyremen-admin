import "./Dashboard.css";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";

export default function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [view, setView] = useState("today");

  useEffect(() => {
    const q = query(collection(db, "jobs"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snapshot) => {
      setJobs(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsub();
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const todayJobs = useMemo(() => {
    return jobs.filter((job) => job.date === today);
  }, [jobs, today]);

  const newJobs = jobs.filter((job) => !job.status || job.status === "New");

  const inProgress = jobs.filter((job) =>
    ["Working", "inprogress", "In Progress"].includes(job.status)
  );

  const completed = jobs.filter((job) =>
    ["Done", "completed", "Completed"].includes(job.status)
  );

  const turnoverToday = todayJobs.reduce((total, job) => {
    return total + Number(job.price || job.total || 0);
  }, 0);

  const serviceCounts = todayJobs.reduce((acc, job) => {
    const name = job.type === "tyres" ? "Tyres" : job.service || "Other";
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});

  const getStockNumbers = (job) => {
    return [
      ...(Array.isArray(job.tyres) ? job.tyres : []),
      ...(Array.isArray(job.items) ? job.items : []),
    ]
      .map(
        (item) =>
          item.stockNumber ||
          item["Stock Number"] ||
          item["Stock No"] ||
          item["Stock Code"] ||
          item.StockNumber ||
          item.stockNo ||
          item.stockCode ||
          ""
      )
      .filter(Boolean);
  };

  return (
    <section className="dashPage">
      <div className="dashHero">
        <div>
          <span>LIVE OVERVIEW</span>
          <h2>Dashboard Home</h2>
          <p>Today’s bookings, alerts, turnover and service totals.</p>
        </div>

        <select value={view} onChange={(e) => setView(e.target.value)}>
          <option value="today">Today</option>
          <option value="day">Day View</option>
          <option value="week">Week View</option>
          <option value="month">Month View</option>
          <option value="year">Year View</option>
        </select>
      </div>

      <div className="dashStatsGrid">
        <div className="dashStatCard yellow">
          <span>New Orders</span>
          <strong>{newJobs.length}</strong>
          <small>Awaiting action</small>
        </div>

        <div className="dashStatCard blue">
          <span>Today’s Bookings</span>
          <strong>{todayJobs.length}</strong>
          <small>Booked for today</small>
        </div>

        <div className="dashStatCard green">
          <span>Completed</span>
          <strong>{completed.length}</strong>
          <small>Finished jobs</small>
        </div>

        <div className="dashStatCard purple">
          <span>Today’s Turnover</span>
          <strong>£{turnoverToday.toFixed(2)}</strong>
          <small>{view.toUpperCase()} view</small>
        </div>
      </div>

      <div className="dashMainGrid">
        <div className="dashPanel">
          <div className="dashPanelHead">
            <h3>Bookings By Service Today</h3>
            <span>{Object.keys(serviceCounts).length} services</span>
          </div>

          {Object.keys(serviceCounts).length === 0 ? (
            <p className="dashEmpty">No bookings today.</p>
          ) : (
            <div className="dashServiceList">
              {Object.entries(serviceCounts).map(([service, count]) => (
                <div className="dashServiceRow" key={service}>
                  <div>
                    <strong>{service}</strong>
                    <small>Bookings today</small>
                  </div>

                  <b>{count}</b>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dashPanel">
          <div className="dashPanelHead">
            <h3>Today’s Bookings</h3>
            <span>{todayJobs.length} jobs</span>
          </div>

          {todayJobs.length === 0 ? (
            <p className="dashEmpty">No bookings found for today.</p>
          ) : (
            <div className="dashBookingList">
              {todayJobs.map((job) => {
                const stockNumbers = getStockNumbers(job);

                return (
                  <div className="dashBookingCard" key={job.id}>
                    <div className="dashBookingTop">
                      <div className="dashRegPlate">
                        {job.registration || "NO REG"}
                      </div>

                      <strong>{job.time || "No time"}</strong>
                    </div>

                    <h4>{job.name || "No name"}</h4>

                    <p>{job.service || job.type || "Service"}</p>

                    {Array.isArray(job.tyres) && job.tyres.length > 0 && (
                      <div className="dashTyreBox">
                        {job.tyres.map((tyre, index) => (
                          <small key={index}>
                            {tyre.qty || 1} x {tyre.size} {tyre.brand}{" "}
                            {tyre.pattern}
                          </small>
                        ))}
                      </div>
                    )}

                    {stockNumbers.length > 0 && (
                      <div className="dashStockBox">
                        {stockNumbers.map((stock, index) => (
                          <span key={index}>Stock No: {stock}</span>
                        ))}
                      </div>
                    )}

                    <div className="dashBookingFooter">
                      <span>{job.status || "New"}</span>
                      <b>£{Number(job.price || job.total || 0).toFixed(2)}</b>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="dashBoardPreview">
        <div className="dashMiniColumn">
          <h3>Waiting</h3>
          {newJobs.slice(0, 4).map((job) => (
            <div className="dashMiniJob" key={job.id}>
              <strong>{job.registration || "NO REG"}</strong>
              <span>{job.service || job.type || "Booking"}</span>
            </div>
          ))}
        </div>

        <div className="dashMiniColumn blue">
          <h3>In Progress</h3>
          {inProgress.slice(0, 4).map((job) => (
            <div className="dashMiniJob" key={job.id}>
              <strong>{job.registration || "NO REG"}</strong>
              <span>{job.service || job.type || "Booking"}</span>
            </div>
          ))}
        </div>

        <div className="dashMiniColumn green">
          <h3>Completed</h3>
          {completed.slice(0, 4).map((job) => (
            <div className="dashMiniJob" key={job.id}>
              <strong>{job.registration || "NO REG"}</strong>
              <span>{job.service || job.type || "Booking"}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}