/* Shared by the Admin preview and server PDF/email renderers. */
const clean = (v, n = 4000) => String(v ?? '').trim().slice(0, n);
const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[c]);
const money = n => '£' + Number(n || 0).toFixed(2);
const DEFAULT = {
  brand: 'TYREMEN',
  tagline: 'MORE THAN JUST TYRES',
  company: 'Tyremen Ltd',
  address: 'Witty Street\nHull\nHU3 4TX',
  telephone: '01482 328800',
  email: 'info@tyremen.co.uk',
  website: 'www.tyremen.co.uk',
  companyNumber: '01339220',
  vatNumber: '317078069',
  accent: '#ffd500',
  ink: '#111111',
  muted: '#666666',
  panel: '#f4f4f4',
  font: 'Arial',
  layout: 'standard',
  density: 'comfortable',
  fontSize: 10,
  logo: '',
  intro: '',
  terms: 'Payment is due on completion unless account terms have been agreed in writing.',
  footer: 'Tyremen Ltd · Witty Street, Hull, HU3 4TX · 01482 328800',
  emailSubject: 'Your Tyremen {{document_type}} {{reference}}',
  emailBody: 'Dear {{name}},\n\nPlease find attached your {{document_type}} {{reference}} for {{registration}}.\n\nTotal: {{total}}\nBalance due: {{balance}}\n\nThank you for choosing Tyremen.\n01482 328800'
};
const TYPES = ['quote', 'order', 'invoice', 'confirmation'];
function defaults(kind = 'invoice') {
  return {
    ...DEFAULT,
    kind,
    ...(kind === 'quote' ? {
      terms: 'This quotation is subject to confirmation of availability and any additional work agreed with you.'
    } : {}),
    ...(kind === 'order' ? {
      terms: 'Sales order. Work and any additional charges are subject to agreement. This document is not a VAT invoice.'
    } : {}),
    ...(kind === 'confirmation' ? {
      intro: 'Thank you for booking with Tyremen.',
      terms: 'No payment is taken online for this workshop booking. Please contact us if you need to change your appointment.',
      emailSubject: 'Your Tyremen booking {{reference}}',
      emailBody: 'Hi {{name}},\n\nThank you for your booking for {{registration}}.\nDate: {{date}}\nAppointment: {{time}}\nPlease arrive: {{arrival_time}}\n\n{{items}}\n\nBooking total: {{total}}\n\nCall 01482 328800 if you need to change anything.'
    } : {})
  };
}
function validLogo(v) {
  if (!v) return '';
  if (typeof v !== 'string' || v.length > 80000 || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(v)) throw new Error('Use a PNG or JPEG logo below 55 KB');
  return v;
}
function theme(v = {}, kind = v.kind || 'invoice') {
  if (!TYPES.includes(kind)) throw new Error('Choose quote, sales order, invoice or booking confirmation');
  const result = defaults(kind);
  for (const k of ['brand', 'tagline', 'company', 'address', 'telephone', 'email', 'website', 'companyNumber', 'vatNumber', 'intro', 'terms', 'footer', 'emailSubject', 'emailBody']) result[k] = clean(v[k] ?? result[k], {
    brand: 80,
    tagline: 120,
    company: 160,
    address: 600,
    telephone: 40,
    email: 180,
    website: 300,
    companyNumber: 40,
    vatNumber: 40,
    intro: 2000,
    terms: 6000,
    footer: 300,
    emailSubject: 180,
    emailBody: 8000
  }[k]);
  for (const k of ['accent', 'ink', 'muted', 'panel']) {
    const value = v[k] ?? result[k];
    if (!/^#[a-f0-9]{6}$/i.test(value)) throw new Error('Choose a valid colour');
    result[k] = value;
  }
  result.logo = validLogo(v.logo || '');
  result.font = ['Arial', 'Georgia', 'Courier New'].includes(v.font) ? v.font : 'Arial';
  result.layout = ['standard', 'compact', 'banner'].includes(v.layout) ? v.layout : 'standard';
  result.density = v.density === 'compact' ? 'compact' : 'comfortable';
  result.fontSize = Math.max(8, Math.min(12, Number(v.fontSize) || 10));
  return result;
}
function label(kind) {
  return kind === 'quote' ? 'QUOTATION' : kind === 'order' ? 'SALES ORDER' : kind === 'confirmation' ? 'BOOKING CONFIRMATION' : kind === 'credit-note' ? 'CREDIT NOTE' : 'VAT INVOICE';
}
function prepare(invoice, {
  describe = line => line.description || line.name || '',
  brandLogo = () => ''
} = {}) {
  const items = (invoice.items || []).map(l => ({
    ...l,
    description: describe(l) + (l.positions?.length ? ' · ' + l.positions.join(' / ') : ''),
    brandLogos: (l.brandLogos || [brandLogo(l)]).filter(Boolean)
  }));
  const selected = new Set(invoice.workDescription ? (invoice.workLineIndices || []).filter(i => Number.isInteger(i) && items[i]) : []);
  const group = [...selected].map(i => items[i]);
  const rows = items.filter((_, i) => !selected.has(i));
  if (group.length) rows.unshift({
    description: invoice.workDescription,
    detail: group.map(l => (l.quantity ?? l.qty ?? 1) + ' × ' + l.description).join('\n'),
    brandLogos: [...new Set(group.flatMap(l => l.brandLogos))],
    quantity: 1,
    unitPriceIncVat: group.reduce((n, l) => n + Number(l.gross || 0), 0),
    net: group.reduce((n, l) => n + Number(l.net || 0), 0),
    vat: group.reduce((n, l) => n + Number(l.vat || 0), 0),
    gross: group.reduce((n, l) => n + Number(l.gross || 0), 0),
    vatRate: new Set(group.map(l => l.vatRate)).size === 1 ? group[0].vatRate : 'Mixed'
  });
  return {
    ...invoice,
    displayLines: rows,
    documentLabel: label(invoice.documentType),
    balanceDue: invoice.balanceDue ?? Math.max(0, Number(invoice.total || 0) - Number(invoice.amountPaid || 0))
  };
}
function vars(invoice) {
  return {
    name: invoice.customer?.name || invoice.name || 'Customer',
    registration: invoice.vehicle?.registration || invoice.registration || '',
    reference: invoice.invoiceNumber || invoice.reference || invoice.id || 'PREVIEW',
    document_type: label(invoice.documentType).toLowerCase(),
    total: money(invoice.total),
    balance: money(invoice.balanceDue ?? Math.max(0, Number(invoice.total || 0) - Number(invoice.amountPaid || 0))),
    date: invoice.date || invoice.invoiceDate || '',
    time: invoice.time || '',
    arrival_time: invoice.arrivalTime || invoice.schedule?.arrivalTime || invoice.time || '',
    items: (invoice.items || []).map(l => (l.quantity ?? l.qty ?? 1) + ' × ' + (l.description || l.name || l.serviceName || l.pattern || 'Item')).join('\n')
  };
}
function merge(text, values) {
  return String(text || '').replace(/{{\s*([a-z_]+)\s*}}/g, (_, key) => String(values[key] ?? ''));
}
function emailHtml(subject, body, t) {
  return `<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font:15px ${escape(t.font)};color:${t.ink};background:#eee;padding:20px"><main style="max-width:650px;margin:auto;background:white;padding:30px;border-top:5px solid ${t.accent}">${t.logo ? `<img src="${t.logo}" style="max-width:240px;max-height:100px" alt="${escape(t.brand)}">` : `<h1 style="font-style:italic">${escape(t.brand)}</h1>`}<h2>${escape(subject)}</h2><div style="white-space:pre-wrap;line-height:1.7">${escape(body)}</div><hr><small>${escape(t.footer)}<br>${escape(t.email)}</small></main></body></html>`;
}
function html(invoice, rawTheme) {
  const t = theme(rawTheme, rawTheme.kind || invoice.documentType),
    v = invoice.displayLines ? invoice : prepare(invoice),
    values = vars(v);
  const cell = s => escape(s).replace(/\n/g, '<br>');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(v.invoiceNumber || v.documentLabel)}</title><style>@page{size:A4;margin:14mm 14mm 22mm}*{box-sizing:border-box}body{margin:0;color:${t.ink};font:${t.fontSize}px ${JSON.stringify(t.font)},sans-serif}.top{display:flex;justify-content:space-between;gap:20px;border-bottom:5px solid ${t.accent};padding:0 0 18px}.brand{font-size:${t.layout === 'compact' ? 28 : 40}px;font-weight:bold;font-style:italic}.logo{max-width:240px;max-height:90px}.tag{font-size:8px;letter-spacing:2px}.type{text-align:right}.type h1{font-size:23px}.banner{background:${t.ink};color:white;padding:18px}.meta,.parties{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:18px 0}.right{text-align:right}.box{background:${t.panel};padding:13px}.box h3{font-size:9px;color:${t.muted}}.vehicle{display:grid;grid-template-columns:repeat(4,1fr);background:${t.ink};color:white;margin:16px 0}.vehicle div{padding:10px}.vehicle small{display:block;color:${t.accent};margin-bottom:5px}table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}th{background:${t.ink};color:white;text-align:right;padding:8px 4px;font-size:8px}td{padding:${t.density === 'compact' ? 6 : 10}px 4px;border-bottom:1px solid #ddd;text-align:right;vertical-align:top;overflow-wrap:anywhere}th:first-child,td:first-child{width:43%;text-align:left}td small{display:block;color:${t.muted};white-space:pre-wrap;margin-top:5px}.brandLogo{display:inline-block;width:70px;height:24px;object-fit:contain;margin:0 7px 6px 0}.summary{width:300px;max-width:100%;margin:20px 0 0 auto;break-inside:avoid}.summary div{display:flex;justify-content:space-between;padding:8px;border-bottom:1px solid #ddd}.total{background:${t.accent};color:${t.ink};font-size:17px;font-weight:bold}.terms{background:${t.panel};padding:14px;margin-top:20px;line-height:1.7;white-space:pre-wrap}.footer{position:fixed;bottom:-12mm;left:0;right:0;font-size:8px;border-top:1px solid #ddd;padding-top:6px;color:${t.muted}}</style></head><body><header class="top ${t.layout === 'banner' ? 'banner' : ''}"><div>${t.logo ? `<img class="logo" src="${t.logo}" alt="${escape(t.brand)}">` : `<div class="brand">${escape(t.brand)}</div>`}<div class="tag">${escape(t.tagline)}</div></div><div class="type"><h1>${escape(v.documentLabel || label(v.documentType))}</h1><b>${escape(v.invoiceNumber || v.reference || 'DRAFT')}</b><p>${escape(v.invoiceDate || v.date || '')}</p></div></header><section class="meta"><div><b>${escape(t.company)}</b><br>${cell(t.address)}<br>Company Registration: ${escape(t.companyNumber)}<br>VAT Registration: ${escape(t.vatNumber)}</div><div class="right">${escape(t.telephone)}<br>${escape(t.email)}<br>${escape(t.website)}<br>Sales adviser: ${escape(v.adviserName || '')}</div></section>${t.intro ? `<p>${cell(merge(t.intro, values))}</p>` : ''}<section class="parties"><div class="box"><h3>CUSTOMER</h3><b>${escape(v.customer?.name || v.name || '')}</b><br>${cell([v.customer?.address1, v.customer?.address2, v.customer?.town, v.customer?.postcode].filter(Boolean).join('\n'))}</div><div class="box"><h3>CONTACT & ACCOUNT</h3>${cell([v.customer?.email || v.email, v.customer?.mobile || v.customer?.phone || v.phone, 'Account: ' + (v.customer?.accountNumber || 'Retail'), 'Terms: ' + (v.paymentTerms || 'Due on completion')].filter(Boolean).join('\n'))}</div></section><section class="vehicle">${[['REGISTRATION', v.vehicle?.registration || v.registration], ['MAKE', v.vehicle?.make], ['MODEL', v.vehicle?.model], ['MILEAGE', v.vehicle?.mileage]].map(([k, val]) => `<div><small>${k}</small>${escape(val || '—')}</div>`).join('')}</section><table><thead><tr><th>Description</th><th>Qty</th><th>Unit inc VAT</th><th>VAT %</th><th>Net</th><th>VAT</th><th>Total</th></tr></thead><tbody>${v.displayLines.map(l => `<tr><td>${(l.brandLogos || []).filter(url => /^data:image\/(png|jpeg);base64,/.test(url) || /^https:\/\/images\.tyreintelligence\.co\.uk\//.test(url)).map(url => `<img class="brandLogo" src="${escape(url)}" alt="Tyre brand">`).join('')}<b>${cell(l.description)}</b>${l.detail ? `<small>${cell(l.detail)}</small>` : ''}</td><td>${escape(l.quantity ?? l.qty ?? 1)}</td><td>${money(l.unitPriceIncVat ?? l.price)}</td><td>${l.vatRate === 'Mixed' ? 'Mixed' : escape(l.vatRate ?? 20) + '%'}</td><td>${money(l.net)}</td><td>${money(l.vat)}</td><td>${money(l.gross)}</td></tr>`).join('')}</tbody></table><section class="summary"><div><span>Total net</span><b>${money(v.net)}</b></div><div><span>Total VAT</span><b>${money(v.vat)}</b></div><div class="total"><span>Total</span><b>${money(v.total)}</b></div><div><span>Paid</span><b>${money(v.amountPaid)}</b></div><div><span>Balance due</span><b>${money(v.balanceDue)}</b></div></section>${v.advisoryNotes ? `<section class="terms"><b>Advisory notes</b><br>${cell(v.advisoryNotes)}</section>` : ''}<section class="terms">${cell(merge(t.terms, values))}</section><footer class="footer">${escape(t.footer)} · ${escape(v.invoiceNumber || v.reference || 'DRAFT')}</footer></body></html>`;
}
const documentTheme = {
  DEFAULT,
  TYPES,
  defaults,
  theme,
  label,
  prepare,
  vars,
  merge,
  emailHtml,
  html,
  escape,
  money
};
export default documentTheme;
