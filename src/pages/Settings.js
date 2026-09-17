import "../admin-pages.css";
export default function Settings() {
  return (
    <section className="page">
      <div className="pageTitleRow">
        <div>
          <h2>Settings</h2>
          <p>Admin settings, staff levels and future system options.</p>
        </div>
      </div>

      <div className="panel">
        <h3>Coming Next</h3>

        <div className="serviceList">
          <div className="serviceRow">
            <span>Staff login levels</span>
            <strong>Admin / Manager / Staff</strong>
          </div>

          <div className="serviceRow">
            <span>Email templates</span>
            <strong>Ready</strong>
          </div>

          <div className="serviceRow">
            <span>SMS reminders</span>
            <strong>Ready later</strong>
          </div>

          <div className="serviceRow">
            <span>Audit log</span>
            <strong>Ready later</strong>
          </div>
        </div>
      </div>
    </section>
  );
}