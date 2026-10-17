// Layout-only checks. The existing invoice endpoint remains authoritative.
export function saleStepError(draft, step, wheelWork = () => false) {
  const vehicle = draft.vehicle || {};
  if (![vehicle.registration, vehicle.make, vehicle.model].every(v => String(v || '').trim())) return 'Enter the registration, make and model before continuing.';
  if (!String(draft.customer?.name || '').trim()) return 'Add the customer or company name before continuing.';
  if (step < 1) return '';
  if (!draft.items?.length || draft.items.some(line => !String(line.description || '').trim())) return 'Add your items, and complete or remove any blank lines.';
  for (const line of draft.items) {
    if (!Number.isFinite(Number(line.quantity)) || Number(line.quantity) <= 0) return 'Each item needs a quantity greater than zero.';
    if (![line.unitPriceIncVat, line.discountIncVat ?? 0].every(v => Number.isFinite(Number(v)) && Number(v) >= 0)) return 'Check the price and discount on each item.';
    if (wheelWork(line)) {
      const positions = line.positions || [];
      if (!Number.isInteger(Number(line.quantity)) || positions.length !== Number(line.quantity) || new Set(positions).size !== positions.length || positions.some(v => !['NSF','OSF','NSR','OSR'].includes(v))) return 'Choose one distinct wheel position per tyre, tyre repair or TPMS unit.';
    }
  }
  if (!(draft.technicians?.length ? draft.technicians : [draft.technician]).some(v => String(v || '').trim())) return 'Select the technician responsible for this work.';
  return '';
}
