import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { officePost, requestId, base64File, matches, readData } from '../lib/officeApi';
import { Field, Panel, Toolbar, Table, Empty } from '../components/OfficeUI';
const kinds = [['quote', 'Quote'], ['order', 'Sales order'], ['invoice', 'Invoice'], ['confirmation', 'Website confirmation']];
export default function DocumentTemplates() {
  const {
    user
  } = useAuth();
  const [cfg, setCfg] = useState(null),
    [kind, setKind] = useState('invoice'),
    [preview, setPreview] = useState(''),
    [recipient, setRecipient] = useState(''),
    [notice, setNotice] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(''),
    [archived, setArchived] = useState(false),
    [emailPreview, setEmailPreview] = useState(false);
  const call = (action, body = {}) => officePost(action, {
    area: 'templates',
    ...body
  });
  const load = useCallback(async () => {
    try {
      setCfg(await officePost('load', {
        area: 'templates'
      }));
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const run = async fn => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const theme = cfg?.templates?.[kind];
  const edit = (key, value) => setCfg(v => ({
    ...v,
    templates: {
      ...v.templates,
      [kind]: {
        ...v.templates[kind],
        [key]: value
      }
    }
  }));
  const show = async (pdf = false) => {
    const r = await call('preview', {
      kind,
      template: theme,
      pdf
    });
    setPreview(emailPreview ? r.emailHtml : r.html);
    if (pdf) base64File(`Tyremen-${kind}-test.pdf`, r.pdf);
    return r;
  };
  return <div className="office"><p className="ofIntro">These templates are used by new quotes, sales orders and invoices. Issued documents keep their saved template. Save and preview a website confirmation before enabling it.</p>{error && <p role="alert" className="ofNotice error">{error}</p>}{notice && <p role="status" className="ofNotice">{notice}</p>}
 {!cfg ? <Panel title="Document templates"><p>Your signed-in ID: <code>{user?.uid}</code></p><p>Owner access must be configured in the office backend before this section can open.</p><button onClick={load}>Retry connection</button></Panel> : <>
 <div className="ofTabs" role="tablist">{kinds.map(([k, n]) => <button role="tab" aria-selected={kind === k} key={k} onClick={() => {
          setKind(k);
          setPreview('');
        }}>{n}</button>)}</div>
 <div className="ofActions"><button className="primary" disabled={busy} onClick={() => run(async () => {
          setCfg({
            ...cfg,
            ...(await call('save', cfg))
          });
          setNotice('Templates published. New documents will use this version.');
        })}>Save & publish templates</button><button disabled={busy || !cfg.previousAvailable} onClick={() => run(async () => {
          if (!window.confirm('Restore the previous saved edit?')) return;
          setCfg({
            ...cfg,
            ...(await call('revert', {
              revision: cfg.revision
            }))
          });
          setPreview('');
          setNotice('Previous edit restored.');
        })}>Revert last edit</button><span className="ofMeta">Published revision {cfg.revision} · Signed-in ID {user?.uid}</span></div>
 <div className="ofSplit"><Panel title="Design & content"><div className="ofGrid two">
 {['brand', 'tagline', 'company', 'telephone', 'email', 'website', 'companyNumber', 'vatNumber'].map(k => <Field label={k.replace(/([A-Z])/g, ' $1')} key={k}><input value={theme[k]} onChange={e => edit(k, e.target.value)} /></Field>)}
 <Field label="Company address"><textarea rows={3} value={theme.address} onChange={e => edit('address', e.target.value)} /></Field><Field label="Logo — PNG or JPEG, up to 55 KB"><input type="file" accept="image/png,image/jpeg" onChange={e => run(async () => {
                const f = e.target.files[0];
                if (!f) return;
                if (f.size > 55000) throw new Error('Resize the logo below 55 KB');
                edit('logo', await readData(f));
              })} />{theme.logo && <><img src={theme.logo} alt="Current logo" style={{
                  maxWidth: 170,
                  maxHeight: 75,
                  objectFit: 'contain',
                  background: '#fff'
                }} /><button onClick={() => edit('logo', '')}>Remove logo</button></>}</Field>
 {['accent', 'ink', 'muted', 'panel'].map(k => <Field label={k + ' colour'} key={k}><input type="color" value={theme[k]} onChange={e => edit(k, e.target.value)} /></Field>)}
 <Field label="Font"><select value={theme.font} onChange={e => edit('font', e.target.value)}>{['Arial', 'Georgia', 'Courier New'].map(v => <option key={v}>{v}</option>)}</select></Field><Field label="Layout"><select value={theme.layout} onChange={e => edit('layout', e.target.value)}>{['standard', 'compact', 'banner'].map(v => <option key={v}>{v}</option>)}</select></Field><Field label="Text size"><input type="number" min="8" max="12" value={theme.fontSize} onChange={e => edit('fontSize', Number(e.target.value))} /></Field><Field label="Spacing"><select value={theme.density} onChange={e => edit('density', e.target.value)}><option>comfortable</option><option>compact</option></select></Field>
 {['intro', 'terms', 'footer', 'emailSubject', 'emailBody'].map(k => <div className="ofWide" key={k}><Field label={k.replace(/([A-Z])/g, ' $1')}><textarea rows={k === 'emailBody' ? 8 : 3} value={theme[k]} onChange={e => edit(k, e.target.value)} /></Field></div>)}
 <p className="ofSmall ofWide">Merge fields: {'{{name}}, {{registration}}, {{reference}}, {{document_type}}, {{total}}, {{balance}}, {{date}}, {{time}}, {{arrival_time}}, {{items}}'}</p>
 {kind === 'confirmation' && <label className="ofCheck ofWide"><input type="checkbox" checked={cfg.confirmationEnabled} onChange={e => setCfg({
                ...cfg,
                confirmationEnabled: e.target.checked
              })} /> Enable automatic website booking confirmations after publishing</label>}
 </div></Panel><div><Panel title="Preview & test"><div className="ofActions"><label className="ofCheck"><input type="checkbox" checked={emailPreview} onChange={e => {
                  setEmailPreview(e.target.checked);
                  setPreview('');
                }} /> Email preview</label><button disabled={busy} onClick={() => run(() => show())}>Refresh preview</button><button disabled={busy} onClick={() => run(() => show(true))}>Test print / PDF</button></div><Field label="Send a real test email to"><input type="email" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="Your email address" /></Field><div className="ofActions"><button disabled={busy || !recipient} onClick={() => run(async () => {
                if (!window.confirm('Send one real test email to ' + recipient + '?')) return;
                const r = await call('test', {
                  kind,
                  template: theme,
                  channel: 'email',
                  recipient,
                  confirm: true,
                  requestId: requestId()
                });
                setNotice(r.status);
                await load();
              })}>Send test email with PDF</button></div><p className="ofSmall">Tests use this unsaved design. Publishing is separate. A test does not create a sale.</p></Panel>{preview ? <iframe title="Actual document preview" className="ofPreview" sandbox="" srcDoc={preview} /> : <Empty>Refresh the preview to see this design.</Empty>}</div></div>
 <Panel title="Search delivery history & saved versions"><Toolbar {...{
          search,
          setSearch,
          archived,
          setArchived
        }} /><Table headings={['Type', 'Recipient / revision', 'Status', 'Actions']} rows={[...(cfg.deliveries || []).filter(r => (archived || !r.archived) && matches(r, search)).map(r => <tr key={r.id}><td>{r.kind}</td><td>{r.recipient}</td><td>{r.status}{r.error && <small>{r.error}</small>}</td><td><button onClick={() => run(async () => {
              await call('archiveDelivery', {
                id: r.id,
                archived: !r.archived
              });
              await load();
            })}>{r.archived ? 'Restore' : 'Archive'}</button></td></tr>), ...(archived ? (cfg.versions || []).filter(r => matches(r, search)).map(r => <tr key={r.id}><td>Saved template version</td><td>Revision {r.revision}</td><td>Retained</td><td><button onClick={() => {
              if (window.confirm('Load this saved design into the editor? Publish to make it live.')) setCfg({
                ...cfg,
                templates: r.templates,
                confirmationEnabled: r.confirmationEnabled
              });
            }}>Load into editor</button></td></tr>) : [])]} /></Panel>
 </>}</div>;
}
