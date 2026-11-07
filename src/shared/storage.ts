/** Small preferences in localStorage. Storage can be missing or throw (private mode, blocked site data), so every access falls back. */

/** A saved on/off preference; false when nothing is saved or storage is unavailable. */
export function loadFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/** Saves an on/off preference; without storage it lasts until the page reloads. */
export function saveFlag(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? "1" : "0");
  } catch {
    // the in-memory value still holds for this visit
  }
}
