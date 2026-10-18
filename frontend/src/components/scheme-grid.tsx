import { getKinds, getSchemes } from "@/lib/api";
import { pick } from "@/lib/i18n";
import type { Lang } from "@/lib/locales";
import type { Kind, Scheme } from "@/lib/types";

import { DataNote } from "./data-note";
import { SchemeCard, schemeGridClass } from "./scheme-card";

/** Kinds in order of how many schemes they have, ties by first appearance. */
function byKind(schemes: Scheme[]): [Kind, Scheme[]][] {
  const groups = new Map<Kind, Scheme[]>();
  for (const s of schemes) groups.set(s.kind, [...(groups.get(s.kind) ?? []), s]);
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
}

/** Schemes of one topic, grouped by kind. Fetches at request time; render inside <Suspense>. */
export async function SchemesByKind({ lang, topic }: { lang: Lang; topic: string }) {
  const [{ schemes }, kinds] = await Promise.all([getSchemes(topic), getKinds()]);
  const labels = new Map(kinds.map((k) => [k.kind, k.label]));
  return (
    <>
      {schemes.some((s) => !s.verified) && <DataNote lang={lang} className="mb-8" />}
      <div className="space-y-10">
        {byKind(schemes).map(([kind, group]) => (
          <section key={kind} aria-labelledby={`kind-${kind}`}>
            <h2 id={`kind-${kind}`} className="flex items-baseline gap-2 text-xl font-bold">
              {labels.get(kind) ? pick(labels.get(kind)!, lang) : kind}
              <span className="text-base font-semibold text-ink-3">{group.length}</span>
            </h2>
            <ul className={`mt-4 ${schemeGridClass}`}>
              {group.map((s, i) => (
                <SchemeCard key={s.id} scheme={s} lang={lang} index={i} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

export function SchemeGridSkeleton({ heading = false }: { heading?: boolean }) {
  return (
    <div aria-hidden="true">
      {heading && <div className="mt-2 mb-6 h-12 animate-pulse rounded-2xl bg-surface/70" />}
      <ul className={`mt-8 ${schemeGridClass}`}>
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="h-44 animate-pulse rounded-2xl border border-line bg-surface/70" />
        ))}
      </ul>
    </div>
  );
}

