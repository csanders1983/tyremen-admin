const zone = "Europe/London";
export function londonDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
export function shiftDate(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function londonStartMs(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time || "")) return NaN;
  const guess = Date.parse(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(guess));
  const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const seen = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
  return guess - (seen - guess);
}
export function jobTiming(job, now = Date.now()) {
  const start = londonStartMs(job.date, job.plan?.startTime || job.time);
  const duration = Number(job.plan?.durationMinutes || 0);
  const done = job.stageComplete===true || Boolean(job.invoiceId) || ["completed", "complete", "done", "ready to collect"].includes(String(job.status || "").toLowerCase());
  if (done) return { state: "complete", label: "Work complete", start, end: duration > 0 ? start + duration * 60000 : NaN, progress: 100 };
  if (!Number.isFinite(start) || duration <= 0) return { state: "unplanned", label: "Duration to be set", progress: 0 };
  const end = start + duration * 60000;
  const remaining = Math.ceil((end - now) / 60000);
  const elapsed = (now - start) / 60000;
  const progress = Math.min(100, Math.max(0, elapsed / duration * 100));
  if (now < start) return { state: "upcoming", label: `Starts in ${Math.ceil((start - now) / 60000)} min`, start, end, progress };
  if (remaining <= 0) return { state: "overdue", label: `${Math.ceil((now - end) / 60000)} min overdue`, start, end, progress };
  if (remaining <= 30) return { state: "due", label: `${remaining} min to completion`, start, end, progress };
  if (duration > 180 && elapsed >= 180) return { state: "checkpoint", label: `3-hour check · ${remaining} min remaining`, start, end, progress };
  return { state: "working", label: `${remaining} min remaining`, start, end, progress };
}
export function londonTime(ms) {
  return Number.isFinite(ms) ? new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(ms)) : "—";
}
