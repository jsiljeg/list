/* A UBL 2.1 e-invoice (what moj-eRačun hands over) turned into a receipt
 * draft: who, when, how much, and every line with its VAT added back — the
 * same shape a photographed receipt is read into (web/EXPENSES.md).
 *
 * Workers have no DOMParser, so this carries a small XML reader of its own.
 * It only has to read well-formed documents a provider has already
 * validated, so it is a tokenizer, not a validator. Namespace prefixes are
 * dropped: a supplier's software may call cbc "cbc", "ns2" or nothing. */

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unent = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) =>
  e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENT[e] ?? m));
const local = (n) => n.slice(n.indexOf(":") + 1);

export function parseXml(xml) {
  const root = { name: "#root", attrs: {}, kids: [], text: "" };
  const stack = [root];
  const re = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([^\s>]+)\s*>|<([^\s/>]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(xml))) {
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) top.text += m[1];
    else if (m[2]) { if (stack.length > 1) stack.pop(); }
    else if (m[3]) {
      const attrs = {};
      for (const a of (m[4] || "").matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[local(a[1])] = unent(a[2] ?? a[3]);
      const el = { name: local(m[3]), attrs, kids: [], text: "" };
      top.kids.push(el);
      if (!m[5]) stack.push(el);
    } else if (m[6] !== undefined) top.text += unent(m[6]);
  }
  return root;
}

/* path helpers: kid(el, "A", "B") is the first A/B under el */
const kid = (el, ...path) => path.reduce((e, n) => (e ? e.kids.find((k) => k.name === n) : null), el);
const kids = (el, n) => (el ? el.kids.filter((k) => k.name === n) : []);
const txt = (el, ...path) => { const e = kid(el, ...path); return e ? e.text.trim() : ""; };
const num = (s) => { const v = Number(String(s).replace(",", ".")); return s !== "" && Number.isFinite(v) ? v : null; };
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
function find(el, names) {
  if (names.includes(el.name)) return el;
  for (const k of el.kids) { const f = find(k, names); if (f) return f; }
  return null;
}

/* UN/ECE rec. 20 units → the three the Cijene tab compares by */
const UNITS = { KGM: ["kg", 1], GRM: ["kg", 0.001], LTR: ["l", 1], MLT: ["l", 0.001], CLT: ["l", 0.01] };
const DOC_UNITS = { KGM: "kg", GRM: "g", LTR: "l", MLT: "ml", CLT: "cl", H87: "kom", C62: "kom", PCE: "kom", EA: "kom",
  XBX: "kut", XPK: "pak", XBO: "boca", MTR: "m", HUR: "h" };
/* UNCL 4461 payment means */
const PAYMENT = { 10: "gotovina", 48: "kartica", 54: "kartica", 55: "kartica" };

/* → {vendor, vendor_oib, doc_date, due_date, doc_no, total, vat, payment, items[], pdf?}
   or null when the document is not an invoice or a credit note. */
export function ublDraft(xml) {
  const doc = find(parseXml(xml), ["Invoice", "CreditNote"]);
  if (!doc) return null;
  const credit = doc.name === "CreditNote";
  const sign = credit ? -1 : 1;
  const party = kid(doc, "AccountingSupplierParty", "Party");
  const vendor = txt(party, "PartyLegalEntity", "RegistrationName") || txt(party, "PartyName", "Name");
  /* OIB: the VAT id without its HR, or an endpoint registered under scheme 9934 */
  let oib = txt(party, "PartyTaxScheme", "CompanyID").replace(/^HR/i, "");
  if (!/^\d{11}$/.test(oib)) {
    const ep = kid(party, "EndpointID");
    oib = ep && /^\d{11}$/.test(ep.text.trim()) ? ep.text.trim() : "";
  }
  const total = num(txt(doc, "LegalMonetaryTotal", "PayableAmount")) ?? num(txt(doc, "LegalMonetaryTotal", "TaxInclusiveAmount"));
  const vat = num(txt(doc, "TaxTotal", "TaxAmount"));
  const items = kids(doc, credit ? "CreditNoteLine" : "InvoiceLine").map((ln) => {
    const qEl = kid(ln, credit ? "CreditedQuantity" : "InvoicedQuantity");
    const rate = num(txt(ln, "Item", "ClassifiedTaxCategory", "Percent")) ?? 0;
    const gross = 1 + rate / 100;
    const [unit, k] = UNITS[(qEl && qEl.attrs.unitCode) || ""] || ["kom", 1];
    const qty0 = qEl ? num(qEl.text.trim()) : null;
    const base = num(txt(ln, "Price", "BaseQuantity")) || 1;
    const price = num(txt(ln, "Price", "PriceAmount"));
    const net = num(txt(ln, "LineExtensionAmount"));
    const qty = qty0 == null ? null : Math.round(qty0 * k * 1000) / 1000;
    /* the line's own rabat, as a percentage when the invoice states one */
    const allow = kids(ln, "AllowanceCharge").find((a) => txt(a, "ChargeIndicator") === "false");
    const discount = allow ? num(txt(allow, "MultiplierFactorNumeric")) : null;
    return {
      name: txt(ln, "Item", "Name") || txt(ln, "Item", "Description"),
      /* as the invoice states it — what Filho compares with the PDF */
      doc_qty: qty0, doc_unit: DOC_UNITS[(qEl && qEl.attrs.unitCode) || ""] || "kom",
      doc_price: price, doc_base: base !== 1 ? base : null,     /* "20,74 € / 1000 g" stays that */
      discount, doc_total: net == null ? null : r2(sign * net), vat_rate: rate,
      /* derived: per kg / l / kom with PDV, for Cijene; the share of what was paid */
      qty,
      unit,
      unit_price: price == null ? null : Math.round((price / base / k) * gross * 10000) / 10000,
      total: net == null ? null : r2(sign * net * gross),
    };
  });
  const code = txt(doc, "PaymentMeans", "PaymentMeansCode");
  let pdf = null;
  for (const ref of kids(doc, "AdditionalDocumentReference")) {
    const bin = kid(ref, "Attachment", "EmbeddedDocumentBinaryObject");
    if (bin && /pdf/i.test(bin.attrs.mimeCode || "") && !pdf) pdf = bin.text.replace(/\s+/g, "");
  }
  return {
    vendor, vendor_oib: oib,
    doc_date: /^\d{4}-\d{2}-\d{2}$/.test(txt(doc, "IssueDate")) ? txt(doc, "IssueDate") : null,
    /* when it must be paid: the invoice's own DueDate, or the payment means' */
    due_date: [txt(doc, "DueDate"), txt(doc, "PaymentMeans", "PaymentDueDate")].find((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)) || null,
    doc_no: txt(doc, "ID"),
    total: total == null ? null : r2(sign * total),
    vat: vat == null ? null : r2(sign * vat),
    payment: PAYMENT[code] || "virman",
    credit,
    items: items.filter((i) => i.name || i.total != null),
    pdf,
  };
}
