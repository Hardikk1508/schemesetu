"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useRef } from "react";

import { DataNote } from "@/components/data-note";
import { STATUS_STYLE } from "@/components/status";
import { getDictionary } from "@/lib/i18n";
import type { Lang } from "@/lib/locales";
import type { EligibilityResponse, FieldMeta, SchemeStatus } from "@/lib/types";

import { ResultCard } from "./result-card";

const SECTIONS: SchemeStatus[] = ["eligible", "needs_info", "not_eligible"];

type Props = {
  lang: Lang;
  result: EligibilityResponse;
  answeredCount: number;
  meta: Map<string, FieldMeta>;
  focusOnMount: boolean;
  onAnswer: (field: string) => void;
  onKeepGoing: () => void;
};

export function ResultsView({ lang, result, answeredCount, meta, focusOnMount, onAnswer, onKeepGoing }: Props) {
  const t = getDictionary(lang).results;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { summary, next_fields: nextFields } = result;

  useEffect(() => {
    if (focusOnMount) headingRef.current?.focus();
  }, [focusOnMount]);

  return (
    <div className="animate-fade">
      <h2 ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold tracking-tight outline-none sm:text-4xl">
        {t.heading(summary.eligible, nextFields.length > 0)}
      </h2>
      <p className="mt-2 text-lg text-ink-2">
        {t.basedOn(answeredCount)} {summary.eligible === 0 && nextFields.length > 0 && t.zeroHint}
      </p>

      {nextFields.length > 0 && summary.needs_info > 0 && (
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-brand/20 bg-brand-soft p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <p className="font-semibold text-brand-strong">{t.moreToCheck(nextFields.length, summary.needs_info)}</p>
          <button
            type="button"
            onClick={onKeepGoing}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-strong"
          >
            {t.keepGoing}
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {result.results.some((r) => !r.verified) && <DataNote lang={lang} className="mt-6" />}

      {SECTIONS.filter((s) => summary[s] > 0).map((status) => {
        const { icon: Icon, text } = STATUS_STYLE[status];
        return (
          <section key={status} className="mt-10" aria-labelledby={`section-${status}`}>
            <h3 id={`section-${status}`} className="flex items-center gap-2 text-xl font-bold">
              <Icon className={`size-6 ${text}`} aria-hidden="true" />
              {t.sections[status]}
              <span className="rounded-full bg-ink/5 px-2 text-base font-semibold text-ink-2">{summary[status]}</span>
            </h3>
            <div className="mt-4 space-y-4">
              {result.results
                .filter((r) => r.status === status)
                .map((r, i) => (
                  <div key={r.scheme_id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}>
                    <ResultCard result={r} lang={lang} meta={meta} onAnswer={onAnswer} />
                  </div>
                ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
