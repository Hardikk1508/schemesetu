"use client";

import { RotateCcw } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect } from "react";

import { getDictionary } from "@/lib/i18n";
import { DEFAULT_LANG, isLang } from "@/lib/locales";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  const params = useParams<{ lang: string }>();
  const t = getDictionary(isLang(params.lang) ? params.lang : DEFAULT_LANG).errors;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
      <p className="mt-3 text-lg text-ink-2">{t.body}</p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-strong"
      >
        <RotateCcw className="size-4" aria-hidden="true" />
        {t.retry}
      </button>
    </div>
  );
}
