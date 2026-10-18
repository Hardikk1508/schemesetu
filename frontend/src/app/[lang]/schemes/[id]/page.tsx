import { ArrowLeft, ArrowRight, ExternalLink, FileText, Info, Landmark } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DataNote } from "@/components/data-note";
import { TopicIcon } from "@/components/topic-icon";
import { getKinds, getScheme, getTopics } from "@/lib/api";
import { getDictionary, pick, ruleText, schemeName } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import type { Lang } from "@/lib/locales";
import { toUnits } from "@/lib/rules";
import type { Rule } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/[lang]/schemes/[id]">): Promise<Metadata> {
  const [{ id }, lang] = await Promise.all([params, getLang()]);
  const scheme = await getScheme(id);
  return scheme ? { title: schemeName(scheme, lang), description: pick(scheme.benefit, lang) } : {};
}

export default async function SchemePage({ params }: PageProps<"/[lang]/schemes/[id]">) {
  const lang = await getLang();
  const t = getDictionary(lang);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link
        href={`/${lang}/schemes`}
        className="inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t.scheme.allSchemes}
      </Link>
      <Suspense fallback={<DetailSkeleton />}>
        <SchemeDetail params={params} lang={lang} />
      </Suspense>
    </div>
  );
}

function RuleLine({ rule, lang }: { rule: Rule; lang: Lang }) {
  const t = getDictionary(lang);
  return (
    <>
      <span className="font-semibold">{ruleText(rule, lang)}</span>
      <span className="mt-0.5 block text-sm text-ink-3">
        {t.scheme.rule}: {rule.clause}
        {rule.source_url && (
          <>
            {" · "}
            <a href={rule.source_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">
              {t.scheme.source}
            </a>
          </>
        )}
      </span>
    </>
  );
}

async function SchemeDetail({ params, lang }: { params: Promise<{ id: string }>; lang: Lang }) {
  const { id } = await params;
  const [scheme, topics, kinds] = await Promise.all([getScheme(id), getTopics(), getKinds()]);
  if (!scheme) notFound();
  const t = getDictionary(lang);
  const units = toUnits(scheme.rules);
  const kind = kinds.find((k) => k.kind === scheme.kind);
  const schemeTopics = topics.filter((tp) => scheme.topics.includes(tp.id));

  return (
    <article className="animate-rise mt-6">
      <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-brand">
        <Landmark className="size-4" aria-hidden="true" />
        {kind ? pick(kind.label, lang) : t.scheme.level[scheme.level]}
        <span className="font-normal text-ink-3">
          · {t.scheme.level[scheme.level]} · {lang === "hi" && scheme.ministry_hi ? scheme.ministry_hi : scheme.ministry}
        </span>
      </p>
      <h1 className="mt-2 text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl">
        {schemeName(scheme, lang)}
      </h1>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="text-sm font-semibold tracking-wide text-ink-3 uppercase">{t.scheme.benefit}</h2>
        <p className="mt-1.5 text-lg">{pick(scheme.benefit, lang)}</p>
      </section>

      {scheme.notes && (
        <aside className="mt-4 flex gap-3 rounded-2xl border border-marigold/40 bg-marigold-soft px-5 py-4">
          <Info className="mt-0.5 size-5 shrink-0 text-wait" aria-hidden="true" />
          <div>
            <p className="font-semibold">{t.scheme.goodToKnow}</p>
            <p className="mt-0.5 text-ink-2">{pick(scheme.notes, lang)}</p>
          </div>
        </aside>
      )}

      {schemeTopics.length > 0 && (
        <p className="mt-5 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-3">{t.scheme.listedUnder}</span>
          {schemeTopics.map((tp) => (
            <Link
              key={tp.id}
              href={`/${lang}/topics/${tp.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 py-1 font-semibold text-ink-2 transition-colors hover:border-brand hover:text-brand"
            >
              <TopicIcon name={tp.icon} className="size-3.5" />
              {pick(tp.name, lang)}
            </Link>
          ))}
        </p>
      )}

      <section className="mt-10">
        <h2 className="text-2xl font-bold tracking-tight">{t.scheme.whoCanApply}</h2>
        <p className="mt-1 text-ink-2">{t.scheme.allOf}</p>
        <ol className="mt-4 space-y-3">
          {units.map((unit, i) => (
            <li key={unit.group ?? unit.items[0].id} className="flex gap-3 rounded-xl border border-line bg-surface p-4">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand">
                {i + 1}
              </span>
              {unit.group ? (
                <div>
                  <p className="text-sm font-semibold text-ink-2">{t.scheme.anyOf}</p>
                  <ul className="mt-2 space-y-2 border-l-2 border-marigold pl-3">
                    {unit.items.map((r) => (
                      <li key={r.id}>
                        <RuleLine rule={r} lang={lang} />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div>
                  <RuleLine rule={unit.items[0]} lang={lang} />
                </div>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold tracking-tight">{t.scheme.documents}</h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {scheme.documents.map((doc) => (
            <li key={doc.en} className="flex gap-2.5 rounded-xl border border-line bg-surface px-4 py-3">
              <FileText className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
              {pick(doc, lang)}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 space-y-4">
        <p className="text-sm text-ink-3">
          {scheme.verified && scheme.last_verified ? t.scheme.verifiedOn(scheme.last_verified) : t.scheme.notVerified}
        </p>
        {!scheme.verified && <DataNote lang={lang} />}
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/${lang}/check${scheme.topics[0] ? `?topic=${scheme.topics[0]}` : ""}`}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-strong"
          >
            {t.scheme.checkCta}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <a
            href={scheme.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-5 py-2.5 font-semibold hover:border-ink-3"
          >
            {t.scheme.source}
            <ExternalLink className="size-4" aria-hidden="true" />
          </a>
        </div>
      </section>
    </article>
  );
}

function DetailSkeleton() {
  return (
    <div className="mt-6 animate-pulse space-y-4" aria-hidden="true">
      <div className="h-4 w-48 rounded bg-line" />
      <div className="h-10 w-4/5 rounded bg-line" />
      <div className="h-24 rounded-2xl bg-surface" />
      <div className="h-40 rounded-2xl bg-surface" />
    </div>
  );
}
