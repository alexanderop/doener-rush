/**
Browser storage that never throws. Private windows, blocked site data and a full quota make every call a no-op, so the game plays on without a save.
*/
import { Option } from "effect";

/**
The stored string, or none when the key is absent or storage is unavailable.
*/
export function readStorage(key: string): Option.Option<string> {
  try {
    return Option.fromNullishOr(localStorage.getItem(key));
  } catch {
    return Option.none();
  }
}

/** Writes a value; does nothing when storage is unavailable or full. */
export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage blocked or full: the value is forgotten
  }
}

/** A saved on/off preference; false when nothing is saved or storage is unavailable. */
export function loadFlag(key: string): boolean {
  return Option.getOrElse(readStorage(key), () => "0") === "1";
}

/** Saves an on/off preference; without storage it lasts until the page reloads. */
export function saveFlag(key: string, on: boolean): void {
  writeStorage(key, on ? "1" : "0");
}
