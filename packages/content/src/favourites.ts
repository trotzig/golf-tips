// Favourite situations, kept on the reader's device by the site (localStorage) and the app
// (AsyncStorage) under the same key. No dependencies, so a page script can import it cheaply.

export const FAVOURITES_KEY = "shotbook:favourites";

/** Stored favourites, newest first; anything unreadable counts as none. */
export function parseFavourites(stored: string | null): string[] {
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((f): f is string => typeof f === "string") : [];
  } catch {
    return [];
  }
}

/** Favourites with `id` added or removed, newest first. */
export function toggleFavourite(favourites: readonly string[], id: string): string[] {
  return favourites.includes(id) ? favourites.filter((f) => f !== id) : [id, ...favourites];
}
