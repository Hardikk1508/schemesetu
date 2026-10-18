import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { getTopics } from "@/lib/api";
import { getDictionary, pick } from "@/lib/i18n";
import type { Lang } from "@/lib/locales";

import { TopicIcon } from "./topic-icon";

/** Fetches at request time; render inside <Suspense> with <TopicGridSkeleton />. */
export async function TopicGrid({ lang }: { lang: Lang }) {
  const topics = await getTopics();
  const t = getDictionary(lang).topic;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {topics.map((topic, i) => (
        <li key={topic.id} className="animate-rise" style={{ animationDelay: `${i * 50}ms` }}>
          <Link
            href={`/${lang}/topics/${topic.id}`}
            className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-5 shadow-card transition duration-200 hover:-translate-y-1 hover:border-line-strong hover:shadow-pop"
          >
            <span className="flex items-start justify-between gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
                <TopicIcon name={topic.icon} className="size-6" />
              </span>
              <span className="rounded-full bg-paper px-2.5 py-0.5 text-sm font-semibold text-ink-2">
                {t.count(topic.scheme_count)}
              </span>
            </span>
            <span className="mt-4 text-xl leading-snug font-bold">{pick(topic.name, lang)}</span>
            <span className="mt-1.5 text-ink-2">{pick(topic.description, lang)}</span>
            <span className="mt-4 flex flex-wrap gap-1.5">
              {topic.kinds.slice(0, 4).map((k) => (
                <span key={k.kind} className="rounded-md border border-line px-2 py-0.5 text-xs font-semibold text-ink-2">
                  {pick(k.label, lang)}
                </span>
              ))}
            </span>
            <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold text-brand">
              {t.explore}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function TopicGridSkeleton() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="h-60 animate-pulse rounded-2xl border border-line bg-surface/70" />
      ))}
    </ul>
  );
}
