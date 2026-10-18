"use client";

import { ArrowRight, ChevronDown, ExternalLink, FileText, Info } from "lucide-react";
import Link from "next/link";

import { OutcomeIcon, StatusBadge } from "@/components/status";
import { formatValue } from "@/lib/format";
import { getDictionary, pick, ruleText, schemeName } from "@/lib/i18n";
import type { Lang } from "@/lib/locales";
import { toUnits } from "@/lib/rules";
import type { FieldMeta, RuleResult, SchemeResult } from "@/lib/types";

type Props = {
  result: SchemeResult;
  lang: Lang;
  meta: Map<string, FieldMeta>;
  onAnswer: (field: string) => void;
};

function RuleRow({ rule, lang, meta }: { rule: RuleResult; lang: Lang; meta: Map<string, FieldMeta> }) {
  const t = getDictionary(lang).results;
  return (
    <li className="flex gap-2.5">
      <OutcomeIcon outcome={rule.outcome} lang={lang} />
      <span>
        {ruleText(rule, lang)}
        {rule.actual !== null && (
          <span className="text-ink-3">
            {" "}
            ({t.yours}: {formatValue(meta.get(rule.field), rule.actual, lang)})
          </span>
        )}
        <span className="block text-sm text-ink-3">{rule.clause}</span>
      </span>
    </li>
  );
}

export function ResultCard({ result, lang, meta, onAnswer }: Props) {
  const t = getDictionary(lang).results;
  const { status } = result;

  return (
    <article className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h4 className="text-xl leading-snug font-bold">{schemeName(result, lang)}</h4>
        <StatusBadge status={status} lang={lang} />
      </header>
      {!result.verified && (
        <p className="mt-1 text-xs font-semibold tracking-wide text-wait uppercase">{t.unverified}</p>
      )}

      <p className={`mt-3 ${status === "not_eligible" ? "text-ink-3" : "text-ink-2"}`}>
        {status === "eligible" && <span className="font-semibold text-ink">{t.benefit}: </span>}
        {pick(result.benefit, lang)}
      </p>

      {status === "eligible" && (
        <div className="mt-5">
          <h5 className="font-semibold">{t.documents}</h5>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {result.documents.map((doc) => (
              <li key={doc.en} className="flex gap-2 rounded-lg bg-paper px-3 py-2">
                <FileText className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                <span className="text-sm">{pick(doc, lang)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {status !== "not_eligible" && result.notes && (
        <p className="mt-4 flex gap-2 rounded-lg bg-marigold-soft px-3 py-2 text-sm text-ink-2">
          <Info className="mt-0.5 size-4 shrink-0 text-wait" aria-hidden="true" />
          <span>
            <span className="font-semibold text-ink">{getDictionary(lang).scheme.goodToKnow}: </span>
            {pick(result.notes, lang)}
          </span>
        </p>
      )}

      {status === "needs_info" && (
        <div className="mt-5 rounded-xl border border-wait-line bg-wait-soft/60 p-4">
          <p className="font-semibold">{t.weNeed}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {result.missing_fields.map((f) => (
              <li key={f}>
                <button
                  type="button"
                  onClick={() => onAnswer(f)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-wait-line bg-surface px-3 py-1.5 text-sm font-semibold hover:border-wait"
                >
                  {meta.get(f) ? pick(meta.get(f)!.label, lang) : f}
                  <span className="text-brand">· {t.answer}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {status === "not_eligible" && result.failed_reasons.length > 0 && (
        <div className="mt-4">
          <p className="font-semibold">{t.whyNot}</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-ink-2">
            {result.failed_reasons.map((r) => (
              <li key={r.en}>{pick(r, lang)}</li>
            ))}
          </ul>
        </div>
      )}

      <details className="group mt-5 border-t border-line pt-4">
        <summary className="inline-flex cursor-pointer items-center gap-1 rounded-md font-semibold text-ink-2 hover:text-ink">
          {t.conditions(result.passed_count, result.total_rules)}
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <ul className="mt-3 space-y-3">
          {toUnits(result.rule_results).map((unit) =>
            unit.group ? (
              <li key={unit.group}>
                <p className="text-sm font-semibold text-ink-2">{t.anyOneOf}</p>
                <ul className="mt-2 space-y-3 border-l-2 border-marigold pl-3">
                  {unit.items.map((r) => (
                    <RuleRow key={r.rule_id} rule={r} lang={lang} meta={meta} />
                  ))}
                </ul>
              </li>
            ) : (
              <RuleRow key={unit.items[0].rule_id} rule={unit.items[0]} lang={lang} meta={meta} />
            ),
          )}
        </ul>
      </details>

      <footer className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
        <a
          href={result.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-brand hover:text-brand-strong"
        >
          {t.official}
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
        <Link
          href={`/${lang}/schemes/${result.scheme_id}`}
          className="inline-flex items-center gap-1 text-ink-2 hover:text-ink"
        >
          {t.details}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </footer>
    </article>
  );
}
