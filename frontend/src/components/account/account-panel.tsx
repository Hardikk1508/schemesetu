"use client";

import { ArrowRight, LoaderCircle, LogOut, MessageCircle, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { setMe, useMe } from "@/lib/account";
import { persistAnswers } from "@/lib/answers";
import { deleteAccount, logout, updateMe } from "@/lib/api";
import { getDictionary } from "@/lib/i18n";
import type { Lang } from "@/lib/locales";

export function AccountPanel({ lang }: { lang: Lang }) {
  const t = getDictionary(lang);
  const ta = t.account;
  const router = useRouter();
  const me = useMe();
  const [busy, setBusy] = useState(false);

  if (me === undefined) {
    return <div className="h-80 animate-pulse rounded-3xl border border-line bg-surface" aria-hidden="true" />;
  }
  if (me === null) {
    return (
      <div className="animate-rise rounded-3xl border border-line bg-surface p-8 text-center shadow-card">
        <p className="text-lg font-semibold">{ta.loginToSave}</p>
        <Link
          href={`/${lang}/login`}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-strong"
        >
          {t.nav.login}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  const answered = me.saved ? Object.keys(me.saved.profile).filter((k) => me.saved!.profile[k] != null).length : 0;
  const when = me.saved?.updated_at
    ? new Date(me.saved.updated_at).toLocaleString(lang === "hi" ? "hi-IN" : "en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "";

  async function toggleAlerts() {
    setBusy(true);
    try {
      setMe(await updateMe({ whatsapp_opt_in: !me!.whatsapp_opt_in, lang }));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await logout().catch(() => {});
    setMe(null);
    router.push(`/${lang}`);
  }

  async function remove() {
    if (!window.confirm(ta.confirmDelete)) return;
    await deleteAccount();
    persistAnswers(null);
    setMe(null);
    router.push(`/${lang}`);
  }

  const card = "rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-8";

  return (
    <div className="space-y-5">
      <section className={`animate-rise ${card}`}>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{ta.title}</h1>
        <p className="mt-3 text-ink-3">{ta.phone}</p>
        <p className="text-xl font-semibold">{me.phone.replace(/^\+91(\d{5})(\d{5})$/, "+91 $1 $2")}</p>
        <p className="mt-5 text-ink-3">{ta.savedAnswers}</p>
        <p className="font-semibold">{answered > 0 ? ta.savedCount(answered, when) : ta.noneSaved}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/${lang}/check`}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-strong"
          >
            {ta.continue}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link
            href={`/${lang}/assistant`}
            className="inline-flex items-center gap-2 rounded-full border border-line-strong px-5 py-2.5 font-semibold hover:border-ink-3"
          >
            {t.nav.assistant}
          </Link>
        </div>
      </section>

      <section className={`animate-rise ${card}`} style={{ animationDelay: "80ms" }}>
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ok-soft text-ok">
            <MessageCircle className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold">{ta.alertsTitle}</h2>
            <p className="mt-1 text-ink-2">{ta.alertsBody}</p>
            <button
              type="button"
              role="switch"
              aria-checked={me.whatsapp_opt_in}
              onClick={toggleAlerts}
              disabled={busy}
              className="mt-4 inline-flex items-center gap-3 font-semibold disabled:opacity-60"
            >
              <span
                className={`relative h-7 w-12 rounded-full transition-colors ${me.whatsapp_opt_in ? "bg-ok" : "bg-line-strong"}`}
              >
                <span
                  className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${
                    me.whatsapp_opt_in ? "left-6" : "left-1"
                  }`}
                />
              </span>
              {me.whatsapp_opt_in ? ta.alertsOn : ta.alertsOff}
              {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </section>

      <section className={`animate-rise flex flex-wrap gap-3 ${card}`} style={{ animationDelay: "160ms" }}>
        <button
          type="button"
          onClick={signOut}
          className="inline-flex items-center gap-2 rounded-full border border-line-strong px-5 py-2.5 font-semibold hover:border-ink-3"
        >
          <LogOut className="size-4" aria-hidden="true" />
          {ta.logout}
        </button>
        <button
          type="button"
          onClick={remove}
          className="inline-flex items-center gap-2 rounded-full border border-danger/40 px-5 py-2.5 font-semibold text-danger hover:bg-danger-soft"
        >
          <Trash2 className="size-4" aria-hidden="true" />
          {ta.delete}
        </button>
      </section>
    </div>
  );
}
