"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { getDictionary } from "@/lib/i18n";
import { DEFAULT_LANG, isLang } from "@/lib/locales";

export default function NotFound() {
  const params = useParams<{ lang: string }>();
  const lang = isLang(params.lang) ? params.lang : DEFAULT_LANG;
  const t = getDictionary(lang).errors;
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{t.notFoundTitle}</h1>
      <p className="mt-3 text-lg text-ink-2">{t.notFoundBody}</p>
      <Link
        href={`/${lang}`}
        className="mt-8 inline-block rounded-full bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-strong"
      >
        {t.home}
      </Link>
    </div>
  );
}
