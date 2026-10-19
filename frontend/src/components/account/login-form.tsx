"use client";

import { ArrowRight, Eye, EyeOff, KeyRound, LoaderCircle, ShieldCheck, Smartphone } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";

import { setMe, useMe } from "@/lib/account";
import { answersFrom, loadSaved, persistAnswers } from "@/lib/answers";
import { ApiError, loginWithPassword, registerWithPassword, requestOtp, saveAnswers, verifyOtp } from "@/lib/api";
import { getDictionary } from "@/lib/i18n";
import type { Lang } from "@/lib/locales";
import type { Me } from "@/lib/types";

const RESEND_SECONDS = 30;

type Method = "otp" | "password";

/** Login with a phone OTP or a username + password. A logged-in account without a phone uses the OTP form to add one. */
export function LoginForm({ lang }: { lang: Lang }) {
  const t = getDictionary(lang).auth;
  const router = useRouter();
  const params = useSearchParams();
  const me = useMe();
  const next = params.get("next")?.startsWith("/") ? params.get("next")! : `/${lang}/account`;
  const addingPhone = !!me && !me.phone;
  const mode = params.get("mode");
  const [method, setMethod] = useState<Method>(mode === "password" ? "password" : "otp");
  const [error, setError] = useState<string | null>(null);
  const [visit, setVisit] = useState(0);
  const active: Method = addingPhone ? "otp" : method;

  // Next keeps this route's state alive between visits: follow ?mode= when it changes,
  // and start from empty forms once the user has logged out.
  const [seen, setSeen] = useState({ mode, me });
  if (seen.mode !== mode || seen.me !== me) {
    setSeen({ mode, me });
    if (seen.mode !== mode && (mode === "otp" || mode === "password")) setMethod(mode);
    if (seen.me && me === null) {
      setVisit((v) => v + 1);
      setError(null);
    }
  }

  /** After any successful login: bring this tab's answers into the account, or the account's into this tab. */
  async function finish(user: Me) {
    const local = loadSaved();
    if (local && local.answers.history.length > 0) {
      user = await saveAnswers(local.answers.profile, local.answers.skipped);
    } else if (user.saved) {
      persistAnswers(answersFrom(user.saved.profile, user.saved.skipped));
    }
    setMe(user);
    router.push(next);
  }

  function explain(e: unknown): string {
    if (e instanceof ApiError) {
      if (e.status === 401) return t.wrongCreds;
      if (e.status === 409) return active === "password" ? t.usernameTaken : t.phoneTaken;
      if (e.status === 429 && active === "password") return t.tooMany;
      if (e.status === 422) return active === "password" ? t.invalid : `${t.phone}: 10 digits`;
      if (e.detail) return e.detail;
    }
    return getDictionary(lang).checker.error;
  }

  const tab = (m: Method) =>
    `flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors sm:text-base ${
      active === m ? "bg-surface text-ink shadow-card" : "text-ink-2 hover:text-ink"
    }`;

  return (
    <div className="animate-rise rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{addingPhone ? t.addPhoneTitle : t.title2}</h1>
      <p className="mt-2 text-ink-2">{addingPhone ? t.addPhoneBody : t.subtitle}</p>

      {!addingPhone && (
        <div role="tablist" aria-label={t.title2} className="mt-6 flex gap-1 rounded-2xl bg-paper p-1">
          <button
            type="button"
            role="tab"
            aria-selected={active === "otp"}
            onClick={() => {
              setMethod("otp");
              setError(null);
            }}
            className={tab("otp")}
          >
            <Smartphone className="size-4" aria-hidden="true" />
            {t.tabOtp}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={active === "password"}
            onClick={() => {
              setMethod("password");
              setError(null);
            }}
            className={tab("password")}
          >
            <KeyRound className="size-4" aria-hidden="true" />
            {t.tabPassword}
          </button>
        </div>
      )}

      {active === "otp" ? (
        <OtpForm key={visit} lang={lang} onDone={finish} onError={(e) => setError(e ? explain(e) : null)} />
      ) : (
        <PasswordForm key={visit} lang={lang} onDone={finish} onError={(e) => setError(e ? explain(e) : null)} />
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-4 py-3 font-semibold text-danger">
          {error}
        </p>
      )}
      <p className="mt-6 flex gap-2 text-sm text-ink-3">
        <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
        {active === "password" ? t.passwordPrivacy : t.privacy}
      </p>
    </div>
  );
}

const inputClass =
  "min-h-13 w-full rounded-xl border-2 border-line-strong bg-surface px-4 text-lg outline-none focus:border-brand";
const buttonClass =
  "inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 text-lg font-semibold text-white transition hover:bg-brand-strong disabled:opacity-50";

type FormProps = { lang: Lang; onDone: (me: Me) => Promise<void>; onError: (e: unknown | null) => void };

function OtpForm({ lang, onDone, onError }: FormProps) {
  const t = getDictionary(lang).auth;
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    onError(null);
    try {
      await requestOtp(phone, lang);
      setStep("code");
      setWait(RESEND_SECONDS);
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    onError(null);
    try {
      await onDone(await verifyOtp(phone, code.trim(), lang));
    } catch (err) {
      onError(err);
      setBusy(false);
    }
  }

  if (step === "phone") {
    return (
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
              className={inputClass}
            />
          </span>
        </label>
        <button type="submit" disabled={busy || phone.replace(/\D/g, "").length < 10} className={buttonClass}>
          {busy ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : null}
          {t.sendCode}
          <ArrowRight className="size-5" aria-hidden="true" />
        </button>
      </form>
    );
  }
  return (
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
          className={`${inputClass} tracking-[0.5em]`}
        />
      </label>
      <button type="submit" disabled={busy || code.length !== 6} className={buttonClass}>
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
  );
}

function PasswordForm({ lang, onDone, onError }: FormProps) {
  const t = getDictionary(lang).auth;
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const id = useId();
  const registering = mode === "register";

  async function submit(e: FormEvent) {
    e.preventDefault();
    onError(null);
    if (registering && password !== confirm) {
      onError(new ApiError("mismatch", 0, t.mismatch));
      return;
    }
    setBusy(true);
    try {
      const me = registering
        ? await registerWithPassword(username, password, lang)
        : await loginWithPassword(username, password, lang);
      await onDone(me);
    } catch (err) {
      onError(err);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div>
        <label htmlFor={`${id}-user`} className="mb-1.5 block font-semibold">
          {t.username}
        </label>
        <input
          id={`${id}-user`}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          minLength={3}
          maxLength={32}
          aria-describedby={registering ? `${id}-user-hint` : undefined}
          className={inputClass}
        />
        {registering && (
          <p id={`${id}-user-hint`} className="mt-1 text-sm text-ink-3">
            {t.usernameHint}
          </p>
        )}
      </div>
      <div>
        <label htmlFor={`${id}-pass`} className="mb-1.5 block font-semibold">
          {t.password}
        </label>
        <div className="relative">
          <input
            id={`${id}-pass`}
            type={visible ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={registering ? "new-password" : "current-password"}
            required
            minLength={8}
            maxLength={128}
            aria-describedby={registering ? `${id}-pass-hint` : undefined}
            className={`${inputClass} pr-14`}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? t.hide : t.show}
            aria-pressed={visible}
            className="absolute top-1/2 right-2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-ink-3 hover:text-ink"
          >
            {visible ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
          </button>
        </div>
        {registering && (
          <p id={`${id}-pass-hint`} className="mt-1 text-sm text-ink-3">
            {t.passwordHint}
          </p>
        )}
      </div>
      {registering && (
        <div>
          <label htmlFor={`${id}-confirm`} className="mb-1.5 block font-semibold">
            {t.confirmPassword}
          </label>
          <input
            id={`${id}-confirm`}
            type={visible ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
            className={inputClass}
          />
        </div>
      )}
      <button type="submit" disabled={busy || !username || password.length < 8} className={buttonClass}>
        {busy ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : null}
        {registering ? t.createAccount : t.signIn}
        <ArrowRight className="size-5" aria-hidden="true" />
      </button>
      <p className="text-center text-sm text-ink-2">
        {registering ? t.haveAccount : t.noAccount}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(registering ? "login" : "register");
            onError(null);
          }}
          className="font-semibold text-brand hover:text-brand-strong"
        >
          {registering ? t.signIn : t.createAccount}
        </button>
      </p>
    </form>
  );
}
