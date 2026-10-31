import AsyncStorage from "@react-native-async-storage/async-storage";
import { forHand, type Handedness } from "@shotbook/content";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { toggleFavourite } from "./lib/text";

// Reader preferences, stored on the device: which hand they play with, and favourite situations.

const HAND_KEY = "shotbook:hand";
const FAVOURITES_KEY = "shotbook:favourites";

interface Prefs {
  hand: Handedness;
  setHand(hand: Handedness): void;
  favourites: string[];
  isFavourite(id: string): boolean;
  toggleFavourite(id: string): void;
}

const PrefsContext = createContext<Prefs | null>(null);

/** Renders nothing until stored preferences are read, so directions never flip after showing. */
export function PrefsProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [hand, setHandState] = useState<Handedness>("right");
  const [favourites, setFavourites] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(HAND_KEY), AsyncStorage.getItem(FAVOURITES_KEY)])
      .then(([storedHand, storedFavourites]) => {
        if (storedHand === "left" || storedHand === "right") setHandState(storedHand);
        if (storedFavourites) {
          const parsed: unknown = JSON.parse(storedFavourites);
          if (Array.isArray(parsed)) setFavourites(parsed.filter((f) => typeof f === "string"));
        }
      })
      .catch(() => {
        // Unreadable storage: start with the defaults.
      })
      .finally(() => setLoaded(true));
  }, []);

  const setHand = useCallback((next: Handedness) => {
    setHandState(next);
    void AsyncStorage.setItem(HAND_KEY, next);
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
      hand,
      setHand,
      favourites,
      isFavourite: (id) => favourites.includes(id),
      toggleFavourite: toggle,
    }),
    [hand, setHand, favourites, toggle],
  );

  if (!loaded) return null;
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): Prefs {
  const prefs = useContext(PrefsContext);
  if (!prefs) throw new Error("usePrefs must be used inside <PrefsProvider>");
  return prefs;
}

/** Resolves `{left}`/`{right}` tokens for the reader's hand. */
export function useHanded(): (text: string) => string {
  const { hand } = usePrefs();
  return useCallback((text: string) => forHand(text, hand), [hand]);
}
