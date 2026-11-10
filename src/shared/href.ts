/**
 * An in-app path under the base the build is served from, so a plain `<a>`
 * works when the game is hosted in a subdirectory (GitHub Pages).
 */
export function appHref(path: `/${string}`): string {
  return import.meta.env.BASE_URL.replace(/\/$/, "") + path;
}
