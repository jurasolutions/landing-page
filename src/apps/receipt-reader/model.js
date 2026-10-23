/**
 * Receipts as the page edits them: every value is the text in its field.
 * The server's numbers become two-decimal strings on the way in, and the
 * exports turn valid amounts back into numbers on the way out.
 */
let counter = 0;
const id = () => `r-${Date.now().toString(36)}-${(counter += 1)}`;

const text = (value) => (value == null ? "" : String(value));
const money = (value) => (typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "");
const qty = (value) => (typeof value === "number" && Number.isFinite(value) ? String(value) : "");

export function fromApi(receipt) {
  return {
    id: id(),
    isReceipt: receipt.is_receipt === true,
    merchant: text(receipt.merchant),
    merchantId: text(receipt.merchant_id),
    date: text(receipt.date),
    currency: text(receipt.currency),
    subtotal: money(receipt.subtotal),
    gst: money(receipt.gst),
    total: money(receipt.total),
    payment: text(receipt.payment_method),
    category: "",
    notes: text(receipt.notes),
    items: (receipt.items ?? []).map((item) => ({
      id: id(),
      description: text(item.description),
      quantity: qty(item.quantity),
      amount: money(item.amount),
    })),
  };
}

export const emptyLine = () => ({ id: id(), description: "", quantity: "", amount: "" });

/** "12.30" or "-1.50" or "1,234.5" to integer cents; null when blank or not a number. */
export function toCents(value) {
  const cleaned = String(value ?? "").trim().replace(/[,\s]/g, "").replace(/^S?\$/i, "");
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const cents = Number(match[2]) * 100 + Number((match[3] ?? "").padEnd(2, "0"));
  return match[1] ? -cents : cents;
}

/**
 * True when the line items are there but add up to neither the total, the
 * subtotal, nor the total less GST (to the cent).
 */
export function itemsMismatch(receipt) {
  if (!receipt.isReceipt) return false;
  const amounts = receipt.items.map((item) => toCents(item.amount)).filter((cents) => cents !== null);
  if (amounts.length === 0) return false;
  const total = toCents(receipt.total);
  if (total === null) return false;
  const sum = amounts.reduce((a, b) => a + b, 0);
  const subtotal = toCents(receipt.subtotal);
  const gst = toCents(receipt.gst);
  const targets = [total, subtotal, gst === null ? null : total - gst].filter((t) => t !== null);
  return !targets.some((target) => Math.abs(sum - target) <= 1);
}
