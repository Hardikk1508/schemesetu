"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { getDictionary, pick } from "@/lib/i18n";
import type { Lang } from "@/lib/locales";
import { buildIndex, search } from "@/lib/search";
import type { KindInfo, Scheme, Topic } from "@/lib/types";

import { DataNote } from "./data-note";
import { SchemeCard, schemeGridClass } from "./scheme-card";
import { TopicIcon } from "./topic-icon";

type Props = {
  lang: Lang;
  schemes: Scheme[];
  kinds: KindInfo[];
  topics: Topic[];
  initialQuery: string;
  initialTopic: string | null;
};

/** Search box plus topic filter over the whole catalogue, kept in the URL (?q=&topic=). */
export function SchemeExplorer({ lang, schemes, kinds, topics, initialQuery, initialTopic }: Props) {
  const t = getDictionary(lang);
  const [query, setQuery] = useState(initialQuery);
  const [topic, setTopic] = useState<string | null>(initialTopic);
  const index = useMemo(() => buildIndex(schemes, kinds, topics), [schemes, kinds, topics]);
  const labels = useMemo(() => new Map(kinds.map((k) => [k.kind, k.label])), [kinds]);

  const visible = useMemo(() => {
    const matched = query.trim() ? search(index, query) : schemes;
    return topic ? matched.filter((s) => s.topics.includes(topic)) : matched;
  }, [index, schemes, query, topic]);

  function update(nextQuery: string, nextTopic: string | null) {
    setQuery(nextQuery);
    setTopic(nextTopic);
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextTopic) params.set("topic", nextTopic);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }

  const chip = (selected: boolean) =>
    `inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
      selected ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink-2 hover:border-ink-3 hover:text-ink"
    }`;

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 rounded-2xl border-2 border-line-strong bg-surface px-4 shadow-card focus-within:border-brand">
        <Search className="size-5 shrink-0 text-ink-3" aria-hidden="true" />
        <input
          type="search"
          aria-label={t.search.label}
          placeholder={t.search.placeholder}
          value={query}
          onChange={(e) => update(e.target.value, topic)}
          autoComplete="off"
          enterKeyHint="search"
          className="min-h-14 w-full min-w-0 bg-transparent text-lg outline-none placeholder:text-ink-3 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            aria-label={t.search.clear}
            onClick={() => update("", topic)}
            className="grid size-8 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-paper hover:text-ink"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label={t.topic.allTopics}>
        <button type="button" aria-pressed={!topic} onClick={() => update(query, null)} className={chip(!topic)}>
          {t.search.all}
        </button>
        {topics.map((tp) => (
          <button
            key={tp.id}
            type="button"
            aria-pressed={topic === tp.id}
            onClick={() => update(query, topic === tp.id ? null : tp.id)}
            className={chip(topic === tp.id)}
          >
            <TopicIcon name={tp.icon} className="size-4" />
            {pick(tp.name, lang)}
          </button>
        ))}
      </div>

      <p className="mt-4 mb-4 font-semibold text-ink-2" aria-live="polite">
        {t.search.results(visible.length)}
      </p>

      {schemes.some((s) => !s.verified) && <DataNote lang={lang} className="mb-6" />}

      {visible.length === 0 ? (
        <div className="animate-fade rounded-2xl border border-dashed border-line-strong bg-surface/60 px-6 py-12 text-center">
          <p className="text-lg font-semibold">{t.search.none(query.trim())}</p>
          <p className="mt-1 text-ink-3">{t.search.tryWords}</p>
          <button
            type="button"
            onClick={() => update("", null)}
            className="mt-5 rounded-full bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-strong"
          >
            {t.search.reset}
          </button>
        </div>
      ) : (
        <ul className={schemeGridClass}>
          {visible.map((s, i) => (
            <SchemeCard key={s.id} scheme={s} lang={lang} kindLabel={labels.get(s.kind)} index={i} />
          ))}
        </ul>
      )}
    </div>
  );
}
