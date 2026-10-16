export const headers = {
  digital: ['Customers Name', 'Registration Number', 'Mobile', 'Due Date', 'Email', 'Account Number', 'SMS Opt Out', 'Email Opt Out', 'Letter Opt Out', 'Archived'],
  letter: ['Name', 'Address', 'MOT Due Date', 'Vehicle Make', 'Vehicle Model', 'Registration Number', 'Postcode', 'SMS Opt Out', 'Email Opt Out', 'Letter Opt Out', 'Archived'],
  campaign: ['Name', 'Email', 'Mobile', 'Account Number', 'Customer Id', 'SMS Opt Out', 'Email Opt Out', 'Letter Opt Out', 'Archived']
};
export function parseCsv(text) {
  const rows = [];
  let row = [],
    field = '',
    quoted = false;
  const src = String(text).replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '"') {
      if (quoted && src[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      if (row.some(v => v.trim())) rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (quoted) throw new Error('CSV has an unclosed quoted field');
  row.push(field);
  if (row.some(v => v.trim())) rows.push(row);
  if (!rows.length) return [];
  const names = rows.shift().map(v => v.trim());
  if (new Set(names.map(v => v.toLowerCase())).size !== names.length) throw new Error('CSV has duplicate column headers');
  return rows.map((values, i) => {
    if (values.length !== names.length) throw new Error(`CSV row ${i + 2}: expected ${names.length} columns, got ${values.length}`);
    return Object.fromEntries(names.map((name, j) => [name, values[j].replace(/^'/, '')]));
  });
}
export function csv(headers, rows) {
  const cell = v => '"' + String(v ?? '').replace(/^[=+@-]/, "'$&").replace(/"/g, '""') + '"';
  return '\uFEFF' + [headers, ...rows].map(r => r.map(cell).join(',')).join('\r\n');
}
export function download(name, data, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], {
    type
  }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function pdfDownload(name, base64) {
  download(name, new Blob([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], {
    type: 'application/pdf'
  }));
}
export function contactRows(items, mode) {
  return items.map(c => [...(mode === 'letter' ? [c.name, c.address, c.dueDate, c.make, c.model, c.registration, c.postcode] : mode === 'campaign' ? [c.name, c.email, c.mobile, c.accountNumber, c.customerId] : [c.name, c.registration, c.mobile, c.dueDate, c.email, c.accountNumber]), !!(c.optOut?.all || c.optOut?.sms), !!(c.optOut?.all || c.optOut?.email), !!(c.optOut?.all || c.optOut?.letter), c.status === 'archived']);
}
export function replaceFields(text, vars) {
  return String(text || '').replace(/{{\s*([a-z_]+)\s*}}/g, (_, key) => String(vars[key] ?? ''));
}
export const blankContact = () => ({
  name: '',
  registration: '',
  mobile: '',
  email: '',
  dueDate: '',
  make: '',
  model: '',
  address: '',
  postcode: '',
  accountNumber: '',
  annualRepeat: true,
  recordType: 'digital'
});
export function monthValue() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
}
export function drawArtwork(canvas, design, image = null) {
  const dims = {
      square: [1080, 1080],
      portrait: [1080, 1350],
      story: [1080, 1920],
      landscape: [1200, 630]
    },
    [w, h] = dims[design.size] || dims.square;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = design.theme === 'white' ? '#f6f7f8' : '#10161d';
  ctx.fillRect(0, 0, w, h);
  if (image) {
    const scale = Math.max(w / image.width, h * .62 / image.height);
    const iw = image.width * scale,
      ih = image.height * scale;
    ctx.drawImage(image, (w - iw) / 2, 0, iw, ih);
    const grad = ctx.createLinearGradient(0, h * .15, 0, h * .8);
    grad.addColorStop(0, '#10161d22');
    grad.addColorStop(1, '#10161d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
  const light = design.theme === 'white' && !image;
  ctx.fillStyle = light ? '#11171e' : '#ffffff';
  ctx.font = 'italic 900 ' + Math.round(w * .055) + 'px Arial';
  ctx.fillText('TYREMEN', w * .065, h * .105);
  ctx.fillStyle = '#ffda16';
  ctx.fillRect(w * .065, h * .15, w * .12, 8);
  const title = String(design.headline || 'MORE THAN JUST TYRES').toUpperCase();
  ctx.font = 'bold ' + Math.round(w * .078) + 'px Arial';
  let words = title.split(/\s+/),
    line = '',
    y = h * .36;
  for (const word of words) {
    const next = line + ' ' + word;
    if (ctx.measureText(next).width > w * .86 && line) {
      ctx.fillStyle = light ? '#11171e' : '#ffffff';
      ctx.fillText(line.trim(), w * .065, y);
      y += w * .095;
      line = word;
    } else line = next;
  }
  ctx.fillText(line.trim(), w * .065, y);
  ctx.fillStyle = light ? '#566273' : '#b3c0ce';
  ctx.font = Math.round(w * .029) + 'px Arial';
  ctx.fillText(String(design.subline || 'Expert care. Local people.').slice(0, 55), w * .065, Math.min(y + w * .085, h * .76));
  ctx.fillStyle = '#ffda16';
  ctx.fillRect(w * .065, h * .83, w * .87, h * .08);
  ctx.fillStyle = '#111111';
  ctx.font = 'bold ' + Math.round(w * .028) + 'px Arial';
  ctx.fillText(String(design.cta || 'BOOK ONLINE · TYREMEN.CO.UK').slice(0, 55), w * .095, h * .882);
  ctx.fillStyle = light ? '#566273' : '#b3c0ce';
  ctx.font = Math.round(w * .022) + 'px Arial';
  ctx.fillText('01482 328800  ·  WITTY STREET, HULL', w * .065, h * .965);
}
export function localDateTime(v) {
  if (!v) return "";
  if (!/Z$|[+-]\d\d:\d\d$/.test(v)) return v.slice(0, 16);
  const d = new Date(v);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
