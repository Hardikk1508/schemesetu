"use client";

import { CircleCheck, Pencil, RotateCcw, UserRound } from "lucide-react";
import Link from "next/link";

import { STATUS_STYLE } from "@/components/status";
import { useMe } from "@/lib/account";
import { formatValue } from "@/lib/format";
import { getDictionary, pick, schemeName } from "@/lib/i18n";
import type { Lang } from "@/lib/locales";
import type { EligibilityResponse, FieldMeta, Profile } from "@/lib/types";

const panelClass = "rounded-2xl border border-line bg-surface p-5";
const headingClass = "text-sm font-semibold tracking-wide text-ink-3 uppercase";

/** Every scheme with its current status, in a stable order so rows don't jump as answers come in. */
export function LiveProgress({ result, order, lang }: { result: EligibilityResponse; order: string[]; lang: Lang }) {
  const t = getDictionary(lang);
  const byId = new Map(result.results.map((r) => [r.scheme_id, r]));
  const rows = order.map((id) => byId.get(id)).filter((r) => r !== undefined);
  const decided = result.summary.eligible + result.summary.not_eligible;

  return (
    <section aria-labelledby="live-heading" className={panelClass}>
      <h2 id="live-heading" className={headingClass}>
        {t.checker.liveHeading}
      </h2>
      <p className="mt-1 font-semibold" aria-live="polite">
        {t.checker.decided(decided, rows.length)}
      </p>
      <div className="mt-3 flex gap-1" aria-hidden="true">
        {rows.map((r) => (
          <span
            key={r.scheme_id}
            className={`h-2 flex-1 rounded-full transition-colors duration-500 ${
              r.status === "needs_info" ? "bg-line" : STATUS_STYLE[r.status].bar
            }`}
          />
        ))}
      </div>
      <ul className="mt-4 space-y-2.5">
        {rows.map((r) => {
          const { icon: Icon, text } = STATUS_STYLE[r.status];
          return (
            <li key={r.scheme_id} className="flex gap-2.5 text-sm">
              {/* Keyed by status so the icon pops when a scheme gets decided. */}
              <Icon key={r.status} className={`mt-0.5 size-4.5 shrink-0 ${text} ${r.status !== "needs_info" ? "animate-pop" : ""}`} aria-hidden="true" />
              <span className={r.status === "not_eligible" ? "text-ink-3" : ""}>
                {schemeName(r, lang)}
                <span className="sr-only">: {t.status[r.status]}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function AnswersPanel({
  lang,
  profile,
  skipped,
  history,
  meta,
  onEdit,
  onStartOver,
}: {
  lang: Lang;
  profile: Profile;
  skipped: string[];
  history: string[];
  meta: Map<string, FieldMeta>;
  onEdit: (field: string) => void;
  onStartOver: () => void;
}) {
  const t = getDictionary(lang).results;
  const ta = getDictionary(lang).account;
  const me = useMe();
  const answered = history.filter((f) => profile[f] !== undefined);
  const label = (f: string) => (meta.get(f) ? pick(meta.get(f)!.label, lang) : f);

  return (
    <section aria-labelledby="answers-heading" className={panelClass}>
      <h2 id="answers-heading" className={headingClass}>
        {t.yourAnswers}
      </h2>
      {answered.length === 0 && skipped.length === 0 ? (
        <p className="mt-2 text-ink-2">{t.noAnswers}</p>
      ) : (
        <dl className="mt-3 divide-y divide-line">
          {answered.map((f) => (
            <div key={f} className="flex items-start justify-between gap-3 py-2.5">
              <div>
                <dt className="text-sm text-ink-3">{label(f)}</dt>
                <dd className="font-semibold">{formatValue(meta.get(f), profile[f], lang)}</dd>
              </div>
              <button
                type="button"
                onClick={() => onEdit(f)}
                className="inline-flex shrink-0 items-center gap-1 rounded-md text-sm font-semibold text-brand hover:text-brand-strong"
              >
                <Pencil className="size-3.5" aria-hidden="true" />
                {t.change}
                <span className="sr-only">: {label(f)}</span>
              </button>
            </div>
          ))}
          {skipped.map((f) => (
            <div key={f} className="flex items-start justify-between gap-3 py-2.5">
              <div>
                <dt className="text-sm text-ink-3">{label(f)}</dt>
                <dd className="text-ink-3 italic">{t.skipped}</dd>
              </div>
              <button
                type="button"
                onClick={() => onEdit(f)}
                className="shrink-0 rounded-md text-sm font-semibold text-brand hover:text-brand-strong"
              >
                {t.answer}
                <span className="sr-only">: {label(f)}</span>
              </button>
            </div>
          ))}
        </dl>
      )}
      {me ? (
        <p className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-ok">
          <CircleCheck className="size-4" aria-hidden="true" />
          {ta.saved}
        </p>
      ) : me === null && answered.length > 0 ? (
        <Link
          href={`/${lang}/login?next=/${lang}/check`}
          className="mt-4 flex items-start gap-1.5 rounded-xl border border-dashed border-line-strong px-3 py-2 text-sm font-semibold text-ink-2 hover:border-brand hover:text-brand"
        >
          <UserRound className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {ta.loginToSave}
        </Link>
      ) : null}
      <button
        type="button"
        onClick={onStartOver}
        className="mt-4 inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-ink-2 hover:text-ink"
      >
        <RotateCcw className="size-3.5" aria-hidden="true" />
        {t.startOver}
      </button>
    </section>
  );
}
