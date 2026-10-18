// The logged-in user, fetched once per page load and shared by every component that asks.

import { useEffect, useSyncExternalStore } from "react";

import { getMe } from "./api";
import type { Me } from "./types";

let current: Me | null | undefined; // undefined = not loaded yet
let loading: Promise<Me | null> | null = null;
const listeners = new Set<() => void>();

export function loadMe(force = false): Promise<Me | null> {
  if (force || !loading) {
    loading = getMe()
      .catch(() => null)
      .then((me) => {
        setMe(me);
        return me;
      });
  }
  return loading;
}

export function setMe(me: Me | null) {
  current = me;
  loading = Promise.resolve(me);
  listeners.forEach((l) => l());
}

export function isLoggedIn(): boolean {
  return !!current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * undefined while loading, null when logged out. The server snapshot is always "loading",
 * so server HTML and hydration agree; the real value arrives right after.
 */
export function useMe(): Me | null | undefined {
  const me = useSyncExternalStore(subscribe, () => current, () => undefined);
  useEffect(() => {
    if (current === undefined) void loadMe();
  }, []);
  return me;
}
