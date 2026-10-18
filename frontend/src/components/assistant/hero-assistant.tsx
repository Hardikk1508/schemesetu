"use client";

import { SendHorizontal, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { LogoMark } from "@/components/logo";
import { getDictionary } from "@/lib/i18n";
import type { Lang } from "@/lib/locales";

const TYPE_MS = 45;
const HOLD_MS = 2200;

/** Home-page entry to the AI assistant: whatever is typed here opens the assistant and is sent. */
export function HeroAssistant({ lang }: { lang: Lang }) {
  const t = getDictionary(lang).assistant;
  const router = useRouter();
  const examples = t.heroExamples;
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [example, setExample] = useState(0);
  const [chars, setChars] = useState(0);

  // Type example messages into the placeholder, one after another, until the user takes over.
  useEffect(() => {
    if (focused || text || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const full = examples[example];
    const id = window.setTimeout(
      () => {
        if (chars < full.length) setChars((c) => c + 1);
        else {
          setChars(0);
          setExample((e) => (e + 1) % examples.length);
        }
      },
      chars < full.length ? TYPE_MS : HOLD_MS,
    );
    return () => window.clearTimeout(id);
  }, [focused, text, example, chars, examples]);

  function ask(message: string) {
    const m = message.trim();
    if (m) router.push(`/${lang}/assistant?q=${encodeURIComponent(m)}`);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    ask(text);
  }

  const placeholder = focused || chars === 0 ? t.placeholder : `${examples[example].slice(0, chars)}▍`;

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="absolute -inset-2 rounded-[2rem] bg-gradient-to-br from-marigold/40 via-brand/15 to-transparent blur-xl"
      />
      <section aria-labelledby="hero-ai-title" className="relative rounded-3xl border border-line bg-surface p-5 shadow-pop sm:p-6">
        <header className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-ink text-marigold">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="hero-ai-title" className="text-lg leading-tight font-bold">
              {t.heroTitle}
            </h2>
            <p className="text-sm text-ink-3">{t.heroSub}</p>
          </div>
        </header>

        <div className="mt-5 flex gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-paper">
            <LogoMark className="size-5" />
          </span>
          <p className="rounded-2xl rounded-tl-sm bg-paper px-4 py-2.5 text-ink">{t.heroGreeting}</p>
        </div>

        <form onSubmit={onSubmit} className="mt-5 flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            aria-label={t.placeholder}
            maxLength={1000}
            enterKeyHint="send"
            className="min-h-12 w-full min-w-0 rounded-full border-2 border-line-strong bg-paper px-4 outline-none placeholder:text-ink-3 focus:border-brand"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            aria-label={t.send}
            className="grid size-12 shrink-0 place-items-center rounded-full bg-brand text-white transition hover:bg-brand-strong disabled:opacity-40"
          >
            <SendHorizontal className="size-5" aria-hidden="true" />
          </button>
        </form>
      </section>
    </div>
  );
}
