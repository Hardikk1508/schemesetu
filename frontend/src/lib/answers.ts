// Answers shared by the step-by-step check and the chat assistant.
// Kept in sessionStorage (this tab only), and mirrored to the account when logged in.

import { saveAnswers } from "./api";
import { isLoggedIn } from "./account";
import type { Profile, ProfileValue } from "./types";

/** history: fields in the order they were first answered or skipped (drives Back in the checker). */
export type Answers = { profile: Profile; skipped: string[]; history: string[] };
export type Saved = { answers: Answers; onResults: boolean };

export const EMPTY_ANSWERS: Answers = { profile: {}, skipped: [], history: [] };

const STORAGE_KEY = "schemesetu.checker.v1";

export function loadSaved(): Saved | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
    const a = v?.answers;
    if (a && typeof a.profile === "object" && Array.isArray(a.skipped) && Array.isArray(a.history)) {
      return { answers: a, onResults: v.onResults === true };
    }
  } catch {}
  return null;
}

let syncTimer: ReturnType<typeof setTimeout> | undefined;

/** Save locally; when logged in, also save to the account (debounced, best effort). */
export function persistAnswers(answers: Answers | null, onResults = false) {
  try {
    if (answers && answers.history.length > 0) {
      const saved: Saved = { answers, onResults };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
  if (answers && isLoggedIn()) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => void saveAnswers(answers.profile, answers.skipped).catch(() => {}), 800);
  }
}

/** Drop nulls the API sends back, so the profile only holds real answers. */
export function cleanProfile(profile: Partial<Record<string, ProfileValue | null>>): Profile {
  return Object.fromEntries(Object.entries(profile).filter(([, v]) => v !== null && v !== undefined)) as Profile;
}

/** Answers built from a saved profile (e.g. loaded from the account), in a stable field order. */
export function answersFrom(profile: Profile, skipped: string[]): Answers {
  const clean = cleanProfile(profile);
  return { profile: clean, skipped, history: [...Object.keys(clean), ...skipped.filter((f) => !(f in clean))] };
}
