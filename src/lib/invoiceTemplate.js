import { calculateInvoice, money } from "./invoiceMath";

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

export function buildInvoiceHtml(invoice) {
  const totals = calculateInvoice(invoice.items || []);
  const title = invoice.documentType === "credit-note" ? "CREDIT NOTE" : invoice.documentType === "quote" ? "QUOTATION" : "VAT INVOICE";
  const rows = totals.lines.map((line) => `
    <tr>
      <td><strong>${escapeHtml(line.description)}</strong>${line.stockNumber ? `<small>Stock: ${escapeHtml(line.stockNumber)}</small>` : ""}</td>
      <td>${money(line.quantity)}</td><td>£${money(line.unitPriceIncVat)}</td>
      <td>£${money(line.discountIncVat)}</td><td>${money(line.vatRate)}%</td>
      <td>£${money(line.net)}</td><td>£${money(line.vat)}</td><td>£${money(line.gross)}</td>
    </tr>`).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(invoice.invoiceNumber || title)}</title>
  <style>
    @page{size:A4;margin:14mm}*{box-sizing:border-box}body{font:12px Arial;color:#111;margin:0}.top{display:flex;justify-content:space-between;border-bottom:5px solid #ffd500;padding-bottom:18px}.brand{font-size:43px;font-weight:1000;font-style:italic}.tag{letter-spacing:3px;font-size:9px;font-weight:bold}.type{text-align:right}.type h1{margin:0;font-size:30px}.meta,.parties{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin:22px 0}.right{text-align:right}.box{border:1px solid #bbb;padding:13px;min-height:110px}.box h3{margin:0 0 9px;font-size:11px;color:#777;letter-spacing:1px}.vehicle{display:grid;grid-template-columns:repeat(4,1fr);background:#111;color:#fff;margin:16px 0}.vehicle div{padding:11px;border-right:1px solid #444}.vehicle small{display:block;color:#ffd500;font-weight:bold;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:18px}th{background:#222;color:#fff;padding:8px;text-align:right}th:first-child,td:first-child{text-align:left}td{border-bottom:1px solid #ccc;padding:9px 7px;text-align:right;vertical-align:top}td small{display:block;color:#666;margin-top:4px}.summary{width:310px;margin:20px 0 0 auto}.summary div{display:flex;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #ccc}.summary .total{background:#ffd500;font-size:18px;font-weight:bold}.terms{margin-top:28px;padding:14px;background:#f4f4f4;line-height:1.5}.footer{position:fixed;bottom:0;left:0;right:0;border-top:1px solid #ccc;padding-top:8px;display:flex;justify-content:space-between;font-size:10px;color:#555}
  </style></head><body>
  <header class="top"><div><div class="brand">TYREMEN</div><div class="tag">MORE THAN JUST TYRES</div></div><div class="type"><h1>${title}</h1><b>${escapeHtml(invoice.invoiceNumber || "DRAFT")}</b><p>${escapeHtml(invoice.invoiceDate || new Date().toLocaleDateString("en-GB"))}</p></div></header>
  <section class="meta"><div><b>Tyremen Ltd</b><br>Witty Street<br>Hull<br>HU3 4TX<br><br>Company Registration: 01339220<br>VAT Registration: 317078069</div><div class="right">Tel: 01482 328800<br>info@tyremen.co.uk<br>www.tyremen.co.uk<br><br>Sales adviser: ${escapeHtml(invoice.adviserName || "")}</div></section>
  <section class="parties"><div class="box"><h3>INVOICE TO</h3><b>${escapeHtml(invoice.customer?.name || "")}</b><br>${escapeHtml(invoice.customer?.address1 || "")}<br>${escapeHtml(invoice.customer?.address2 || "")}<br>${escapeHtml(invoice.customer?.town || "")} ${escapeHtml(invoice.customer?.postcode || "")}</div><div class="box"><h3>CONTACT & ACCOUNT</h3>${escapeHtml(invoice.customer?.email || "")}<br>${escapeHtml(invoice.customer?.phone || "")}<br><br>Account: ${escapeHtml(invoice.customer?.accountNumber || "Retail")}<br>Terms: ${escapeHtml(invoice.paymentTerms || "Due on completion")}</div></section>
  <section class="vehicle"><div><small>REGISTRATION</small><b>${escapeHtml(invoice.vehicle?.registration || "-")}</b></div><div><small>MAKE</small>${escapeHtml(invoice.vehicle?.make || "-")}</div><div><small>MODEL</small>${escapeHtml(invoice.vehicle?.model || "-")}</div><div><small>MILEAGE</small>${escapeHtml(invoice.vehicle?.mileage || "-")}</div></section>
  <table><thead><tr><th>Description</th><th>Qty</th><th>Unit inc VAT</th><th>Discount</th><th>VAT</th><th>Net</th><th>VAT</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
  <section class="summary"><div><span>Total net</span><b>£${money(totals.net)}</b></div><div><span>Total VAT</span><b>£${money(totals.vat)}</b></div><div class="total"><span>Total</span><b>£${money(totals.total)}</b></div><div><span>Paid</span><b>£${money(invoice.amountPaid)}</b></div><div><span>Balance due</span><b>£${money(Math.max(0, totals.total - Number(invoice.amountPaid || 0)))}</b></div></section>
  <section class="terms"><b>Payment terms</b><br>${escapeHtml(invoice.termsText || "Payment is due on completion unless account terms have been agreed in writing.")}</section>
  <footer class="footer"><span>Tyremen Ltd · Witty Street, Hull, HU3 4TX · 01482 328800</span><span>${escapeHtml(invoice.invoiceNumber || "DRAFT")}</span></footer>
  </body></html>`;
}
