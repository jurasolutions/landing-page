import React from "react";

/**
 * Keeping keyboard focus where the visitor was working. A focused control
 * that turns disabled, or that moves to a place where it is disabled, drops
 * focus to the page: screen readers lose their place, and some browsers
 * start the next Tab from the top.
 */

/**
 * Focuses `element` again when focus has fallen to the page (or to nothing)
 * meanwhile. Leaves it alone if the visitor has moved on, or if the element
 * is gone or still disabled. Returns whether it moved focus.
 */
export function returnFocus(element, doc = globalThis.document) {
  if (!element || !doc || !element.isConnected || element.disabled) return false;
  const active = doc.activeElement;
  if (active && active !== doc.body) return false;
  element.focus();
  return true;
}

/**
 * In a row of buttons marked `data-action`, focuses the one for `action`, or
 * the row's first enabled button when that one is now disabled (an item moved
 * to the top has no "Move up"). Returns whether anything took focus.
 */
export function focusAction(row, action) {
  if (!row) return false;
  const wanted = row.querySelector(`[data-action="${action}"]`);
  const button = wanted && !wanted.disabled ? wanted : row.querySelector("button:not([disabled])");
  if (!button) return false;
  button.focus();
  return true;
}

/**
 * For a control that is disabled while its work runs (a download being put
 * together). Call the returned `hold` as the work starts; when `busy` turns
 * false again and the control is enabled, focus goes back to it, if it had
 * fallen to the page in the meantime.
 */
export function useFocusReturn(busy) {
  const held = React.useRef(null);
  React.useEffect(() => {
    if (busy) return;
    const element = held.current;
    held.current = null;
    returnFocus(element);
  }, [busy]);
  return React.useCallback(() => {
    held.current = globalThis.document?.activeElement ?? null;
  }, []);
}
