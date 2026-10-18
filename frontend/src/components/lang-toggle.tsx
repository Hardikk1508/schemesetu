"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LANGS, switchLangPath, type Lang } from "@/lib/locales";

const LABELS: Record<Lang, { short: string; long: string }> = {
  en: { short: "EN", long: "English" },
  hi: { short: "हिं", long: "हिंदी" },
};

type Props = { lang: Lang; label: string };

function Toggle({ lang, label, hrefs }: Props & { hrefs: Record<Lang, string> }) {
  return (
    <nav aria-label={label} className="flex rounded-full border border-line-strong bg-surface p-0.5 text-sm">
      {LANGS.map((l) => {
        const active = l === lang;
        return (
          <Link
            key={l}
            href={hrefs[l]}
            hrefLang={l}
            lang={l}
            aria-current={active ? "true" : undefined}
            className={`rounded-full px-3 py-1 font-semibold transition-colors ${
              active ? "bg-ink text-white" : "text-ink-2 hover:text-ink"
            }`}
          >
            <span className="xl:hidden">{LABELS[l].short}</span>
            <span className="hidden xl:inline">{LABELS[l].long}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Links to the same page in the other language. Reads the URL, so render it inside <Suspense>. */
export function LangToggle(props: Props) {
  const pathname = usePathname();
  const hrefs = { en: switchLangPath(pathname, "en"), hi: switchLangPath(pathname, "hi") };
  return <Toggle {...props} hrefs={hrefs} />;
}

/** Prerendered stand-in until the URL is known: links to each language's home page. */
export function LangToggleFallback(props: Props) {
  return <Toggle {...props} hrefs={{ en: "/en", hi: "/hi" }} />;
}
