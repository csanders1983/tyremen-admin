import { workshopPost } from './workshopApi';
export const officePost = (action, body = {}) => workshopPost('officeAdmin', {
  action,
  ...body
});
export const requestId = () => window.crypto?.randomUUID?.() || `request-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const today = () => new Date().toLocaleDateString('en-CA', {
  timeZone: 'Europe/London'
});
export function downloadFile(name, data, mime = 'text/csv') {
  const url = URL.createObjectURL(new Blob([data], {
    type: mime
  }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function base64File(name, data, mime = 'application/pdf') {
  downloadFile(name, Uint8Array.from(atob(data), c => c.charCodeAt(0)), mime);
}
export const matches = (row, q) => !q.trim() || JSON.stringify(row).toLowerCase().includes(q.toLowerCase().trim());
export const dateText = value => value ? String(value).slice(0, 10).split('-').reverse().join('/') : '—';
export const gbp = v => Number(v || 0).toLocaleString('en-GB', {
  style: 'currency',
  currency: 'GBP'
});
export function readData(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
