import type { Metadata } from "next";
import { Suspense } from "react";

import { ChatAssistant } from "@/components/assistant/chat";
import { checkEligibility, getChatStatus, getFields } from "@/lib/api";
import { getDictionary } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import type { Lang } from "@/lib/locales";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLang()).assistant.title };
}

export default async function AssistantPage({ searchParams }: PageProps<"/[lang]/assistant">) {
  const lang = await getLang();
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-10">
      <p className="mb-5 max-w-2xl text-ink-2">{getDictionary(lang).assistant.subtitle}</p>
      <Suspense
        fallback={
          <div className="grid animate-pulse gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]" aria-hidden="true">
            <div className="h-[30rem] rounded-3xl border border-line bg-surface" />
            <div className="h-72 rounded-2xl border border-line bg-surface" />
          </div>
        }
      >
        <AssistantLoader lang={lang} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function AssistantLoader({
  lang,
  searchParams,
}: {
  lang: Lang;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, fields, initial, status] = await Promise.all([
    searchParams,
    getFields(),
    checkEligibility({ profile: {}, skipped: [] }),
    getChatStatus(),
  ]);
  const q = typeof params.q === "string" ? params.q.slice(0, 1000) : undefined;
  return <ChatAssistant lang={lang} fields={fields} initial={initial} status={status} initialMessage={q} />;
}
