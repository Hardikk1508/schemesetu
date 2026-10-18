import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Checker } from "@/components/checker/checker";
import { TopicIcon } from "@/components/topic-icon";
import { checkEligibility, getFields, getTopics } from "@/lib/api";
import { getDictionary, pick } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import type { Lang } from "@/lib/locales";
import type { Topic } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLang()).nav.check };
}

export default async function CheckPage({ searchParams }: PageProps<"/[lang]/check">) {
  const lang = await getLang();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
      <h1 className="mb-4 text-sm font-semibold tracking-wide text-brand uppercase">{getDictionary(lang).nav.check}</h1>
      <Suspense fallback={<CheckerSkeleton />}>
        <CheckerLoader lang={lang} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CheckerLoader({
  lang,
  searchParams,
}: {
  lang: Lang;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, topics] = await Promise.all([searchParams, getTopics()]);
  const topic = typeof params.topic === "string" && topics.some((t) => t.id === params.topic) ? params.topic : null;
  // The starting state (nothing answered) comes from the backend too, so the first question renders on the server.
  const [fields, initial] = await Promise.all([getFields(), checkEligibility({ profile: {}, skipped: [], topic })]);
  return (
    <>
      <TopicChips lang={lang} topics={topics} current={topic} />
      {/* Keyed by topic: switching topic starts a fresh check that reuses the answers saved in this tab. */}
      <Checker key={topic ?? "all"} lang={lang} fields={fields} initial={initial} topic={topic} />
    </>
  );
}

function TopicChips({ lang, topics, current }: { lang: Lang; topics: Topic[]; current: string | null }) {
  const t = getDictionary(lang).topic;
  const chip = (selected: boolean) =>
    `inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
      selected ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink-2 hover:border-ink-3 hover:text-ink"
    }`;
  return (
    <nav aria-label={t.checking} className="-mx-4 mb-6 flex items-center gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
      <span className="shrink-0 text-sm text-ink-3">{t.checking}:</span>
      <Link href={`/${lang}/check`} aria-current={current === null ? "page" : undefined} className={chip(current === null)} scroll={false}>
        {t.everything}
      </Link>
      {topics.map((tp) => (
        <Link
          key={tp.id}
          href={`/${lang}/check?topic=${tp.id}`}
          aria-current={current === tp.id ? "page" : undefined}
          className={chip(current === tp.id)}
          scroll={false}
        >
          <TopicIcon name={tp.icon} className="size-4" />
          {pick(tp.name, lang)}
        </Link>
      ))}
    </nav>
  );
}

function CheckerSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="mb-6 h-9 animate-pulse rounded-full bg-surface/70" />
      <div className="grid animate-pulse gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="h-80 rounded-3xl border border-line bg-surface" />
        <div className="h-72 rounded-2xl border border-line bg-surface" />
      </div>
    </div>
  );
}
