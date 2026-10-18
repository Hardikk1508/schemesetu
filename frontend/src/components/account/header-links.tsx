"use client";

import { Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useMe } from "@/lib/account";
import { getDictionary } from "@/lib/i18n";
import type { Lang } from "@/lib/locales";

/** "Log in" or "My account" in the header, depending on the session cookie. */
export function AccountLink({ lang }: { lang: Lang }) {
  const t = getDictionary(lang).nav;
  const me = useMe();
  const label = me ? t.account : t.login;
  return (
    <Link
      href={me ? `/${lang}/account` : `/${lang}/login`}
      aria-label={label}
      title={label}
      className="hidden h-9 min-w-9 place-items-center rounded-full border border-line-strong bg-surface px-2 text-sm font-semibold text-ink-2 transition-colors hover:border-ink-3 hover:text-ink lg:grid"
    >
      <UserRound className={`size-4 ${me ? "text-brand" : ""}`} aria-hidden="true" />
    </Link>
  );
}

/** "Ask AI" in the sticky header (tablet and up; phones get the floating button). */
export function AskAiLink({ lang }: { lang: Lang }) {
  const t = getDictionary(lang).assistant;
  return (
    <Link
      href={`/${lang}/assistant`}
      className="hidden h-9 items-center gap-1.5 rounded-full bg-ink px-3.5 text-sm font-semibold text-white transition hover:bg-brand-strong sm:inline-flex"
    >
      <Sparkles className="size-4 text-marigold" aria-hidden="true" />
      {t.launcherShort}
    </Link>
  );
}

/** Floating "Ask AI" button on every page except the assistant itself. Render inside <Suspense>. */
export function AssistantLauncher({ lang }: { lang: Lang }) {
  const pathname = usePathname();
  if (pathname.startsWith(`/${lang}/assistant`)) return null;
  const t = getDictionary(lang).assistant;
  return (
    <Link
      href={`/${lang}/assistant`}
      aria-label={t.launcher}
      className="animate-rise fixed right-4 bottom-4 z-40 inline-flex items-center gap-2.5 rounded-full bg-ink py-3 pr-5 pl-3.5 font-semibold text-white shadow-pop ring-4 ring-marigold/30 transition hover:-translate-y-0.5 hover:bg-brand-strong sm:right-6 sm:bottom-6"
      style={{ animationDelay: "600ms" }}
    >
      <span className="relative grid size-7 place-items-center rounded-full bg-marigold/20">
        <span className="absolute inset-0 animate-ping rounded-full bg-marigold/30" aria-hidden="true" />
        <Sparkles className="relative size-4 text-marigold" aria-hidden="true" />
      </span>
      <span className="sm:hidden">{t.launcherShort}</span>
      <span className="hidden sm:inline">{t.launcher}</span>
    </Link>
  );
}
