/**
 * Browser storage that never throws. Storage can be blocked (private modes,
 * strict privacy settings, sandboxed frames) or full, and the tools must keep
 * working in all of those cases, so every access is wrapped.
 *
 * `readStored` and friends use localStorage, which lasts on the device.
 * `readSession` and friends use sessionStorage, which lasts for the tab.
 */
const AREAS = { local: "localStorage", session: "sessionStorage" };

function read(area, key) {
  try {
    const raw = window[AREAS[area]].getItem(key);
    return raw == null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function write(area, key, value) {
  try {
    window[AREAS[area]].setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function remove(area, key) {
  try {
    window[AREAS[area]].removeItem(key);
  } catch {
    // Nothing to do: if storage is blocked there is nothing stored either.
  }
}

export const readStored = (key) => read("local", key);

/** Returns false when the value could not be stored. */
export const writeStored = (key, value) => write("local", key, value);

export const removeStored = (key) => remove("local", key);

export const readSession = (key) => read("session", key);

/** Returns false when the value could not be stored, for example when it is too big. */
export const writeSession = (key, value) => write("session", key, value);

export const removeSession = (key) => remove("session", key);
