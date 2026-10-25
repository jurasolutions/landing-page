/**
 * Every word on the page.
 *
 * Two rules govern this file, both from `design-system/README.md` §3:
 *
 *  1. Warm and plain-spoken. Sentence case, second person, short declaratives.
 *     No buzzwords, no urgency, no emoji, no exclamation marks.
 *  2. Never publish a figure the business cannot evidence. No client counts,
 *     no hours saved, no ROI. Defensible ranges and ceilings only. The
 *     illustrative dashboard is captioned as illustrative.
 */

export const CONTACT_EMAIL = "info@jurasolutions.sg";
export const SITE_ORIGIN = "https://jurasolutions.sg";

/** Hash links point at sections of the home page; elsewhere they become /#hash. */
export const NAV_LINKS = [
  { href: "#services", label: "Services" },
  { href: "#how", label: "How we work" },
  { href: "#proof", label: "What it looks like" },
  { href: "#trust", label: "Working with us" },
  { href: "#faq", label: "Questions" },
  { href: "/apps", label: "Toolbox" },
];

export const NAV = {
  cta: "Book a call",
  menuOpen: "Open menu",
  menuClose: "Close menu",
  skip: "Skip to content",
};

/**
 * Title and description for each route, used in the browser and by
 * `scripts/prerender-routes.mjs` for the copies of index.html it writes.
 * The home entry matches index.html exactly.
 */
export const ROUTE_META = {
  home: {
    path: "/",
    title: "Jura Solutions — automate the work nobody should be doing",
    description:
      "Jura Solutions is an automation consultancy. We map the repetitive parts of how your business runs, then hand them to software. You keep the judgement, the credentials and the off-switch.",
  },
  apps: {
    path: "/apps",
    title: "Free business tools | Jura Solutions",
    description:
      "Free tools for quotes, PDFs and other everyday paperwork. No sign-up. Open one and use it straight away.",
  },
  privacy: {
    path: "/privacy",
    title: "Privacy | Jura Solutions",
    description:
      "What Jura Solutions collects through this site, its free tools and its emails, why, and how to stop it.",
  },
  unsubscribed: {
    path: "/unsubscribed",
    title: "Unsubscribe | Jura Solutions",
    description: "Unsubscribe from emails sent by Jura Solutions.",
    noindex: true,
  },
  notfound: {
    path: "/404",
    title: "Page not found | Jura Solutions",
    description: "That page is not on jurasolutions.sg.",
    noindex: true,
  },
};

/** The /apps index. */
export const TOOLBOX = {
  label: "Toolbox",
  heading: "Free tools for the paperwork",
  lede:
    "Small tools for the jobs that come round every week. No sign-up. Each one is a small version of something we can build into your own systems.",
  filterLabel: "Show tools for",
  allLabel: "All",
  emptyHeading: "The first tools are on the way",
  emptyBody: "Nothing is listed yet. If there is a job you would like a tool for, tell us about it.",
  emptyButton: "Tell us about it",
  noneInCategory: "No tools in this category yet.",
  tierLabel: {
    browser: "Runs in your browser",
    ai: "Uses AI, with free tries each day",
  },
  open: "Open",
};

/** Words the page shell around every tool uses. Each tool's own copy is in its copy.js. */
export const APP_SHELL = {
  back: "All tools",
  loading: "Loading the tool",
  loadFailedTitle: "The tool did not load",
  loadFailedBody: "Check your connection, then refresh the page.",
  talkEyebrow: "The full version",
  privacyLink: "How we handle your data",
  privacyHref: "/privacy",
  tierLabel: {
    browser: "Runs in your browser",
    ai: "Uses AI",
  },
  metaTitle: (name) => `${name} | Free tool from Jura Solutions`,
};

/** The shared file picker used by tools that take uploads. */
export const FILE_DROP = {
  choose: "Choose files",
  chooseOne: "Choose a file",
  camera: "Take a photo",
  drop: "or drop them here",
  dropOne: "or drop it here",
};

export const EXPORTS = {
  groupLabel: "Download or copy",
  copied: "Copied",
};

/**
 * /privacy. Covers the enquiry form, the toolbox (including the paragraph on
 * AI tools that APP-002 asks for) and the outreach emails the scout sends
 * (scout PRD §5.9: what it collects, why, how to opt out). Every statement
 * here must stay true of the code: change one, change the other.
 */
export const PRIVACY = {
  label: "Privacy",
  heading: "How we handle your data",
  lede: "What this site, its free tools and our emails collect, why, and how to stop it. If anything here is unclear, ask us.",
  updated: "Last updated 25 October 2026",
  sections: [
    {
      heading: "Who we are",
      paragraphs: [
        `Jura Solutions is an automation consultancy in Singapore. For anything about your data, including a request to see, correct or delete what we hold, email ${CONTACT_EMAIL}.`,
      ],
    },
    {
      heading: "The enquiry form",
      paragraphs: [
        "When you send the form, we receive your name, work email and whatever else you choose to add. It reaches our inbox by email, delivered by Resend. We use it to reply to you and for nothing else, and we do not add you to a mailing list.",
        "If you came to the form from one of our free tools, the enquiry also says which tool, so we know what you were looking at.",
      ],
    },
    {
      heading: "Tools that run in your browser",
      paragraphs: [
        "Tools marked “Runs in your browser” do all their work on your device. What you type, and any logo you add, is not sent to us.",
        "If you tick “Remember my business details on this device”, those details are kept in your browser's storage on that device until you untick it. We never see them.",
      ],
    },
    {
      heading: "Tools that use AI",
      paragraphs: [
        "Tools marked “Uses AI” send what you give them, such as photos of receipts, over an encrypted connection to Anthropic's Claude API to be read. Anthropic processes it under its commercial terms and returns the result, which we pass straight back to your browser. We do not store your images, your files or the results, and we do not log what is in them.",
        "To keep the free tries fair, we count how many you have used today. The count is kept against two scrambled codes, one made from your connection's IP address and a random cookie and one from the IP address alone, never against the address itself. The cookie is called jura_vid, holds nothing but that random code, is only sent with the tools' own requests, and expires after a year.",
        "Before a try is sent, Cloudflare Turnstile checks that you are a person and not a bot. It runs on the AI tool pages only.",
      ],
    },
    {
      heading: "Counting visits",
      paragraphs: [
        "We count how many times each tool is opened and used each day, with nothing about who you are.",
        "The site's fonts come from Google Fonts, so your browser connects to Google to fetch them.",
      ],
    },
    {
      heading: "Emails we send to businesses",
      paragraphs: [
        "We send a small number of short, personal emails to Singapore businesses whose work involves a lot of paperwork, to tell them about our free tools. We only write to an address a business publishes for enquiries on its own website, such as info@ or hello@, and to a named person's address only when the business lists it there for enquiries. We do not buy lists or guess addresses.",
        "To choose who to write to, we note the business's name, website, industry and a few things its own website says about how it works, with the pages we read. We send each business one email and, at most, one follow-up.",
        "Every email has a one-click unsubscribe link, which puts the address on our do-not-email list straight away. You can also reply “unsubscribe”, and the address is added by hand, well within ten business days. Either way it stays on the list. Addresses that bounce or report an email as spam go on the same list.",
        "If a business never replies, its details are deleted after two years. We keep the website's domain so we never contact that business again.",
      ],
    },
  ],
};

export const UNSUBSCRIBED = {
  ok: {
    heading: "You're unsubscribed",
    body: `We won't email this address again. If you change your mind, write to ${CONTACT_EMAIL}.`,
  },
  invalid: {
    heading: "That link didn't work",
    body: "It may have been cut short when it was copied. Reply “unsubscribe” to the email instead and we'll take you off our list by hand.",
  },
  error: {
    heading: "That didn't go through",
    body: "Something went wrong on our side. Reply “unsubscribe” to the email and we'll take you off our list by hand.",
  },
  privacy: "How we handle your data",
  home: "Go to the home page",
};

export const NOT_FOUND = {
  heading: "That page is not here",
  body: "The link may be out of date. The toolbox and the home page are both one click away.",
  toToolbox: "Go to the toolbox",
  toHome: "Go to the home page",
};

export const HERO = {
  label: "Automation consultancy",
  heading: "Automate the work nobody should be doing",
  lede:
    "Jura Solutions maps the repetitive parts of how your business runs, then hands them to software. You keep the judgement, the credentials and the off-switch.",
  primary: "Book a discovery call",
  secondary: "See how we work",
  assurances: ["No system replacement", "Documented handover", "You hold the credentials"],
  motionCaption: "A job moving through an automation, start to finish",
  flowSteps: [
    { label: "Trigger", detail: "Invoice arrives" },
    { label: "Read", detail: "Extract the totals" },
    { label: "Act", detail: "Post to the ledger" },
    { label: "Confirm", detail: "Notify finance" },
  ],
};

export const PROBLEM = {
  label: "The reality",
  heading: "Most businesses are held together by manual work",
  lede: "None of it is complicated. That is exactly why it should not be taking your team's week.",
  statements: [
    "The same figures get typed into three systems.",
    "Invoices sit in an inbox until someone remembers them.",
    "Month-end runs on one person and one spreadsheet.",
    "Nobody can say what is late without going to look.",
  ],
};

export const SERVICES = {
  label: "What we do",
  heading: "Four things, done properly",
  lede: "Start with one process. The rest follows only if it earns its place.",
  items: [
    {
      icon: "search-check",
      name: "Process discovery",
      body:
        "We sit with your team, follow the work, and write down what actually happens rather than what the manual says.",
      gets: "A map of the process and a shortlist of what is worth automating.",
    },
    {
      icon: "workflow",
      name: "Workflow automation",
      body:
        "The repetitive steps get handed to software: data entry, filing, chasing, reconciling, reporting.",
      gets: "A running automation, documented, that you can switch off.",
    },
    {
      icon: "plug",
      name: "Systems integration",
      body:
        "Your accounting, CRM, email and spreadsheets stop being separate islands and start passing data between them.",
      gets: "Connections that keep working when your data grows.",
    },
    {
      icon: "life-buoy",
      name: "Support and care",
      body:
        "Processes change. We stay reachable, keep things running, and adjust as your business shifts.",
      gets: "A named person who knows your setup.",
    },
  ],
};

export const HOW = {
  label: "How we work",
  heading: "Slowly at the start, so the rest is quick",
  lede:
    "Most automation fails because nobody agreed what the process was. We spend our first days watching the work. The code comes later.",
  motionCaption: "Approvals stop waiting in inboxes",
  steps: [
    {
      n: "01",
      title: "A conversation",
      body:
        "Half an hour. You describe the work that eats the week. We say honestly whether automation helps.",
    },
    {
      n: "02",
      title: "Discovery",
      body:
        'We follow one process from start to finish and agree what "done" looks like before anything is built.',
    },
    {
      n: "03",
      title: "Build in small pieces",
      body:
        "You see each piece working before we move on. Nothing goes live that you have not watched run.",
    },
    {
      n: "04",
      title: "Handover",
      body:
        "Documentation, credentials and training. You could take it in-house tomorrow if you wanted to.",
    },
  ],
};

export const PROOF = {
  label: "What it looks like",
  heading: "The kind of work we automate",
  lede:
    "Three of the jobs that come up most often. None of them are glamorous, and that is the point.",
  tabs: [
    { id: "paperwork", label: "Paperwork" },
    { id: "systems", label: "Disconnected systems" },
    { id: "visibility", label: "Visibility" },
  ],
  captions: {
    paperwork: "Documents arrive, get read, and end up filed without anyone typing them in",
    systems: "Systems that did not talk, joined at one hub",
    visibility: "Illustrative only. Your board would show your own processes.",
  },
  meterLabel: "of the manual steps in a paperwork process can typically go",
  meterNote:
    "We will not promise a number before we have seen your process. What we can say is that the repetitive part is usually most of it.",
  imageLabel: "screen recording: an invoice automation running",
};

export const TRUST = {
  label: "Working with us",
  heading: "Trust is the whole business",
  lede:
    "We are asking to be let into the systems that run your company. Here is what we do to deserve that.",
  items: [
    {
      icon: "key-round",
      title: "Your credentials stay yours",
      body:
        "Automations run in your environment wherever possible. We never hold logins you cannot see or revoke.",
    },
    {
      icon: "file-text",
      title: "Everything is documented",
      body:
        "Each build ships with a written explanation of what it does, where it runs and how to stop it.",
    },
    {
      icon: "user-round",
      title: "A person, not a ticket queue",
      body: "You work with the same consultant who mapped your process. They pick up the phone.",
    },
    {
      icon: "door-open",
      title: "No lock-in",
      body:
        "If you want to bring it in-house or move on, we hand it over cleanly. That has to be true or none of the rest matters.",
    },
  ],
};

export const FAQ = {
  label: "Questions",
  heading: "The things people ask first",
  lede:
    "If yours is not here, ask it on the call. We would rather talk you out of the wrong project than sell you one.",
  items: [
    {
      question: "How much of a process can actually be automated?",
      answer:
        "It depends on the process. For the paperwork-heavy ones such as invoices, timesheets, onboarding and reporting, it is usually possible to remove 80%+ of the manual steps. The remainder is judgement, and it should stay with a person.",
    },
    {
      question: "How long until something is running?",
      answer:
        "Most first automations go live within weeks of the process being mapped. We deliberately start with one process rather than a programme of work, so you see something real early.",
    },
    {
      question: "Do we have to replace our systems?",
      answer:
        "Almost never. We work with what you already have. Replacing software is expensive and disruptive. Connecting it usually is not.",
    },
    {
      question: "What happens to our data and logins?",
      answer:
        "They stay yours. Credentials live in your accounts, automations run in your environment where possible, and you get the documentation. If you ever want to walk away, nothing is held hostage.",
    },
    {
      question: "Will this cost people their jobs?",
      answer:
        "That is not what we are for. The work we take away is the work nobody wanted: copying, chasing, re-keying. In most teams there is already a longer list of things people would do if they had the time.",
    },
    {
      question: "We are small. Is this worth it?",
      answer:
        "Often more so. A small team feels a few hours a week more sharply than a large one. We will tell you if a spreadsheet fixes it more cheaply than we can.",
    },
  ],
};

export const CONTACT = {
  label: "Start here",
  heading: "Half an hour, no obligation",
  lede:
    "Tell us which process is costing you the most time. We will tell you whether it is worth automating, including when the answer is no.",
  submit: "Book a discovery call",
  note: "We will not add you to a mailing list.",
  successTitle: "Thanks, we have got it",
  successBody: "We reply within one business day.",
  errorTitle: "That did not send",
  errorBody: "Your answers are still here. Try again, or email us directly.",
};

export const FOOTER = {
  tagline: "Automation consultancy",
  columns: [
    {
      head: "Company",
      links: [
        { href: "#how", label: "How we work" },
        { href: "#trust", label: "Working with us" },
        { href: "#faq", label: "Questions" },
        { href: "/apps", label: "Toolbox" },
        { href: "/privacy", label: "Privacy" },
      ],
    },
    {
      head: "Services",
      links: [
        { href: "#services", label: "Process discovery" },
        { href: "#services", label: "Workflow automation" },
        { href: "#services", label: "Systems integration" },
        { href: "#services", label: "Support and care" },
      ],
    },
    {
      head: "Contact",
      links: [{ href: `mailto:${CONTACT_EMAIL}`, label: CONTACT_EMAIL }],
    },
  ],
  base: "© 2026 Jura Solutions",
  place: "Singapore",
};
