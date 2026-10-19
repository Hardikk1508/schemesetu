import Link from "next/link";
import { Suspense } from "react";

import { getDictionary } from "@/lib/i18n";
import type { Lang } from "@/lib/locales";

import { AccountLink } from "./account/header-links";
import { LangToggle, LangToggleFallback } from "./lang-toggle";
import { Wordmark } from "./logo";
import { SearchDialog } from "./search/search-dialog";
import { DesktopNav, MobileMenu, NavLinks, StickyHeader } from "./site-nav";

export function SiteHeader({ lang }: { lang: Lang }) {
  const t = getDictionary(lang);
  return (
    <StickyHeader>
      <div className="relative mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <Link href={`/${lang}`} aria-label={`${t.brand}: ${t.tagline}`} className="mr-2 shrink-0 rounded-md lg:mr-4">
          <Wordmark />
        </Link>
        <Suspense fallback={<NavLinks lang={lang} pathname={null} />}>
          <DesktopNav lang={lang} />
        </Suspense>
        <div className="ml-auto flex items-center gap-2">
          <SearchDialog lang={lang} />
          <Suspense fallback={<LangToggleFallback lang={lang} label={t.nav.language} />}>
            <LangToggle lang={lang} label={t.nav.language} />
          </Suspense>
          {/* Profile sits at the far right on desktop; below lg it lives in the menu, which takes this spot. */}
          <AccountLink lang={lang} />
          <Suspense fallback={null}>
            <MobileMenu lang={lang} />
          </Suspense>
        </div>
      </div>
    </StickyHeader>
  );
}

export function SiteFooter({ lang }: { lang: Lang }) {
  const t = getDictionary(lang);
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-ink-3 sm:px-6 md:flex-row md:items-start md:justify-between md:gap-12">
        <p className="font-semibold text-ink-2">
          {t.brand} <span className="font-normal text-ink-3">· {t.tagline}</span>
        </p>
        <p className="max-w-xl">{t.footer.disclaimer}</p>
      </div>
    </footer>
  );
}
