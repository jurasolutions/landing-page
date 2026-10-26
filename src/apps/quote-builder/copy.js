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
  privacy:
    "Everything you type stays in your browser, except the job you describe for an AI draft. That is sent securely to Anthropic's Claude to draft your quote, then discarded. We don't store it.",
  talk: {
    heading: "Quotes, jobs and invoices, entered once",
    body: "We can connect your quoting to your jobs and invoicing, so each detail is typed one time.",
    button: "Tell us how you quote today",
  },

  // APP-001a: draft the quote from a loosely written description.
  ai: {
    heading: "Draft with AI",
    label: "Describe the job and your prices",
    hint: "Write it the way you would jot it down. Leave the example in grey to see how it works.",
    // Loosely written on purpose (APP-001a §2), so a visitor sees it copes.
    example:
      "Generate a quote for setting up a planter area with faux plants, site visit and measurement = $200, design concept + 3D render = $200, planter box (200x100,70) for $350, custom fabrication (inc lining, tray and other equipments) = $300, faux plants (non-custom) = $700, installation =$200",
    button: "Draft the quote",
    drafting: "Drafting your quote…",
    oneTry: "Each draft uses one free try and replaces the items on the quote.",
    done: "Quote drafted. Check each line before you send it.",
    scope: (summary) => `Scope: ${summary}`,
    triesLeft: (n) => (n === 1 ? "1 free try left today" : `${n} free tries left today`),
    limitReached: "You've used today's free tries. You can still fill in the quote by hand.",
    capReached: "The free tries are used up for today. You can still fill in the quote by hand.",
    notReady: "Drafting with AI isn't available right now. You can still fill in the quote by hand.",
    loading: "Checking your free tries for today…",
    errors: {
      unreadable: "We couldn't draft a quote from that. Try listing each part of the job with its price.",
      unavailable: "Drafting isn't available right now. Please try again later.",
      // Added after either message above, only when the try came back.
      notCounted: "This try wasn't counted.",
      botCheck: "We couldn't confirm this is a person and not a bot. Refresh the page and try again.",
      tooLong: "That description is too long. Please keep it under 2,000 characters.",
    },
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
  itemsFull: (n) => `You can add up to ${n} items to one quote.`,
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
