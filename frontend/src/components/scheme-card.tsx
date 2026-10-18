import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { getDictionary, pick, schemeName } from "@/lib/i18n";
import type { Lang } from "@/lib/locales";
import type { LocalizedText, Scheme } from "@/lib/types";

/** One scheme in a grid. Used by server pages and the client-side explorer. */
export function SchemeCard({
  scheme,
  lang,
  kindLabel,
  index = 0,
}: {
  scheme: Scheme;
  lang: Lang;
  kindLabel?: LocalizedText;
  index?: number;
}) {
  const t = getDictionary(lang);
  return (
    <li className="animate-rise" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
      <Link
        href={`/${lang}/schemes/${scheme.id}`}
        className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-5 shadow-card transition duration-200 hover:-translate-y-1 hover:border-line-strong hover:shadow-pop"
      >
        <span className="text-xs font-semibold tracking-wide text-brand uppercase">
          {kindLabel ? pick(kindLabel, lang) : t.scheme.level[scheme.level]}
        </span>
        <span className="mt-1.5 text-lg leading-snug font-bold">{schemeName(scheme, lang)}</span>
        <span className="mt-2 line-clamp-3 text-ink-2">{pick(scheme.benefit, lang)}</span>
        <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-brand">
          {t.results.details}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
}

export const schemeGridClass = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";
