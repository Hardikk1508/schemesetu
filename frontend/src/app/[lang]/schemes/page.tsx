import type { Metadata } from "next";
import { Suspense } from "react";

import { SchemeExplorer } from "@/components/scheme-explorer";
import { SchemeGridSkeleton } from "@/components/scheme-grid";
import { getKinds, getSchemes, getTopics } from "@/lib/api";
import { getDictionary } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import type { Lang } from "@/lib/locales";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLang()).nav.schemes };
}

export default async function SchemesPage({ searchParams }: PageProps<"/[lang]/schemes">) {
  const lang = await getLang();
  const t = getDictionary(lang);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="animate-rise text-3xl font-extrabold tracking-tight sm:text-4xl">{t.home.schemesHeading}</h1>
      <Suspense fallback={<SchemeGridSkeleton heading />}>
        <ExplorerLoader lang={lang} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ExplorerLoader({
  lang,
  searchParams,
}: {
  lang: Lang;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, { schemes }, kinds, topics] = await Promise.all([searchParams, getSchemes(), getKinds(), getTopics()]);
  const q = typeof params.q === "string" ? params.q : "";
  const topic = typeof params.topic === "string" && topics.some((t) => t.id === params.topic) ? params.topic : null;
  return (
    <>
      <p className="mt-2 text-ink-2">{getDictionary(lang).home.schemesSub(schemes.length)}</p>
      <SchemeExplorer
        lang={lang}
        schemes={schemes}
        kinds={kinds}
        topics={topics}
        initialQuery={q}
        initialTopic={topic}
      />
    </>
  );
}
