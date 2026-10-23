/**
 * Every word the quote builder uses, on the page and in the PDF.
 *
 * The PRD's copy (prd-app-001-quote-builder-2026-10-24.md §5.2) is used
 * verbatim. Everything else follows design-system/README.md §3: sentence
 * case, second person, plain, no figures Jura cannot evidence.
 *
 * `pdf` is the wording on the visitor's own document. It carries their name,
 * not Jura's, apart from the optional "Made with" line they can switch off.
 * A quotation is not a tax invoice and is never labelled as one.
 */
export default {
  title: "Quote builder",
  subtitle: "Make a clean, professional quote with your logo and send it as a PDF in a few minutes.",
  privacy: "Everything you type stays in your browser. Nothing is sent to us.",
  talk: {
    heading: "Quotes, jobs and invoices, entered once",
    body: "We can connect your quoting to your jobs and invoicing, so each detail is typed one time.",
    button: "Tell us how you quote today",
  },

  sections: {
    business: "Your business",
    customer: "Customer",
    details: "Quote details",
    items: "Items",
    totals: "Discount and GST",
    notes: "Notes and terms",
    output: "Your quote",
  },

  view: {
    label: "Quote builder view",
    edit: "Edit",
    preview: "Preview",
  },

  business: {
    name: "Business name",
    address: "Address",
    uen: "UEN",
    uenHint: "Optional",
    phone: "Phone",
    email: "Email",
    logo: "Logo",
    logoDrop: "Add your logo",
    logoHint: "PNG, JPG or SVG, under 1 MB. It stays in your browser.",
    logoRemove: "Remove logo",
    logoAlt: "Your logo",
    logoUnreadable: "That image could not be read. Try a PNG or JPG.",
  },

  remember: "Remember my business details on this device",
  rememberBlocked: "This browser is not letting the page store anything, so your details will not be remembered.",

  customer: {
    company: "Company",
    contact: "Contact name",
    address: "Address",
    email: "Email",
  },

  details: {
    number: "Quote number",
    date: "Quote date",
    validUntil: "Valid until",
  },

  items: {
    heading: (n) => `Item ${n}`,
    description: "Description",
    quantity: "Quantity",
    unit: "Unit",
    unitPlaceholder: "hours, pcs, m²",
    unitPrice: "Unit price (SGD)",
    discountType: "Discount",
    discountNone: "No discount",
    discountPercent: "Percentage off",
    discountAmount: "Amount off",
    discountPercentValue: "Discount (%)",
    discountAmountValue: "Discount (SGD)",
    lineTotal: "Line total",
    moveUp: (n) => `Move item ${n} up`,
    moveDown: (n) => `Move item ${n} down`,
    remove: (n) => `Remove item ${n}`,
  },

  emptyItems: "Add your first item to see the total.",
  zeroQuantity: "Items with no quantity are left off the quote.",

  totals: {
    overallType: "Discount on the whole quote",
    overallPercentValue: "Discount on the whole quote (%)",
    overallAmountValue: "Discount on the whole quote (SGD)",
    gstSwitch: "Add GST",
    gstRate: "GST rate (%)",
    gstRegNo: "GST registration number",
  },
  gstHelper: "Only switch this on if your business is GST-registered.",

  notesLabel: "Notes and terms",
  defaultNotes:
    "Prices are in Singapore dollars. This quote is valid until the date shown above. To go ahead, reply to confirm and we will arrange the next steps.",

  madeWith: "Show “Made with jurasolutions.sg/apps” at the foot of the PDF",

  errors: {
    invalidNumber: "Use a number, like 120 or 120.50.",
    percent: "Use a percentage from 0 to 100.",
  },

  unsupported: (chars) => `Some characters can't go into the PDF, so they will be left out: ${chars}`,

  buttons: {
    addItem: "Add item",
    downloadPdf: "Download PDF",
    saveFile: "Save quote file",
    openFile: "Open quote file",
    newQuote: "New quote",
  },

  working: "Making your PDF",
  pdfFailed: "The PDF could not be made. Try again, or refresh the page.",
  opened: "Quote opened",
  badFile: "That file doesn't look like a quote saved from this tool.",
  logoTooBig: "Please use a logo under 1 MB.",

  newQuoteDialog: {
    title: "Start a new quote",
    body: "Your business details stay. The customer, items and notes are cleared.",
    cancel: "Keep editing",
    confirm: "Start a new quote",
  },

  preview: {
    label: "Quote preview",
  },

  pdf: {
    title: "Quotation",
    number: "Quote no.",
    date: "Date",
    validUntil: "Valid until",
    preparedFor: "Prepared for",
    uen: "UEN",
    gstRegNo: "GST reg. no.",
    phone: "Tel",
    email: "Email",
    columns: {
      index: "#",
      description: "Description",
      quantity: "Qty",
      unit: "Unit",
      unitPrice: "Unit price",
      discount: "Discount",
      amount: "Amount",
    },
    currencyNote: "All amounts in SGD",
    subtotal: "Subtotal",
    discount: "Discount",
    taxable: "Total before GST",
    gst: (rate) => `GST (${rate}%)`,
    total: "Total (SGD)",
    notes: "Notes and terms",
    page: (n, of) => `Page ${n} of ${of}`,
    madeWith: "Made with jurasolutions.sg/apps",
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  },
};
