// Client-side scheme search. The catalogue is small (tens of schemes), so we index it
// in the browser and match as the user types, in English, Hindi or Hinglish.

import type { Kind, KindInfo, Scheme, Topic } from "./types";

// Everyday words people use for each kind of scheme, including Hinglish spellings.
const KIND_WORDS: Record<Kind, string> = {
  scholarship: "scholarship scholarships chhatravritti chatravriti chhatrvritti vazifa wazifa fees padhai",
  internship: "internship intern job naukri kaam work stipend",
  apprenticeship: "apprentice apprenticeship training job naukri stipend",
  skill_training: "skill skills training course kaushal job naukri certificate",
  education_loan: "loan education study padhai rin karz karza",
  business_loan: "loan business vyapar vyavsay dukaan dukan shop rin karz karza",
  startup_funding: "startup funding grant seed fund",
  income_support: "money cash paisa income kisan",
  pension: "pension budhapa old age retirement",
  insurance: "insurance bima cover",
  health_cover: "health hospital ilaj treatment ayushman card",
  savings: "savings bachat account",
  housing: "house home ghar makan makaan awas",
  household: "gas lpg cylinder chulha",
  maternity: "pregnancy pregnant maternity baby mother maa",
};

const TOPIC_WORDS: Record<string, string> = {
  students: "student students chhatra college school university padhai youth yuva",
  jobs: "job jobs naukri rozgar employment work kaam",
  business: "business vyapar dukaan shop startup udyam",
  farmers: "farmer farmers kisan kheti agriculture",
  women: "women woman girl girls mahila beti betiyan ladki",
  seniors: "senior old elderly budhe buzurg vriddh",
  health: "health hospital ilaj swasthya",
  housing: "house home ghar awas",
  pension: "pension savings bachat",
};

export type SearchEntry = { scheme: Scheme; title: string; tags: string; body: string };

/** Lowercase, and drop Latin accents so "ज़" vs "ज" and "é" vs "e" don't block a match. */
function norm(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-़ͯ]/g, "");
}

export function buildIndex(schemes: Scheme[], kinds: KindInfo[], topics: Topic[]): SearchEntry[] {
  const kindLabels = new Map(kinds.map((k) => [k.kind, k.label]));
  const topicsById = new Map(topics.map((t) => [t.id, t]));
  return schemes.map((s) => {
    const kind = kindLabels.get(s.kind);
    const schemeTopics = s.topics.map((id) => topicsById.get(id)).filter((t) => t !== undefined);
    return {
      scheme: s,
      title: norm(`${s.name} ${s.name_hi} ${s.id.replace(/_/g, " ")}`),
      tags: norm(
        [kind?.en, kind?.hi, KIND_WORDS[s.kind], ...schemeTopics.flatMap((t) => [t.name.en, t.name.hi, TOPIC_WORDS[t.id]])]
          .filter(Boolean)
          .join(" "),
      ),
      body: norm(`${s.benefit.en} ${s.benefit.hi} ${s.ministry} ${s.ministry_hi ?? ""} ${s.notes?.en ?? ""} ${s.notes?.hi ?? ""}`),
    };
  });
}

/**
 * Every word of the query must appear somewhere. Matches in the name count most,
 * then the scheme's kind and topics, then the benefit text.
 */
export function search(index: SearchEntry[], query: string): Scheme[] {
  const terms = norm(query)
    .split(/[\s,]+/)
    .filter((t) => t.length > 1 || /[ऀ-ॿ]/.test(t));
  if (terms.length === 0) return [];
  const hits: { score: number; scheme: Scheme }[] = [];
  for (const entry of index) {
    let score = 0;
    for (const term of terms) {
      const s = entry.title.includes(term) ? 3 : entry.tags.includes(term) ? 2 : entry.body.includes(term) ? 1 : 0;
      if (s === 0) {
        score = 0;
        break;
      }
      score += s;
    }
    if (score > 0) hits.push({ score, scheme: entry.scheme });
  }
  return hits.sort((a, b) => b.score - a.score).map((h) => h.scheme);
}
