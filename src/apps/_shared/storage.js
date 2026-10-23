/**
 * localStorage that never throws. Storage can be blocked (private modes,
 * strict privacy settings, sandboxed frames) or full, and the tools must keep
 * working in all of those cases, so every access is wrapped.
 */
export function readStored(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Returns false when the value could not be stored. */
export function writeStored(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStored(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to do: if storage is blocked there is nothing stored either.
  }
}
