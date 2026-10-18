import { Info } from "lucide-react";

import { getDictionary } from "@/lib/i18n";
import type { Lang } from "@/lib/locales";

/** Shown whenever any scheme on the page has unverified rules. */
export function DataNote({ lang, className = "" }: { lang: Lang; className?: string }) {
  const t = getDictionary(lang).dataNote;
  return (
    <aside
      className={`flex gap-3 rounded-xl border border-wait-line bg-wait-soft px-4 py-3 text-sm text-ink-2 ${className}`}
    >
      <Info className="mt-0.5 size-5 shrink-0 text-wait" aria-hidden="true" />
      <div>
        <p className="font-semibold text-ink">{t.title}</p>
        <p>{t.body}</p>
      </div>
    </aside>
  );
}
