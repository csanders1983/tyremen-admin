import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { officePost, today, matches, dateText, base64File } from '../lib/officeApi';
import { Panel, Toolbar, Modal, Table, Empty } from '../components/OfficeUI';
import { LeaveForm, HoursForm } from './HR';
export default function StaffPortal() {
  const {
    signOut
  } = useAuth();
  const [data, setData] = useState(null),
    [tab, setTab] = useState('holiday'),
    [search, setSearch] = useState(''),
    [archived, setArchived] = useState(false),
    [month, setMonth] = useState(today().slice(0, 7)),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [modal, setModal] = useState('');
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/staff.webmanifest';
    document.head.appendChild(link);
    return () => link.remove();
  }, []);
  const load = useCallback(async () => {
    const from = month + '-01',
      d = new Date(from + 'T12:00:00Z');
    d.setUTCMonth(d.getUTCMonth() + 1);
    d.setUTCDate(0);
    setData(await officePost('portal', {
      year: Number(month.slice(0, 4)),
      from,
      to: d.toISOString().slice(0, 10)
    }));
  }, [month]);
  useEffect(() => {
    load().catch(e => setError(e.message));
  }, [load]);
  const run = async fn => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const rows = v => (v || []).filter(r => (archived || !r.archived) && matches(r, search));
  return <main className="office staffShell"><header className="staffHeader"><div><strong>TYREMEN</strong><span>{data?.employee.name || 'Staff portal'}</span></div><button onClick={signOut}>Sign out</button></header>{error && <p className="ofNotice error" role="alert">{error}</p>}{notice && <p className="ofNotice" role="status">{notice}</p>}{!data ? <Panel title="Your staff portal"><p>Your login must be linked to an active employee record.</p><button onClick={() => run(load)}>Retry</button></Panel> : <><div className="ofStats">{[['Holiday hours remaining', data.employee.balance.remainingHours], ['Booked holiday hours', data.employee.balance.bookedHours], ['Bank holiday hours', data.employee.balance.bankHolidayHours], ['Pending hours', data.employee.balance.pendingHours]].map(([k, v]) => <div className="ofStat" key={k}><span>{k}</span><b>{v}</b></div>)}</div><div className="ofTabs" role="tablist">{[['holiday', 'My holiday'], ['availability', 'Availability & rota'], ['documents', 'Documents'], ['hours', 'My hours'], ['messages', 'My messages']].map(([k, n]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{n}</button>)}</div><Toolbar {...{
        search,
        setSearch,
        archived,
        setArchived
      }}><input aria-label="View month" type="month" style={{
          width: 170
        }} value={month} onChange={e => setMonth(e.target.value)} /><button disabled={busy} onClick={() => run(load)}>Refresh</button></Toolbar>
{tab === 'holiday' && <Panel title="My holiday requests" actions={<button className="primary" onClick={() => setModal('leave')}>Request time off</button>}><Table headings={['Dates', 'Hours', 'Status', 'Actions']} rows={rows(data.requests).map(r => <tr key={r.id}><td>{dateText(r.from)} — {dateText(r.to)}<small>{r.type} · {r.note}</small></td><td>{r.hours}</td><td>{r.status}<small>{r.decisionNote}</small></td><td>{r.status === 'pending' && <button onClick={() => run(async () => {
              const reason = window.prompt('Why are you cancelling?');
              if (reason) await officePost('cancelLeave', {
                id: r.id,
                reason
              });
            })}>Cancel request</button>}</td></tr>)} /><p className="ofSmall">Bank holidays are included in your annual allowance. For approved leave changes or sickness, contact Sarah.</p></Panel>}
{tab === 'availability' && <><Panel title="Team availability"><p className="ofSmall">Team absence counts are shown without confidential reasons. A request still needs approval.</p><div className="ofCalendar">{data.calendar.map(d => <div key={d.date} className="ofDay"><b>{new Date(d.date + 'T12:00:00Z').toLocaleDateString('en-GB', {
                  weekday: 'short',
                  day: 'numeric'
                })}</b>{d.bankHoliday && <span>{d.bankHoliday}</span>}{d.departments.map(r => <small key={r.name}>{r.name}: {r.unavailable} off · {r.remaining} spaces</small>)}{data.rota.filter(r => r.date === d.date).map(r => <small key={r.id}>{r.employeeName}: {r.off ? 'Off' : r.start + '–' + r.end}</small>)}</div>)}</div></Panel><Panel title="My normal working week"><Table headings={['Day', 'Start', 'Finish', 'Break']} rows={(data.employee.pattern || []).map((r, i) => <tr key={i}><td>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i]}</td><td>{r.start || 'Off'}</td><td>{r.end || '—'}</td><td>{r.breakMinutes || 0} mins</td></tr>)} /><p>Saturday rota: every {data.employee.saturdayEvery || 1} week(s){data.employee.saturdayAnchor ? ' from ' + dateText(data.employee.saturdayAnchor) : ''}. Dated rota shifts override this pattern.</p></Panel></>}
{tab === 'documents' && <Panel title="My documents & handbooks"><Table headings={['Document', 'Version', 'Status', 'Actions']} rows={rows(data.documents).map(d => {
          const ack = data.acknowledgements.find(a => a.documentId === d.id);
          return <tr key={d.id}><td>{d.title}</td><td>{d.version}</td><td>{ack ? 'Acknowledged' : d.requiresAcknowledgement ? 'Read & acknowledge' : 'Available'}</td><td><button onClick={() => run(async () => {
                const r = await officePost('downloadDocument', {
                  id: d.id
                });
                base64File(r.name, r.data, r.mime);
              })}>Download / read</button>{d.requiresAcknowledgement && !ack && <button onClick={() => run(async () => {
                if (!window.confirm('I confirm I have read and understood ' + d.title + ' version ' + d.version + '.')) return;
                await officePost('acknowledge', {
                  id: d.id,
                  confirm: true
                });
                setNotice('Your acknowledgement of this version has been recorded.');
              })}>I have read this version</button>}</td></tr>;
        })} /></Panel>}
{tab === 'hours' && <Panel title="My submitted hours" actions={<button onClick={() => setModal('hours')}>Submit hours</button>}><Table headings={['Period', 'Hours', 'Overtime', 'Status']} rows={rows(data.timesheets).map(r => <tr key={r.id}><td>{dateText(r.from)} — {dateText(r.to)}</td><td>{r.hours}</td><td>{r.overtime}</td><td>{r.status}</td></tr>)} /></Panel>}
{tab === 'messages' && <Panel title="Messages for me">{rows(data.messages).map(r => <article className="ofPanel" key={r.id}><h3>{r.subject}</h3><p className="ofContent">{r.body}</p><small>{r.channel} · {r.status}</small></article>)}{!rows(data.messages).length && <Empty />}</Panel>}
{modal && <Modal title={modal === 'leave' ? 'Request holiday' : 'Submit hours'} close={() => setModal('')}>{modal === 'leave' ? <LeaveForm self busy={busy} save={v => run(async () => {
          await officePost('requestLeave', v);
          setModal('');
          setNotice('Request sent for approval.');
        })} /> : <HoursForm self mode="timesheet" year={Number(month.slice(0, 4))} busy={busy} save={v => run(async () => {
          await officePost('timesheet', v);
          setModal('');
          setNotice('Hours submitted.');
        })} />}</Modal>}
</>}</main>;
}
