/**
 * Every word PDF merge and split uses.
 *
 * The PRD's copy (prd-app-003-pdf-merge-and-split-2026-10-24.md §5.2) is used
 * verbatim. The few strings the PRD does not cover (screen reader labels, the
 * range errors other than "pages aren't in this file", a failed merge) follow
 * design-system/README.md §3.
 *
 * File names the tool writes (`files`) are the visitor's, not Jura's.
 */
export default {
  title: "PDF merge and split",
  subtitle: "Join your PDFs into one file, or pull out the pages you need, without uploading them anywhere.",
  privacy: "Your files stay in your browser. Nothing is uploaded to us.",
  talk: {
    heading: "Document bundles put together for you",
    body: "We can gather your documents from email, folders or your job system and assemble each bundle the same way every time.",
    button: "Tell us about your paperwork",
  },

  tabs: {
    label: "Merge or split",
    merge: "Merge",
    split: "Split",
  },

  merge: {
    dropLabel: "Drop your PDFs here, or choose files",
    helper: "Add up to 20 files, under 50 MB in total. Drag to change the order.",
    listLabel: "Files to merge, in order",
    nameLabel: "Name for the new file",
    leftOut: "Files with a problem are left out. Remove them, or fix them and add them again.",
    moved: (name, position, total) => `${name} is now file ${position} of ${total}.`,
  },

  split: {
    dropLabel: "Drop a PDF here, or choose a file",
    rangeLabel: "Pages to keep",
    rangeHelper: "Use commas between pages and a dash for a run of pages.",
    rangePlaceholder: "1-3, 5",
    pagesLabel: "Pages in this file",
    page: (n) => `Page ${n}`,
  },

  empty: "Add a PDF to get started.",
  pageCount: (n) => (n === 1 ? "1 page" : `${n} pages`),
  checking: "Checking the file…",

  buttons: {
    choose: "Choose files",
    moveUp: "Move up",
    moveDown: "Move down",
    remove: "Remove",
    merge: "Merge and download",
    downloadSelected: "Download selected pages",
    splitAll: "Split into single pages",
    startAgain: "Start again",
  },

  done: "Your file is ready. Check your downloads.",
  working: "Putting your file together…",

  errors: {
    encrypted: "This PDF is password protected. Remove the password in your PDF reader, then add it again.",
    damaged: "We couldn't read this PDF. It may be damaged.",
    notPdf: "This file isn't a PDF.",
    tooLarge: "These files are over 50 MB together. Try fewer files at a time.",
    tooLargeOne: "This file is over 50 MB. Try a smaller one.",
    tooMany: "You can add up to 20 files at a time.",
    badRange: (n) => `Some of those pages aren't in this file. It has ${n === 1 ? "1 page" : `${n} pages`}.`,
    rangeEmpty: "Type the pages you want to keep.",
    rangeFormat: "Use page numbers, commas and dashes only, like 1-3, 5.",
    rangeReversed: "Write each run of pages from low to high, like 3-5.",
    failed: "We couldn't put your file together. Try again, or try fewer files.",
  },

  files: {
    merged: "merged",
    selected: "selected",
    pages: "pages",
  },
};
