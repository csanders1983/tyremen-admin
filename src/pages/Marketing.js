import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MarketingTestSend from '../components/MarketingTestSend';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { workshopPost } from '../lib/workshopApi';
import { headers, parseCsv, csv, download, pdfDownload, contactRows, blankContact, monthValue, localDateTime, drawArtwork } from '../lib/marketingTools';
import '../marketing.css';
const tabs = [['overview', 'Overview'], ['mot', 'MOT reminders'], ['letters', 'Letters'], ['attention', 'Needs attention'], ['campaigns', 'Campaigns'], ['insights', 'Business insights'], ['social', 'Social studio'], ['offers', 'Offers'], ['archive', 'Archives & opt-outs'], ['settings', 'Settings']];
const empty = {
  contacts: [],
  messages: [],
  campaigns: [],
  offers: [],
  social: [],
  batches: [],
  cycles: [],
  issues: [],
  staff: [],
  connections: {},
  settings: {
    templates: {}
  }
};
const money = n => '£' + Number(n || 0).toLocaleString('en-GB', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
const showDate = v => v ? String(v).slice(0, 10).split('-').reverse().join('/') : '—';
const titleKind = {
  motMonth: 'One-month MOT',
  motFortnight: 'Two-week MOT',
  appointment: 'Appointment',
  staffCheck: 'Staff booking check',
  campaign: 'Campaign',
  letter: 'Letter'
};
function Tag({
  children,
  state = ''
}) {
  return <span className={`mkTag ${state}`}>{children}</span>;
}
function Field({
  label,
  children
}) {
  return <label className="mkField"><span>{label}</span>{children}</label>;
}
const freshCampaign = () => ({
  title: '',
  kind: 'standard',
  subject: '',
  body: '',
  channels: ['email'],
  contactIds: [],
  month: monthValue(),
  accountOnly: false,
  imageUrl: '',
  sendAt: ''
});
export default function Marketing() {
  const {
    role
  } = useAuth();
  const [testDraft,setTestDraft]=useState(null),[includeArchived,setIncludeArchived]=useState(false),[librarySearch,setLibrarySearch]=useState('');
  const libraryRows=rows=>rows.filter(r=>(includeArchived||(!r.archived&&r.status!=='archived'))&&JSON.stringify(r).toLowerCase().includes(librarySearch.toLowerCase()));
  const [tab, setTab] = useState('overview'),
    [data, setData] = useState(empty),
    [config, setConfig] = useState(null),
    [busy, setBusy] = useState(''),
    [notice, setNotice] = useState(''),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(''),
    [status, setStatus] = useState('all'),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [selected, setSelected] = useState([]),
    [editor, setEditor] = useState(null),
    [importRows, setImportRows] = useState(null),
    [importMode, setImportMode] = useState('digital'),
    [importCheck, setImportCheck] = useState(null),
    [showImport, setShowImport] = useState(false),
    [preview, setPreview] = useState(null),
    [linking, setLinking] = useState(null),
    [jobs, setJobs] = useState([]);
  const [campaign, setCampaign] = useState(freshCampaign),
    [offer, setOffer] = useState({
      title: '',
      text: '',
      category: 'all',
      productCode: '',
      starts: '',
      ends: '',
      active: true,
      channels:['sms','email','letter']
    }),
    [month, setMonth] = useState(monthValue),
    [accountOnly, setAccountOnly] = useState(true),
    [report, setReport] = useState(null);
  const [post, setPost] = useState({
      platform: 'facebook',
      channelId: '',
      text: '',
      title: '',
      mediaType: 'image',
      mediaUrl: '',
      publishAt: '',
      aiGenerated: false
    }),
    [channels, setChannels] = useState([]),
    [organizations, setOrganizations] = useState([]),
    [design, setDesign] = useState({
      headline: 'MORE THAN JUST TYRES',
      subline: 'Your local team. Ready when you need us.',
      cta: 'BOOK ONLINE · TYREMEN.CO.UK',
      size: 'square',
      theme: 'dark'
    }),
    [photo, setPhoto] = useState(null),
    [testTarget, setTestTarget] = useState('');
  const [historySearch, setHistorySearch] = useState(''),
    [historyChannel, setHistoryChannel] = useState('all'),
    [historyStatus, setHistoryStatus] = useState('all'),
    [historyFrom, setHistoryFrom] = useState(''),
    [historyTo, setHistoryTo] = useState('');
  const [issueEditor,setIssueEditor]=useState(null),[issueStatus,setIssueStatus]=useState('pending');
  const canvas = useRef(null);
  const call = (action, body = {}) => workshopPost('marketingAdmin', {
    action,
    ...body
  });
  const refresh = useCallback(async () => {
    const result = await workshopPost('marketingAdmin', {
      action: 'load'
    });
    setData(result);
    setConfig(result.settings);
    return result;
  }, []);
  useEffect(() => {
    refresh().catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [refresh]);
  useEffect(() => {
    setSelected([]);
    setSearch('');
    setStatus('all');
  }, [tab]);
  useEffect(() => {
    if (tab === 'social' && canvas.current) drawArtwork(canvas.current, design, photo);
  }, [tab, design, photo]);
  async function run(label, fn, reload = true) {
    setBusy(label);
    setError('');
    setNotice('');
    try {
      const result = await fn();
      if (reload) await refresh();
      return result;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy('');
    }
  }
  const contacts = useMemo(() => data.contacts.filter(c => [c.name, c.registration, c.mobile, c.email, c.accountNumber].join(' ').toLowerCase().includes(search.toLowerCase())).filter(c => status === 'all' || (status === 'verify' ? c.estimatedDate : c.status === status)).filter(c => (!from || c.dueDate >= from) && (!to || c.dueDate <= to)).filter(c => tab === 'letters' ? !!c.address : tab === 'archive' ? ['archived', 'opted-out'].includes(c.status) || Object.values(c.optOut || {}).some(Boolean) : true), [data.contacts, search, status, from, to, tab]);
  const chosen = data.contacts.filter(c => selected.includes(c.id)),
    active = data.contacts.filter(c => c.status === 'active'),
    booked = data.contacts.filter(c => c.status === 'booked'),
    optouts = data.contacts.filter(c => c.status === 'opted-out' || Object.values(c.optOut || {}).some(Boolean)),
    today = new Date().toLocaleDateString('en-CA', {
      timeZone: 'Europe/London'
    });
  const history = data.messages.filter(m => [m.recipient, m.subject, m.kind, m.body].join(' ').toLowerCase().includes(historySearch.toLowerCase())).filter(m => historyChannel === 'all' || m.channel === historyChannel).filter(m => historyStatus === 'all' || m.status === historyStatus).filter(m => {
    const day = new Date(m.createdAtMs || 0).toLocaleDateString('en-CA', {
      timeZone: 'Europe/London'
    });
    return (!historyFrom || day >= historyFrom) && (!historyTo || day <= historyTo);
  });
  const last30 = data.messages.filter(m => m.createdAtMs > Date.now() - 30 * 86400000),
    sent = last30.filter(m => ['accepted', 'delivered'].includes(m.status));
  function toggle(id) {
    setSelected(v => v.includes(id) ? v.filter(x => x !== id) : [...v, id]);
  }
  async function permission(c, basis) {
    const channel = window.prompt('Channel: sms, email, letter or all', 'all');
    if (!channel) return;
    const reason = window.prompt(basis === 'denied' ? 'Reason for opt-out' : 'Permission source / evidence (required)');
    if (!reason) return;
    await run('permission', () => call('permission', {
      id: c.id,
      channel,
      basis,
      reason
    }));
  }
  async function bulkPermission() {
    if (!selected.length) return;
    const basis = window.prompt('Permission basis: consent, soft-opt-in, corporate, denied', 'consent'),
      reason = window.prompt('Permission source / evidence (required)');
    if (!basis || !reason) return;
    await run('permissions', () => call('bulkPermission', {
      ids: selected.slice(0, 100),
      channel: 'all',
      basis,
      reason
    }));
  }
  async function editSave(e) {
    e.preventDefault();
    const r = await run('contact', () => call('saveContact', {
      contact: editor,
      mode: editor.recordType || 'digital'
    }));
    if (r) {
      setEditor(null);
      setNotice('Contact saved. Existing opt-outs and permissions have been preserved.');
    }
  }
  function exportContacts(mode = tab === 'letters' ? 'letter' : 'digital') {
    download(`tyremen-${mode}-contacts.csv`, csv(headers[mode], contactRows(chosen.length ? chosen : contacts, mode)));
  }
  async function fileImport(e) {
    try {
      const file = e.target.files[0];
      if (!file) return;
      const rows=parseCsv(await file.text());
      setImportRows(rows);
      setImportCheck(null);
      await checkImport(rows);
    } catch (e) {
      setError(e.message);
    }
  }
  async function checkImport(input = importRows) {
    const rows=Array.isArray(input)?input:importRows;
    if(!rows?.length)return;
    return run('import-check', async () => {
      const results = [];
      for (let i = 0; i < rows.length; i += 100) {
        const r = await call('import', {
          mode: importMode,
          rows: rows.slice(i, i + 100),
          preview: true
        });
        results.push(...r.rows.map(v => ({
          ...v,
          row: v.row + i + 1 // CSV header occupies spreadsheet row 1.
        })));
      }
      setImportCheck(results);
    }, false);
  }
  function downloadImportIssues() {
    const issues = (importCheck || []).filter(r => r.error);
    if (!issues.length) return;
    const columns = [...new Set(issues.flatMap(r => Object.keys(importRows[r.row - 2] || {})))];
    download('tyremen-contacts-to-check.csv', csv(['Spreadsheet Row', ...columns, 'Issue'], issues.map(r => [r.row, ...columns.map(k => importRows[r.row - 2]?.[k] || ''), r.error])));
  }
  async function commitImport() {
    const checked = (importCheck || []).filter(r => !r.error);
    const validRows = checked.map(r => importRows[r.row - 2]);
    const invalidCount = (importCheck || []).filter(r => r.error).length;
    await run('import', async () => {
      const problemRows=(importCheck || []).filter(r=>r.error).map(r=>({row:r.row,values:importRows[r.row-2]}));
      for(let i=0;i<problemRows.length;i+=100)await call('saveImportIssues',{mode:importMode,rows:problemRows.slice(i,i+100)});
      for (let i = 0; i < validRows.length; i += 100) await call('import', {
        mode: importMode,
        rows: validRows.slice(i, i + 100)
      });
      if (invalidCount) setTab('attention');
      setShowImport(false);
      setImportRows(null);
      setImportCheck(null);
      setNotice(`Imported ${validRows.length} contacts.${invalidCount ? ' ' + invalidCount + ' rows saved in Needs attention. Correct and retry them there.' : ''} Existing opt-outs stay blocked.`);
    });
  }
  async function seePreview(c, kind = 'motMonth', template = null) {
    const r = await run('preview', () => call('preview', {
      contactId: c.id,
      kind,
      template,
      month,
      accountOnly
    }), false);
    if (r) setPreview(r);
  }
  async function linkBooking(c) {
    const r = await run('bookings', () => call('jobs', {
      registration: c.registration
    }), false);
    if (r) {
      setJobs(r.jobs);
      setLinking(c);
    }
  }
  async function generateLetters(batchId = '') {
    const r = await run('letters', () => call('createLetters', batchId ? {
      batchId
    } : {
      ids: selected,
      template: config.templates.letter
    }));
    if (r) {
      pdfDownload(`Tyremen-MOT-letters-${r.batchId}.pdf`, r.pdf);
      setNotice(`${r.count} letters prepared. Mark the batch Posted when it has actually been sent.`);
    }
  }
  function campaignDraft(source) {
    setCampaign({
      ...freshCampaign(),
      ...source
    });
    setTab('campaigns');
  }
  async function saveCampaign(e) {
    e?.preventDefault();
    const r = await run('campaign', () => call('saveCampaign', {
      campaign
    }));
    if (r) {
      setCampaign(r.campaign);
      setNotice('Draft saved. Review recipients and preview before starting.');
    }
  }
  async function startCampaign(c) {
    if (window.confirm(`Start “${c.title}” for its selected recipients? Messages will send when automation and the selected channels are enabled.`)) await run('start', () => call('campaignStatus', {
      id: c.id,
      status: 'running',
      confirm: 'SEND'
    }));
  }
  async function getChannels() {
    const r = await run('connections', () => call('socialConnections'), false);
    if (r) {
      setChannels(r.channels);
      setOrganizations(r.organizations);
      setNotice(r.connected ? 'Connected social accounts loaded.' : 'Buffer is not connected yet. Follow the setup guide to add the publishing key.');
    }
  }
  async function savePost(e) {
    e?.preventDefault();
    const r = await run('social-draft', () => call('saveSocial', {
      post: {
        ...post,
        publishAt: post.publishAt ? new Date(post.publishAt).toISOString() : ''
      }
    }));
    if (r) {
      setPost(r.post);
      setNotice('Social draft saved.');
    }
  }
  async function publishPost(p) {
    if (window.confirm(`Publish/schedule this ${p.platform} post to the selected connected account?`)) await run('publish', () => call('publishSocial', {
      id: p.id,
      confirm: 'PUBLISH'
    }));
  }
  async function useArtwork() {
    const r = await run('artwork', () => call('uploadImage', {
      data: canvas.current.toDataURL('image/jpeg', .85),
      name: design.headline
    }), false);
    if (r) {
      setPost(p => ({
        ...p,
        mediaType: 'image',
        mediaUrl: r.url
      }));
      setNotice('Artwork added to this post.');
    }
  }
  async function uploadImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file),
      image = new Image();
    image.onload = () => {
      setPhoto(image);
      URL.revokeObjectURL(url);
    };
    image.src = url;
  }
  function caption(topic) {
    const offerText = data.offers.filter(o => o.active && (!o.starts || o.starts <= today) && (!o.ends || o.ends >= today)).map(o => o.text).join(' ');
    const ideas = {
      mot: `Is your MOT due soon? Keep your plans moving with Tyremen. ${offerText} Book at ${config.bookingUrl} or call 01482 328800. #Hull #MOT #Tyremen`,
      tyres: `Grip, comfort and confidence start with the right tyres. Talk to the Tyremen team about your next set. ${offerText} ${config.bookingUrl} #Hull #Tyres`,
      service: `Look after your car and it will look after you. Book your next service with Tyremen in Hull. ${offerText} Call 01482 328800. #CarServicing #Hull`,
      behind: `A look behind the bays at Tyremen. Real people, expert care and more than just tyres. Visit us on Witty Street, Hull. #WorkshopLife #Tyremen`
    };
    setPost(p => ({
      ...p,
      text: ideas[topic]
    }));
  }
  const checkboxes = (values, selected, onChange) => <div className="mkChecks">{values.map(([key, label]) => <label key={key}><input type="checkbox" checked={selected.includes(key)} onChange={e => onChange(e.target.checked ? [...selected, key] : selected.filter(v => v !== key))} />{label}</label>)}</div>;
  const messageList = rows => <div className="mkTable"><table><thead><tr><th>When / channel</th><th>Recipient / subject</th><th>Stage</th><th>Outcome</th><th>Action</th></tr></thead><tbody>{rows.map(m => <tr key={m.id}><td>{m.createdAtMs ? new Date(m.createdAtMs).toLocaleString('en-GB') : '—'}<small>{m.channel}</small></td><td>{m.recipient || 'Removed'}<small>{m.subject}</small></td><td>{titleKind[m.kind] || m.kind}</td><td><Tag state={m.status}>{m.status}</Tag><small>{m.providerStatus || ''}{m.clickCount ? ' · ' + m.clickCount + ' clicks' : ''}</small>{m.error && <small>{m.error}</small>}</td><td>{m.testLetter&&<button onClick={()=>run('test letter PDF',async()=>{const r=await call('downloadTestLetter',{id:m.id});pdfDownload('Tyremen-test-letter.pdf',r.pdf);},false)}>Download test PDF</button>}<button onClick={()=>run('archive message',()=>call('archiveItem',{kind:'message',id:m.id,archived:!m.archived}))}>{m.archived?'Restore':'Archive'}</button><button onClick={() => setPreview({
              subject: m.subject,
              text: m.body,
              html: m.html,
              sms: m.sms
            })}>View</button>{role === 'owner' && m.status === 'failed' && <button onClick={() => run('retry', () => call('retry', {
              id: m.id
            }))}>Requeue</button>}{role === 'owner' && m.status !== 'deleted' && <button onClick={() => {
              if (window.confirm('Delete message content? The no-resend record will be retained.')) run('delete', () => call('deleteMessage', {
                id: m.id,
                confirm: 'DELETE'
              }));
            }}>Delete content</button>}</td></tr>)}</tbody></table>{!rows.length && <div className="mkEmpty">No messages in this view.</div>}</div>;
  const contactTable = <><div className="mkPanel"><div className="mkPanelHeading"><div><h3>{tab === 'letters' ? 'Postal recipients' : tab === 'archive' ? 'Retained contacts' : 'Reminder contacts'}</h3><small>{contacts.length} records · {selected.length} selected</small></div><div className="mkActions"><button onClick={() => {
            setImportMode(tab === 'letters' ? 'letter' : 'digital');
            setShowImport(v => !v);
          }}>Import CSV</button><button onClick={() => exportContacts()}>Export CSV</button><button className="mkPrimary" onClick={() => setEditor({
            ...blankContact(),
            recordType: tab === 'letters' ? 'letter' : 'digital'
          })}>Add contact</button></div></div><div className="mkFilters"><input aria-label="Search marketing contacts" placeholder="Registration, customer, mobile or account…" value={search} onChange={e => setSearch(e.target.value)} /><select aria-label="Reminder status" value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option><option value="active">Active reminders</option><option value="booked">Booked / appointments</option><option value="verify">Annual date needs verification</option><option value="opted-out">Opted out</option><option value="archived">Archived</option></select><input aria-label="Due from" type="date" value={from} onChange={e => setFrom(e.target.value)} /><input aria-label="Due to" type="date" value={to} onChange={e => setTo(e.target.value)} /></div><div className="mkBulk"><button onClick={() => setSelected(contacts.map(c => c.id))}>Select filtered</button><button onClick={() => setSelected([])}>Clear selection</button><button disabled={!selected.length} onClick={bulkPermission}>Set permission / source</button>{tab === 'letters' && <button className="mkPrimary" disabled={!selected.length || selected.length > 25} onClick={() => generateLetters()}>Create letters PDF · max 25</button>}</div><div className="mkTable"><table><thead><tr><th></th><th>Customer / vehicle</th><th>Mobile / email</th><th>MOT due</th><th>Status / permission</th><th>Actions</th></tr></thead><tbody>{contacts.slice(0, 300).map(c => <tr key={c.id}><td><input aria-label={`Select ${c.name || c.registration || c.mobile}`} type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} /></td><td><b>{c.name || 'Customer'}</b><small><span className="mkPlate">{c.registration || 'No registration'}</span> {c.make} {c.model}</small>{c.accountNumber && <small>Account {c.accountNumber}</small>}</td><td>{c.mobile || '—'}<small>{c.email || 'No email'}</small>{tab === 'letters' && <small>{c.address} {c.postcode}</small>}</td><td>{showDate(c.dueDate)}{c.estimatedDate && <small className="mkWarn">Projected · verify</small>}</td><td><Tag state={c.status}>{c.status}</Tag><small>SMS {c.permission?.sms || 'unknown'} · Email {c.permission?.email || 'unknown'}</small>{c.booking && <small>Arrive {c.booking.arrivalTime} · {showDate(c.booking.date)}</small>}</td><td><div className="mkActions"><button onClick={() => setEditor(c)}>Edit</button><button onClick={() => seePreview(c, tab === 'letters' ? 'letter' : 'motMonth')}>Preview</button>{role==='owner'&&<button onClick={()=>setTestDraft({contactId:c.id,kind:tab==='letters'?'letter':'motMonth',channel:tab==='letters'?'letter':'sms',template:config.templates[tab==='letters'?'letter':'motMonth']})}>Test send</button>}<button onClick={() => linkBooking(c)}>Link booking</button><button onClick={() => permission(c, 'denied')}>Opt out</button><button onClick={() => permission(c, 'consent')}>Permission</button><button onClick={() => run('archive', () => call('archive', {
                    id: c.id,
                    archive: c.status !== 'archived'
                  }))}>{c.status === 'archived' ? 'Restore' : 'Archive'}</button>{c.estimatedDate && <button onClick={() => {
                    const due = window.prompt('Confirmed MOT due date (YYYY-MM-DD)', c.dueDate),
                      reason = window.prompt('Date checked against?');
                    if (due && reason) run('verify', () => call('verifyDate', {
                      id: c.id,
                      dueDate: due,
                      reason
                    }));
                  }}>Verify date</button>}{c.registration && <button onClick={() => run('MOT lookup', () => call('refreshMot', {
                    id: c.id
                  }))}>Check MOT</button>}{role === 'owner' && <button className="mkDanger" onClick={() => {
                    if (window.confirm('Delete this contact and redact its message content? An anonymous no-contact record remains to prevent accidental reimport.')) run('delete', () => call('deleteContact', {
                      id: c.id,
                      confirm: 'DELETE'
                    }));
                  }}>Delete</button>}</div></td></tr>)}</tbody></table>{!contacts.length && <div className="mkEmpty">No matching contacts. Import a CSV or add a contact.</div>}{contacts.length > 300 && <p className="mkMuted">Showing 300 rows. Narrow your search; exports include the full filtered selection.</p>}</div></div></>;
  return <section className="marketingWorkspace"><header className="mkHeading"><div><span className="mkEyebrow">TYREMEN · CUSTOMER GROWTH</span><h2>Marketing</h2><p>Reminders, relationships and reasons to come back.</p></div><div className="mkActions"><Tag state={config?.enabled ? 'active' : 'paused'}>{config?.enabled ? 'Automation on' : 'Automation paused'}</Tag><button disabled={!!busy} onClick={() => run('refresh', refresh, false)}>Refresh</button></div></header><nav className="mkTabs">{tabs.map(([key, label]) => <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}{key==='attention' && (data.issues || []).some(i=>i.status==='pending') ? ' ('+(data.issues || []).filter(i=>i.status==='pending').length+')' : ''}</button>)}</nav>{notice && <div className="mkNotice" role="status">{notice}</div>}{error && <div className="mkError" role="alert">{error}</div>}{busy && <div className="mkBusy" role="status">Working · {busy}…</div>}{loading && <div className="mkEmpty">Opening Marketing…</div>}
 {!loading && config && <>
 <div className="mkFilters"><input aria-label="Search marketing libraries" placeholder="Search offers, campaigns, letters, posts and history…" value={librarySearch} onChange={e=>setLibrarySearch(e.target.value)}/><label className="mkCheck"><input type="checkbox" checked={includeArchived} onChange={e=>setIncludeArchived(e.target.checked)}/>Include archived library items</label>{role==='owner'&&<button onClick={()=>setTestDraft({kind:'motMonth',template:config.templates.motMonth})}>Test reminder content</button>}</div>
 {tab === 'overview' && <><div className="mkMetricGrid">{[['Active reminder contacts', active.length, 'Retained annual records'], ['Booked', booked.length, 'MOT reminders suppressed'], ['Accepted / delivered', sent.length, 'Last 30 days'], ['Opt-outs retained', optouts.length, 'Never automatically deleted']].map(([label, note, sub]) => <div className="mkMetric" key={label}><span>{label}</span><b>{note}</b><small>{sub}</small></div>)}</div><div className="mkOverviewGrid"><div className="mkPanel"><div className="mkPanelHeading"><h3>The reminder journey</h3><button onClick={() => setTab('settings')}>Manage automation →</button></div>{[['One calendar month before', 'MOT reminder, with your selected offers.'], ['15 days before', 'Email and text the responsible staff member to check bookings.'], ['14 days before', 'Two-week MOT follow-up, excluding booked and opted-out contacts.'], ['Booking linked', 'Move to appointment reminders using the live diary arrival time.'], ['24 hours before arrival', 'Send the appointment reminder. Changed or cancelled bookings are rechecked.'], ['Next year', 'Keep history; roll the date forward and verify the new MOT date.']].map(([label, desc], i) => <div className="mkJourney" key={label}><i>{i + 1}</i><div><b>{label}</b><p>{desc}</p></div></div>)}</div><aside className="mkPanel"><h3>What needs attention</h3><button className="mkAttention" onClick={() => {
              setTab('mot');
              setTimeout(() => setStatus('verify'), 0);
            }}><b>{data.contacts.filter(c => c.estimatedDate).length}</b> MOT dates to verify</button><button className="mkAttention" onClick={() => setTab('archive')}><b>{data.messages.filter(m => ['failed', 'uncertain'].includes(m.status)).length}</b> delivery checks</button><button className="mkAttention" onClick={() => setTab('letters')}><b>{data.messages.filter(m => m.status === 'ready-to-print').length}</b> letters ready to print</button><button className="mkAttention" onClick={() => setTab('social')}><b>{data.social.filter(s => s.status === 'draft').length}</b> social drafts</button><p className="mkMuted">SMS “accepted” means Webex queued it. Email “accepted” means the mail server accepted it. Delivery is shown only when confirmed.</p><p className="mkMuted">No contacts or messages are automatically deleted.</p></aside></div><div className="mkPanel"><div className="mkPanelHeading"><h3>Recent activity</h3><button onClick={() => setTab('archive')}>Full archive →</button></div>{messageList(data.messages.slice(0, 12))}</div></>}
 {(tab === 'mot' || tab === 'letters') && contactTable}
 {tab === 'letters' && <><div className="mkPanel"><div className="mkPanelHeading"><h3>Letter template</h3>{role==='owner'&&<button onClick={()=>setTestDraft({kind:'letter',channel:'letter',template:config.templates.letter})}>Test letter / email / text</button>}<button onClick={() => {
              setTab('settings');
            }}>Save templates in Settings →</button></div><Field label="Letter heading"><input value={config.templates.letter?.subject || ''} onChange={e => setConfig({
              ...config,
              templates: {
                ...config.templates,
                letter: {
                  ...config.templates.letter,
                  subject: e.target.value
                }
              }
            })} /></Field><Field label="Letter body · merge fields supported"><textarea rows="10" value={config.templates.letter?.body || ''} onChange={e => setConfig({
              ...config,
              templates: {
                ...config.templates,
                letter: {
                  ...config.templates.letter,
                  body: e.target.value
                }
              }
            })} /></Field><p className="mkMuted">Select recipients above to generate an A4 PDF. Each letter is retained with its batch. Export CSV for a mailing house.</p></div><div className="mkPanel"><h3>Letter batches</h3>{libraryRows(data.batches).map(b => <div className="mkListRow" key={b.id}><div><b>{b.contacts.length} letters</b><small>{b.id} · {b.status}</small></div><div className="mkActions"><button onClick={() => generateLetters(b.id)}>Download PDF</button><button onClick={()=>run('archive letter batch',()=>call('archiveItem',{kind:'batch',id:b.id,archived:!b.archived}))}>{b.archived?'Restore':'Archive'}</button>{b.status !== 'posted' && <button onClick={() => run('posted', () => call('lettersPosted', {
                id: b.id
              }))}>Mark posted</button>}<button onClick={() => download('tyremen-mail-house.csv', csv(['Name', 'Address', 'Postcode', 'Registration Number', 'MOT Due Date', 'Vehicle Make', 'Vehicle Model', 'Subject', 'Letter'], b.contacts.map(c => [c.name, c.address, c.postcode, c.registration, c.dueDate, c.make, c.model, c.subject, c.body])))}>Mail-house CSV</button></div></div>)}{!data.batches.length && <div className="mkEmpty">No letter batches yet.</div>}</div></>}
 {tab === 'campaigns' && <div className="mkOverviewGrid"><form className="mkPanel" onSubmit={saveCampaign}><div className="mkPanelHeading"><h3>{campaign.id ? 'Edit campaign' : 'Create a campaign'}</h3><button type="button" onClick={() => setCampaign(freshCampaign())}>New draft</button></div><div className="mkFormGrid"><Field label="Campaign name"><input required value={campaign.title} onChange={e => setCampaign({
                ...campaign,
                title: e.target.value
              })} /></Field><Field label="Campaign type"><select value={campaign.kind} onChange={e => setCampaign({
                ...campaign,
                kind: e.target.value,
                ...(e.target.value === 'thankYou' ? {
                  subject: config.templates.thankYou.subject,
                  body: config.templates.thankYou.body
                } : {})
              })}><option value="standard">Offer / newsletter</option><option value="thankYou">Monthly thank you + tyre analysis</option></select></Field><Field label="Send at · blank for next automation run"><input type="datetime-local" value={localDateTime(campaign.sendAt)} onChange={e => setCampaign({
                ...campaign,
                sendAt: e.target.value
              })} /></Field>{campaign.kind === 'thankYou' && <Field label="Spending month"><input type="month" value={campaign.month} onChange={e => setCampaign({
                ...campaign,
                month: e.target.value
              })} /></Field>}</div><Field label="Email subject"><input value={campaign.subject} onChange={e => setCampaign({
              ...campaign,
              subject: e.target.value
            })} /></Field><Field label="Message"><textarea required rows="10" value={campaign.body} onChange={e => setCampaign({
              ...campaign,
              body: e.target.value
            })} /></Field><p className="mkMuted">Fields: {'{{name}}, {{registration}}, {{offer}}, {{month}}, {{spend}}, {{top_tyres}}, {{booking_url}}'}</p><Field label="Hero image URL · optional"><input type="url" value={campaign.imageUrl} onChange={e => setCampaign({
              ...campaign,
              imageUrl: e.target.value
            })} /></Field>{checkboxes([['email', 'Email'], ['sms', 'Text message']], campaign.channels, channels => setCampaign({
            ...campaign,
            channels
          }))}<label className="mkCheck"><input type="checkbox" checked={campaign.accountOnly} onChange={e => setCampaign({
              ...campaign,
              accountOnly: e.target.checked
            })} />Account customers only</label><Field label="Audience"><select value={campaign.contactIds.length ? 'selected' : 'all'} onChange={e => setCampaign({
              ...campaign,
              contactIds: e.target.value === 'all' ? [] : selected
            })}><option value="all">All current eligible contacts</option><option value="selected">Selected reminder contacts ({selected.length})</option></select></Field><div className="mkActions"><button className="mkPrimary" disabled={!!busy}>Save draft</button>{role==='owner'&&<button type="button" onClick={()=>setTestDraft({kind:campaign.kind,template:{subject:campaign.subject,body:campaign.body},month:campaign.month,accountOnly:campaign.accountOnly})}>Test text / email / letter</button>}<button type="button" disabled={!data.contacts.length} onClick={() => seePreview(chosen[0] || data.contacts[0], campaign.kind, campaign)}>Preview sample</button></div><p className="mkMuted">Only permitted recipients are queued. Opt-outs are rechecked before each send. The contact list is fixed when you start a campaign.</p></form><aside className="mkPanel"><h3>Campaign monitor</h3><div className="mkActions"><button onClick={() => {
              setImportMode('campaign');
              setShowImport(true);
            }}>Import email contacts</button><button onClick={() => exportContacts('campaign')}>Export contacts</button><button onClick={() => run('sync', () => call('syncCustomers'))}>Sync customer directory</button><button onClick={() => download('tyremen-campaign-report.csv', csv(['Campaign', 'Channel', 'Recipient', 'Status', 'Provider Status', 'Clicked'], data.messages.filter(m => m.campaignId).map(m => [data.campaigns.find(c => c.id === m.campaignId)?.title, m.channel, m.recipient, m.status, m.providerStatus, m.clickedAt ? 'Yes' : 'No'])))}>Export campaign report</button></div>{libraryRows(data.campaigns).map(c => {
            const messages = data.messages.filter(m => m.campaignId === c.id);
            return <div className="mkCampaignCard" key={c.id}><div><b>{c.title}</b><Tag state={c.status}>{c.status}</Tag></div><small>{messages.filter(m => ['accepted', 'delivered'].includes(m.status)).length} accepted · {messages.filter(m => m.status === 'delivered').length} delivered · {messages.filter(m => m.status === 'queued').length} queued · {messages.filter(m => m.clickedAt).length} clicked</small><div className="mkActions"><button onClick={() => setCampaign({
                  ...freshCampaign(),
                  ...c
                })}>Edit</button><button onClick={() => setCampaign({
                  ...freshCampaign(),
                  ...c,
                  id: '',
                  title: c.title + ' copy'
                })}>Duplicate</button>{['draft', 'paused'].includes(c.status) && <button onClick={() => startCampaign(c)}>Start campaign</button>}{c.status === 'running' && <button onClick={() => run('pause', () => call('campaignStatus', {
                  id: c.id,
                  status: 'paused'
                }))}>Pause</button>}<button onClick={() => run('archive', () => call('archiveItem', {kind:'campaign',id:c.id,archived:!c.archived&&c.status!=='archived'}))}>{c.archived||c.status==='archived'?'Restore':'Archive'}</button></div></div>;
          })}{!data.campaigns.length && <div className="mkEmpty">Save your first campaign draft.</div>}</aside></div>}
 {tab === 'insights' && <><div className="mkPanel"><div className="mkPanelHeading"><div><h3>Customer spending & tyre opportunities</h3><small>Actual invoice totals, including VAT and credit notes.</small></div><div className="mkActions"><input aria-label="Report month" type="month" value={month} onChange={e => setMonth(e.target.value)} /><label className="mkCheck"><input type="checkbox" checked={accountOnly} onChange={e => setAccountOnly(e.target.checked)} />Account customers</label><button className="mkPrimary" onClick={() => run('analyse', async () => {
                const r = await call('analytics', {
                  month,
                  accountOnly
                });
                setReport(r.report);
              }, false)}>Analyse month</button>{report && <button onClick={() => download('tyremen-customer-insights.csv', csv(['Customer', 'Account', 'Month', 'Spend inc VAT', 'Top tyre', 'Qty', 'Average sold inc VAT', 'Current same-level price inc VAT', 'Decrease %'], report.flatMap(r => r.topTyres.length ? r.topTyres.map(t => [r.name, r.accountNumber, month, r.total, t.description, t.qty, t.averagePrice, t.currentPrice, t.decreasePct]) : [[r.name, r.accountNumber, month, r.total, '', '', '', '', '']])))}>Export report</button>}</div></div>{report && <><div className="mkMetricGrid"><div className="mkMetric"><span>Period customer spend</span><b>{money(report.reduce((n, r) => n + r.total, 0))}</b><small>Including VAT</small></div><div className="mkMetric"><span>Customers</span><b>{report.length}</b></div><div className="mkMetric"><span>Invoices & credit notes</span><b>{report.reduce((n, r) => n + r.invoiceCount, 0)}</b></div><div className="mkMetric"><span>Lower current tyre prices</span><b>{report.reduce((n, r) => n + r.topTyres.filter(t => t.decreasePct > 0).length, 0)}</b></div></div>{report.map(r => <article className="mkInsight" key={r.id}><div className="mkPanelHeading"><div><h3>{r.name}</h3><small>Account {r.accountNumber || 'Retail'} · {r.monthLabel}</small></div><b>{money(r.total)}</b></div><div className="mkBar"><i style={{
                  width: `${Math.max(0, r.total) / Math.max(1, ...report.map(v => v.total)) * 100}%`
                }} /></div>{r.topTyres.map(t => <div className="mkTyreInsight" key={t.sku + t.description}><div><b>{t.description}</b><small>{t.qty} units · average paid {money(t.averagePrice)} · {t.priceLevel} level</small></div><div>{t.currentPrice ? money(t.currentPrice) : 'Current price unavailable'}{t.decreasePct > 0 && <Tag state="active">{t.decreasePct.toFixed(1)}% lower</Tag>}</div></div>)}{!r.topTyres.length && <p className="mkMuted">No tyre sales found in this period.</p>}</article>)}{!report.length && <div className="mkEmpty">No matching completed sales in this month.</div>}<button className="mkPrimary" onClick={() => campaignDraft({
              title: `Thank you · ${month}`,
              kind: 'thankYou',
              month,
              accountOnly,
              subject: config.templates.thankYou.subject,
              body: config.templates.thankYou.body
            })}>Create personalised thank-you campaign</button></>}{!report && <div className="mkEmpty">Choose a month to see spending, each customer's two most-purchased tyres and verified price decreases.</div>}</div></>}
 {tab === 'social' && <><div className="mkSocialBanner"><div><h3>Facebook · TikTok · X</h3><p>Create content here. Connect your accounts through Buffer to publish and schedule.</p></div><div className="mkActions"><button onClick={getChannels}>Check connected accounts</button><a href="https://publish.buffer.com" target="_blank" rel="noreferrer">Open Buffer ↗</a></div></div><div className="mkOverviewGrid"><form className="mkPanel" onSubmit={savePost}><h3>Post composer</h3><div className="mkFormGrid"><Field label="Platform"><select value={post.platform} onChange={e => setPost({
                  ...post,
                  platform: e.target.value,
                  channelId: ''
                })}><option value="facebook">Facebook</option><option value="tiktok">TikTok</option><option value="twitter">X / Twitter · connect when ready</option></select></Field><Field label="Connected account"><select value={post.channelId} onChange={e => setPost({
                  ...post,
                  channelId: e.target.value
                })}><option value="">Choose connected account</option>{channels.filter(c => c.service === post.platform).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field></div><div className="mkActions">{[['mot', 'MOT idea'], ['tyres', 'Tyre idea'], ['service', 'Service idea'], ['behind', 'Workshop idea']].map(([key, label]) => <button type="button" key={key} onClick={() => caption(key)}>{label}</button>)}</div><Field label={`Caption · ${post.text.length} characters`}><textarea aria-label="Social caption" rows="7" required value={post.text} onChange={e => setPost({
                ...post,
                text: e.target.value
              })} /></Field><Field label="Post title"><input value={post.title} onChange={e => setPost({
                ...post,
                title: e.target.value
              })} /></Field><div className="mkFormGrid"><Field label="Media type"><select value={post.mediaType} onChange={e => setPost({
                  ...post,
                  mediaType: e.target.value
                })}><option value="image">Image</option><option value="video">Video</option></select></Field><Field label="Public image or hosted video URL"><input type="url" value={post.mediaUrl} onChange={e => setPost({
                  ...post,
                  mediaUrl: e.target.value
                })} /></Field><Field label="Publish at · blank means now"><input type="datetime-local" value={localDateTime(post.publishAt)} onChange={e => setPost({
                  ...post,
                  publishAt: e.target.value
                })} /></Field></div>{post.platform === 'tiktok' && <label className="mkCheck"><input type="checkbox" checked={post.aiGenerated} onChange={e => setPost({
                ...post,
                aiGenerated: e.target.checked
              })} />This video contains AI-generated content</label>}<div className="mkActions"><button className="mkPrimary" disabled={!!busy}>Save draft</button><button type="button" onClick={() => setPost({
                platform: 'facebook',
                channelId: '',
                text: '',
                title: '',
                mediaType: 'image',
                mediaUrl: '',
                publishAt: '',
                aiGenerated: false
              })}>New post</button>{post.id && <button type="button" disabled={!post.channelId} onClick={() => publishPost(post)}>Review & publish / schedule</button>}</div><h4>Video planning notes</h4><p className="mkMuted">Film a short opening hook, show the tyre or repair clearly, explain one customer benefit, finish with your booking details. Use your own footage and licensed music. Video publishing uses a publicly hosted video URL.</p></form><aside className="mkPanel"><h3>Artwork studio</h3><canvas aria-label="Marketing artwork preview" ref={canvas} /><div className="mkFormGrid"><Field label="Format"><select value={design.size} onChange={e => setDesign({
                  ...design,
                  size: e.target.value
                })}><option value="square">Square · 1080 × 1080</option><option value="portrait">Portrait · 1080 × 1350</option><option value="story">Story · 1080 × 1920</option><option value="landscape">Landscape · 1200 × 630</option></select></Field><Field label="Theme"><select value={design.theme} onChange={e => setDesign({
                  ...design,
                  theme: e.target.value
                })}><option value="dark">Black / yellow</option><option value="white">White / yellow</option></select></Field></div>{[['headline', 'Headline'], ['subline', 'Supporting line'], ['cta', 'Call to action']].map(([key, label]) => <Field key={key} label={label}><input value={design[key]} onChange={e => setDesign({
                ...design,
                [key]: e.target.value
              })} /></Field>)}<Field label="Your background photograph"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadImage} /></Field><div className="mkActions"><button onClick={() => {
                canvas.current.toBlob(b => download('tyremen-social-artwork.jpg', b), 'image/jpeg', .9);
              }}>Download artwork</button><button onClick={useArtwork}>Use artwork in post</button><button onClick={() => setPhoto(null)}>Remove photo</button></div></aside></div><div className="mkPanel"><h3>Content calendar & publishing monitor</h3>{libraryRows(data.social).map(p => <div className="mkListRow" key={p.id}><div><b>{p.platform.toUpperCase()} · {p.title || p.text.slice(0, 60)}</b><small>{p.publishAt ? new Date(p.publishAt).toLocaleString('en-GB') : 'Publish now'} · {p.status}{p.error ? ' · ' + p.error : ''}</small>{p.metrics?.length > 0 && <small>{p.metrics.map(m => `${m.name}: ${m.value}`).join(' · ')}</small>}</div><div className="mkActions"><button onClick={() => setPost({
                ...p,
                publishAt: p.publishAt || ''
              })}>Open</button>{p.archived&&<button onClick={()=>run('restore post',()=>call('archiveItem',{kind:'social',id:p.id,archived:false}))}>Restore</button>}{p.status === 'draft' && !p.archived && <button onClick={() => publishPost(p)}>Publish / schedule</button>}{p.providerId && <button onClick={() => run('post status', () => call('refreshSocial', {
                id: p.id
              }))}>Refresh status</button>}<button onClick={() => setPost({
                ...p,
                id: '',
                status: 'draft',
                providerId: ''
              })}>Duplicate</button>{!p.providerId && !['submitting', 'uncertain'].includes(p.status) && <button onClick={() => run('delete draft', () => call('deleteSocial', {
                id: p.id
              }))}>Archive draft</button>}</div></div>)}{!data.social.length && <div className="mkEmpty">Your saved drafts and submitted posts will appear here.</div>}</div></>}
 {tab === 'offers' && <div className="mkOverviewGrid"><form className="mkPanel" onSubmit={e => {
          e.preventDefault();
          run('offer', async () => {
            await call('offer', {
              offer
            });
            setOffer({
              title: '',
              text: '',
              category: 'all',
              productCode: '',
              starts: '',
              ends: '',
              active: true
            });
          });
        }}><h3>{offer.id ? 'Edit offer' : 'Create an offer'}</h3><Field label="Offer name"><input required value={offer.title} onChange={e => setOffer({
              ...offer,
              title: e.target.value
            })} /></Field><Field label="Customer-facing wording"><textarea required rows="5" value={offer.text} onChange={e => setOffer({
              ...offer,
              text: e.target.value
            })} /></Field><div className="mkFormGrid"><Field label="Applies to"><select value={offer.category} onChange={e => setOffer({
                ...offer,
                category: e.target.value
              })}>{['all', 'tyres', 'MOT', 'servicing', 'aircon', 'alignment', 'brakes', 'batteries', 'TPMS', 'repairs', 'space savers', 'other'].map(v => <option key={v}>{v}</option>)}</select></Field><Field label="Catalogue code · optional"><input value={offer.productCode} onChange={e => setOffer({
                ...offer,
                productCode: e.target.value
              })} /></Field><Field label="Starts"><input type="date" value={offer.starts} onChange={e => setOffer({
                ...offer,
                starts: e.target.value
              })} /></Field><Field label="Ends"><input type="date" value={offer.ends} onChange={e => setOffer({
                ...offer,
                ends: e.target.value
              })} /></Field></div><label className="mkCheck"><input type="checkbox" checked={offer.active} onChange={e => setOffer({
              ...offer,
              active: e.target.checked
            })} />Active in reminder and campaign templates</label>{checkboxes([['sms','Text'],['email','Email'],['letter','Letter']],offer.channels||['sms','email','letter'],channels=>setOffer({...offer,channels}))}<button className="mkPrimary">Save offer</button>{role==='owner'&&<button type="button" onClick={()=>setTestDraft({kind:'offer',template:{subject:offer.title,body:offer.text}})}>Test offer</button>}<p className="mkMuted">These offers control marketing wording. Set actual sale and checkout prices in <Link to="/pricing-control">Pricing & capacity</Link>.</p></form><aside className="mkPanel"><h3>Offer library</h3>{libraryRows(data.offers).map(o => <div className="mkCampaignCard" key={o.id}><b>{o.title}</b><p>{o.text}</p><small>{o.category} · {showDate(o.starts)} – {showDate(o.ends)} · {o.active ? 'Active' : 'Paused'}</small><div className="mkActions"><button onClick={() => setOffer(o)}>Edit</button>{o.archived&&<button onClick={()=>run('restore offer',()=>call('archiveItem',{kind:'offer',id:o.id,archived:false}))}>Restore</button>}<button onClick={() => run('offer status', () => call('offer', {
                offer: {
                  ...o,
                  active: !o.active
                }
              }))}>{o.active ? 'Pause' : 'Activate'}</button><button onClick={() => {
                if (window.confirm('Archive this offer and retain its content?')) run('delete offer', () => call('deleteOffer', {
                  id: o.id
                }));
              }}>Archive</button></div></div>)}</aside></div>}
 {tab === 'archive' && <><div className="mkPanel"><div className="mkPanelHeading"><div><h3>Message history</h3><small>Email and text contents, letter records, outcomes and opt-outs are retained.</small></div><button onClick={() => download('tyremen-message-archive.csv', csv(['Created', 'Channel', 'Recipient', 'Kind', 'Subject', 'Body', 'Status', 'Provider Status'], history.map(m => [new Date(m.createdAtMs || 0).toISOString(), m.channel, m.recipient, m.kind, m.subject, m.body, m.status, m.providerStatus])))}>Export archive</button></div><div className="mkFilters"><input aria-label="Search message archive" placeholder="Recipient, subject or content…" value={historySearch} onChange={e => setHistorySearch(e.target.value)} /><select aria-label="Archive channel" value={historyChannel} onChange={e => setHistoryChannel(e.target.value)}><option value="all">All channels</option>{['sms', 'email', 'letter'].map(v => <option key={v}>{v}</option>)}</select><input aria-label="Archive from" type="date" value={historyFrom} onChange={e => setHistoryFrom(e.target.value)} /><input aria-label="Archive to" type="date" value={historyTo} onChange={e => setHistoryTo(e.target.value)} /><select aria-label="Archive status" value={historyStatus} onChange={e => setHistoryStatus(e.target.value)}><option value="all">All outcomes</option>{['queued', 'accepted', 'delivered', 'failed', 'uncertain', 'suppressed', 'created', 'posted', 'deleted'].map(v => <option key={v}>{v}</option>)}</select></div>{messageList(libraryRows(history).slice(0, 500))}</div>{contactTable}<div className="mkPanel"><h3>Previous MOT cycles</h3>{libraryRows(data.cycles).map(c => <div className="mkListRow" key={c.id}><span>{data.contacts.find(p => p.id === c.contactId)?.registration || c.contactId}</span><span>{showDate(c.dueDate)} · {c.status}</span><button onClick={()=>run('archive cycle',()=>call('archiveItem',{kind:'cycle',id:c.id,archived:!c.archived}))}>{c.archived?'Restore':'Archive'}</button></div>)}</div></>}
 {tab === 'settings' && <><form className="mkPanel" onSubmit={e => {
          e.preventDefault();
          run('settings', () => call('settings', {
            settings: config
          }));
        }}><div className="mkPanelHeading"><div><h3>Marketing automation</h3><small>Owner controls sending, templates, limits and staff responsibility.</small></div><button className="mkPrimary" disabled={role !== 'owner' || !!busy}>Save settings</button></div><div className="mkSettingsChecks">{[['enabled', 'Enable automation'], ['smsEnabled', 'Send SMS through Webex'], ['emailEnabled', 'Send email'], ['lettersEnabled', 'Prepare postal reminder content'], ['oneMonth', 'One calendar month before MOT'], ['twoWeeks', 'Two weeks before MOT'], ['staffCheck', 'Staff booking check 24 hours before two-week messages'], ['appointmentReminder', 'Appointment reminder 24 hours before arrival'], ['annualRepeat', 'Retain and repeat MOT cycles each year'], ['allowEstimatedDates', 'Allow reminders using projected annual dates'], ['monthlyThankYou', 'Monthly account thank-you email on day 2'], ['socialEnabled', 'Enable social publishing through connected Buffer accounts']].map(([key, label]) => <label className="mkCheck" key={key}><input type="checkbox" disabled={role !== 'owner'} checked={!!config[key]} onChange={e => setConfig({
                ...config,
                [key]: e.target.checked
              })} />{label}</label>)}</div><div className="mkFormGrid">{[['sendHour', 'Reminder send hour', 0, 23], ['quietStart', 'Send window starts', 0, 23], ['quietEnd', 'Send window ends', 1, 24], ['dailyLimit', 'Daily attempts per channel', 1, 2000]].map(([key, label, min, max]) => <Field label={label} key={key}><input type="number" min={min} max={max} value={config[key]} onChange={e => setConfig({
                ...config,
                [key]: Number(e.target.value)
              })} /></Field>)}<Field label="Responsible staff member"><select value={config.staffId || ''} onChange={e => {
                const staff = data.staff.find(s => s.id === e.target.value);
                setConfig({
                  ...config,
                  staffId: e.target.value,
                  staffName: staff?.name || '',
                  staffEmail: staff?.email || '',
                  staffMobile: staff?.mobile || ''
                });
              }}><option value="">Select responsible member of staff</option>{data.staff.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}</select></Field>{[['staffName', 'Responsible name'], ['staffEmail', 'Staff email'], ['staffMobile', 'Staff mobile'], ['smsSender', 'Webex sender'], ['senderName', 'Email sender name'], ['fromEmail', 'Verified sender email · blank uses invoice account'], ['replyTo', 'Reply-to email'], ['bookingUrl', 'Booking link'], ['website', 'Website'], ['postalAddress', 'Postal address'], ['bufferOrgId', 'Buffer organisation ID']].map(([key, label]) => <Field key={key} label={label}><input value={config[key] || ''} onChange={e => setConfig({
                ...config,
                [key]: e.target.value
              })} /></Field>)}</div>{organizations.length > 0 && <p className="mkMuted">Connected organisations: {organizations.map(o => o.name + ' (' + o.id + ')').join(' · ')}</p>}<p className="mkMuted">Times use Europe/London. Annual dates are projected and held for verification unless you explicitly allow them.</p><h3>Templates</h3>{Object.entries(config.templates).map(([key, t]) => <details className="mkTemplate" key={key}><summary>{{
                motMonth: 'One-month MOT',
                motFortnight: 'Two-week MOT',
                appointment: 'Appointment reminder',
                letter: 'Printed letter',
                thankYou: 'Monthly thank you'
              }[key] || key}</summary>{role==='owner'&&<button type="button" onClick={()=>setTestDraft({kind:key,template:t,channel:key==='letter'?'letter':'sms'})}>Test this template</button>}<Field label="Subject / heading"><input value={t.subject} onChange={e => setConfig({
                ...config,
                templates: {
                  ...config.templates,
                  [key]: {
                    ...t,
                    subject: e.target.value
                  }
                }
              })} /></Field><Field label="Message body"><textarea rows="6" value={t.body} onChange={e => setConfig({
                ...config,
                templates: {
                  ...config.templates,
                  [key]: {
                    ...t,
                    body: e.target.value
                  }
                }
              })} /></Field></details>)}<p className="mkMuted">Available fields: {(data.templateVariables || []).map(v => '{{' + v + '}}').join(', ')}</p></form><div className="mkPanel"><h3>Connections & test messages</h3><div className="mkConnections">{[['webex', 'Webex SMS'], ['email', 'Invoice email connection'], ['buffer', 'Buffer social publishing'], ['deliveryWebhook', 'Webex delivery / STOP webhook']].map(([key, label]) => <div key={key}><span>{label}</span><Tag state={data.connections[key] ? 'active' : 'paused'}>{data.connections[key] ? 'Configured' : 'Not configured'}</Tag></div>)}</div><div className="mkActions"><input aria-label="Connection test recipient" placeholder="Your test email or mobile" value={testTarget} onChange={e => setTestTarget(e.target.value)} /><button onClick={() => run('Webex validation', async () => {
              const r = await call('test', {
                channel: 'sms',
                recipient: testTarget,
                live: false
              });
              setNotice('Webex validated the request. No SMS sent. ' + r.status);
            }, false)}>Validate Webex · no text sent</button><button onClick={() => {
              if (window.confirm('Send one real test text to this number?')) run('test SMS', () => call('test', {
                channel: 'sms',
                recipient: testTarget,
                live: true
              }), false);
            }}>Send test text</button><button onClick={() => {
              if (window.confirm('Send one real connection test email?')) run('test email', () => call('test', {
                channel: 'email',
                recipient: testTarget,
                live: true
              }), false);
            }}>Send test email</button></div><p className="mkMuted">Provider keys are kept in backend secrets. Social publishing needs a Buffer account/API key and connected Facebook/TikTok accounts. Connect X after creating the account. No paid account is created by this update.</p></div>{role === 'owner' && <div className="mkPanel"><h3>Marketing access</h3>{data.staff.filter(s => !['owner', 'manager'].includes(s.role)).map(s => <label className="mkListRow" key={s.id}><span>{s.name} · {s.role}</span><input type="checkbox" checked={!!s.marketingAccess} onChange={e => run('access', () => call('staffAccess', {
              id: s.id,
              enabled: e.target.checked
            }))} /></label>)}</div>}</>}
 {tab==='attention' && <div className="mkPanel"><div className="mkPanelHeading"><div><h3>Needs attention</h3><small>Valid contacts import normally. These original rows are kept here until corrected or dismissed.</small></div><select aria-label="Import issue status" value={issueStatus} onChange={e=>setIssueStatus(e.target.value)}><option value="pending">Needs attention</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option><option value="all">All rows</option></select></div><input aria-label="Search import issues" placeholder="Customer, registration or number…" value={search} onChange={e=>setSearch(e.target.value)}/><div className="mkTable"><table><thead><tr><th>CSV row</th><th>Original details</th><th>What needs checking</th><th>Status</th><th>Action</th></tr></thead><tbody>{(data.issues || []).filter(i=>issueStatus==='all'||i.status===issueStatus).filter(i=>Object.values(i.values || {}).join(' ').toLowerCase().includes(search.toLowerCase())).map(i=><tr key={i.id}><td>{i.sourceRow}</td><td>{Object.entries(i.values || {}).filter(([,v])=>v).map(([k,v])=><small key={k}><b>{k}:</b> {v}</small>)}</td><td>{i.error || 'Imported successfully'}</td><td><Tag state={i.status==='resolved'?'active':'paused'}>{i.status}</Tag></td><td><div className="mkActions">{['pending','dismissed'].includes(i.status) && <button onClick={()=>setIssueEditor({...i,values:{...i.values}})}>Correct & retry</button>}{i.status==='pending' && <button onClick={()=>run('dismiss row',()=>call('dismissImportIssue',{id:i.id}))}>Dismiss</button>}</div></td></tr>)}</tbody></table>{!(data.issues || []).some(i=>issueStatus==='all'||i.status===issueStatus) && <div className="mkEmpty">No rows in this view.</div>}</div></div>}
 {issueEditor && <div className="mkModal"><form className="mkModalBody" onSubmit={async e=>{e.preventDefault();const result=await run('retry import',()=>call('retryImportIssue',{id:issueEditor.id,values:issueEditor.values}));if(result){setIssueEditor(null);setNotice('Corrected contact imported. Original row retained in Resolved.');}}}><div className="mkPanelHeading"><h3>Correct CSV row {issueEditor.sourceRow}</h3><button type="button" onClick={()=>setIssueEditor(null)}>Close</button></div><p className="mkMuted">{issueEditor.error}</p><div className="mkFormGrid">{Object.entries(issueEditor.values || {}).map(([key,value])=><Field key={key} label={key}><input value={value} onChange={e=>setIssueEditor({...issueEditor,values:{...issueEditor.values,[key]:e.target.value}})}/></Field>)}</div><button className="mkPrimary" disabled={!!busy}>Save & import contact</button></form></div>}
 {showImport && <div className="mkModal"><section className="mkModalBody"><div className="mkPanelHeading"><h3>Import contacts</h3><button onClick={() => setShowImport(false)}>Close</button></div><Field label="Import type"><select value={importMode} onChange={e => {
              setImportMode(e.target.value);
              setImportCheck(null);
            }}><option value="digital">MOT text / email reminders</option><option value="letter">Postal letters</option><option value="campaign">Email / SMS campaign contacts</option></select></Field><p className="mkMuted">{importMode === 'digital' ? 'Mandatory: Due Date and Mobile. Name and Registration Number are optional. Email is needed for email reminders.' : importMode === 'letter' ? 'Required: Name, Address, MOT Due Date, Vehicle Make and Vehicle Model.' : 'At least Email or Mobile is required. Permission is recorded separately.'}</p><button onClick={() => download('tyremen-' + importMode + '-template.csv', csv(headers[importMode], []))}>Download CSV headers</button><Field label="CSV file"><input type="file" accept=".csv,text/csv" onChange={fileImport} /></Field>{importRows && <p>{importRows.length} rows loaded.</p>}<div className="mkActions"><button disabled={!importRows?.length || !!busy} onClick={checkImport}>Recheck file</button><button className="mkPrimary" disabled={!importCheck?.length || !!busy} onClick={commitImport}>Import contacts & keep problem rows</button></div>{importCheck && <div className="mkImportResults"><p>{importCheck.filter(r => !r.error).length} ready to import · {importCheck.filter(r => r.error).length} need checking. Recognisable UK numbers are formatted automatically.</p>{importCheck.some(r => r.error) && <button type="button" onClick={downloadImportIssues}>Download rows to check</button>}{importCheck.filter(r => r.error).map(r => <p key={r.row}>Row {r.row}: {r.error}</p>)}{!importCheck.some(r => r.error) && <p>All {importCheck.length} rows are valid. Imported contacts start with unknown permission; existing opt-outs stay blocked.</p>}</div>}</section></div>}
 {editor && <div className="mkModal"><form className="mkModalBody" onSubmit={editSave}><div className="mkPanelHeading"><h3>{editor.id ? 'Edit contact' : 'Add contact'}</h3><button type="button" onClick={() => setEditor(null)}>Close</button></div><Field label="Record type"><select value={editor.recordType || 'digital'} onChange={e => setEditor({
              ...editor,
              recordType: e.target.value
            })}><option value="digital">MOT reminders</option><option value="letter">Postal reminders</option><option value="campaign">Campaign contact</option></select></Field><div className="mkFormGrid">{[['name', 'Customer name', 'text'], ['registration', 'Registration number', 'text'], ['mobile', 'Mobile' + (editor.recordType === 'digital' ? ' *' : ''), 'tel'], ['email', 'Email', 'email'], ['dueDate', 'MOT due date' + (editor.recordType !== 'campaign' ? ' *' : ''), 'date'], ['make', 'Vehicle make', 'text'], ['model', 'Vehicle model', 'text'], ['address', 'Address', 'text'], ['postcode', 'Postcode', 'text'], ['accountNumber', 'Account number', 'text']].map(([key, label, type]) => <Field key={key} label={label}><input type={type} required={(editor.recordType === 'digital' && ['mobile', 'dueDate'].includes(key)) || (editor.recordType === 'letter' && ['name', 'address', 'dueDate', 'make', 'model'].includes(key))} value={editor[key] || ''} onChange={e => setEditor({
                ...editor,
                [key]: key === 'registration' ? e.target.value.toUpperCase() : e.target.value
              })} /></Field>)}</div><label className="mkCheck"><input type="checkbox" checked={editor.annualRepeat !== false} onChange={e => setEditor({
              ...editor,
              annualRepeat: e.target.checked
            })} />Repeat annually</label><button className="mkPrimary" disabled={!!busy}>Save contact</button></form></div>}
 {linking && <div className="mkModal"><section className="mkModalBody"><div className="mkPanelHeading"><h3>Link booking · {linking.registration || linking.name}</h3><button onClick={() => setLinking(null)}>Close</button></div><p>Link an existing booking to stop MOT reminders and use its live arrival time for the appointment reminder.</p>{jobs.map(j => <div className="mkListRow" key={j.id}><div><b>{j.registration} · {j.name}</b><small>{showDate(j.date)} {j.time} · {j.service}</small></div><button onClick={() => run('link booking', async () => {
              await call('book', {
                id: linking.id,
                jobId: j.id
              });
              setLinking(null);
            })}>Link this booking</button></div>)}{!jobs.length && <p>No matching open bookings. <Link to="/calendar#manual-booking">Create a diary booking</Link>, then return here.</p>}{linking.bookedJobId && <button onClick={() => run('unlink', async () => {
            await call('unbook', {
              id: linking.id
            });
            setLinking(null);
          })}>Remove manual booking link</button>}</section></div>}
 {testDraft&&<MarketingTestSend draft={testDraft} contacts={data.contacts} close={()=>setTestDraft(null)} done={refresh}/>}
 {preview && <div className="mkModal"><section className="mkModalBody"><div className="mkPanelHeading"><h3>Message preview</h3><button onClick={() => setPreview(null)}>Close</button></div><b>{preview.subject}</b><pre className="mkMessageText">{preview.text || 'No text content'}</pre>{preview.sms && <p className="mkMuted">SMS estimate: {preview.sms.segments} segments · {preview.sms.encoding}. Actual personalised content can vary.</p>}{preview.html && <iframe title="Email preview" sandbox="" srcDoc={preview.html} />}</section></div>}
 </>}
 </section>;
}
