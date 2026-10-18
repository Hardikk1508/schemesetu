"use client";

import { ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EMPTY_ANSWERS as EMPTY, loadSaved, persistAnswers, type Answers } from "@/lib/answers";
import { checkEligibility } from "@/lib/api";
import { getDictionary } from "@/lib/i18n";
import type { Lang } from "@/lib/locales";
import type { EligibilityResponse, FieldMeta, ProfileValue } from "@/lib/types";

import { QuestionCard } from "./question-card";
import { ResultsView } from "./results-view";
import { AnswersPanel, LiveProgress } from "./side-panels";

type View =
  | { mode: "ask" } // the backend's next most useful question, or results when there is none
  | { mode: "edit"; field: string; returnTo: "ask" | "results" }
  | { mode: "results" };

function without<T>(list: T[], item: T): T[] {
  return list.filter((x) => x !== item);
}

/** topic: only check schemes in this topic (null = all). Answers are shared across topics. */
type Props = { lang: Lang; fields: FieldMeta[]; initial: EligibilityResponse; topic: string | null };

export function Checker({ lang, fields, initial, topic }: Props) {
  const t = getDictionary(lang).checker;
  const meta = useMemo(() => new Map(fields.map((f) => [f.field, f])), [fields]);
  const order = useMemo(() => initial.results.map((r) => r.scheme_id), [initial]);

  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [result, setResult] = useState<EligibilityResponse>(initial);
  const [view, setView] = useState<View>({ mode: "ask" });
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState<{ answers: Answers; view: View } | null>(null);
  const [touched, setTouched] = useState(false);
  const inflight = useRef<AbortController | null>(null);

  const submit = useCallback(async (next: Answers, nextView: View) => {
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    setPending(true);
    setFailed(null);
    try {
      const res = await checkEligibility({ profile: next.profile, skipped: next.skipped, topic }, controller.signal);
      setAnswers(next);
      setResult(res);
      setView(nextView);
      persistAnswers(next, nextView.mode === "results");
    } catch {
      if (!controller.signal.aborted) setFailed({ answers: next, view: nextView });
    } finally {
      if (inflight.current === controller) setPending(false);
    }
  }, [topic]);

  // Pick up answers saved earlier in this tab. Answering anything first aborts this.
  useEffect(() => {
    const saved = loadSaved();
    if (!saved || saved.answers.history.length === 0) return;
    const controller = new AbortController();
    inflight.current = controller;
    checkEligibility({ profile: saved.answers.profile, skipped: saved.answers.skipped, topic }, controller.signal)
      .then((res) => {
        setAnswers(saved.answers);
        setResult(res);
        if (saved.onResults) setView({ mode: "results" });
      })
      .catch(() => {
        if (!controller.signal.aborted) persistAnswers(null); // stale saved answers: start fresh, no error
      });
    return () => controller.abort();
  }, [topic]);

  const field = view.mode === "edit" ? view.field : view.mode === "ask" ? (result.next_fields[0] ?? null) : null;
  const fieldMeta = field ? meta.get(field) : undefined;
  const { history } = answers;
  const position = field ? history.indexOf(field) : -1;
  const previous = position === -1 ? history.at(-1) : history[position - 1];

  function viewAfterAnswering(f: string): View {
    if (view.mode !== "edit") return { mode: "ask" };
    if (view.returnTo === "results") return { mode: "results" };
    const following = history[history.indexOf(f) + 1];
    return following ? { mode: "edit", field: following, returnTo: "ask" } : { mode: "ask" };
  }

  function record(f: string, value: ProfileValue | null) {
    setTouched(true);
    const profile = { ...answers.profile };
    if (value === null) delete profile[f];
    else profile[f] = value;
    const skipped = value === null ? [...without(answers.skipped, f), f] : without(answers.skipped, f);
    const nextHistory = history.includes(f) ? history : [...history, f];
    void submit({ profile, skipped, history: nextHistory }, viewAfterAnswering(f));
  }

  function go(next: View) {
    setTouched(true);
    setFailed(null);
    setView(next);
    persistAnswers(answers, next.mode === "results");
  }

  function startOver() {
    inflight.current?.abort();
    persistAnswers(null);
    setTouched(true);
    setPending(false);
    setFailed(null);
    setAnswers(EMPTY);
    setResult(initial);
    setView({ mode: "ask" });
  }

  const answeredCount = Object.keys(answers.profile).length;
  const editFromResults = (f: string) => go({ mode: "edit", field: f, returnTo: "results" });

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="min-w-0">
        {field && fieldMeta ? (
          <>
            <QuestionCard
              key={field}
              meta={fieldMeta}
              lang={lang}
              value={answers.profile[field]}
              position={position === -1 ? history.length + 1 : position + 1}
              remaining={view.mode === "ask" ? result.next_fields.length : null}
              pending={pending}
              error={failed !== null}
              focusOnMount={touched}
              onAnswer={(value) => record(field, value)}
              onSkip={() => record(field, null)}
              onBack={
                previous && !(view.mode === "edit" && view.returnTo === "results")
                  ? () => go({ mode: "edit", field: previous, returnTo: "ask" })
                  : undefined
              }
              onCancel={view.mode === "edit" && view.returnTo === "results" ? () => go({ mode: "results" }) : undefined}
              onRetry={() => failed && void submit(failed.answers, failed.view)}
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1 text-sm text-ink-3">
              <p className="flex items-center gap-1.5">
                <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
                {t.privacy}
              </p>
              {view.mode === "ask" && answeredCount > 0 && (
                <button
                  type="button"
                  onClick={() => go({ mode: "results" })}
                  className="rounded-md font-semibold text-brand hover:text-brand-strong"
                >
                  {t.seeResults}
                </button>
              )}
            </div>
          </>
        ) : (
          <ResultsView
            lang={lang}
            result={result}
            answeredCount={answeredCount}
            meta={meta}
            focusOnMount={touched}
            onAnswer={editFromResults}
            onKeepGoing={() => go({ mode: "ask" })}
          />
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24">
        {field ? (
          <LiveProgress result={result} order={order} lang={lang} />
        ) : (
          <AnswersPanel
            lang={lang}
            profile={answers.profile}
            skipped={answers.skipped}
            history={history}
            meta={meta}
            onEdit={editFromResults}
            onStartOver={startOver}
          />
        )}
      </aside>
    </div>
  );
}
