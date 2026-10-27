# 4. The saved quote file's version rises when a new field changes the printed total

Date: 2026-10-27
Status: accepted
Context: APP-001b Quote builder, prices that include GST (`.scratch/quote-gst-inclusive/reviews/technical.md`)

## Context

The saved quote file is plain JSON with a format marker and a version. Opening a file keeps only
the fields the app knows and drops the rest. An older copy of the app, such as a tab left open
from before a deploy, would therefore open a file carrying the new `gst.inclusive` choice, drop
it, and print a different total from the same file. The reader accepts every version from 1 up to
its own.

## Decision

`FILE_VERSION` rises to 2 with `gst.inclusive`. The current app always writes version 2 and a
boolean `inclusive`. It opens versions 1 and 2, and refuses 0, 3 and above, and anything that is
not a whole number. An older copy of the app refuses a version 2 file, because its check is
`version > FILE_VERSION`.

`inclusive` is read as `g.inclusive === true` whatever the file's version, the same rule as
`gst.on`. A version 1 file has no such field and opens as exclusive. A damaged value (`"yes"`, `1`,
`null`) opens as exclusive and never refuses the file. A field that cannot change a printed
figure does not need a new version.

## Consequences

- A stale tab or cached copy fails loudly on a new file instead of printing a wrong total quietly.
  Its message ("That file doesn't look like a quote saved from this tool") is misleading, but it
  reaches only a visitor with an old copy.
- Files saved from version 2 on cannot be opened by an app older than this change. Rolling the
  change back means those files are refused rather than mis-read, which is the intended failure.
- A stale tab can still write a version 1 file without the field. That file opens as exclusive,
  which is what it was.
- The remembered business details in `localStorage` keep their key (`jura.quote-builder.business.v1`):
  adding a field is backward compatible there, and the restore path reads `inclusive` with the same
  `=== true` rule (`readGst` in `model.js`).

## Rejected

- Keeping the version at 1 and making `inclusive` optional: an older copy would open the file and
  drop the choice without saying so.
- Reading an unknown `inclusive` value as an error: the PRD wants a damaged value to re-open as
  exclusive, so a file never becomes unreadable over one field.

Hard to reverse because saved files exist on visitors' machines.
