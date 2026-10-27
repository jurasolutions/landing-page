/**
 * Every word the receipt reader uses, on the page and in its exports.
 *
 * The PRD's copy (prd-app-002-receipt-reader-2026-10-24.md §5.2) is used
 * verbatim. Everything else follows design-system/README.md §3.
 */
export default {
  title: "Receipt reader",
  subtitle: "Snap a few receipts and get a tidy table you can drop into Excel or your accounts.",
  privacy:
    "Your images are sent securely to Anthropic's Claude to read them, then discarded. We don't store your receipts or what's on them.",
  talk: {
    heading: "Receipts filed for you, every week",
    body: "We can set this up to read receipts from email or WhatsApp and file them in your accounts.",
    button: "Show us your receipt process",
  },

  triesLeft: (n) => (n === 1 ? "1 free try left today" : `${n} free tries left today`),
  limitReached:
    "You've used today's free tries. Come back tomorrow, or tell us how you handle receipts and we'll show you the full version.",
  capReached:
    "The free tries are used up for today. Come back tomorrow, or tell us what you need and we'll show you the full version.",

  uploadLabel: "Add your receipts",
  uploadHint: "Add up to 3 receipts. Clear, flat photos work best.",
  read: "Read receipts",
  reading: "Reading your receipts…",
  preparing: "Getting your files ready",
  oneTry: "One try reads every receipt you have added.",
  // Why the read button is off. Only the reasons nothing else on the page explains.
  readWhy: {
    loading: "Checking your free tries for today…",
    preparing: "Your receipts are still getting ready.",
    noFiles: "Add at least one receipt first.",
  },

  files: {
    label: (n) => `Receipt ${n}`,
    remove: (n) => `Remove receipt ${n}`,
    pdf: "First page of the PDF",
  },

  heic: "Please share the photo as a JPG.",
  tooMany: "You can add up to 3 receipts at a time.",
  badType: "That file can't be read here. Use a JPG, PNG, WEBP or PDF.",
  tooBig: "That file is too large to send, even after resizing. Try a smaller photo.",
  unopenable: "That file couldn't be opened. Try another photo.",

  errors: {
    unreadable: "We couldn't read these images. Clearer, flatter photos usually work.",
    unavailable: "The receipt reader isn't available right now. Please try again later.",
    refused: "These images couldn't be read. If they're receipts, try one clear photo of each.",
    rejected: "One of these images couldn't be processed. Take the photo again, or save it as a JPG.",
    badOutput: "Something went wrong on our side while reading. Please try again.",
    busy: "The receipt reader is busy right now. Please try again in a minute.",
    offline: "We couldn't reach the receipt reader. Check your connection and try again.",
    // Added after any message above but the last, only when the try came back.
    notCounted: "This try wasn't counted.",
    botCheck: "We couldn't confirm this is a person and not a bot. Refresh the page and try again.",
    notReady: "The receipt reader isn't available right now. Please try again later.",
  },

  results: {
    heading: "Your receipts",
    hint: "Check and edit anything below before you download.",
    receipt: (n) => `Receipt ${n}`,
    remove: (n) => `Remove receipt ${n} from the table`,
    showItems: (n) => `Show line items (${n})`,
    hideItems: "Hide line items",
    noItems: "No line items were read.",
    addItem: "Add a line",
    removeItem: (n) => `Remove line ${n}`,
  },

  // Why a photo came back without a receipt. `n` is the photo's number in the
  // batch it was sent with. `notReceipt` is for an answer with no number.
  notReceipt: "We couldn't find a receipt in this image.",
  problems: {
    not_a_receipt: (n) => `Photo ${n} doesn't look like a receipt or invoice.`,
    blurry: (n) => `Photo ${n} is too blurry to read. Hold the receipt flat and keep the camera steady.`,
    cut_off: (n) => `Part of the receipt in photo ${n} is cut off. Fit the whole receipt in the frame.`,
    too_dark: (n) => `Photo ${n} is too dark to read. Try again in better light.`,
    other: (n) => `We couldn't read a receipt in photo ${n}. Try a closer, straighter photo.`,
  },
  mismatch: "These items don't add up to the total. Worth a quick check.",

  fields: {
    merchant: "Merchant",
    merchantId: "UEN or GST reg. no.",
    date: "Date",
    datePlaceholder: "YYYY-MM-DD",
    currency: "Currency",
    subtotal: "Subtotal",
    gst: "GST",
    total: "Total",
    payment: "Payment method",
    category: "Category",
    notes: "Notes",
    itemDescription: "Description",
    itemQuantity: "Qty",
    itemAmount: "Amount",
  },
  categories: ["Transport", "Meals", "Supplies", "Utilities"],

  exports: {
    csv: "Download CSV",
    xlsx: "Download Excel",
    copy: "Copy table",
    copied: "Table copied",
    copyFailed: "Your browser didn't allow copying. Use Download CSV instead.",
    group: "Download or copy the table",
    receiptsSheet: "Receipts",
    itemsSheet: "Line items",
    fileName: "receipts",
    itemsReceipt: "Receipt",
  },
};
