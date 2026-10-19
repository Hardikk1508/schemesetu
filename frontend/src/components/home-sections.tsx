import { FileCheck2, ListChecks, MessagesSquare } from "lucide-react";

import { getDictionary } from "@/lib/i18n";
import type { Lang } from "@/lib/locales";

const STEP_ICONS = [MessagesSquare, ListChecks, FileCheck2];

export function HowItWorks({ lang }: { lang: Lang }) {
  const t = getDictionary(lang).home;
  return (
    <section aria-labelledby="how-title" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="max-w-2xl">
        <h2 id="how-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t.howTitle}
        </h2>
        <p className="mt-2 text-lg text-ink-2">{t.howSub}</p>
      </div>
      <ol className="relative mt-10 grid gap-6 md:grid-cols-3">
        {/* Connector line behind the step numbers (desktop). */}
        <span aria-hidden="true" className="absolute top-6 right-[16%] left-[16%] hidden h-0.5 bg-gradient-to-r from-brand/10 via-marigold/60 to-brand/10 md:block" />
        {t.steps.map((step, i) => {
          const Icon = STEP_ICONS[i];
          return (
            <li key={step.title} className="animate-rise relative flex flex-col items-start md:items-center md:text-center" style={{ animationDelay: `${i * 120}ms` }}>
              <span className="relative grid size-12 place-items-center rounded-2xl bg-ink text-marigold shadow-pop">
                <Icon className="size-6" aria-hidden="true" />
                <span className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-marigold text-xs font-bold text-ink">
                  {i + 1}
                </span>
              </span>
              <h3 className="mt-4 text-lg font-bold">{step.title}</h3>
              <p className="mt-1 max-w-xs text-ink-2">{step.body}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
