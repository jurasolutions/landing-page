/**
 * Every word the invoice builder uses, on the page and in the PDF.
 *
 * The PRD's copy (APP-005 §5.2, approval A-0002) is used word for word, and
 * so are the strings agreed in .scratch/invoice-builder/reviews/decisions.md
 * (D4, D6, D10, D12). Everything else follows the voice rules: sentence case,
 * second person, plain, no exclamation marks, no emoji, no figures Jura
 * cannot evidence. Nothing here may say a document meets IRAS rules.
 *
 * `pdf` is the wording on the visitor's own document. It carries their name,
 * never Jura's, and it is titled "Invoice" with GST off and "Tax invoice"
 * with GST on, never anything else.
 *
 * The GST, missing-field and file strings are used by tickets 03 and 04; they
 * are all here so the copy has one home.
 *
 * Shape: the keys ItemEditor reads (`items.*`, `errors.*`) match the quote
 * builder's, because the invoice reuses its form parts.
 */
export default {
  title: "Invoice builder",
  subtitle: "Make a clean invoice with your logo and download it as a PDF, with or without GST.",
  privacy: "Everything you type stays in your browser. Nothing is sent to us.",
  talk: {
    heading: "Invoices raised from the work you've done",
    body: "We can connect your invoicing to your quotes, jobs and accounts, so each detail is typed one time.",
    button: "Tell us how you invoice today",
  },

  sections: {
    business: "Your business",
    customer: "Your customer",
    details: "Invoice details",
    items: "Items",
    payment: "Payment details",
    notes: "Notes",
    output: "Your invoice",
  },

  view: {
    label: "Invoice builder view",
    edit: "Edit",
    preview: "Preview",
  },

  business: {
    name: "Business name",
    address: "Address",
    uen: "UEN (optional)",
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
    company: "Company or customer name",
    contact: "Contact name",
    address: "Customer address",
    email: "Customer email",
  },

  details: {
    number: "Invoice number",
    date: "Invoice date",
    dueDate: "Due date (optional)",
    dueBeforeDate: "The due date is before the invoice date.",
  },

  items: {
    heading: (n) => `Item ${n}`,
    description: "Description",
    quantity: "Quantity",
    unit: "Unit",
    unitPlaceholder: "hours, pcs, m²",
    unitPrice: "Unit price",
    discountType: "Line discount",
    discountNone: "No discount",
    discountPercent: "Percentage off",
    discountAmount: "Amount off",
    discountPercentValue: "Line discount (%)",
    discountAmountValue: "Line discount (SGD)",
    lineTotal: "Line total",
    moveUp: (n) => `Move item ${n} up`,
    moveDown: (n) => `Move item ${n} down`,
    remove: (n) => `Remove item ${n}`,
  },

  emptyItems: "Add your first item to see the total.",
  itemsFull: (n) => `You can add up to ${n} items to one invoice.`,
  zeroQuantity: "Items with no quantity are left off the invoice.",

  discount: {
    type: "Overall discount",
    percentValue: "Overall discount (%)",
    amountValue: "Overall discount (SGD)",
  },

  // The fields and helpers ticket 03 shows while GST is on.
  gst: {
    switch: "Charge GST",
    rate: "GST rate (%)",
    regNo: "GST registration number",
    helper: "Only switch this on if your business is GST-registered. Your invoice will then be titled Tax invoice.",
    rateHelper: "Set to the current rate on the IRAS website. Please check the figures before you send your invoice.",
  },

  payment: {
    label: "Payment details",
    helper: "Tell your customer how to pay you, such as your bank account or PayNow details.",
  },

  notesLabel: "Notes",

  // The totals rows (decision D5), on the preview and the PDF.
  totals: {
    subtotal: "Subtotal",
    discount: "Discount",
    taxable: "Amount before GST",
    gst: "GST",
    gstAt: (rate) => `GST (${rate}%)`,
    withGst: "Amount with GST",
    total: "Total",
  },

  // The list "Download PDF" shows with GST on (ticket 03, decision D4).
  missing: {
    heading: "A few details are still needed for a tax invoice",
    field: (field) => `Please add: ${field}`,
    items: "Items",
    itemDescription: (n) => `Description for item ${n}`,
  },

  errors: {
    invalidNumber: "Use a number, like 120 or 120.50.",
    percent: "Use a percentage from 0 to 100.",
  },
  // Decision D13: no file while a figure shows an error.
  figuresToFix: "Please correct the figures marked in the form, then download your PDF again.",

  unsupported: (chars) => `Some characters can't go into the PDF, so they will be left out: ${chars}`,

  buttons: {
    addItem: "Add item",
    downloadPdf: "Download PDF",
    saveFile: "Save invoice file",
    openFile: "Open invoice file",
    openQuote: "Open quote file",
    newInvoice: "New invoice",
  },

  working: "Making your PDF",
  pdfFailed: "The PDF could not be made. Try again, or refresh the page.",
  // Ticket 04: the files.
  opened: "Invoice opened",
  quoteOpened: "Quote opened",
  badFile: "That file doesn't look like one saved from our quote or invoice builder.",
  quoteIncludedGst:
    "This quote's prices include GST. Your invoice adds GST on top, so change each unit price to the amount before GST.",
  logoTooBig: "Please use a logo under 1 MB.",

  newInvoiceDialog: {
    title: "Start a new invoice",
    body: "Your business details stay. The customer, items and notes are cleared.",
    cancel: "Keep editing",
    confirm: "Start a new invoice",
  },

  preview: {
    label: "Invoice preview",
  },

  pdf: {
    title: (gstOn) => (gstOn ? "Tax invoice" : "Invoice"),
    number: "Invoice no.",
    date: "Date",
    dueDate: "Due date",
    billTo: "Bill to",
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
    payment: "Payment details",
    notes: "Notes",
    page: (n, of) => `Page ${n} of ${of}`,
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  },
};
