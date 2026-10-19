import { Languages, ScrollText, ShieldCheck } from "lucide-react";
import { Suspense } from "react";

import { HeroAssistant } from "@/components/assistant/hero-assistant";
import { HowItWorks } from "@/components/home-sections";
import { TopicGrid, TopicGridSkeleton } from "@/components/topic-grid";
import { getDictionary } from "@/lib/i18n";
import { getLang } from "@/lib/lang";

const TRUST_ICONS = [ShieldCheck, ScrollText, Languages];

export default async function HomePage() {
  const lang = await getLang();
  const t = getDictionary(lang);

  return (
    <>
      <section className="relative isolate">
        {/* Soft colour wash behind the hero. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-24 -right-24 size-96 rounded-full bg-marigold/15 blur-3xl" />
          <div className="absolute top-40 -left-32 size-96 rounded-full bg-brand/10 blur-3xl" />
        </div>
        <div className="mx-auto grid max-w-6xl gap-x-14 gap-y-8 px-4 pt-10 pb-16 sm:px-6 md:grid-cols-[1.15fr_1fr] md:pt-16 md:pb-20">
          <div className="min-w-0">
            <p className="animate-rise text-sm font-semibold tracking-wide text-brand uppercase">{t.home.eyebrow}</p>
            <h1
              className="animate-rise mt-3 text-4xl leading-[1.08] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl"
              style={{ animationDelay: "60ms" }}
            >
              {t.home.title}
            </h1>
            <p className="animate-rise mt-5 max-w-xl text-lg text-ink-2" style={{ animationDelay: "120ms" }}>
              {t.home.body}
            </p>
          </div>

          {/* On phones this comes right after the heading; on wider screens it fills the right column. */}
          <div
            id="hero-ai"
            className="animate-rise min-w-0 md:col-start-2 md:row-span-2 md:row-start-1 md:self-center"
            style={{ animationDelay: "160ms" }}
          >
            <HeroAssistant lang={lang} />
          </div>

          <div className="min-w-0">
            <ul className="animate-rise flex flex-wrap gap-x-6 gap-y-3 text-sm text-ink-2" style={{ animationDelay: "200ms" }}>
              {t.home.trust.map((item, i) => {
                const Icon = TRUST_ICONS[i];
                return (
                  <li key={item} className="flex items-center gap-2">
                    <Icon className="size-4 shrink-0 text-brand" aria-hidden="true" />
                    {item}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      <div className="border-t border-line">
        <HowItWorks lang={lang} />
      </div>

      <section id="topics" className="scroll-mt-20 border-t border-line bg-surface/50">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.home.topicsHeading}</h2>
          <p className="mt-2 max-w-2xl text-ink-2">{t.home.topicsSub}</p>
          <div className="mt-8">
            <Suspense fallback={<TopicGridSkeleton />}>
              <TopicGrid lang={lang} />
            </Suspense>
          </div>
        </div>
      </section>
    </>
  );
}
