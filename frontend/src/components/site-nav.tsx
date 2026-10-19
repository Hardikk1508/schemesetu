"use client";

import { Menu, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useMe } from "@/lib/account";
import { getDictionary } from "@/lib/i18n";
import type { Lang } from "@/lib/locales";

type NavItem = { href: string; label: string; active: (path: string) => boolean };

function navItems(lang: Lang): NavItem[] {
  const t = getDictionary(lang).nav;
  return [
    { href: `/${lang}#topics`, label: t.topics, active: (p) => p.startsWith(`/${lang}/topics`) },
    { href: `/${lang}/schemes`, label: t.schemes, active: (p) => p.startsWith(`/${lang}/schemes`) },
    { href: `/${lang}/check`, label: t.check, active: (p) => p.startsWith(`/${lang}/check`) },
  ];
}

/** Sticky header shell that gains a shadow once the page scrolls. */
export function StickyHeader({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const onScroll = () => ref.current?.toggleAttribute("data-scrolled", window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      ref={ref}
      className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md transition-shadow duration-300 supports-[backdrop-filter]:bg-paper/70 data-scrolled:shadow-[0_6px_24px_-12px_rgb(20_33_61/0.25)]"
    >
      {children}
    </header>
  );
}

/** Main links (desktop). Highlights the current section; render inside <Suspense> (reads the URL). */
export function DesktopNav({ lang }: { lang: Lang }) {
  const pathname = usePathname();
  return <NavLinks lang={lang} pathname={pathname} />;
}

export function NavLinks({ lang, pathname }: { lang: Lang; pathname: string | null }) {
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
      {navItems(lang).map((item) => {
        const active = pathname ? item.active(pathname) : false;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
              active ? "bg-ink/[0.07] text-ink" : "text-ink-2 hover:bg-ink/[0.05] hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Menu for phones and tablets: every link the desktop header shows, plus account. Ask AI is the floating button. */
export function MobileMenu({ lang }: { lang: Lang }) {
  const t = getDictionary(lang).nav;
  const pathname = usePathname();
  const me = useMe();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const items: NavItem[] = [
    { href: `/${lang}`, label: t.home, active: (p) => p === `/${lang}` },
    ...navItems(lang),
    me
      ? { href: `/${lang}/account`, label: t.account, active: (p) => p.startsWith(`/${lang}/account`) }
      : { href: `/${lang}/login`, label: t.login, active: (p) => p.startsWith(`/${lang}/login`) },
  ];

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? t.closeMenu : t.menu}
        className="grid size-9 place-items-center rounded-full border border-line-strong bg-surface text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
      >
        {open ? <X className="size-4" aria-hidden="true" /> : <Menu className="size-4" aria-hidden="true" />}
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="animate-fade fixed inset-x-0 top-16 bottom-0 z-30 bg-ink/20"
          />
          <div
            id="mobile-menu"
            className="animate-rise absolute inset-x-0 top-full z-40 border-b border-line bg-paper px-4 pt-2 pb-5 shadow-pop sm:px-6"
          >
            <nav aria-label={t.menu} className="mx-auto grid max-w-6xl gap-1">
              {items.map((item) => {
                const active = item.active(pathname);
                const icon =
                  item.href.endsWith("/login") || item.href.endsWith("/account") ? (
                    <UserRound className="size-4" aria-hidden="true" />
                  ) : null;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2 rounded-xl px-4 py-3 text-lg font-semibold transition-colors ${
                      active ? "bg-ink/[0.07] text-ink" : "text-ink-2 hover:bg-ink/[0.05] hover:text-ink"
                    }`}
                  >
                    {icon}
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
