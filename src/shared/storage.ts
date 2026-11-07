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
