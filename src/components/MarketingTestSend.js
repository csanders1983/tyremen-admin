import { useState } from 'react';
import { workshopPost } from '../lib/workshopApi';
import { requestId, base64File } from '../lib/officeApi';
export default function MarketingTestSend({
  draft,
  contacts,
  close,
  done
}) {
  const [channel, setChannel] = useState(draft.channel || 'sms'),
    [target, setTarget] = useState(''),
    [contactId, setContactId] = useState(draft.contactId || ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const needsRecipient=channel!=='letter'&&!target;
  const send = async () => {
    setBusy(true);
    setError('');
    try {
      if (channel !== 'letter' && !window.confirm('Send one real test ' + channel + ' to ' + target + '?')) return;
      const r = await workshopPost('marketingAdmin', {
        action: 'testContent',
        ...draft,
        contactId,
        channel,
        recipient: target,
        confirm: true,
        requestId: requestId()
      });
      if (r.pdf) base64File('Tyremen-test-letter.pdf', r.pdf);
      setNotice(r.status);
      done?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return <div className="mkModal"><section className="mkModalBody" role="dialog" aria-modal="true" aria-label="Test actual content"><div className="mkPanelHeading"><h3>Test actual content</h3><button onClick={close}>Close</button></div><p className="mkMuted">This uses the content you are editing. No campaign starts and no customer reminder is consumed. Text and email tests are real sends to your chosen address; letter tests generate a PDF.</p><label className="mkField"><span>Sample personalisation</span><select value={contactId} onChange={e => setContactId(e.target.value)}><option value="">Example customer</option>{contacts.filter(c => c.status !== 'archived').map(c => <option key={c.id} value={c.id}>{c.name || c.registration || c.mobile}</option>)}</select></label><label className="mkField"><span>Test channel</span><select value={channel} onChange={e => setChannel(e.target.value)}><option value="sms">Text / Webex</option><option value="email">Email</option><option value="letter">Letter / PDF</option></select></label>{channel !== 'letter' && <label className="mkField"><span>Your test {channel === 'sms' ? 'mobile' : 'email'}</span><input type={channel === 'email' ? 'email' : 'tel'} value={target} onChange={e => setTarget(e.target.value)} placeholder={channel === 'sms' ? '07…' : 'you@example.com'} /></label>}<pre className="mkMessageText">{draft.template?.subject}{'\n\n'}{draft.template?.body || 'Saved reminder content will be used.'}</pre>{error && <p className="mkError" role="alert">{error}</p>}{notice && <p className="mkNotice" role="status">{notice}</p>}<button className="mkPrimary" disabled={busy || needsRecipient} onClick={send}>{busy ? 'Processing…' : channel === 'letter' ? 'Generate test letter' : 'Send test ' + channel}</button></section></div>;
}
