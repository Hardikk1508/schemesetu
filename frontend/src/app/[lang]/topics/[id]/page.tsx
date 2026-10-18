import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SchemeGridSkeleton, SchemesByKind } from "@/components/scheme-grid";
import { TopicIcon } from "@/components/topic-icon";
import { getTopic, getTopics } from "@/lib/api";
import { getDictionary, pick } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import type { Lang } from "@/lib/locales";

export async function generateMetadata({ params }: PageProps<"/[lang]/topics/[id]">): Promise<Metadata> {
  const [{ id }, lang] = await Promise.all([params, getLang()]);
  const topic = await getTopic(id);
  return topic ? { title: pick(topic.name, lang), description: pick(topic.description, lang) } : {};
}

export default async function TopicPage({ params }: PageProps<"/[lang]/topics/[id]">) {
  const lang = await getLang();
  const t = getDictionary(lang);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link
        href={`/${lang}#topics`}
        className="inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t.topic.allTopics}
      </Link>
      <Suspense fallback={<SchemeGridSkeleton heading />}>
        <TopicContent params={params} lang={lang} />
      </Suspense>
    </div>
  );
}

async function TopicContent({ params, lang }: { params: Promise<{ id: string }>; lang: Lang }) {
  const { id } = await params;
  const [topic, topics] = await Promise.all([getTopic(id), getTopics()]);
  if (!topic) notFound();
  const t = getDictionary(lang);

  return (
    <>
      <header className="animate-rise mt-6 flex flex-col gap-6 rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-8 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
            <TopicIcon name={topic.icon} className="size-7" />
          </span>
          <div>
            <h1 className="text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl">{pick(topic.name, lang)}</h1>
            <p className="mt-1.5 text-lg text-ink-2">{pick(topic.description, lang)}</p>
            <p className="mt-3 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-ink px-2.5 py-0.5 text-sm font-semibold text-white">
                {t.topic.count(topic.scheme_count)}
              </span>
              {topic.kinds.map((k) => (
                <a
                  key={k.kind}
                  href={`#kind-${k.kind}`}
                  className="rounded-full border border-line-strong px-2.5 py-0.5 text-sm font-semibold text-ink-2 hover:border-brand hover:text-brand"
                >
                  {pick(k.label, lang)} · {k.count}
                </a>
              ))}
            </p>
          </div>
        </div>
        <Link
          href={`/${lang}/check?topic=${topic.id}`}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-lg font-semibold text-white shadow-card transition hover:bg-brand-strong hover:shadow-pop"
        >
          {t.topic.checkCta}
          <ArrowRight className="size-5" aria-hidden="true" />
        </Link>
      </header>

      <nav aria-label={t.topic.allTopics} className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
        {topics.map((tp) => {
          const current = tp.id === topic.id;
          return (
            <Link
              key={tp.id}
              href={`/${lang}/topics/${tp.id}`}
              aria-current={current ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                current
                  ? "border-ink bg-ink text-white"
                  : "border-line-strong bg-surface text-ink-2 hover:border-ink-3 hover:text-ink"
              }`}
            >
              <TopicIcon name={tp.icon} className="size-4" />
              {pick(tp.name, lang)}
            </Link>
          );
        })}
      </nav>

      <div className="mt-8">
        <SchemesByKind lang={lang} topic={topic.id} />
      </div>
    </>
  );
}
