export const money = (value) => Number(value || 0).toFixed(2);

export function calculateInvoice(items = []) {
  const lines = items.map((item) => {
    const quantity = Math.max(0, Number(item.quantity || 0));
    const unitPriceIncVat = Math.max(0, Number(item.unitPriceIncVat || 0));
    const discountIncVat = Math.max(0, Number(item.discountIncVat || 0));
    const vatRate = Math.max(0, Number(item.vatRate ?? 20));
    const gross = Math.max(0, quantity * unitPriceIncVat - discountIncVat);
    const net = vatRate ? gross / (1 + vatRate / 100) : gross;
    const vat = gross - net;
    return { ...item, quantity, unitPriceIncVat, discountIncVat, vatRate, net, vat, gross };
  });
  const net = lines.reduce((sum, line) => sum + line.net, 0);
  const vat = lines.reduce((sum, line) => sum + line.vat, 0);
  const total = lines.reduce((sum, line) => sum + line.gross, 0);
  return { lines, net, vat, total };
}
