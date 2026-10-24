import React from "react";
import { isPasswordError, openThumbnails } from "./thumbs.js";

/**
 * A grid of page thumbnails for the split view. Every page gets a placeholder
 * of the right shape straight away (sizes come from readPdf); a page is drawn
 * only when its placeholder comes near the screen, so a 200-page file opens
 * as quickly as a two-page one. If pdf.js cannot draw the file, the numbered
 * placeholders stay and the rest of the tool still works.
 */
export function Thumbnails({ buffer, pages, copy, onPassword }) {
  const [viewer, setViewer] = React.useState(null);
  const [drawn, setDrawn] = React.useState({});
  const listRef = React.useRef(null);
  const onPasswordRef = React.useRef(onPassword);
  onPasswordRef.current = onPassword;

  React.useEffect(() => {
    let alive = true;
    let opened = null;
    setDrawn({});
    openThumbnails(buffer)
      .then((value) => {
        if (alive) {
          opened = value;
          setViewer(value);
        } else value.close();
      })
      .catch((error) => {
        if (alive && isPasswordError(error)) onPasswordRef.current?.();
      });
    return () => {
      alive = false;
      opened?.close();
      setViewer(null);
    };
  }, [buffer]);

  // Release every drawn thumbnail when the file goes.
  const drawnRef = React.useRef(drawn);
  drawnRef.current = drawn;
  React.useEffect(() => () => Object.values(drawnRef.current).forEach((url) => URL.revokeObjectURL(url)), [buffer]);

  React.useEffect(() => {
    const list = listRef.current;
    if (!viewer || !list) return undefined;
    const draw = (pageNumber) =>
      viewer
        .draw(pageNumber)
        .then((url) => url && setDrawn((current) => ({ ...current, [pageNumber]: url })))
        .catch(() => {});

    if (typeof IntersectionObserver === "undefined") {
      pages.slice(0, 12).forEach((_, i) => draw(i + 1));
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          draw(Number(entry.target.dataset.page));
        }
      },
      { rootMargin: "300px 0px" }
    );
    list.querySelectorAll("[data-page]").forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [viewer, pages]);

  return (
    <ol ref={listRef} className="pm-thumbs" aria-label={copy.split.pagesLabel}>
      {pages.map((page, i) => {
        const n = i + 1;
        return (
          <li key={n} className="pm-thumb" data-page={n}>
            <span className="pm-thumb-frame" style={{ aspectRatio: `${page.width} / ${page.height}` }}>
              {drawn[n] && <img src={drawn[n]} alt="" decoding="async" className="pm-thumb-image" />}
            </span>
            <span className="pm-thumb-label">{copy.split.page(n)}</span>
          </li>
        );
      })}
    </ol>
  );
}
