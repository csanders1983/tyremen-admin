import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../auth/AuthContext';
import { officePost, today, requestId, matches, dateText, gbp, readData, base64File, downloadFile } from '../lib/officeApi';
import { parseCsv, csv as rawCsv } from '../lib/marketingTools';
import { Panel, Field, Toolbar, Modal, Table } from '../components/OfficeUI';
const csv = (headers, rows) => rawCsv(headers, rows.map(r => headers.map(k => r[k] ?? '')));
const tabs = [['people', 'People'], ['leave', 'Holiday & absence'], ['rota', 'Saturday rota'], ['records', 'Employee records'], ['documents', 'Documents'], ['hours', 'Hours & TOIL'], ['payroll', 'Payroll preparation'], ['messages', 'Staff messages'], ['history', 'History & alerts'], ['settings', 'HR settings']];
const pattern = () => Array.from({
  length: 7
}, (_, i) => ({
  start: i < 5 ? '09:00' : '',
  end: i < 5 ? '17:00' : '',
  breakMinutes: 0
}));
const fresh = () => ({
  name: '',
  email: '',
  mobile: '',
  dob: '',
  startDate: today(),
  finishDate: '',
  department: 'Workshop',
  jobTitle: '',
  address: '',
  postcode: '',
  emergencyName: '',
  emergencyRelationship: '',
  emergencyPhone: '',
  pattern: pattern(),
  payType: 'hourly',
  hoursType: 'regular',
  hourlyRate: '',
  annualSalary: '',
  holidayHourlyRate: '',
  entitlementHours: '',
  saturdayEvery: 1,
  saturdayAnchor: '',
  payFrequency: 'monthly',
  payPeriodDay: 1,
  payPeriodAnchor: '',
  taxCode: '1257L',
  niCategory: 'A',
  studentLoan: 'none',
  employeePensionPct: 5,
  employerPensionPct: 3,
  pensionEnabled: true,
  pensionMethod: 'relief-at-source',
  pensionBasis: 'qualifying',
  payrollNumber: '',
  notes: ''
});
const peopleHeaders = ['name', 'email', 'mobile', 'dob', 'startDate', 'finishDate', 'department', 'jobTitle', 'address', 'postcode', 'emergencyName', 'emergencyRelationship', 'emergencyPhone', 'payrollNumber', 'hourlyRate', 'annualSalary', 'holidayHourlyRate', 'payType', 'hoursType', 'payFrequency', 'taxCode', 'niCategory', 'studentLoan'];
function EmployeeForm({
  initial,
  save,
  busy
}) {
  const [v, setV] = useState({
      ...fresh(),
      ...initial
    }),
    [effective, setEffective] = useState(today());
  const field = (k, type = 'text', label = k.replace(/([A-Z])/g, ' $1')) => <Field key={k} label={label}><input type={type} value={v[k] ?? ''} onChange={e => setV({
      ...v,
      [k]: e.target.value
    })} /></Field>;
  return <form onSubmit={e => {
    e.preventDefault();
    save(v, effective);
  }}><div className="ofGrid">{['name', 'preferredName', 'department', 'jobTitle', 'payrollNumber'].map(k => field(k))}{field('email', 'email')}{field('mobile', 'tel')}{field('dob', 'date', 'Date of birth')}{field('startDate', 'date')}{field('finishDate', 'date')}{field('postcode')}{field('authUid', 'text', 'Linked Firebase login ID (optional)')}<div className="ofWide"><Field label="Home address"><textarea rows={3} value={v.address} onChange={e => setV({
            ...v,
            address: e.target.value
          })} /></Field></div>{['emergencyName', 'emergencyRelationship', 'emergencyPhone'].map(k => field(k))}</div>
<h3>Working week & holiday</h3><p className="ofSmall">28 days including bank holidays for a five-day week; part-time patterns are prorated and balances are held in hours. Blank start/end means not working. Dates override the normal pattern in Saturday rota.</p>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, i) => <div className="ofPattern" key={day}><span>{day}</span>{['start', 'end', 'breakMinutes'].map(k => <input key={k} aria-label={day + ' ' + k} type={k === 'breakMinutes' ? 'number' : 'time'} min="0" placeholder="Break mins" value={v.pattern[i]?.[k] ?? ''} onChange={e => setV({
        ...v,
        pattern: v.pattern.map((r, n) => n === i ? {
          ...r,
          [k]: k === 'breakMinutes' ? Number(e.target.value) : e.target.value
        } : r)
      })} />)}</div>)}<div className="ofGrid">{field('saturdayEvery', 'number', 'Saturday: every N weeks')}{field('saturdayAnchor', 'date', 'First working Saturday')}{field('entitlementHours', 'number', 'Annual hours override (blank = statutory)')}<Field label="Hours basis"><select value={v.hoursType} onChange={e => setV({
          ...v,
          hoursType: e.target.value
        })}><option value="regular">Regular contracted hours</option><option value="irregular">Irregular hours: 12.07% accrual</option></select></Field></div>
<h3>Pay settings — accountant preparation</h3><div className="ofGrid"><Field label="Pay type"><select value={v.payType} onChange={e => setV({
          ...v,
          payType: e.target.value
        })}><option value="hourly">Hourly</option><option value="salary">Annual salary</option></select></Field>{['hourlyRate', 'annualSalary', 'holidayHourlyRate'].map(k => field(k, 'number'))}<Field label="Pay frequency"><select value={v.payFrequency} onChange={e => setV({
          ...v,
          payFrequency: e.target.value
        })}>{['weekly', 'fortnightly', 'four-weekly', 'monthly'].map(x => <option key={x}>{x}</option>)}</select></Field>{field('payPeriodDay', 'number', 'Monthly pay reference period starts on day')}{field('payPeriodAnchor', 'date', 'Weekly pay reference period anchor')}{field('taxCode')}<Field label="NI category"><select value={v.niCategory} onChange={e => setV({
          ...v,
          niCategory: e.target.value
        })}>{['A', 'B', 'C', 'H', 'J', 'M', 'Z'].map(x => <option key={x}>{x}</option>)}</select></Field><Field label="Student loan"><select value={v.studentLoan} onChange={e => setV({
          ...v,
          studentLoan: e.target.value
        })}>{['none', '1', '2', '4', '5'].map(x => <option key={x}>{x}</option>)}</select></Field>{['employeePensionPct', 'employerPensionPct'].map(k => field(k, 'number'))}<Field label="Pension method"><select value={v.pensionMethod} onChange={e => setV({
          ...v,
          pensionMethod: e.target.value
        })}>{['relief-at-source', 'net-pay', 'salary-sacrifice'].map(x => <option key={x}>{x}</option>)}</select></Field><Field label="Pension basis"><select value={v.pensionBasis} onChange={e => setV({
          ...v,
          pensionBasis: e.target.value
        })}><option value="qualifying">Qualifying earnings</option><option value="all">All earnings</option></select></Field>{field('apprenticeshipStart', 'date')}{['apprentice', 'postgraduateLoan', 'director', 'pensionEnabled', 'writtenHolidayRecoveryAgreement'].map(k => <label className="ofCheck" key={k}><input type="checkbox" checked={!!v[k]} onChange={e => setV({
          ...v,
          [k]: e.target.checked
        })} />{k.replace(/([A-Z])/g, ' $1')}</label>)}</div><Field label="Confidential notes"><textarea rows={4} value={v.notes} onChange={e => setV({
        ...v,
        notes: e.target.value
      })} /></Field>{initial?.id && <Field label="Contract/pay changes take effect from"><input type="date" value={effective} onChange={e => setEffective(e.target.value)} /></Field>}<div className="ofActions"><button disabled={busy} className="primary">Save employee</button></div></form>;
}
function LeaveForm({
  employees,
  self,
  save,
  busy
}) {
  const [v, setV] = useState({
    employeeId: employees?.[0]?.id || '',
    from: today(),
    to: today(),
    type: 'holiday',
    note: '',
    partialHours: ''
  });
  return <form onSubmit={e => {
    e.preventDefault();
    save(v);
  }}><div className="ofGrid">{!self && <PersonSelect {...{
        employees
      }} value={v.employeeId} onChange={employeeId => setV({
        ...v,
        employeeId
      })} />}<Field label="From"><input type="date" required value={v.from} onChange={e => setV({
          ...v,
          from: e.target.value,
          to: v.to < e.target.value ? e.target.value : v.to
        })} /></Field><Field label="To"><input type="date" required value={v.to} min={v.from} onChange={e => setV({
          ...v,
          to: e.target.value
        })} /></Field><Field label="Type"><select value={v.type} onChange={e => setV({
          ...v,
          type: e.target.value
        })}>{(self ? ['holiday', 'unpaid'] : ['holiday', 'sick', 'unpaid', 'family', 'compassionate', 'other']).map(x => <option key={x}>{x}</option>)}</select></Field><Field label="Partial day hours (blank = full days)"><input type="number" min="0.25" step="0.25" value={v.partialHours} onChange={e => setV({
          ...v,
          partialHours: e.target.value
        })} /></Field><Field label="Note"><textarea value={v.note} onChange={e => setV({
          ...v,
          note: e.target.value
        })} /></Field></div><div className="ofActions"><button className="primary" disabled={busy}>Submit for approval</button></div></form>;
}
function PersonSelect({
  employees,
  value,
  onChange,
  label = 'Employee',
  all = false
}) {
  return <Field label={label}><select required value={value} onChange={e => onChange(e.target.value)}>{all && <option value="">All employees</option>}{employees.filter(e => !e.archived || e.id === value).map(e => <option value={e.id} key={e.id}>{e.name}</option>)}</select></Field>;
}
function RotaForm({
  employees,
  save,
  busy
}) {
  const [v, setV] = useState({
    employeeId: employees[0]?.id || '',
    date: today(),
    start: '09:00',
    end: '13:00',
    breakMinutes: 0,
    note: '',
    off: false
  });
  return <form onSubmit={e => {
    e.preventDefault();
    save(v);
  }}><div className="ofGrid"><PersonSelect {...{
        employees
      }} value={v.employeeId} onChange={employeeId => setV({
        ...v,
        employeeId
      })} />{['date', 'start', 'end', 'breakMinutes', 'note'].map(k => <Field label={k} key={k}><input required={k === 'date'} type={k === 'date' ? 'date' : ['start', 'end'].includes(k) ? 'time' : k === 'breakMinutes' ? 'number' : 'text'} value={v[k]} onChange={e => setV({
          ...v,
          [k]: e.target.value
        })} /></Field>)}<label className="ofCheck"><input type="checkbox" checked={v.off} onChange={e => setV({
          ...v,
          off: e.target.checked
        })} /> Not working on this date</label></div><div className="ofActions"><button disabled={busy} className="primary">Save dated shift</button></div></form>;
}
function RecordForm({
  employees,
  save,
  busy
}) {
  const [v, setV] = useState({
    employeeId: employees[0]?.id || '',
    type: 'sickness',
    title: '',
    date: today(),
    from: today(),
    to: today(),
    note: '',
    followUpDate: ''
  });
  return <form onSubmit={e => {
    e.preventDefault();
    save(v);
  }}><div className="ofGrid"><PersonSelect {...{
        employees
      }} value={v.employeeId} onChange={employeeId => setV({
        ...v,
        employeeId
      })} /><Field label="Record type"><select value={v.type} onChange={e => setV({
          ...v,
          type: e.target.value
        })}>{['sickness', 'warning', 'performance', 'training', 'probation', 'meeting', 'other'].map(x => <option key={x}>{x}</option>)}</select></Field>{['title', 'date', 'from', 'to', 'followUpDate'].map(k => <Field key={k} label={k}><input required={k === 'title'} type={k === 'title' ? 'text' : 'date'} value={v[k]} onChange={e => setV({
          ...v,
          [k]: e.target.value
        })} /></Field>)}<div className="ofWide"><Field label="Confidential record / letter text"><textarea rows={10} value={v.note} onChange={e => setV({
            ...v,
            note: e.target.value
          })} /></Field></div></div><div className="ofActions"><button disabled={busy} className="primary">Save record</button></div></form>;
}
function DocumentForm({
  employees,
  save,
  busy
}) {
  const [v, setV] = useState({
    scope: 'handbook',
    employeeId: employees[0]?.id || '',
    title: '',
    version: '1',
    requiresAcknowledgement: true,
    sharedWithEmployee: true,
    data: '',
    name: ''
  });
  return <form onSubmit={e => {
    e.preventDefault();
    save(v);
  }}><div className="ofGrid two"><Field label="Document scope"><select value={v.scope} onChange={e => setV({
          ...v,
          scope: e.target.value
        })}><option value="handbook">Handbook / shared with all staff</option><option value="employee">Employee file</option></select></Field>{v.scope === 'employee' && <PersonSelect {...{
        employees
      }} value={v.employeeId} onChange={employeeId => setV({
        ...v,
        employeeId
      })} />}<Field label="Title"><input required value={v.title} onChange={e => setV({
          ...v,
          title: e.target.value
        })} /></Field><Field label="Version"><input value={v.version} onChange={e => setV({
          ...v,
          version: e.target.value
        })} /></Field><label className="ofCheck"><input type="checkbox" checked={v.requiresAcknowledgement} onChange={e => setV({
          ...v,
          requiresAcknowledgement: e.target.checked
        })} /> Employee must acknowledge this version</label>{v.scope === 'employee' && <label className="ofCheck"><input type="checkbox" checked={v.sharedWithEmployee} onChange={e => setV({
          ...v,
          sharedWithEmployee: e.target.checked
        })} /> Share with this employee</label>}<div className="ofWide"><Field label="File — PDF, DOCX, image or text; max 5 MB"><input required type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,.txt" onChange={async e => {
            const f = e.target.files[0];
            if (!f) return;
            if (f.size > 5 * 1024 * 1024) {
              alert('Keep files under 5 MB');
              return;
            }
            setV({
              ...v,
              name: f.name,
              data: await readData(f)
            });
          }} /></Field></div></div><div className="ofActions"><button disabled={busy || !v.data} className="primary">Upload new retained version</button></div></form>;
}
function HoursForm({
  employees,
  mode,
  self,
  save,
  busy,
  year
}) {
  const [v, setV] = useState({
    employeeId: employees[0]?.id || '',
    year,
    kind: 'toil',
    hours: '',
    reason: '',
    from: today(),
    to: today(),
    overtime: 0,
    note: '',
    self: !!self
  });
  return <form onSubmit={e => {
    e.preventDefault();
    save(v);
  }}><div className="ofGrid">{!self && <PersonSelect {...{
        employees
      }} value={v.employeeId} onChange={employeeId => setV({
        ...v,
        employeeId
      })} />}<Field label="Hours"><input type="number" step="0.25" required value={v.hours} onChange={e => setV({
          ...v,
          hours: e.target.value
        })} /></Field>{mode === 'adjustment' ? <><Field label="Adjustment type"><select value={v.kind} onChange={e => setV({
            ...v,
            kind: e.target.value
          })}>{['toil', 'carry', 'correction', 'irregular-accrual'].map(x => <option key={x}>{x}</option>)}</select></Field><Field label="Reason"><input required value={v.reason} onChange={e => setV({
            ...v,
            reason: e.target.value
          })} /></Field></> : ['from', 'to', 'overtime', 'note'].map(k => <Field key={k} label={k}><input type={['from', 'to'].includes(k) ? 'date' : k === 'overtime' ? 'number' : 'text'} value={v[k]} onChange={e => setV({
          ...v,
          [k]: e.target.value
        })} /></Field>)}</div><div className="ofActions"><button disabled={busy} className="primary">{mode === 'adjustment' ? 'Add balance adjustment' : 'Submit hours'}</button></div></form>;
}
function Payroll({
  employees,
  call,
  run,
  busy,
  payruns,
  archive,
  showRows
}) {
  const [id, setId] = useState(employees[0]?.id || ''),
    [input, setInput] = useState({
      payDate: today(),
      periodStart: today(),
      periodNumber: 1,
      hours: '',
      overtimeHours: 0,
      overtimeRate: '',
      bonus: 0,
      basePay: '',
      statutoryPay: 0,
      holidayPay: 0,
      expenses: 0,
      otherDeductions: 0,
      taxableYtd: 0,
      taxYtd: 0,
      nmwHours: '',
      nonCumulative: true
    }),
    [result, setResult] = useState(null),
    [rows, setRows] = useState([]),
    [leaver, setLeaver] = useState(null),
    [leaving, setLeaving] = useState(today()),
    [calculationError, setCalculationError] = useState('');
  useEffect(() => {
    setResult(null);
    setCalculationError('');
    let current = true;
    const timer = setTimeout(() => {
      if (id) call('payrollEstimate', {
        employeeId: id,
        input
      }).then(r => {
        if (current) setResult(r.result);
      }).catch(e => {
        if (current) setCalculationError(e.message);
      });
    }, 500);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [id, input, call]);
  const calculate = () => call('payrollEstimate', {
    employeeId: id,
    input
  });
  return <><Panel title="Live pay calculator — prepare for accountant"><p className="ofNotice">2026/27 estimate for accountant review. This does not submit PAYE/RTI, approve payroll or create a statutory payslip. Enter the employee’s actual tax code and approved hours.</p><div className="ofGrid"><PersonSelect {...{
          employees
        }} value={id} onChange={setId} />{Object.keys(input).filter(k => k !== 'nonCumulative').map(k => <Field label={k.replace(/([A-Z])/g, ' $1')} key={k}><input type={['payDate', 'periodStart'].includes(k) ? 'date' : 'number'} step="any" value={input[k]} onChange={e => setInput({
            ...input,
            [k]: e.target.value
          })} /></Field>)}<label className="ofCheck"><input type="checkbox" checked={input.nonCumulative} onChange={e => setInput({
            ...input,
            nonCumulative: e.target.checked
          })} /> Week 1 / Month 1 illustration (uncheck for cumulative with YTD)</label></div><div className="ofActions"><button disabled={busy || !id} className="primary" onClick={() => run(async () => setResult((await calculate()).result))}>Calculate pay</button><button disabled={busy || !result} onClick={() => {
          setRows(v => [...v.filter(r => r.employeeId !== id), {
            employeeId: id,
            name: employees.find(e => e.id === id)?.name,
            input: {
              ...input
            },
            result
          }]);
        }}>Add to accountant pack</button></div>{calculationError && <p className="ofWarn">{calculationError}</p>}{result && <><div className="ofStats">{[['Gross', result.gross], ['PAYE', result.tax], ['Employee NI', result.employeeNi], ['Net estimate', result.net]].map(([k, v]) => <div key={k} className="ofStat"><span>{k}</span><b>{gbp(v)}</b></div>)}</div><dl>{Object.entries(result).filter(([k, v]) => typeof v === 'number' && !['periodNumber'].includes(k)).map(([k, v]) => <div key={k}><dt>{k.replace(/([A-Z])/g, ' $1')}</dt><dd>{gbp(v)}</dd></div>)}</dl>{result.warnings.map(w => <p className="ofWarn" key={w}>{w}</p>)}</>}</Panel>
 <Panel title="Accountant pack"><Table headings={['Employee', 'Gross', 'PAYE', 'NI', 'Net', 'Actions']} rows={rows.map(r => <tr key={r.employeeId}><td>{r.name}</td><td>{gbp(r.result.gross)}</td><td>{gbp(r.result.tax)}</td><td>{gbp(r.result.employeeNi)}</td><td>{gbp(r.result.net)}</td><td><button onClick={() => setRows(rows.filter(v => v.employeeId !== r.employeeId))}>Remove draft row</button></td></tr>)} /><div className="ofActions"><button disabled={busy || !rows.length} onClick={() => run(async () => {
          await call('payrun', {
            rows,
            title: 'Payroll preparation ' + today(),
            date: today()
          });
          setRows([]);
        })}>Save accountant pack</button></div><Table headings={['Prepared date', 'Title', 'People', 'Actions']} rows={showRows(payruns).map(p => <tr key={p.id}><td>{dateText(p.date)}</td><td>{p.title}<small>Prepared · accountant approval required</small></td><td>{p.rows.length}</td><td><button onClick={() => {
            const h = ['name', 'payrollNumber', 'taxCode', 'gross', 'tax', 'employeeNi', 'employerNi', 'employeePension', 'employerPension', 'studentLoan', 'postgraduateLoan', 'net', 'employerCost'];
            downloadFile('Tyremen-payroll-' + p.date + '.csv', csv(h, p.rows.map(r => ({
              ...r,
              ...r.result
            }))));
          }}>Export CSV</button><button onClick={() => archive('payruns', p)}>{p.archived ? 'Restore' : 'Archive'}</button></td></tr>)} /></Panel>
 <Panel title="Leaving employee — holiday settlement"><div className="ofGrid"><PersonSelect {...{
          employees
        }} value={id} onChange={setId} /><Field label="Leaving date"><input type="date" value={leaving} onChange={e => setLeaving(e.target.value)} /></Field></div><div className="ofActions"><button disabled={busy} onClick={() => run(async () => setLeaver(await call('leaver', {
          employeeId: id,
          date: leaving
        })))}>Calculate holiday owed</button></div>{leaver && <><p>Untaken hours owed: <b>{leaver.hoursOwed}</b> · Indicative payment <b>{gbp(leaver.paymentDue)}</b></p><p>Overtaken hours: {leaver.hoursOvertaken}. {leaver.canDeductOvertaken ? 'Written recovery agreement recorded.' : 'No written agreement recorded: do not deduct automatically.'}</p><p className="ofSmall">{leaver.note}</p></>}</Panel></>;
}
export default function HR() {
  const {
    user
  } = useAuth();
  const [data, setData] = useState(null),
    [tab, setTab] = useState('people'),
    [year, setYear] = useState(Number(today().slice(0, 4))),
    [search, setSearch] = useState(''),
    [archived, setArchived] = useState(false),
    [person, setPerson] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [modal, setModal] = useState(null),
    [calendar, setCalendar] = useState([]),
    [month, setMonth] = useState(today().slice(0, 7)),
    [selected, setSelected] = useState([]),
    [message, setMessage] = useState(''),
    [channels, setChannels] = useState(['sms']),
    [password, setPassword] = useState(''),
    [override, setOverride] = useState(false),
    [settings, setSettings] = useState(null),
    [access, setAccess] = useState({
      uid: '',
      role: 'approver',
      active: true
    }),
    [inspect, setInspect] = useState(null),
    [importRows, setImportRows] = useState(null);
  const load = useCallback(async () => {
    const r = await officePost('load', {
      year
    });
    setData(r);
    setSettings(r.settings);
    if (r.access === 'approver') setTab(t => t === 'people' ? 'leave' : t);
  }, [year]);
  useEffect(() => {
    load().catch(e => setError(e.message));
  }, [load]);
  const run = async (fn, reload = true) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const v = await fn();
      if (reload) await load();
      return v;
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const call = officePost;
  const showRows = useCallback(rows => (rows || []).filter(r => (archived || !r.archived) && (!person || r.employeeId === person || r.id === person) && matches(r, search)), [archived, person, search]);
  const missingOverridePassword=override&&!password;
  const employees = data?.employees || [],
    active = employees.filter(e => !e.archived),
    privateAccess = data && ['owner', 'hr-admin'].includes(data.access),
    owner = data?.access === 'owner';
  const name = id => employees.find(e => e.id === id)?.name || id;
  const archive = (collection, row) => run(async () => {
    await call('archive', {
      collection,
      id: row.id,
      archived: !row.archived
    });
    setNotice(row.archived ? 'Record restored.' : 'Archived and retained. Approved financial/holiday entries still count.');
  });
  const saveModal = action => async v => run(async () => {
    await call(action, v);
    setModal(null);
    setNotice('Saved.');
  });
  const downloadDoc = d => run(async () => {
    const r = await call('downloadDocument', {
      id: d.id
    });
    base64File(r.name, r.data, r.mime);
  }, false);
  const getCalendar = useCallback(async () => {
    const start = month + '-01',
      d = new Date(start + 'T12:00:00Z');
    d.setUTCMonth(d.getUTCMonth() + 1);
    d.setUTCDate(0);
    setCalendar((await officePost('calendar', {
      from: start,
      to: d.toISOString().slice(0, 10),
      year: Number(month.slice(0, 4))
    })).calendar);
  }, [month]);
  useEffect(() => {
    if (data && (tab === 'leave' || tab === 'rota')) getCalendar().catch(e => setError(e.message));
  }, [tab, data, getCalendar]);
  const stats = useMemo(() => [active.length, (data?.requests || []).filter(r => r.status === 'pending').length, (data?.alerts || []).filter(r => !r.archived).length, (data?.timesheets || []).filter(r => r.status === 'submitted').length], [active.length, data]);
  return <div className="office"><p className="ofIntro">People, holidays, records and pay preparation. Archived records stay searchable and can be restored. Private HR access is separate from workshop permissions.</p>{error && <p className="ofNotice error" role="alert">{error}</p>}{notice && <p className="ofNotice" role="status">{notice}</p>}{!data ? <Panel title="HR connection"><p>Signed-in ID: <code>{user?.uid}</code></p><p>Configure the owner ID and private HR database using INSTALL-OFFICE-HR.md.</p><button onClick={() => run(load, false)}>Retry connection</button></Panel> : <>
 <div className="ofStats">{['Active employees', 'Leave awaiting approval', 'Wage review alerts', 'Timesheets awaiting review'].map((k, i) => <div className="ofStat" key={k}><span>{k}</span><b>{stats[i]}</b></div>)}</div><div className="ofTabs" role="tablist">{tabs.filter(([k]) => privateAccess || ['leave', 'rota', 'hours'].includes(k)).map(([k, n]) => <button role="tab" aria-selected={tab === k} key={k} onClick={() => {
          setTab(k);
          setSearch('');
          setPerson('');
        }}>{n}</button>)}</div>
 <Toolbar {...{
        search,
        setSearch,
        archived,
        setArchived
      }}><select aria-label="Holiday year" style={{
          width: 110
        }} value={year} onChange={e => setYear(Number(e.target.value))}>{Array.from({
            length: 7
          }, (_, i) => year - 3 + i).map(y => <option key={y}>{y}</option>)}</select><select aria-label="Filter employee" style={{
          width: 200
        }} value={person} onChange={e => setPerson(e.target.value)}><option value="">All employees</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}{e.archived ? ' (archived)' : ''}</option>)}</select><button disabled={busy} onClick={() => run(load, false)}>Refresh</button><a href="/staff" target="_blank" rel="noreferrer">Staff portal ↗</a></Toolbar>
 {tab === 'people' && privateAccess && <Panel title="Employee directory" actions={owner && <><button className="primary" onClick={() => setModal({
          type: 'employee'
        })}>Add employee</button><button onClick={() => downloadFile('Tyremen-employees.csv', csv(peopleHeaders, showRows(employees)))}>Export CSV</button><label className="ofCheck">Import CSV<input type="file" accept=".csv" style={{
            width: 170
          }} onChange={e => run(async () => {
            const f = e.target.files[0];
            if (f) setImportRows(parseCsv(await f.text()));
          }, false)} /></label></>}><Table headings={['Employee', 'Contact', 'Holiday hours', 'Minimum wage', 'Actions']} rows={showRows(employees).map(e => <tr key={e.id}><td><b>{e.name}</b><small>{e.jobTitle} · {e.department}</small>{e.archived && <span className="ofBadge">Archived</span>}</td><td>{e.email}<small>{e.mobile}</small></td><td><b>{e.balance.remainingHours}</b> remaining<small>{e.balance.entitlementHours} entitlement · {e.balance.bankHolidayHours} bank holidays · {e.balance.bookedHours} booked</small></td><td>{e.wage?.rate ? gbp(e.wage.rate) + '/hr' : e.wage?.reason}{(e.wageAlerts || []).map(a => <small className="ofFlag" key={a.at}>{a.reason} {dateText(a.at)} · {gbp(a.required)}/hr from {dateText(a.effective)}</small>)}</td><td>{owner && <><button onClick={() => setModal({
                type: 'employee',
                value: e
              })}>Edit</button><button onClick={() => run(async () => {
                const r = await call('createStaffLogin', {
                  employeeId: e.id
                });
                setNotice(r.message);
              })}>Link staff login</button><button onClick={() => archive('employees', e)}>{e.archived ? 'Restore' : 'Archive'}</button></>}</td></tr>)} /><p className="ofSmall">CSV headers: {peopleHeaders.join(', ')}. Existing employees should be edited in the directory; imports create new records after review.</p></Panel>}
 {tab === 'leave' && <><Panel title="Holiday & absence requests" actions={<button className="primary" onClick={() => setModal({
          type: 'leave'
        })}>Add request / absence</button>}><Table headings={['Employee', 'Dates', 'Type / hours', 'Status', 'Actions']} rows={showRows(data.requests).filter(r => r.year === year).map(r => <tr key={r.id}><td>{name(r.employeeId)}</td><td>{dateText(r.from)} — {dateText(r.to)}<small>{r.note}</small></td><td>{r.type} · {r.hours} hrs</td><td>{r.status}<small>{r.decisionNote || r.reason}</small></td><td>{r.status === 'pending' && !r.archived && <><button onClick={() => run(async () => {
                  const reason = window.prompt('Approval note (optional)', '');
                  if (reason === null) return;
                  await call('decideLeave', {
                    id: r.id,
                    revision: r.revision,
                    decision: 'approve',
                    reason
                  });
                })}>Approve</button><button onClick={() => run(async () => {
                  const reason = window.prompt('Reason for declining');
                  if (!reason) return;
                  await call('decideLeave', {
                    id: r.id,
                    revision: r.revision,
                    decision: 'decline',
                    reason
                  });
                })}>Decline</button>{owner && <button onClick={() => run(async () => {
                  const overrideReason = window.prompt('Owner override reason — balance/capacity exception');
                  if (!overrideReason) return;
                  await call('decideLeave', {
                    id: r.id,
                    revision: r.revision,
                    decision: 'approve',
                    overrideReason
                  });
                })}>Owner override</button>}</>}{['approved', 'pending'].includes(r.status) && <button onClick={() => run(async () => {
                const reason = window.prompt('Cancellation reason');
                if (reason) await call('cancelLeave', {
                  id: r.id,
                  reason
                });
              })}>Cancel request</button>}<button onClick={() => archive('leave', r)}>{r.archived ? 'Restore' : 'Archive'}</button></td></tr>)} /></Panel></>}
 {['leave', 'rota'].includes(tab) && <Panel title="Team availability & Saturday rota" actions={<><input aria-label="Calendar month" style={{
          width: 165
        }} type="month" value={month} onChange={e => setMonth(e.target.value)} />{owner && <button onClick={() => setModal({
          type: 'rota'
        })}>Add dated shift</button>}</>}><p className="ofSmall">Availability includes approved absences. The normal working week and alternating Saturday pattern are set on each employee. Dated shifts take precedence.</p><div className="ofCalendar">{calendar.map(d => <div key={d.date} className="ofDay"><b>{new Date(d.date + 'T12:00:00Z').toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric'
              })}</b>{d.bankHoliday && <span className="ofFlag">{d.bankHoliday}</span>}{d.departments.map(r => <small key={r.name}>{r.name}: {r.unavailable} off · {r.remaining} leave spaces</small>)}{(data.rota || []).filter(r => r.date === d.date && matches(r, search)).map(r => <small key={r.id}>{name(r.employeeId)} {r.off ? 'off' : r.start + '–' + r.end}</small>)}</div>)}</div></Panel>}
 {tab === 'records' && privateAccess && <Panel title="Confidential employee records" actions={<button className="primary" onClick={() => setModal({
        type: 'record'
      })}>Add record / warning</button>}><Table headings={['Employee', 'Date', 'Type', 'Title', 'Actions']} rows={showRows(data.records).map(r => <tr key={r.id}><td>{name(r.employeeId)}</td><td>{dateText(r.date)}</td><td>{r.type}</td><td>{r.title}<small>{r.followUpDate ? 'Review ' + dateText(r.followUpDate) : ''}</small></td><td><button onClick={() => setInspect(r)}>View</button><button onClick={() => archive('records', r)}>{r.archived ? 'Restore' : 'Archive'}</button></td></tr>)} /><p className="ofSmall">For sickness absence affecting the working calendar, also add an absence request and approve it. Files such as fit notes and signed letters belong in Documents.</p></Panel>}
 {tab === 'documents' && privateAccess && <Panel title="Handbooks & employee files" actions={<button className="primary" onClick={() => setModal({
        type: 'document'
      })}>Upload document</button>}><Table headings={['Title / version', 'Scope', 'Acknowledgements', 'Actions']} rows={showRows(data.documents).map(d => <tr key={d.id}><td>{d.title}<small>Version {d.version} · {d.name}</small></td><td>{d.scope === 'handbook' ? 'All staff' : name(d.employeeId)}<small>{d.sharedWithEmployee ? 'Visible to employee' : 'Confidential HR only'}</small></td><td>{d.requiresAcknowledgement ? (data.acknowledgements || []).filter(a => a.documentId === d.id).map(a => a.employeeName).join(', ') || 'Awaiting acknowledgement' : 'Not required'}</td><td><button onClick={() => downloadDoc(d)}>Download</button><button onClick={() => archive('documents', d)}>{d.archived ? 'Restore' : 'Archive'}</button></td></tr>)} /></Panel>}
 {tab === 'hours' && <><Panel title="Submitted hours" actions={<button onClick={() => setModal({
          type: 'timesheet'
        })}>Add timesheet</button>}><Table headings={['Employee', 'Period', 'Hours', 'Status', 'Actions']} rows={showRows(data.timesheets).map(r => <tr key={r.id}><td>{name(r.employeeId)}</td><td>{dateText(r.from)} — {dateText(r.to)}</td><td>{r.hours} + {r.overtime} overtime</td><td>{r.status}</td><td>{r.status === 'submitted' && <button onClick={() => run(() => call('approveTimesheet', {
                id: r.id
              }))}>Approve</button>}{privateAccess && <button onClick={() => archive('timesheets', r)}>{r.archived ? 'Restore' : 'Archive'}</button>}</td></tr>)} /></Panel><Panel title="Holiday adjustments & time off in lieu" actions={owner && <button onClick={() => setModal({
          type: 'adjustment'
        })}>Add hours / TOIL</button>}><p className="ofSmall">Approved irregular-hours timesheets accrue 12.07%, rounded to the nearest whole hour. Archiving an adjustment does not reverse its balance; add an explicit negative correction with a reason.</p><Table headings={['Employee', 'Year', 'Type', 'Hours', 'Reason', 'Actions']} rows={showRows(data.adjustments).map(r => <tr key={r.id}><td>{name(r.employeeId)}</td><td>{r.year}</td><td>{r.kind}</td><td>{r.hours}</td><td>{r.reason}</td><td>{owner && <button onClick={() => archive('adjustments', r)}>{r.archived ? 'Restore' : 'Archive'}</button>}</td></tr>)} /></Panel></>}
 {tab === 'payroll' && privateAccess && <Payroll {...{
        employees: active,
        call,
        run,
        busy,
        payruns: data.payruns,
        archive,
        showRows
      }} />}
 {tab === 'messages' && privateAccess && <><Panel title="Staff messages"><p className="ofSmall">Messages wait until each employee’s working hours and exclude bank holidays and approved absence. An immediate out-of-hours send requires the owner to re-enter their password. Delivery history retains every attempt.</p><div className="ofGrid two"><Field label="Recipients"><select multiple style={{
                minHeight: 180
              }} value={selected} onChange={e => setSelected([...e.target.selectedOptions].map(o => o.value))}>{active.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field><Field label="Message"><textarea rows={8} value={message} onChange={e => setMessage(e.target.value)} /></Field></div><div className="ofActions"><button onClick={() => setSelected(active.map(e => e.id))}>Select all active staff</button>{['sms', 'email'].map(c => <label key={c} className="ofCheck"><input type="checkbox" checked={channels.includes(c)} onChange={e => setChannels(e.target.checked ? [...channels, c] : channels.filter(v => v !== c))} />{c.toUpperCase()}</label>)}</div>{owner && <><label className="ofCheck"><input type="checkbox" checked={override} onChange={e => setOverride(e.target.checked)} /> Send immediately outside working hours</label>{override && <Field label="Owner password — used only for Firebase reauthentication"><input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></Field>}</>}<div className="ofActions"><button className="primary" disabled={busy || !selected.length || !channels.length || !message.trim() || missingOverridePassword} onClick={() => run(async () => {
              if (!window.confirm(`Queue ${channels.join(' / ')} for ${selected.length} selected employees?`)) return;
              if (override) {
                try {
                  await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, password));
                  await auth.currentUser.getIdToken(true);
                } finally {
                  setPassword('');
                }
              }
              const r = await call('queue', {
                area: 'messaging',
                employeeIds: selected,
                channels,
                message,
                override,
                requestId: requestId()
              });
              setNotice(r.count + ' messages queued/processed. Check the history below.');
              setMessage('');
            })}>Queue staff message</button></div></Panel><Panel title="Message history"><Table headings={['Employee', 'Channel', 'Message', 'Status', 'Actions']} rows={showRows(data.messages).map(r => <tr key={r.id}><td>{r.employeeName}</td><td>{r.channel}</td><td>{r.body}</td><td>{r.status}<small>{r.error || r.providerStatus}</small></td><td><button onClick={() => archive('messages', r)}>{r.archived ? 'Restore' : 'Archive'}</button></td></tr>)} /></Panel></>}
 {tab === 'history' && privateAccess && <><Panel title="Review alerts"><Table headings={['Employee', 'Date', 'Alert', 'Actions']} rows={showRows(data.alerts).map(r => <tr key={r.id}><td>{name(r.employeeId)}</td><td>{dateText(r.date)}</td><td>{r.title}<small>{r.body}</small></td><td><button onClick={() => archive('alerts', r)}>{r.archived ? 'Restore' : 'Archive'}</button></td></tr>)} /></Panel><Panel title="Searchable audit history"><Table headings={['When', 'Action', 'By', 'Reference', 'Details']} rows={showRows([...(data.audit || []), ...(data.rotaHistory || []).map(r => ({
            ...r,
            action: 'rota.previous-version',
            atMs: r.updatedAt?._seconds * 1000 || 0
          })), ...(data.acknowledgements || []).map(r => ({
            ...r,
            action: 'document.acknowledged',
            atMs: r.acknowledgedAt?._seconds * 1000 || 0
          }))]).sort((a, b) => b.atMs - a.atMs).map(r => <tr key={r.id}><td>{new Date(r.atMs).toLocaleString('en-GB')}</td><td>{r.action}</td><td>{r.actor?.name}</td><td>{r.employeeId ? name(r.employeeId) : r.requestId || r.collection || ''}</td><td><button onClick={() => setInspect(r)}>View retained event</button></td></tr>)} /></Panel></>}
 {tab === 'settings' && privateAccess && settings && <><Panel title="Holiday & communication policy"><p>Holiday year: 1 January · 28 days including bank holidays for a five-day week. Signed-in ID: <code>{user?.uid}</code></p><div className="ofGrid"><Field label="Maximum staff off per department"><input type="number" min="1" value={settings.maxOffPerDepartment} onChange={e => setSettings({
                ...settings,
                maxOffPerDepartment: Number(e.target.value)
              })} /></Field><Field label="Leave approver logins (choose Sarah)"><select multiple style={{
                minHeight: 150
              }} value={settings.approverUids} onChange={e => setSettings({
                ...settings,
                approverUids: [...e.target.selectedOptions].map(o => o.value)
              })}>{(data.logins || []).map(u => <option key={u.id} value={u.id}>{u.name || u.id}</option>)}</select></Field><Field label="HR notification recipients (HR-authorised employees only)"><select multiple style={{
                minHeight: 150
              }} value={settings.notificationEmployeeIds} onChange={e => setSettings({
                ...settings,
                notificationEmployeeIds: [...e.target.selectedOptions].map(o => o.value)
              })}>{active.filter(e => e.authUid === user?.uid || (data.roles || []).some(r => r.id === e.authUid && r.active && ['hr-admin', 'approver'].includes(r.role))).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field><Field label="SMS sender"><input maxLength="11" value={settings.smsSender} onChange={e => setSettings({
                ...settings,
                smsSender: e.target.value
              })} /></Field><label className="ofCheck"><input type="checkbox" checked={settings.messagesEnabled} onChange={e => setSettings({
                ...settings,
                messagesEnabled: e.target.checked
              })} /> Enable staff messages and automatic HR notices</label><Field label="Carry-over policy"><textarea rows={3} value={settings.carryPolicy} onChange={e => setSettings({
                ...settings,
                carryPolicy: e.target.value
              })} /></Field></div><h3>Minimum wage rates — review before expiry</h3><Table headings={['Effective', 'Expires', '21+', '18–20', 'Under 18', 'Apprentice']} rows={settings.wageRates.map((r, i) => <tr key={i}>{['effective', 'expires', 'adult', 'youth', 'under18', 'apprentice'].map(k => <td key={k}><input aria-label={'Wage ' + k} type={['effective', 'expires'].includes(k) ? 'date' : 'number'} step="0.01" value={r[k] || ''} onChange={e => setSettings({
                ...settings,
                wageRates: settings.wageRates.map((x, n) => i === n ? {
                  ...x,
                  [k]: ['effective', 'expires'].includes(k) ? e.target.value : Number(e.target.value)
                } : x)
              })} /></td>)}</tr>)} /><div className="ofActions"><button disabled={!owner} onClick={() => setSettings({
              ...settings,
              wageRates: [...settings.wageRates, {
                effective: '2027-04-01',
                expires: '2028-03-31',
                adult: '',
                youth: '',
                under18: '',
                apprentice: ''
              }]
            })}>Add confirmed future rates</button><button disabled={busy || !owner} className="primary" onClick={() => run(() => call('settings', {
              settings
            }))}>Save HR settings</button><button disabled={busy || !owner} onClick={() => run(() => call('refreshBankHolidays'))}>Refresh GOV.UK bank holidays</button></div><details><summary>Bank holiday closure dates</summary>{settings.bankHolidays.map((h, i) => <label className="ofCheck" key={h.date}><input type="checkbox" checked={h.closed !== false} onChange={e => setSettings({
                ...settings,
                bankHolidays: settings.bankHolidays.map((x, n) => i === n ? {
                  ...x,
                  closed: e.target.checked
                } : x)
              })} />{dateText(h.date)} · {h.title}</label>)}</details></Panel>{owner && <Panel title="Private HR access"><p className="ofSmall">A workshop role does not grant confidential HR access. Grant Sarah approver access, then select her in the policy above. Owners are defined in the backend secret.</p><div className="ofGrid"><Field label="Existing staff login"><select value={access.uid} onChange={e => setAccess({
                ...access,
                uid: e.target.value
              })}><option value="">Choose login</option>{(data.logins || []).map(u => <option key={u.id} value={u.id}>{u.name || u.id}</option>)}</select></Field><Field label="HR permission"><select value={access.role} onChange={e => setAccess({
                ...access,
                role: e.target.value
              })}><option value="approver">Holiday approver only</option><option value="hr-admin">Confidential HR administrator</option><option value="employee">Own staff portal only</option></select></Field></div><div className="ofActions"><button disabled={busy || !access.uid} onClick={() => run(() => call('access', access))}>Grant selected access</button></div><Table headings={['Login', 'Role', 'Status', 'Actions']} rows={(data.roles || []).map(r => <tr key={r.id}><td>{data.logins.find(l => l.id === r.id)?.name || r.id}</td><td>{r.role}</td><td>{r.active ? 'Active' : 'Revoked'}</td><td><button onClick={() => run(() => call('access', {
                uid: r.id,
                role: r.role,
                active: !r.active
              }))}>{r.active ? 'Revoke' : 'Restore'}</button></td></tr>)} /></Panel>}</>}
 </>}
 {modal && <Modal title={{
      employee: modal.value ? 'Edit employee' : 'Add employee',
      leave: 'Holiday / absence request',
      rota: 'Dated rota shift',
      record: 'Employee record',
      document: 'Upload document',
      timesheet: 'Timesheet',
      adjustment: 'Holiday adjustment / TOIL'
    }[modal.type]} close={() => setModal(null)}>{modal.type === 'employee' ? <EmployeeForm initial={modal.value} busy={busy} save={(employee, effectiveFrom) => run(async () => {
        await call('employee', {
          employee,
          revision: modal.value?.revision,
          effectiveFrom
        });
        setModal(null);
      })} /> : modal.type === 'leave' ? <LeaveForm employees={active} busy={busy} save={saveModal('manualLeave')} /> : modal.type === 'rota' ? <RotaForm employees={active} busy={busy} save={saveModal('rota')} /> : modal.type === 'record' ? <RecordForm employees={active} busy={busy} save={saveModal('record')} /> : modal.type === 'document' ? <DocumentForm employees={active} busy={busy} save={saveModal('uploadDocument')} /> : <HoursForm employees={active} mode={modal.type} year={year} busy={busy} save={saveModal(modal.type)} />}</Modal>}
 {inspect && <Modal title="Retained record" close={() => setInspect(null)}><pre className="ofContent">{JSON.stringify(inspect, null, 2)}</pre><button onClick={() => downloadFile('Tyremen-HR-record.json', JSON.stringify(inspect, null, 2), 'application/json')}>Export this record</button></Modal>}
 {importRows && <Modal title="Review employee CSV import" close={() => setImportRows(null)}><p>{importRows.length} rows. This creates new employee records; it does not overwrite existing people. Name and startDate are mandatory. Work patterns default to Monday–Friday 09:00–17:00 and must be checked after import.</p><Table headings={['Name', 'Start date', 'Email', 'Check']} rows={importRows.map((r, i) => <tr key={i}><td>{r.name}</td><td>{r.startDate}</td><td>{r.email}</td><td>{!r.name || !/^\d{4}-\d\d-\d\d$/.test(r.startDate || '') ? 'Needs correction' : employees.some(e => e.email && e.email === r.email) ? 'Existing email — skipped' : 'Ready'}</td></tr>)} /><div className="ofActions"><button disabled={busy} className="primary" onClick={() => run(async () => {
          let count = 0;
          for (const r of importRows) {
            if (!r.name || !/^\d{4}-\d\d-\d\d$/.test(r.startDate || '') || employees.some(e => e.email && e.email === r.email)) continue;
            await call('employee', {
              employee: {
                ...fresh(),
                ...Object.fromEntries(peopleHeaders.filter(k => r[k] !== undefined).map(k => [k, r[k]]))
              }
            });
            count++;
          }
          setImportRows(null);
          setNotice(count + ' employees imported. Review their contracts and work patterns.');
        })}>Import ready rows</button></div></Modal>}
 </div>;
}
export { LeaveForm, HoursForm };
