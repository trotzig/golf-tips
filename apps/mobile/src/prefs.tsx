import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_READER,
  DISTANCE_UNITS,
  FAVOURITES_KEY,
  forReader,
  HANDEDNESS,
  parseFavourites,
  toggleFavourite,
  WIND_UNITS,
  type Reader,
} from "@shotbook/content";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

// Reader preferences, stored on the device: which hand they play with, the units they measure
// distance and wind in, and favourite situations. Keys match the site's localStorage.

const READER_KEYS = { hand: "shotbook:hand", distance: "shotbook:distance", wind: "shotbook:wind" };
const ALLOWED: { [K in keyof Reader]: readonly Reader[K][] } = {
  hand: HANDEDNESS,
  distance: DISTANCE_UNITS,
  wind: WIND_UNITS,
};

interface Prefs extends Reader {
  setPref<K extends keyof Reader>(pref: K, value: Reader[K]): void;
  favourites: string[];
  isFavourite(id: string): boolean;
  toggleFavourite(id: string): void;
}

const PrefsContext = createContext<Prefs | null>(null);

/** Renders nothing until stored preferences are read, so directions never flip after showing. */
export function PrefsProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [reader, setReader] = useState<Reader>(DEFAULT_READER);
  const [favourites, setFavourites] = useState<string[]>([]);

  useEffect(() => {
    const prefs = Object.keys(READER_KEYS) as Array<keyof Reader>;
    Promise.all([
      AsyncStorage.multiGet(prefs.map((pref) => READER_KEYS[pref])),
      AsyncStorage.getItem(FAVOURITES_KEY),
    ])
      .then(([stored, storedFavourites]) => {
        const saved: Partial<Record<keyof Reader, string>> = {};
        prefs.forEach((pref, i) => {
          const value = stored[i]?.[1];
          if (value && (ALLOWED[pref] as readonly string[]).includes(value)) saved[pref] = value;
        });
        setReader({ ...DEFAULT_READER, ...(saved as Partial<Reader>) });
        setFavourites(parseFavourites(storedFavourites));
      })
      .catch(() => {
        // Unreadable storage: start with the defaults.
      })
      .finally(() => setLoaded(true));
  }, []);

  const setPref = useCallback(<K extends keyof Reader>(pref: K, value: Reader[K]) => {
    setReader((current) => ({ ...current, [pref]: value }));
    void AsyncStorage.setItem(READER_KEYS[pref], value);
  }, []);

  const toggle = useCallback((id: string) => {
    setFavourites((current) => {
      const next = toggleFavourite(current, id);
      void AsyncStorage.setItem(FAVOURITES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo<Prefs>(
    () => ({
      ...reader,
      setPref,
      favourites,
      isFavourite: (id) => favourites.includes(id),
      toggleFavourite: toggle,
    }),
    [reader, setPref, favourites, toggle],
  );

  if (!loaded) return null;
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): Prefs {
  const prefs = useContext(PrefsContext);
  if (!prefs) throw new Error("usePrefs must be used inside <PrefsProvider>");
  return prefs;
}

/** Resolves direction (`{left}`) and measurement (`{15 yd}`) tokens for the reader. */
export function useHanded(): (text: string) => string {
  const { hand, distance, wind } = usePrefs();
  return useCallback(
    (text: string) => forReader(text, { hand, distance, wind }),
    [hand, distance, wind],
  );
}
