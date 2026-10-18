"use client";

import { ArrowLeft, ArrowRight, LoaderCircle, RotateCcw } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { formatINR, inWords } from "@/lib/format";
import { getDictionary, pick } from "@/lib/i18n";
import type { Lang } from "@/lib/locales";
import type { FieldMeta, ProfileValue } from "@/lib/types";

type Props = {
  meta: FieldMeta;
  lang: Lang;
  value: ProfileValue | undefined;
  position: number;
  remaining: number | null;
  pending: boolean;
  error: boolean;
  focusOnMount: boolean;
  onAnswer: (value: ProfileValue) => void;
  onSkip: () => void;
  onBack?: () => void;
  onCancel?: () => void;
  onRetry: () => void;
};

const choiceClass = (selected: boolean) =>
  `flex min-h-14 items-center justify-center rounded-xl border-2 px-4 py-3 text-lg font-semibold transition-colors disabled:opacity-60 ${
    selected
      ? "border-brand bg-brand-soft text-brand-strong"
      : "border-line-strong bg-surface hover:border-brand hover:bg-brand-soft/50"
  }`;

export function QuestionCard(props: Props) {
  const { meta, lang, position, remaining, pending, error, focusOnMount, onSkip, onBack, onCancel, onRetry } = props;
  const t = getDictionary(lang).checker;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hintId = useId();

  // The card is keyed by field, so this runs once per question: move focus to it for keyboard and screen-reader users.
  useEffect(() => {
    if (focusOnMount) headingRef.current?.focus();
  }, [focusOnMount]);

  return (
    <section className="animate-rise rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-8" aria-busy={pending}>
      <div className="flex items-center justify-between gap-3 text-sm text-ink-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            disabled={pending}
            className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 font-semibold text-ink-2 hover:text-ink disabled:opacity-50"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t.back}
          </button>
        ) : (
          <span />
        )}
        <span>
          <span className="font-semibold text-ink-2">{t.questionOf(position)}</span>
          {remaining !== null && remaining > 0 && <> · {t.upToMore(remaining)}</>}
        </span>
      </div>

      <h2
        ref={headingRef}
        tabIndex={-1}
        className="mt-6 text-2xl leading-snug font-bold tracking-tight text-balance outline-none sm:text-3xl"
      >
        {pick(meta.question, lang)}
      </h2>
      {meta.hint && (
        <p id={hintId} className="mt-2 text-ink-2">
          {pick(meta.hint, lang)}
        </p>
      )}

      <div className="mt-7">
        <AnswerInput {...props} hintId={meta.hint ? hintId : undefined} />
      </div>

      {error && (
        <div role="alert" className="mt-5 flex flex-wrap items-center gap-3 rounded-xl bg-danger-soft px-4 py-3 text-danger">
          <span className="flex-1">{t.error}</span>
          <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 font-semibold underline">
            <RotateCcw className="size-4" aria-hidden="true" />
            {t.retry}
          </button>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <button
          type="button"
          onClick={onSkip}
          disabled={pending}
          className="rounded-md font-semibold text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink hover:decoration-ink-3 disabled:opacity-50"
        >
          {t.skip}
        </button>
        <span className="flex items-center gap-3">
          {pending && (
            <span className="inline-flex items-center gap-1.5 text-sm text-ink-3" role="status">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              {t.checking}
            </span>
          )}
          {onCancel && (
            <button type="button" onClick={onCancel} disabled={pending} className="font-semibold text-ink-2 hover:text-ink">
              {t.cancelEdit}
            </button>
          )}
        </span>
      </div>
    </section>
  );
}

function AnswerInput({ meta, lang, value, pending, onAnswer, hintId }: Props & { hintId?: string }) {
  const t = getDictionary(lang).checker;

  if (meta.kind === "bool") {
    return (
      <div className="grid grid-cols-2 gap-3" role="group" aria-describedby={hintId}>
        {[true, false].map((choice) => (
          <button
            key={String(choice)}
            type="button"
            disabled={pending}
            aria-pressed={value === choice}
            onClick={() => onAnswer(choice)}
            className={choiceClass(value === choice)}
          >
            {choice ? t.yes : t.no}
          </button>
        ))}
      </div>
    );
  }

  if (meta.kind === "enum") {
    return (
      <div className="grid gap-3 sm:grid-cols-2" role="group" aria-describedby={hintId}>
        {meta.options.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={pending}
            aria-pressed={value === o.value}
            onClick={() => onAnswer(o.value)}
            className={choiceClass(value === o.value)}
          >
            {pick(o.label, lang)}
          </button>
        ))}
      </div>
    );
  }

  return <TypedInput meta={meta} lang={lang} value={value} pending={pending} onAnswer={onAnswer} hintId={hintId} />;
}

function TypedInput({
  meta,
  lang,
  value,
  pending,
  onAnswer,
  hintId,
}: Pick<Props, "meta" | "lang" | "value" | "pending" | "onAnswer"> & { hintId?: string }) {
  const t = getDictionary(lang).checker;
  const isNumber = meta.kind === "int";
  const [text, setText] = useState(value === undefined ? "" : String(value));
  const [problem, setProblem] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();

  const digits = text.replace(/[\s,₹]/g, "");
  const amount = isNumber && /^\d+$/.test(digits) ? Number(digits) : null;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!isNumber) {
      if (text.trim()) onAnswer(text.trim());
      return;
    }
    if (amount === null) return setProblem(t.numberInvalid);
    if ((meta.min !== null && amount < meta.min) || (meta.max !== null && amount > meta.max)) {
      return setProblem(t.outOfRange(meta.min, meta.max));
    }
    setProblem(null);
    onAnswer(amount);
  }

  const describedBy = [hintId, problem ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor={inputId} className="sr-only">
        {pick(meta.label, lang)}
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div
          className={`flex flex-1 items-center rounded-xl border-2 bg-surface px-4 focus-within:border-brand ${
            problem ? "border-danger" : "border-line-strong"
          }`}
        >
          {meta.unit === "inr" && <span className="mr-2 text-xl font-semibold text-ink-3">₹</span>}
          <input
            id={inputId}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setProblem(null);
            }}
            inputMode={isNumber ? "numeric" : "text"}
            autoComplete="off"
            placeholder={isNumber ? t.numberPlaceholder : t.textPlaceholder}
            aria-invalid={problem ? true : undefined}
            aria-describedby={describedBy}
            disabled={pending}
            className="min-h-14 w-full min-w-0 bg-transparent text-xl font-semibold outline-none placeholder:font-normal placeholder:text-ink-3"
          />
          {meta.unit === "years" && <span className="ml-2 text-lg text-ink-3">{t.years}</span>}
        </div>
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-lg font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
        >
          {t.next}
          <ArrowRight className="size-5" aria-hidden="true" />
        </button>
      </div>
      {meta.unit === "inr" && amount !== null && amount > 0 && (
        <p className="mt-2 text-ink-2">
          {formatINR(amount)}
          {inWords(amount, lang) && <span className="text-ink-3"> · {inWords(amount, lang)}</span>}
        </p>
      )}
      {problem && (
        <p id={errorId} className="mt-2 font-semibold text-danger">
          {problem}
        </p>
      )}
    </form>
  );
}
