import React from "react";
import { Tabs } from "../../ds.js";
import { MergePanel } from "./MergePanel.jsx";
import { SplitPanel } from "./SplitPanel.jsx";
import "./pdf-merge-and-split.css";

// pdf-lib and fflate come with pdf.js (this folder's module, not the
// library): fetched when the first file is added, and warmed up once the page
// is idle so the first file is quick. pdf.js the library is fetched only for
// Split's thumbnails (thumbs.js).
const loadPdf = () => import("./pdf.js");

const TABS = ["merge", "split"];
const STEP = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * APP-003. Two tabs on one page. Both panels stay mounted, so switching tabs
 * keeps what was added to each. File bytes live in React state only and are
 * dropped on "Start again" or when the visitor leaves the page.
 */
export default function PdfMergeAndSplit({ app, copy }) {
  const [tab, setTab] = React.useState("merge");
  const tabsRef = React.useRef(null);

  React.useEffect(() => {
    const warm = () => loadPdf().catch(() => {});
    const handle = "requestIdleCallback" in window ? window.requestIdleCallback(warm) : setTimeout(warm, 1500);
    return () => ("cancelIdleCallback" in window ? window.cancelIdleCallback(handle) : clearTimeout(handle));
  }, []);

  // The design system's Tabs draws plain role="tab" buttons. Finish the tab
  // pattern here: each tab names its panel, and only the selected tab is in
  // the Tab order (the arrow keys move between them).
  React.useEffect(() => {
    tabsRef.current?.querySelectorAll('[role="tab"]').forEach((button, i) => {
      button.id = `pm-tab-${TABS[i]}`;
      button.setAttribute("aria-controls", `pm-panel-${TABS[i]}`);
      button.tabIndex = TABS[i] === tab ? 0 : -1;
    });
  }, [tab]);

  const onKeyDown = (event) => {
    const last = TABS.length - 1;
    const at = TABS.indexOf(tab);
    const next =
      event.key === "Home" ? 0 : event.key === "End" ? last : event.key in STEP ? (at + STEP[event.key] + TABS.length) % TABS.length : null;
    if (next === null) return;
    event.preventDefault();
    setTab(TABS[next]);
    tabsRef.current?.querySelectorAll('[role="tab"]')[next]?.focus();
  };

  return (
    <div className="pm stack-6">
      <div className="pm-tabs" ref={tabsRef} onKeyDown={onKeyDown}>
        <Tabs
          aria-label={copy.tabs.label}
          tabs={[
            { id: "merge", label: copy.tabs.merge },
            { id: "split", label: copy.tabs.split },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      <div id="pm-panel-merge" role="tabpanel" aria-label={copy.tabs.merge} hidden={tab !== "merge"}>
        <MergePanel app={app} copy={copy} loadPdf={loadPdf} />
      </div>
      <div id="pm-panel-split" role="tabpanel" aria-label={copy.tabs.split} hidden={tab !== "split"}>
        <SplitPanel app={app} copy={copy} loadPdf={loadPdf} />
      </div>
    </div>
  );
}
