"use client";

import { ArrowRight, LoaderCircle, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { setMe } from "@/lib/account";
import { answersFrom, loadSaved, persistAnswers } from "@/lib/answers";
import { ApiError, requestOtp, saveAnswers, verifyOtp } from "@/lib/api";
import { getDictionary } from "@/lib/i18n";
import type { Lang } from "@/lib/locales";

const RESEND_SECONDS = 30;

export function LoginForm({ lang }: { lang: Lang }) {
  const t = getDictionary(lang).auth;
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next")?.startsWith("/") ? params.get("next")! : `/${lang}/account`;

  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  function message(e: unknown): string {
    return e instanceof ApiError && e.detail ? e.detail : getDictionary(lang).checker.error;
  }

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestOtp(phone, lang);
      setStep("code");
      setWait(RESEND_SECONDS);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 422 ? t.phone + ": 10 digits" : message(err));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let me = await verifyOtp(phone, code.trim(), lang);
      // Bring this tab's answers into the account, or the account's answers into this tab.
      const local = loadSaved();
      if (local && local.answers.history.length > 0) {
        me = await saveAnswers(local.answers.profile, local.answers.skipped);
      } else if (me.saved) {
        persistAnswers(answersFrom(me.saved.profile, me.saved.skipped));
      }
      setMe(me);
      router.push(next);
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  }

  const input =
    "min-h-13 w-full rounded-xl border-2 border-line-strong bg-surface px-4 text-lg outline-none focus:border-brand";
  const button =
    "inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 text-lg font-semibold text-white transition hover:bg-brand-strong disabled:opacity-50";

  return (
    <div className="animate-rise rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.title}</h1>
      <p className="mt-2 text-ink-2">{t.subtitle}</p>

      {step === "phone" ? (
        <form onSubmit={sendCode} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1.5 block font-semibold">{t.phone}</span>
            <span className="flex items-center gap-2">
              <span className="rounded-xl border-2 border-line bg-paper px-3 py-3 text-lg text-ink-2">+91</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="98765 43210"
                required
                className={input}
              />
            </span>
          </label>
          <button type="submit" disabled={busy || phone.replace(/\D/g, "").length < 10} className={button}>
            {busy ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : null}
            {t.sendCode}
            <ArrowRight className="size-5" aria-hidden="true" />
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-6 space-y-4">
          <p className="text-ink-2">{t.codeSentTo(`+91 ${phone.replace(/\D/g, "").slice(-10)}`)}</p>
          <label className="block">
            <span className="mb-1.5 block font-semibold">{t.code}</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="••••••"
              autoFocus
              required
              className={`${input} tracking-[0.5em]`}
            />
          </label>
          <button type="submit" disabled={busy || code.length !== 6} className={button}>
            {busy ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : null}
            {t.verify}
          </button>
          <div className="flex flex-wrap justify-between gap-2 text-sm font-semibold">
            <button type="button" onClick={() => setStep("phone")} className="text-ink-2 hover:text-ink">
              {t.changeNumber}
            </button>
            <button type="button" onClick={() => void sendCode()} disabled={wait > 0 || busy} className="text-brand disabled:text-ink-3">
              {wait > 0 ? t.resendIn(wait) : t.resend}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-4 py-3 font-semibold text-danger">
          {error}
        </p>
      )}
      <p className="mt-6 flex gap-2 text-sm text-ink-3">
        <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
        {t.privacy}
      </p>
    </div>
  );
}
